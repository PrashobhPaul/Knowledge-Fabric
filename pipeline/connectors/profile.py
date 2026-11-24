"""Profile connector — the structured, hand-curated facts become retrievable prose.

Design note: we *verbalise* each fact into natural language rather than indexing
raw fields. A YAML block {organization: Qualizeal, role: AI Architect, start:
2026-01} is invisible to lexical and semantic search. The same block rendered as
"Prashobh Paul has worked at Qualizeal as AI Architect since January 2026" is
retrievable by the identical machinery that serves the resume PDF — which is the
whole point of a fabric. Typed facets are preserved in metadata for filtering and
graph construction, so nothing is lost.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Iterator

from .. import ontology
from .base import KnowledgeRecord, sanitize

MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
          "September", "October", "November", "December"]


def _month(ym) -> str:
    """'2023-06' -> 'June 2023'; 2014 -> '2014'; None -> ''."""
    if ym is None:
        return ""
    s = str(ym)
    if len(s) >= 7 and s[4] == "-":
        try:
            return f"{MONTHS[int(s[5:7]) - 1]} {s[:4]}"
        except (ValueError, IndexError):
            return s
    return s[:4]


def _join(items: list[str]) -> str:
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " and " + items[-1]


class ProfileConnector:
    name = "Structured Profile"
    source_type = "profile"

    def __init__(self, path: Path):
        self.path = Path(path)
        import yaml
        self.data = yaml.safe_load(self.path.read_text(encoding="utf-8"))
        self.person = self.data["person"]["name"]
        self.as_of = str(self.data.get("as_of") or date.today().isoformat())

    # ---------------------------------------------------------------- helpers
    def _rec(self, *, rtype: str, doc: str, section: list[str], title: str, text: str,
             meta: dict | None = None, entities: list[tuple[str, str]] | None = None,
             url: str = "https://www.prashobhpaul.com/") -> KnowledgeRecord:
        meta = {"record_type": rtype, "document_name": f"Profile · {doc}", "domain": "Profile",
                "as_of": self.as_of, **(meta or {})}
        ents = [("Person", self.person)] + (entities or [])
        # Anything the ontology recognises in the prose joins the graph too.
        for kind, canon in ontology.detect(text, ("Organization", "Technology", "Domain", "Project", "Place", "Client")):
            if (kind, canon) not in ents:
                ents.append((kind, canon))
        return KnowledgeRecord(
            source_type=self.source_type, source_system=self.name,
            source_id=f"profile:{rtype}:{title}"[:120], title=title, text=text,
            section_path=["Profile"] + section, url=url, metadata=meta, entities=ents,
        )

    # ---------------------------------------------------------------- sections
    def _person(self) -> Iterator[KnowledgeRecord]:
        p = self.data["person"]
        yield self._rec(
            rtype="person_summary", doc="About", section=["About"], title=f"Who is {self.person}",
            text=(f"{self.person} is an {sanitize(p.get('headline'))}, based in {sanitize(p.get('location'))}, "
                  f"with {sanitize(p.get('years_experience'))} years of experience. {sanitize(p.get('summary'))}"),
            meta={"year": self.as_of[:4]}, entities=[("Place", "Hyderabad")])
        if p.get("about"):
            yield self._rec(rtype="person_about", doc="About", section=["About", "Background"],
                            title=f"About {self.person}", text=f"{self.person}: {sanitize(p['about'])}")
        if p.get("working_style"):
            yield self._rec(rtype="working_style", doc="About", section=["About", "Working style"],
                            title=f"How {self.person} works", text=f"{self.person} works as an {sanitize(p['working_style'])}"
                            .replace("works as an Architect", "is an architect"))

    def _links(self) -> Iterator[KnowledgeRecord]:
        links = self.data.get("links", [])
        if not links:
            return
        parts = [f"{sanitize(l['label'])} ({sanitize(l['url'])})" for l in links]
        yield self._rec(
            rtype="contact", doc="Contact", section=["Contact & Links"], title=f"How to reach {self.person}",
            text=(f"{self.person} can be reached and followed online through: {_join(parts)}. "
                  f"The website is the primary contact point; the resume is downloadable as a PDF."),
            entities=[("Platform", "LinkedIn"), ("Platform", "GitHub"), ("Platform", "YouTube"),
                      ("Platform", "Personal Website")])

    def _experience(self) -> Iterator[KnowledgeRecord]:
        for i, e in enumerate(self.data.get("experience", [])):
            org = sanitize(e["organization"])
            role = sanitize(e["role"])
            start, end = _month(e.get("start")), _month(e.get("end"))
            current = not e.get("end")
            unit = sanitize(e.get("unit"))
            domains = [sanitize(d) for d in e.get("domains", [])]
            when = (f"since {start} (current role)" if current else f"from {start} to {end}")
            text = (f"{self.person} {'has worked' if current else 'worked'} at {org} as {role}"
                    f"{' in the ' + unit if unit else ''} {when}"
                    f"{', based in ' + sanitize(e.get('location')) if e.get('location') else ''}"
                    f"{', working in ' + _join(domains) if domains else ''}. ")
            if e.get("alt_titles"):
                text += f"The role has also been described as {_join([sanitize(t) for t in e['alt_titles']])}. "
            text += " ".join(sanitize(h) for h in e.get("highlights", []))
            ents = [("Organization", ontology.canonical("Organization", org) or org), ("Role", f"{role} @ {org}")]
            ents += [("Domain", ontology.canonical("Domain", d) or d) for d in domains]
            yield self._rec(
                rtype="role", doc="Experience", section=["Experience", org], title=f"{role} at {org}",
                text=text,
                meta={"organization": ontology.canonical("Organization", org) or org, "role": role,
                      "start": str(e.get("start") or ""), "end": str(e.get("end") or ""),
                      "year": str(e.get("start") or "")[:4], "current": current,
                      "domains": domains, "order": i},
                entities=ents)

    def _engagements(self) -> Iterator[KnowledgeRecord]:
        for g in self.data.get("engagements", []):
            name = sanitize(g["name"])
            org = sanitize(g.get("organization"))
            client = sanitize(g.get("client"))
            techs = [sanitize(t) for t in g.get("technologies", [])]
            kind = sanitize(g.get('kind'))
            article = "an" if kind[:1].lower() in "aeiou" else "a"
            text = (f"{name} is {article} {kind} that {self.person} works on"
                    f"{' at ' + org if org else ''}{' for ' + client if client else ''}. "
                    f"{sanitize(g.get('description'))}"
                    f"{' It is built with ' + _join(techs) + '.' if techs else ''}")
            ents = [("Project", ontology.canonical("Project", name) or name)]
            if org:
                ents.append(("Organization", ontology.canonical("Organization", org) or org))
            if client:
                ents.append(("Client", ontology.canonical("Client", client) or client))
            ents += [("Technology", ontology.canonical("Technology", t) or t) for t in techs]
            yield self._rec(
                rtype="engagement", doc="Engagements", section=["Current Engagements", name], title=name,
                text=text,
                meta={"project": ontology.canonical("Project", name) or name, "organization": org,
                      "client": client, "technology": techs, "year": self.as_of[:4],
                      "provenance": ",".join(g.get("source", []))},
                entities=ents)

    def _education(self) -> Iterator[KnowledgeRecord]:
        for ed in self.data.get("education", []):
            degree, inst = sanitize(ed["degree"]), sanitize(ed["institution"])
            text = (f"{self.person} earned a {degree} from {inst}"
                    f"{' (' + sanitize(ed['college']) + ')' if ed.get('college') else ''}"
                    f"{', ' + sanitize(ed['location']) if ed.get('location') else ''}, "
                    f"studying from {ed.get('start')} to {ed.get('end')}"
                    f"{', graduating with ' + sanitize(ed['grade']) if ed.get('grade') else ''}.")
            yield self._rec(
                rtype="education", doc="Education", section=["Education", inst], title=degree, text=text,
                meta={"institution": ontology.canonical("Institution", inst) or inst, "degree": degree,
                      "year": str(ed.get("end") or ""), "start": str(ed.get("start") or ""), "end": str(ed.get("end") or "")},
                entities=[("Institution", ontology.canonical("Institution", inst) or inst), ("Degree", degree)])

    def _skills(self) -> Iterator[KnowledgeRecord]:
        for grp in self.data.get("skills", []):
            if not isinstance(grp, dict) or "group" not in grp:
                continue
            group = sanitize(grp["group"])
            items = [sanitize(i) for i in grp.get("items", [])]
            text = (f"{self.person}'s skills in {group} include {_join(items)}. "
                    f"These are listed on the resume and the website as core expertise.")
            ents = [("Skill", i) for i in items] + [("Topic", group)]
            for i in items:
                tech = ontology.canonical("Technology", i)
                if tech:
                    ents.append(("Technology", tech))
            yield self._rec(
                rtype="skill_group", doc="Skills", section=["Skills", group], title=group, text=text,
                meta={"topic": group, "skills": items}, entities=ents)

    def _services(self) -> Iterator[KnowledgeRecord]:
        for s in self.data.get("services", []):
            if not isinstance(s, dict) or "name" not in s:
                continue
            name = sanitize(s["name"])
            text = f"{self.person} offers {name}: {sanitize(s.get('description'))}"
            yield self._rec(rtype="service", doc="Services", section=["Services", name], title=name,
                            text=text, meta={"service": name}, entities=[("Service", name)],
                            url="https://www.prashobhpaul.com/#contact")

    def _career_projects(self) -> Iterator[KnowledgeRecord]:
        for pj in self.data.get("career_projects", []):
            if not isinstance(pj, dict) or "name" not in pj:
                continue
            name = sanitize(pj["name"])
            text = f"{name} is a key project and innovation on {self.person}'s resume: {sanitize(pj.get('description'))}"
            canon = ontology.canonical("Project", name) or name
            yield self._rec(rtype="career_project", doc="Key Projects", section=["Key Projects", name],
                            title=name, text=text, meta={"project": canon}, entities=[("Project", canon)])

    def _personal(self) -> Iterator[KnowledgeRecord]:
        p = self.data.get("personal", {})
        if p.get("statement"):
            interests = [sanitize(i) for i in p.get("interests", [])]
            yield self._rec(
                rtype="personal", doc="Personal", section=["Personal", "Interests"],
                title=f"{self.person} outside work",
                text=f"{sanitize(p['statement'])}{' His interests include ' + _join(interests) + '.' if interests else ''}"
                     f"{' His YouTube channel is ' + sanitize(p['youtube_channel']) + '.' if p.get('youtube_channel') else ''}",
                meta={"topic": "Personal"},
                entities=[("Topic", i) for i in interests] + ([("Channel", sanitize(p["youtube_channel"]))] if p.get("youtube_channel") else []))
        langs = p.get("languages", [])
        if langs:
            parts = [f"{sanitize(l['language'])} ({sanitize(l['proficiency']).lower()})" for l in langs]
            yield self._rec(rtype="languages", doc="Personal", section=["Personal", "Languages"],
                            title="Languages spoken", text=f"{self.person} speaks {_join(parts)}.",
                            meta={"topic": "Languages"}, entities=[("Language", sanitize(l["language"])) for l in langs])

    # ---------------------------------------------------------------- fetch
    def fetch(self) -> Iterator[KnowledgeRecord]:
        for source in (self._person, self._links, self._experience, self._engagements,
                       self._education, self._skills, self._services, self._career_projects,
                       self._personal):
            yield from source()
