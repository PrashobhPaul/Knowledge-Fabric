"""GitHub code — READMEs, representative source files and images of the public repos.

The repository list (repos.json) says a project exists; this source says how it
is built. For every public repository it takes a shallow clone and keeps:

  * the README, split into sections (what the project does, how it works),
  * up to MAX_FILES representative source files (entry points, agents,
    pipelines, view models), each as a short excerpt with its symbols and a
    permalink, so "show me how you build an agent" can be answered with real code,
  * images that explain the work (architecture, screens, previews), by raw URL.

Private repositories cannot be cloned and are skipped: their code stays private.
Output: knowledge_sources/github/code.json. Nothing is generated; every excerpt
is the file as committed, cut at a line boundary.
"""
from __future__ import annotations

import re
import subprocess
import tempfile
from pathlib import Path

from ..common import SyncResult, read_json, write_json

MAX_FILES = 4
MAX_LINES = 60
README_CAP = 2600          # words kept per README
CODE_EXT = {".py": "python", ".ts": "typescript", ".tsx": "typescript", ".kt": "kotlin", ".js": "javascript"}
IMG_EXT = {".png", ".svg", ".jpg", ".jpeg", ".gif", ".webp"}
SKIP_DIR = re.compile(r"(^|/)(node_modules|\.git|dist|build|out|vendor|\.next|coverage|__pycache__|test|tests|"
                      r"androidTest|\.gradle|gradle|public/assets|venv|\.venv|migrations)(/|$)", re.I)
GOOD_NAME = re.compile(r"(main|app|agent|pipeline|graph|engine|core|service|model|predict|score|search|"
                       r"index|router|orchestr|planner|viewmodel|repository|analy[sz]|retriev|rag|server)", re.I)
IMG_GOOD = re.compile(r"(arch|diagram|flow|screen|preview|demo|pipeline|overview|workflow|explainer|results|banner)", re.I)
# Repositories that are client work or demos for others are never mined for code.
EXCLUDE = {"SDLC_Lifecycle__KiroAutomation", "novabiomedicaldocs_demo"}


def _score_file(rel: str, text: str) -> float:
    s = 0.0
    name = rel.rsplit("/", 1)[-1]
    if GOOD_NAME.search(name):
        s += 3
    if rel.count("/") <= 2:
        s += 1
    n = text.count("\n")
    if 30 <= n <= 900:
        s += 2
    if re.search(r"^\s*(def |class |fun |export (async )?function |export class |async def )", text, re.M):
        s += 2
    if re.search(r"(generated|auto-generated|do not edit)", text[:400], re.I):
        s -= 10
    return s


def _symbols(text: str, lang: str) -> list[str]:
    pat = {
        "python": r"^\s*(?:async\s+)?(?:def|class)\s+([A-Za-z_]\w*)",
        "kotlin": r"^\s*(?:(?:private|public|internal|suspend|override|data|sealed|open)\s+)*(?:fun|class|object|interface)\s+([A-Za-z_]\w*)",
    }.get(lang, r"^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|interface|type)\s+([A-Za-z_]\w*)")
    return list(dict.fromkeys(re.findall(pat, text, re.M)))[:12]


def _excerpt(text: str) -> tuple[str, int, int]:
    """The first meaningful block: skip license headers and imports, keep up to MAX_LINES."""
    lines = text.splitlines()
    start = 0
    for i, ln in enumerate(lines):
        if re.match(r"\s*(def |class |fun |export |async def |@|const |function |object |interface )", ln):
            # keep a docstring / comment block just above the first definition
            j = i
            while j > 0 and (lines[j - 1].strip().startswith(("#", "//", "*", "/*", '"""', "'''")) or not lines[j - 1].strip()):
                j -= 1
            start = j
            break
    end = min(len(lines), start + MAX_LINES)
    return "\n".join(lines[start:end]).rstrip(), start + 1, end


def _readme_sections(md: str) -> list[dict]:
    md = re.sub(r"<!--.*?-->", "", md, flags=re.S)
    parts = re.split(r"^(#{1,3})\s+(.+)$", md, flags=re.M)
    out, words = [], 0
    head = "Overview"
    chunks = [(head, parts[0])] + [(parts[i + 1].strip(), parts[i + 2]) for i in range(1, len(parts) - 2, 3)]
    for title, body in chunks:
        t = re.sub(r"```.*?```", " ", body, flags=re.S)
        t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)
        t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)
        t = re.sub(r"<[^>]+>", " ", t)
        t = re.sub(r"[*_`>|]+", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        if len(t.split()) < 12:
            continue
        w = t.split()
        if words + len(w) > README_CAP:
            w = w[: max(0, README_CAP - words)]
        if not w:
            break
        words += len(w)
        out.append({"title": re.sub(r"[#*`]", "", title).strip()[:90], "text": " ".join(w)})
    return out


def _mine(repo: dict, root: Path, branch: str) -> dict:
    name, base = repo["name"], repo.get("html_url") or f"https://github.com/{repo.get('full_name', '')}"
    owner_repo = base.rstrip("/").split("github.com/")[-1]
    blob = f"{base.rstrip('/')}/blob/{branch}/"
    raw = f"https://raw.githubusercontent.com/{owner_repo}/{branch}/"
    readme = next((p for p in root.iterdir() if p.name.lower().startswith("readme")), None)
    sections = _readme_sections(readme.read_text(encoding="utf-8", errors="ignore")) if readme else []

    cands = []
    for p in root.rglob("*"):
        rel = p.relative_to(root).as_posix()
        if not p.is_file() or SKIP_DIR.search(rel) or p.suffix.lower() not in CODE_EXT or p.name.endswith(".min.js") \
                or re.search(r"(\.(test|spec)\.|^test_|_test\.py$|^sw\.js$)", p.name):
            continue
        if p.stat().st_size > 120_000:
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        cands.append((_score_file(rel, text), rel, text, CODE_EXT[p.suffix.lower()]))
    cands.sort(key=lambda c: (-c[0], c[1]))
    files = []
    for score, rel, text, lang in cands[:MAX_FILES]:
        if score < 2:
            continue
        ex, a, b = _excerpt(text)
        files.append({"path": rel, "language": lang, "url": f"{blob}{rel}#L{a}-L{b}", "lines": [a, b],
                      "symbols": _symbols(text, lang), "excerpt": ex})

    images = []
    for p in root.rglob("*"):
        rel = p.relative_to(root).as_posix()
        if p.is_file() and p.suffix.lower() in IMG_EXT and not SKIP_DIR.search(rel) and IMG_GOOD.search(rel) \
                and "icon" not in rel.lower() and "logo" not in rel.lower() and p.stat().st_size < 3_000_000:
            images.append({"path": rel, "url": raw + rel, "kind": "architecture" if re.search(r"arch|diagram|flow|pipeline", rel, re.I)
                           else "screen" if re.search(r"screen|preview|demo|results|explainer", rel, re.I) else "banner"})
    images.sort(key=lambda i: ({"architecture": 0, "screen": 1, "banner": 2}[i["kind"]], i["path"]))
    return {"name": name, "url": base, "branch": branch, "readme_url": f"{blob}{readme.name}" if readme else "",
            "readme": sections, "files": files, "images": images[:8]}


def sync(config: dict, out_dir: Path, repo_root: Path) -> SyncResult:
    res = SyncResult("github_code")
    gh_dir = out_dir / "github"
    repos = read_json(gh_dir / "repos.json", {"repos": []})
    repos = repos.get("repos", repos) if isinstance(repos, dict) else repos
    out = []
    with tempfile.TemporaryDirectory(prefix="kf-code-") as tmp:
        for r in repos:
            name = r.get("name")
            if not name or name in EXCLUDE or r.get("fork") or r.get("private"):
                continue
            url = (r.get("html_url") or f"https://github.com/{r.get('full_name')}") + ".git"
            dest = Path(tmp) / name
            ok = subprocess.run(["git", "clone", "-q", "--depth", "1", url, str(dest)],
                                capture_output=True, text=True, timeout=180).returncode == 0
            if not ok:
                res.notes.append(f"{name}: not public, skipped")
                continue
            branch = subprocess.run(["git", "-C", str(dest), "rev-parse", "--abbrev-ref", "HEAD"],
                                    capture_output=True, text=True).stdout.strip() or "main"
            out.append(_mine(r, dest, branch))
    write_json(gh_dir / "code.json", {"repos": out})
    res.records = sum(len(x["files"]) + len(x["readme"]) for x in out)
    res.files.append("github/code.json")
    res.notes.append(f"{len(out)} public repositories mined: "
                     f"{sum(len(x['files']) for x in out)} code excerpts, {sum(len(x['readme']) for x in out)} README sections, "
                     f"{sum(len(x['images']) for x in out)} images")
    return res
