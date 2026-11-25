"""Code connector — README sections and code excerpts of the public repositories.

Reads knowledge_sources/github/code.json (written by the Factory's github_code
source). Each README section becomes a record ("Koode · How it works"), and each
representative source file becomes a code record whose text names the repo, the
file, its language and symbols, followed by the excerpt itself, so "show me how
you wrote the agents" retrieves the real file with a permalink to its lines.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterator

from .. import ontology
from .base import KnowledgeRecord, sanitize


def _slug(t: str) -> str:
    return re.sub(r"[^\w\- ]", "", t.lower()).strip().replace(" ", "-")


class CodeConnector:
    name = "GitHub code"
    source_type = "github"

    def __init__(self, path: Path):
        self.path = Path(path)
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self.repos = data.get("repos", [])
        meta = json.loads((self.path.parent / "repos.json").read_text(encoding="utf-8")) if (self.path.parent / "repos.json").exists() else {}
        rows = meta.get("repos", meta) if isinstance(meta, dict) else meta
        self.pushed = {x.get("name"): (x.get("pushed_at") or x.get("updated_at") or "")[:10] for x in rows or []}

    def fetch(self) -> Iterator[KnowledgeRecord]:
        for r in self.repos:
            repo = r.get("name", "")
            project = ontology.canonical("Project", repo)
            proj = project or repo
            ents = [("Project", proj)]
            dated = {"date": self.pushed.get(repo, ""), "published": self.pushed.get(repo, ""), "date_source": "github"} if self.pushed.get(repo) else {}
            for sec in r.get("readme") or []:
                title = sec.get("title") or "Overview"
                url = (r.get("readme_url") or r.get("url", "")) + (f"#{_slug(title)}" if title != "Overview" else "")
                yield KnowledgeRecord(
                    source_type=self.source_type, source_system="GitHub README", source_id=f"readme:{repo}:{_slug(title)}",
                    title=f"{proj} · {title}", text=sanitize(f"{proj} — {title}. {sec.get('text', '')}"),
                    section_path=["GitHub", repo, "README", title], url=url,
                    metadata={"record_type": "readme_section", "repository": repo, "project": proj, "section": title,
                              "document_name": f"{repo} README", **dated},
                    entities=ents)
            for f in r.get("files") or []:
                syms = ", ".join(f.get("symbols") or [])
                lang = f.get("language", "")
                head = f"{proj} source code: {f['path']} ({lang})." + (f" It defines {syms}." if syms else "")
                yield KnowledgeRecord(
                    source_type=self.source_type, source_system="GitHub code", source_id=f"code:{repo}:{f['path']}",
                    title=f"{proj} · {f['path']}", text=sanitize(head + "\n" + (f.get("excerpt") or ""))[:4000],
                    section_path=["GitHub", repo, f["path"]], url=f.get("url", ""),
                    metadata={"record_type": "code", "repository": repo, "project": proj, "path": f["path"],
                              "language": lang, "symbols": f.get("symbols") or [], "lines": f.get("lines") or [],
                              "excerpt": f.get("excerpt", ""), "document_name": f"{repo}/{f['path']}", **dated},
                    entities=ents + [("Technology", {"python": "Python", "kotlin": "Kotlin", "typescript": "TypeScript",
                                                     "javascript": "JavaScript"}.get(lang, lang))])
