"""Website connector — reads what the Knowledge Factory crawled from the personal site.

Three record shapes come out of one site:
    web_paragraph   a paragraph under a heading path (packed into chunks like a document)
    project         a portfolio card, atomic — one complete thought per project
    faq             the site assistant's hand-written Q&A, atomic
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterator
from urllib.parse import urlparse

from .. import ontology
from .base import KnowledgeRecord, sanitize

DETECT_KINDS = ("Organization", "Technology", "Domain", "Project", "Place", "Client",
                "Institution", "Event")


def _host(url: str) -> str:
    return urlparse(url).netloc.replace("www.", "") or "website"


def _page_label(page: dict) -> str:
    path = urlparse(page["url"]).path.rsplit("/", 1)[-1] or "index.html"
    name = {"index.html": "Home", "works.html": "Works & Projects"}.get(path, path.replace(".html", "").title())
    return f"{_host(page['url'])} · {name}"


class WebsiteConnector:
    name = "Personal Website"
    source_type = "website"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.pages = self._load("pages.json").get("pages", [])
        self.base = self._load("pages.json").get("base_url", "")
        self.projects = self._load("projects.json").get("projects", [])
        self.faq = self._load("faq.json").get("faq", [])
        self.name = _host(self.base) if self.base else self.name

    def _load(self, fn: str) -> dict:
        p = self.root / fn
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

    def _ents(self, text: str, extra: list[tuple[str, str]] | None = None) -> list[tuple[str, str]]:
        ents = [("Person", ontology.PERSON)] + list(extra or [])
        for e in ontology.detect(text, DETECT_KINDS):
            if e not in ents:
                ents.append(e)
        return ents

    # ---------------------------------------------------------------- pages
    def _pages(self) -> Iterator[KnowledgeRecord]:
        for page in self.pages:
            label = _page_label(page)
            idx = 0
            if page.get("description"):
                yield KnowledgeRecord(
                    source_type=self.source_type, source_system=self.name,
                    source_id=f"{page['url']}#meta", title=page["title"],
                    text=sanitize(page["description"]), section_path=[page["title"]], url=page["url"],
                    metadata={"record_type": "web_paragraph", "document_name": label, "domain": "Website",
                              "page": page["title"], "paragraph_index": idx, "year": ""},
                    entities=self._ents(page["description"]))
                idx += 1
            for sec in page.get("sections", []):
                path = [h for h in sec.get("heading_path", []) if h]
                # On the works page every card heading is a project name.
                extra = []
                leaf = path[-1] if path else ""
                proj = ontology.canonical("Project", leaf)
                if proj and "works" in page["url"].lower():
                    extra.append(("Project", proj))
                for para in sec.get("paragraphs", []):
                    text = sanitize(para)
                    if len(text) < 25:
                        continue
                    yield KnowledgeRecord(
                        source_type=self.source_type, source_system=self.name,
                        source_id=f"{sec.get('url') or page['url']}#p{idx}", title=page["title"],
                        text=text, section_path=path, page=1, url=sec.get("url") or page["url"],
                        metadata={"record_type": "web_paragraph", "document_name": label, "domain": "Website",
                                  "page": page["title"], "section": leaf, "paragraph_index": idx,
                                  "project": proj or "", "year": ""},
                        entities=self._ents(f"{leaf} {text}", extra))
                    idx += 1

    # ---------------------------------------------------------------- projects
    def _projects(self) -> Iterator[KnowledgeRecord]:
        for p in self.projects:
            name = sanitize(p["name"])
            canon = ontology.canonical("Project", name) or name
            techs = [sanitize(t) for t in p.get("technologies", [])]
            live = next((l["url"] for l in p.get("links", []) if l.get("kind") == "live"), "")
            src = next((l["url"] for l in p.get("links", []) if l.get("kind") == "source"), "")
            dl = next((l["url"] for l in p.get("links", []) if l.get("kind") == "download"), "")
            text = (f"{name} — {sanitize(p.get('tagline'))}. {sanitize(p.get('description'))} "
                    f"{name} is built with {', '.join(techs)}." if techs else
                    f"{name} — {sanitize(p.get('tagline'))}. {sanitize(p.get('description'))}")
            avail = []
            if live:
                avail.append(f"it is live at {live}")
            if dl:
                avail.append("an Android APK is available for download")
            if src:
                avail.append(f"the source code is on GitHub at {src}")
            if avail:
                text += " " + name + ": " + "; ".join(avail) + "."
            platform = []
            if "Android" in techs or dl:
                platform.append(("Platform", "Android"))
            if live or "PWA" in techs or "Web App" in techs:
                platform.append(("Platform", "Web"))
            if src:
                platform.append(("Platform", "GitHub"))
            ents = [("Project", canon)] + [("Technology", ontology.canonical("Technology", t) or t) for t in techs] + platform
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=self.name,
                source_id=f"project:{canon}", title=name, text=text,
                section_path=["Works & Projects", name], url=live or src or p.get("source_url", self.base),
                metadata={"record_type": "project", "document_name": f"{_host(self.base)} · Works & Projects",
                          "domain": "Personal Projects", "project": canon, "technology": techs,
                          "live_url": live, "source_url": src, "download_url": dl,
                          "year": re.search(r"20\d{2}", p.get("tagline", "") + p.get("description", "")).group(0)
                          if re.search(r"20\d{2}", p.get("tagline", "") + p.get("description", "")) else ""},
                entities=self._ents(text, ents))

    # ---------------------------------------------------------------- faq
    def _faq(self) -> Iterator[KnowledgeRecord]:
        for i, f in enumerate(self.faq):
            qs = [sanitize(q) for q in f.get("questions", []) if sanitize(q)]
            if not qs:
                continue
            lead = qs[0].rstrip("?")
            lead = lead[:1].upper() + lead[1:]
            answer = sanitize(f["answer"].replace("•", " "))
            kind = f.get("kind", "about")
            text = f"{lead}? {answer}"
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=f"{self.name} assistant",
                source_id=f"faq:{i}", title=lead + "?", text=text,
                section_path=["Website Assistant FAQ", "About Prashobh" if kind == "about" else "AI explainers", lead],
                url=f.get("source_url", self.base),
                metadata={"record_type": "faq", "document_name": f"{_host(self.base)} · Assistant FAQ",
                          "domain": "Website FAQ", "kind": kind, "questions": qs, "year": ""},
                entities=self._ents(text) if kind == "about" else
                         [e for e in ontology.detect(text, DETECT_KINDS)])

    def fetch(self) -> Iterator[KnowledgeRecord]:
        yield from self._pages()
        yield from self._projects()
        yield from self._faq()
