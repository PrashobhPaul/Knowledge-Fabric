"""Connector contract — every source, however different, lands as KnowledgeRecords.

The fabric thesis: a resume paragraph, a YouTube video, a GitHub repository, a
website section and a structured profile fact are all the same shape once
ingested. Only the connector knows the difference.

A connector yields KnowledgeRecords. The pipeline never learns what a CSV, a
YAML file or an RSS feed is.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Protocol


@dataclass
class KnowledgeRecord:
    """One atomic, retrievable, citable unit of knowledge."""

    source_type: str            # 'document' | 'profile' | 'website' | 'youtube' | 'github'
    source_system: str          # human label, e.g. 'Resume', 'prashobhpaul.com', 'YouTube'
    source_id: str              # stable id within the source system
    title: str
    text: str                   # the retrievable body
    section_path: list[str] = field(default_factory=list)
    page: int = 1
    url: str = ""               # provenance — where a human verifies this
    metadata: dict = field(default_factory=dict)   # typed, filterable facets
    entities: list[tuple[str, str]] = field(default_factory=list)  # (kind, name) seeds


class Connector(Protocol):
    """Anything that can produce knowledge. Implement one method."""

    name: str
    source_type: str

    def fetch(self) -> Iterator[KnowledgeRecord]:
        ...


def sanitize(value) -> str:
    """Structured fields arrive dirty. Normalise to clean single-line text."""
    if value is None:
        return ""
    s = str(value).strip()
    if s.lower() in {"nan", "none", "null", "n/a"}:
        return ""
    return " ".join(s.split())


def registry_from(paths: dict[str, Path]) -> list:
    """Build the active connector set. Sources absent on disk are skipped, not fatal —
    a fabric must degrade gracefully when one system is unavailable.

    paths:
        documents          folder of PDF/DOCX/MD/TXT files
        knowledge_sources  folder the Knowledge Factory writes to
    """
    from .documents import DocumentConnector
    from .github import GitHubConnector
    from .profile import ProfileConnector
    from .website import WebsiteConnector
    from .youtube import YouTubeConnector

    connectors = []
    docs = paths.get("documents")
    if docs and Path(docs).exists():
        connectors.append(DocumentConnector(docs))

    ks = paths.get("knowledge_sources")
    if ks and Path(ks).exists():
        ks = Path(ks)
        if (ks / "profile" / "profile.yaml").exists():
            connectors.append(ProfileConnector(ks / "profile" / "profile.yaml"))
        if (ks / "website").exists():
            connectors.append(WebsiteConnector(ks / "website"))
        if (ks / "youtube" / "videos.json").exists():
            connectors.append(YouTubeConnector(ks / "youtube"))
        if (ks / "github" / "repos.json").exists():
            connectors.append(GitHubConnector(ks / "github" / "repos.json"))
    return connectors
