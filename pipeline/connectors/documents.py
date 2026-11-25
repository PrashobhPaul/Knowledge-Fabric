"""Document connector — wraps the heading-aware parsers behind the Connector contract.

Deliberately thin: parsers.py already handles PDF/DOCX/MD/TXT with heading-aware
structure. This adapts its output to KnowledgeRecords and classifies each file
into a knowledge domain from the folder it sits in, so the fabric can reason
about provenance ("this came from the resume" vs "this came from a note").
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator

from ..parsers import iter_sources, parse_any
from .base import KnowledgeRecord

# Folder name -> (source_system label, domain facet, doc_type)
DOMAIN_MAP = {
    "resume": ("Resume", "Career", "Resume"),
    "notes": ("Personal Notes", "Notes", "Note"),
    "talks": ("Talks & Decks", "Speaking", "Presentation"),
    "articles": ("Articles", "Writing", "Article"),
}
DEFAULT_DOMAIN = ("Document Library", "Documents", "Document")

DATE_IN_NAME_RE = re.compile(r"(20\d{2})(?:[-_]?(0[1-9]|1[0-2]))?|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(20\d{2})", re.I)


def _classify(path: Path, root: Path) -> tuple[str, str, str]:
    try:
        rel = path.relative_to(root)
    except ValueError:
        return DEFAULT_DOMAIN
    top = rel.parts[0].lower() if len(rel.parts) > 1 else ""
    return DOMAIN_MAP.get(top, DEFAULT_DOMAIN)


# Documents live in this repository, so their provenance link is the file on GitHub.
REPO_BLOB = "https://github.com/PrashobhPaul/Prashobh_Knowledge_Factory/blob/main/"


def _blob_url(path: Path, root: Path) -> str:
    try:
        rel = path.resolve().relative_to(root.resolve().parent)
    except ValueError:
        return ""
    return REPO_BLOB + str(rel).replace("\\", "/").replace(" ", "%20")


def _version_hint(name: str) -> str:
    """'Prashobh_Paul_Resume_May2025.pdf' -> '2025-05'. Lets the UI say which
    revision a sentence came from when two resumes are indexed side by side."""
    m = DATE_IN_NAME_RE.search(name)
    if not m:
        return ""
    if m.group(1):
        return f"{m.group(1)}-{m.group(2)}" if m.group(2) else m.group(1)
    months = {"jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
              "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"}
    return f"{m.group(4)}-{months[m.group(3).lower()[:3]]}"


class DocumentConnector:
    name = "Document Library"
    source_type = "document"

    def __init__(self, root: Path):
        self.root = Path(root)

    def fetch(self) -> Iterator[KnowledgeRecord]:
        for path in iter_sources(self.root):
            try:
                parsed = parse_any(path)
            except Exception as exc:  # one bad file must not kill the fabric
                print(f"  ! skip {path.name}: {exc}")
                continue

            system, domain, doc_type = _classify(path, self.root)
            version = _version_hint(path.name)
            is_current = doc_type != "Resume" or not re.search(r"\d{4}", path.stem.split("Resume")[-1])

            for para in parsed.paragraphs:
                if len(para.text) < 25:      # drop page furniture
                    continue
                yield KnowledgeRecord(
                    source_type=self.source_type,
                    source_system=system,
                    source_id=f"{path.name}#p{para.paragraph_index}",
                    title=parsed.name,
                    text=para.text,
                    section_path=para.section_path,
                    page=para.page,
                    url=_blob_url(path, self.root),
                    metadata={
                        "record_type": "document_paragraph",
                        "document_name": parsed.name,
                        "domain": domain,
                        "doc_type": doc_type,
                        "version": version,
                        "current": is_current,
                        "page_count": parsed.page_count,
                        "paragraph_index": para.paragraph_index,
                        "source_path": str(path),
                    },
                    entities=[("Document", parsed.name)],
                )
