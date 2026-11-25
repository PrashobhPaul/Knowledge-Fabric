"""Canon connector — the curated, owner-voiced answers with their evidence.

Each entry of knowledge_sources/profile/canon.yaml becomes one record whose text
is the answer exactly as the owner says it. The evidence list is carried in the
metadata; build_index resolves every evidence link to the records that prove it
(a link that proves nothing is reported, never silently accepted).
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

from .base import KnowledgeRecord


class CanonConnector:
    name = "Canon"
    source_type = "canon"

    def __init__(self, path: Path):
        import yaml
        self.path = Path(path)
        self.data = yaml.safe_load(self.path.read_text(encoding="utf-8")) or {}
        self.entries = self.data.get("canon") or []
        from datetime import date as _d
        self.as_of = str(self.data.get("as_of") or _d.today().isoformat())

    def fetch(self) -> Iterator[KnowledgeRecord]:
        for e in self.entries:
            qs = [str(q) for q in (e.get("questions") or []) if q]
            if not qs or not e.get("answer"):
                continue
            ev = [{"url": str(x.get("url", "")), "source": str(x.get("source", "")), "why": str(x.get("why", ""))}
                  for x in (e.get("evidence") or []) if x.get("url")]
            first_http = next((x["url"] for x in ev if x["url"].startswith("http")), "")
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=self.name, source_id=f"canon:{e['id']}",
                title=qs[0], text=" ".join(str(e["answer"]).split()),
                section_path=["Canon", str(e.get("id"))], url=first_http,
                metadata={"record_type": "canon", "document_name": f"Canon · {qs[0]}", "canon_id": str(e.get("id")),
                          "answer": " ".join(str(e["answer"]).split()),
                          "keywords": [str(k) for k in (e.get("keywords") or [])],
                          "date": self.as_of, "as_of": self.as_of, "date_source": "canon",
                          "questions": qs, "evidence": ev, "topics": list(e.get("topics") or []), "domain": "Canon",
                          "showcase": str(e.get("project") or ""),
                          "links": [{"label": str(x.get("label", "")), "url": str(x.get("url", ""))} for x in (e.get("links") or []) if x.get("url")]},
                entities=[("Person", "Prashobh Paul")],
            )
