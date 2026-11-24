"""LinkedIn connector — posts, events and profile extras as verbalised records.

A post is the subject's own voice on a topic at a point in time, which is a
different kind of knowledge from a resume line: it carries opinion and date.
Events are first-class because "what has he attended / spoken at" is a question
the career record cannot answer.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Iterator

from .. import ontology
from .base import KnowledgeRecord, sanitize

DETECT_KINDS = ("Organization", "Technology", "Domain", "Project", "Place", "Client", "Event", "Person")
HASHTAG_RE = re.compile(r"#(\w+)")


def _when(iso: str) -> tuple[str, str]:
    if not iso:
        return "", ""
    try:
        d = datetime.strptime(iso[:10], "%Y-%m-%d")
        return f"{d.day} {d.strftime('%B %Y')}", str(d.year)
    except ValueError:
        return iso[:10], iso[:4]


class LinkedInConnector:
    name = "LinkedIn"
    source_type = "linkedin"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.posts = self._load("posts.json").get("posts", [])
        self.profile_url = self._load("posts.json").get("profile_url", "")
        self.events = self._load("events.json").get("events", [])
        self.extra = self._load("profile_extra.json")

    def _load(self, fn: str) -> dict:
        p = self.root / fn
        return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}

    def _ents(self, text: str, extra: list[tuple[str, str]] | None = None) -> list[tuple[str, str]]:
        ents = [("Person", ontology.PERSON)] + list(extra or [])
        for e in ontology.detect(text, DETECT_KINDS):
            if e not in ents:
                ents.append(e)
        return ents

    def _posts(self) -> Iterator[KnowledgeRecord]:
        for i, p in enumerate(self.posts):
            raw = p.get("text", "")
            tags = [t.lower() for t in HASHTAG_RE.findall(raw)]
            body = sanitize(HASHTAG_RE.sub("", raw))
            if len(body) < 30:
                continue
            when, year = _when(p.get("date", ""))
            title = body[:80].rsplit(" ", 1)[0] + ("…" if len(body) > 80 else "")
            text = (f"{ontology.PERSON} wrote on LinkedIn{' on ' + when if when else ''}: {body}"
                    f"{' Tagged: ' + ', '.join(tags[:8]) + '.' if tags else ''}")
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=self.name, source_id=f"post:{p.get('id', i)}",
                title=title, text=text, section_path=["LinkedIn", "Posts", year or "Undated"],
                url=p.get("url") or self.profile_url,
                metadata={"record_type": "post", "document_name": f"LinkedIn · {title[:70]}", "domain": "LinkedIn",
                          "year": year, "published": p.get("date", ""), "topic": tags[0] if tags else "",
                          "topics": tags, "provenance": p.get("source", "")},
                entities=self._ents(f"{body} {' '.join(tags)}", [("Post", title[:80])]))

    def _events(self) -> Iterator[KnowledgeRecord]:
        for i, e in enumerate(self.events):
            name = sanitize(e.get("name"))
            when, year = _when(e.get("date", ""))
            role = sanitize(e.get("role")) or "attendee"
            text = (f"{ontology.PERSON} {'spoke at' if 'speaker' in role.lower() else 'attended'} the event {name}"
                    f"{' on ' + when if when else ''}{' as ' + role if role != 'attendee' else ''}. "
                    f"{sanitize(e.get('description', ''))}").strip()
            canon = ontology.canonical("Event", name) or name
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=self.name, source_id=f"event:{i}",
                title=name, text=text, section_path=["LinkedIn", "Events", year or "Undated"],
                url=e.get("url") or self.profile_url,
                metadata={"record_type": "event", "document_name": f"Event · {name[:70]}", "domain": "Events",
                          "year": year, "published": e.get("date", ""), "event": canon, "role": role},
                entities=self._ents(f"{name} {e.get('description', '')}", [("Event", canon)]))

    def _extras(self) -> Iterator[KnowledgeRecord]:
        x = self.extra or {}
        for c in x.get("certifications", []):
            name = sanitize(c.get("name"))
            if not name:
                continue
            text = (f"{ontology.PERSON} holds the certification {name}"
                    f"{' from ' + sanitize(c['authority']) if c.get('authority') else ''}"
                    f"{' (earned ' + _when(c.get('started_on', ''))[0] + ')' if c.get('started_on') else ''}.")
            yield KnowledgeRecord(source_type=self.source_type, source_system=self.name, source_id=f"cert:{name}",
                                  title=name, text=text, section_path=["LinkedIn", "Certifications"], url=c.get("url") or self.profile_url,
                                  metadata={"record_type": "certification", "document_name": "LinkedIn · Certifications",
                                            "domain": "Credentials", "year": _when(c.get("started_on", ""))[1]},
                                  entities=self._ents(text, [("Certification", name)]))
        for h in x.get("honors", []):
            title = sanitize(h.get("title"))
            if not title:
                continue
            text = (f"{ontology.PERSON} received the honor {title}"
                    f"{' from ' + sanitize(h['issuer']) if h.get('issuer') else ''}"
                    f"{' in ' + _when(h.get('issued_on', ''))[0] if h.get('issued_on') else ''}. {sanitize(h.get('description', ''))}").strip()
            yield KnowledgeRecord(source_type=self.source_type, source_system=self.name, source_id=f"honor:{title}",
                                  title=title, text=text, section_path=["LinkedIn", "Honors & Awards"], url=self.profile_url,
                                  metadata={"record_type": "honor", "document_name": "LinkedIn · Honors", "domain": "Credentials",
                                            "year": _when(h.get("issued_on", ""))[1]},
                                  entities=self._ents(text, [("Honor", title)]))
        for p in x.get("publications", []):
            name = sanitize(p.get("name"))
            if not name:
                continue
            text = (f"{ontology.PERSON} published '{name}'{' in ' + sanitize(p['publisher']) if p.get('publisher') else ''}"
                    f"{' on ' + _when(p.get('published_on', ''))[0] if p.get('published_on') else ''}. {sanitize(p.get('description', ''))}").strip()
            yield KnowledgeRecord(source_type=self.source_type, source_system=self.name, source_id=f"pub:{name}",
                                  title=name, text=text, section_path=["LinkedIn", "Publications"], url=p.get("url") or self.profile_url,
                                  metadata={"record_type": "publication", "document_name": "LinkedIn · Publications", "domain": "Writing",
                                            "year": _when(p.get("published_on", ""))[1]},
                                  entities=self._ents(text, [("Publication", name)]))
        for r in x.get("recommendations", []):
            who = sanitize(f"{r.get('first_name', '')} {r.get('last_name', '')}")
            body = sanitize(r.get("text"))
            if not body:
                continue
            text = (f"{who}{', ' + sanitize(r['job_title']) if r.get('job_title') else ''}"
                    f"{' at ' + sanitize(r['company']) if r.get('company') else ''}, recommended {ontology.PERSON} on LinkedIn: {body}")
            yield KnowledgeRecord(source_type=self.source_type, source_system=self.name, source_id=f"rec:{who}",
                                  title=f"Recommendation from {who}", text=text, section_path=["LinkedIn", "Recommendations"], url=self.profile_url,
                                  metadata={"record_type": "recommendation", "document_name": "LinkedIn · Recommendations",
                                            "domain": "Recommendations", "year": _when(r.get("creation_date", ""))[1]},
                                  entities=self._ents(text))

    def fetch(self) -> Iterator[KnowledgeRecord]:
        yield from self._posts()
        yield from self._events()
        yield from self._extras()
