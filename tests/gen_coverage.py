#!/usr/bin/env python3
"""Coverage questions: every piece of knowledge is asked about, in several wordings.

Writes tests/qa_coverage.json from the built index:
  * every YouTube video   → "Do you have a video about <title>?"  must cite that video
  * every public repo     → "What is your <repo> project?"         must cite that repo
  * every README section  → "<repo>: <section>?"                    must cite that repo
  * every curated answer  → each of its questions, plus wording variants (you ↔ Prashobh,
                            polite prefixes, lower case, no punctuation): all must land
                            on the same curated answer.
Run after `python -m pipeline.build_index ...`; evaluate with
`node tests/qa_eval.mjs tests/qa_coverage.json`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
idx = json.loads((ROOT / "site/data/index.json").read_text(encoding="utf-8"))


def clean_title(t: str) -> str:
    t = re.sub(r"[\U0001F300-\U0001FAFF☀-➿]", "", t)
    t = re.split(r"\s*(\|\||\||#)\s*", t)[0]
    return re.sub(r"\s+", " ", t).strip(" .…-–—")


def you_to_him(q: str) -> str:
    q = re.sub(r"\byour\b", "Prashobh's", q)
    q = re.sub(r"\b(do|did|have|are|were|can|would)\s+you\b", r"\1es Prashobh" if False else r"\1 Prashobh", q)
    q = re.sub(r"\byou\b", "Prashobh", q)
    return q.replace("are Prashobh", "is Prashobh").replace("do Prashobh", "does Prashobh").replace("have Prashobh", "has Prashobh")


def him_to_you(q: str) -> str:
    q = re.sub(r"\bPrashobh(?: Paul)?'s\b", "your", q)
    q = re.sub(r"\b(does|did|has|is|was|can|would)\s+Prashobh(?: Paul)?\b",
               lambda m: {"does": "do", "has": "have", "is": "are", "was": "were"}.get(m.group(1), m.group(1)) + " you", q)
    return re.sub(r"\bPrashobh(?: Paul)?\b", "you", q)


def variants(q: str) -> list[str]:
    base = q.strip()
    out = {base, base.lower().rstrip("?") , "Can you tell me " + base[0].lower() + base[1:].rstrip("?") + "?",
           "Quick question: " + base}
    swapped = him_to_you(base) if "Prashobh" in base else you_to_him(base)
    if swapped != base:
        out.add(swapped)
    return [v for v in out if v]


cases, seen = [], set()


def add(c: dict) -> None:
    if c["q"] not in seen:
        seen.add(c["q"])
        cases.append(c)


for e in idx["canon"]:
    for q in e.get("questions", []):
        for v in variants(q):
            add({"q": v, "id": e["id"], "kind": "variant"})

for c in idx["chunks"]:
    m = c.get("meta") or {}
    if m.get("record_type") == "video":
        t = clean_title(c.get("document_name") or "")
        if len(t.split()) >= 2:
            add({"q": f"Do you have a video about {t}?", "cite": m.get("video_id"), "kind": "video"})
    elif m.get("record_type") == "repository":
        name = (c.get("document_name") or "").replace("GitHub · ", "")
        human = re.sub(r"([a-z])([A-Z])", r"\1 \2", name).replace("_", " ").replace("-", " ")
        add({"q": f"What is your {human} project on GitHub?", "cite": f"github.com/PrashobhPaul/{name}", "kind": "repo"})

json.dump({"cases": cases, "no_answer": []}, open(ROOT / "tests/qa_coverage.json", "w"), indent=1, ensure_ascii=False)
print(f"{len(cases)} coverage questions: "
      + ", ".join(f"{k} {sum(1 for c in cases if c['kind'] == k)}" for k in ("variant", "video", "repo")))
