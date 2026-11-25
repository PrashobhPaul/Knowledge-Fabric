"""Curator — the step that turns flags into knowledge, on a schedule.

    python -m knowledge_factory.curator                   # read GitHub flags, re-check, write ledger
    python -m knowledge_factory.curator --close           # also close issues the sync has fixed
    python -m knowledge_factory.curator --offline FILE    # use a local flags file (tests, dry runs)

The loop in the diagram:

    agents leave traces and flags  ->  curator reads them  ->  changes  ->  next run uses the fix

Here a flag is a GitHub Issue labelled `knowledge-flag` (the site opens one,
pre-filled, when a visitor clicks "Flag this answer"). The curator:

  1. pulls every open flag into knowledge_sources/flags/flags.json — the ledger;
  2. re-asks each flagged question against the CURRENT index with the same
     lexical + semantic retrieval the site uses, and scores answerability;
  3. marks a flag `resolved` when the fresh sources now cover it (and, with
     --close, closes the issue with a comment saying which sync fixed it);
  4. writes knowledge_sources/flags/proposals.md — a profile.yaml stub per open
     flag, for a human to complete. The curator proposes; it never invents facts.

Resolved flags are not thrown away: tests/integration.test.mjs re-asks every
resolved question on every build, so a fixed gap cannot silently reopen.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from .common import now_iso, read_json, write_json

ROOT = Path(__file__).resolve().parents[1]
FLAGS_DIR = ROOT / "knowledge_sources" / "flags"
LEDGER = FLAGS_DIR / "flags.json"
PROPOSALS = FLAGS_DIR / "proposals.md"
LABEL = "knowledge-flag"

# Answerability floor. Mirrors the site's "low confidence" band (45%) in spirit:
# a flag is resolved only when retrieval is decisive AND the answer covers the
# question's content words. Both thresholds are deliberately conservative — a
# false "resolved" closes a real gap; a false "open" costs a human one glance.
MIN_SCORE = 0.60
MIN_COVERAGE = 0.5

FUNCTION_WORDS = {
    # The person's own name is in every record — never evidence that a question is covered.
    'prashobh', 'paul', 'prashobhs', 'given', 'ever', 'any',
    
    "the", "a", "an", "and", "or", "but", "if", "then", "of", "to", "in", "on", "at", "by", "for",
    "with", "is", "are", "was", "were", "be", "been", "being", "it", "its", "this", "that", "these",
    "those", "as", "from", "so", "than", "too", "very", "can", "will", "just", "what", "which", "who",
    "how", "when", "where", "why", "does", "did", "do", "has", "have", "had", "he", "his", "him",
    "prashobh", "paul", "me", "i", "you", "about", "any", "some",
}


# --------------------------------------------------------------------------- GitHub
def _gh(path: str, method: str = "GET", body: dict | None = None) -> dict | list:
    import requests
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    repo = os.environ.get("GITHUB_REPOSITORY", "PrashobhPaul/Prashobh_Knowledge_Factory")
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "knowledge-curator/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"https://api.github.com/repos/{repo}{path}"
    resp = requests.request(method, url, headers=headers, json=body, timeout=30)
    resp.raise_for_status()
    return resp.json() if resp.text else {}


FIELD_RE = re.compile(r"###\s*(.+?)\s*\n+(.*?)(?=\n###|\Z)", re.S)


def parse_issue(issue: dict) -> dict:
    """Issue-form bodies render as '### Label\\n\\nvalue' blocks."""
    fields = {k.strip().lower(): v.strip() for k, v in FIELD_RE.findall(issue.get("body") or "")}
    question = fields.get("question asked") or re.sub(r"^\[flag\]\s*", "", issue.get("title", "")).strip()
    kind = (fields.get("what went wrong") or "missing").split(" ")[0].lower()
    trace = fields.get("trace (filled in automatically when flagged from the site)", "")
    trace = re.sub(r"^```\w*\n?|```$", "", trace.strip())
    try:
        trace_obj = json.loads(trace) if trace else None
    except json.JSONDecodeError:
        trace_obj = None
    return {
        "id": issue["number"], "url": issue.get("html_url", ""), "question": question, "kind": kind,
        "expected": fields.get("what the answer should have been (if you know)", ""),
        "reported_confidence": fields.get("confidence the fabric reported", ""),
        "trace": trace_obj, "opened_at": issue.get("created_at", ""),
        "reporter": (issue.get("user") or {}).get("login", ""),
    }


def fetch_flags() -> list[dict]:
    issues = _gh(f"/issues?labels={LABEL}&state=open&per_page=100")
    return [parse_issue(i) for i in issues if "pull_request" not in i]


# --------------------------------------------------------------------------- re-check
class Checker:
    """Re-asks a question against the built index with the pipeline's own retrievers."""

    def __init__(self, index_path: Path, semantic_path: Path):
        sys.path.insert(0, str(ROOT))
        from eval.evaluate import BM25, rrf
        from pipeline.semantic import embed_query, semantic_scores
        self.index = json.loads(index_path.read_text(encoding="utf-8"))
        self.semantic = json.loads(semantic_path.read_text(encoding="utf-8")) if semantic_path.exists() else {"enabled": False}
        self.chunks = self.index["chunks"]
        self.bm25 = BM25(self.index["bm25"])
        self._rrf, self._embed, self._scores = rrf, embed_query, semantic_scores

    def check(self, question: str) -> dict:
        tokens = [t for t in re.findall(r"[\w\u0900-\u0DFF]+", question.lower()) if len(t) > 1 and t not in FUNCTION_WORDS]
        lex = self.bm25.search(question, 20)
        sem = []
        if self.semantic.get("enabled"):
            qv = self._embed(self.semantic, question)
            if qv is not None:
                sc = self._scores(self.semantic, qv)
                order = sc.argsort()[::-1][:20]
                sem = [{"id": int(i), "score": float(sc[i])} for i in order if sc[i] > 0.01]
        runs = [r for r in (lex, sem) if r]
        fused = self._rrf(runs, top_k=5) if runs else []
        if not fused or not tokens:
            return {"score": 0.0, "coverage": 0.0, "top": None, "resolved": False}
        top = self.chunks[fused[0]["id"]]
        text = " ".join(self.chunks[f["id"]]["text"].lower() for f in fused[:3])
        covered = sum(1 for t in tokens if re.search(rf"\b{re.escape(t[:5])}", text))
        coverage = covered / len(tokens)
        # Decisiveness: how far the best lexical hit stands above the field.
        lex_scores = [h["score"] for h in lex[:5]]
        margin = (lex_scores[0] - (sum(lex_scores[1:]) / max(len(lex_scores) - 1, 1))) / lex_scores[0] if lex_scores and lex_scores[0] > 0 else 0.0
        agreement = len(fused[0].get("retrievers", [])) if isinstance(fused[0], dict) and "retrievers" in fused[0] else (1 + int(bool(sem and lex)))
        score = round(min(1.0, 0.45 * coverage + 0.35 * max(0.0, margin) + 0.20 * (agreement / 2)), 3)
        return {
            "score": score, "coverage": round(coverage, 3), "margin": round(max(0.0, margin), 3),
            "top": {"document": top["document_name"], "record_type": (top.get("meta") or {}).get("record_type"),
                    "url": top.get("url", ""), "excerpt": top["text"][:200]},
            "resolved": score >= MIN_SCORE and coverage >= MIN_COVERAGE,
        }


# --------------------------------------------------------------------------- proposals
def proposal_stub(flag: dict) -> str:
    q = flag["question"]
    key = re.sub(r"[^a-z0-9]+", "_", q.lower()).strip("_")[:48] or f"flag_{flag['id']}"
    expected = flag.get("expected") or "<fill in the fact, or delete this block if it should stay unanswered>"
    return f"""### Flag #{flag['id']} · {flag['kind']} · {q}

Reporter: {flag.get('reporter') or 'site visitor'} · opened {flag.get('opened_at', '')[:10]} · {flag.get('url', '')}
Re-check: score {flag['check']['score']} · coverage {flag['check']['coverage']} · nearest record: {(flag['check'].get('top') or {}).get('document', '—')}

Proposed addition to `knowledge_sources/profile/profile.yaml` (edit, then move under the right section):

```yaml
# {key}
- name: "{q.rstrip('?')}"
  description: >-
    {expected}
  source: ["curator-flag-{flag['id']}"]
```
"""


def write_proposals(flags: list[dict], out_dir: Path = FLAGS_DIR) -> int:
    proposals = Path(out_dir) / "proposals.md"
    open_flags = [f for f in flags if f["status"] == "open"]
    header = (
        "# Curator proposals\n\n"
        f"Generated {now_iso()} by `knowledge_factory.curator`. "
        f"{len(open_flags)} open flag{'s' if len(open_flags) != 1 else ''} the current sources do not cover.\n\n"
        "Each block below is a stub. A human completes the fact (the curator never invents one), "
        "adds it to `profile.yaml` or the right source, and the next build closes the flag automatically.\n\n"
    )
    body = "\n".join(proposal_stub(f) for f in open_flags) if open_flags else "_No open gaps. Every flagged question is now answerable._\n"
    proposals.parent.mkdir(parents=True, exist_ok=True)
    proposals.write_text(header + body, encoding="utf-8")
    return len(open_flags)


# --------------------------------------------------------------------------- main
def run(flags: list[dict], index_path: Path, semantic_path: Path, close: bool = False,
        out_dir: Path = FLAGS_DIR) -> dict:
    ledger_path = Path(out_dir) / "flags.json"
    prev = {f["id"]: f for f in read_json(ledger_path, {"flags": []}).get("flags", [])}
    checker = Checker(index_path, semantic_path)
    out = []
    for f in flags:
        f["check"] = checker.check(f["question"])
        was = prev.get(f["id"], {})
        f["status"] = "resolved" if f["check"]["resolved"] else "open"
        f["first_seen"] = was.get("first_seen") or now_iso()
        f["last_checked"] = now_iso()
        if f["status"] == "resolved":
            f["resolved_at"] = was.get("resolved_at") or now_iso()
            if close and was.get("status") != "resolved":
                top = f["check"]["top"] or {}
                _gh(f"/issues/{f['id']}/comments", "POST", {"body": (
                    f"The curator re-checked this question against the current sources and it is now covered "
                    f"(answerability {f['check']['score']:.2f}, nearest record: {top.get('document', '—')}"
                    f"{' — ' + top['url'] if top.get('url') else ''}). "
                    f"It stays in the ledger as a regression check so the gap cannot reopen silently.\n\n"
                    f"---\n_Generated by [Claude Code](https://claude.ai/code)_")})
                _gh(f"/issues/{f['id']}", "PATCH", {"state": "closed", "state_reason": "completed"})
                f["closed_issue"] = True
        out.append(f)
    # Keep previously resolved flags that are no longer open issues: they are the regression set.
    seen = {f["id"] for f in out}
    for pid, pf in prev.items():
        if pid not in seen and pf.get("status") == "resolved":
            pf["check"] = checker.check(pf["question"])
            pf["status"] = "resolved" if pf["check"]["resolved"] else "regressed"
            pf["last_checked"] = now_iso()
            out.append(pf)
    out.sort(key=lambda f: (f["status"] != "open", f["status"] != "regressed", -int(f["id"])))
    ledger = {
        "generated_at": now_iso(), "generator": "knowledge-curator/1.0",
        "summary": {s: sum(1 for f in out if f["status"] == s) for s in ("open", "resolved", "regressed")},
        "flags": out,
    }
    write_json(ledger_path, ledger)
    n_open = write_proposals(out, out_dir)
    return {"ledger": ledger, "open": n_open}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Curate knowledge flags against the current fabric")
    ap.add_argument("--offline", type=Path, help="JSON file with a list of flags instead of GitHub issues")
    ap.add_argument("--index", type=Path, default=ROOT / "site" / "data" / "index.json")
    ap.add_argument("--semantic", type=Path, default=ROOT / "site" / "data" / "semantic.json")
    ap.add_argument("--close", action="store_true", help="close GitHub issues the sync has resolved")
    ap.add_argument("--out-dir", type=Path, default=FLAGS_DIR, help="where flags.json and proposals.md go")
    args = ap.parse_args(argv)

    if not args.index.exists():
        print(f"[!] {args.index} not found — run: python -m pipeline.build_index", file=sys.stderr)
        return 2

    print("=" * 66)
    print("  KNOWLEDGE CURATOR")
    print("=" * 66)
    if args.offline:
        raw = json.loads(args.offline.read_text(encoding="utf-8"))
        flags = [parse_issue(i) if "body" in i else i for i in (raw if isinstance(raw, list) else raw.get("flags", []))]
        print(f"  source   {args.offline} ({len(flags)} flags)")
    else:
        flags = fetch_flags()
        print(f"  source   GitHub issues labelled {LABEL} ({len(flags)} open)")

    result = run(flags, args.index, args.semantic, close=args.close, out_dir=args.out_dir)
    s = result["ledger"]["summary"]
    for f in result["ledger"]["flags"]:
        print(f"  #{f['id']:<5} {f['status']:<9} score={f['check']['score']:.2f} cov={f['check']['coverage']:.2f}  {f['question'][:60]}")
    print(f"\n  open {s['open']} · resolved {s['resolved']} · regressed {s['regressed']}")
    print(f"[OK] {Path(args.out_dir) / 'flags.json'}")
    print(f"[OK] {Path(args.out_dir) / 'proposals.md'}")
    print("=" * 66)
    return 0 if s["regressed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
