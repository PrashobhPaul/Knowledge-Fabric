"""GitHub connector — public repositories as project records.

The repository name is resolved through the ontology so "InvestIQ" (GitHub)
and "Invest.IQ" (website) land on one Project node. That join is the point:
the website says what the project is for, the repository says how it is built
and when it last moved.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Iterator

from .. import ontology
from .base import KnowledgeRecord, sanitize

DETECT_KINDS = ("Technology", "Domain", "Project", "Organization")


def _d(iso: str | None) -> tuple[str, str]:
    if not iso:
        return "", ""
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return d.strftime("%B %Y"), str(d.year)
    except ValueError:
        return iso[:10], iso[:4]


def _readme_excerpt(md: str, cap: int = 700) -> str:
    if not md:
        return ""
    t = re.sub(r"```.*?```", " ", md, flags=re.S)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", t)              # images
    t = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", t)            # links -> text
    t = re.sub(r"<[^>]+>", " ", t)                            # html
    t = re.sub(r"^\s*#+\s*", "", t, flags=re.M)               # headings
    t = re.sub(r"[*_`>|-]{1,}", " ", t)
    t = sanitize(t)
    return t[:cap].rsplit(" ", 1)[0] + ("…" if len(t) > cap else "")


class GitHubConnector:
    name = "GitHub"
    source_type = "github"

    def __init__(self, path: Path):
        data = json.loads(Path(path).read_text(encoding="utf-8"))
        self.user = data.get("user", "")
        self.repos = data.get("repos", [])
        self.name = f"GitHub · {self.user}" if self.user else "GitHub"

    def fetch(self) -> Iterator[KnowledgeRecord]:
        for r in self.repos:
            if r.get("fork"):
                continue
            name = sanitize(r["name"])
            canon = ontology.canonical("Project", name) or name.replace("_", " ").replace("-", " ")
            lang = sanitize(r.get("language"))
            desc = sanitize(r.get("description"))
            created, cyear = _d(r.get("created_at"))
            pushed, pyear = _d(r.get("pushed_at"))
            topics = [sanitize(t) for t in (r.get("topics") or [])]
            readme = _readme_excerpt(r.get("readme") or "")

            text = (f"{name} is a public GitHub repository by {ontology.PERSON}"
                    f"{' written mainly in ' + lang if lang else ''}"
                    f"{', created in ' + created if created else ''}"
                    f"{' and last updated in ' + pushed if pushed else ''}. ")
            if canon != name:
                text += f"It is the code behind the project {canon}. "
            if desc:
                text += desc.rstrip(".") + ". "
            if topics:
                text += f"Topics: {', '.join(topics)}. "
            if readme:
                text += f"From its README: {readme}"
            if r.get("stargazers_count"):
                text += f" It has {r['stargazers_count']} star{'s' if r['stargazers_count'] != 1 else ''}."
            text = sanitize(text)

            ents = [("Person", ontology.PERSON), ("Project", canon), ("Platform", "GitHub")]
            if lang:
                ents.append(("Technology", ontology.canonical("Technology", lang) or lang))
            ents += [e for e in ontology.detect(f"{desc} {readme} {' '.join(topics)}", DETECT_KINDS) if e not in ents]
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=self.name, source_id=f"repo:{r.get('full_name', name)}",
                title=name, text=text, section_path=["GitHub", "Repositories", name], url=r.get("html_url", ""),
                metadata={"record_type": "repository", "document_name": f"GitHub · {name}", "domain": "Code",
                          "project": canon, "technology": [lang] if lang else [], "language": lang,
                          "year": pyear or cyear, "published": r.get("pushed_at") or r.get("created_at") or "",
                          "created": r.get("created_at", ""), "pushed": r.get("pushed_at", ""),
                          "stars": r.get("stargazers_count", 0), "archived": bool(r.get("archived"))},
                entities=ents)
