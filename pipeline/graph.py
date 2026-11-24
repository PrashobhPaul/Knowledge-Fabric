"""Typed knowledge graph — the layer that makes this a fabric rather than a search box.

An untyped co-occurrence graph surfaces association but cannot answer "which
company was he at when he built the clinical NLP pipelines, and what did he
build at the next one?" Here every node and edge carries a type, and — the
important part — edges are inferred *across* source systems:

    Prashobh_Paul_Resume.pdf      (document)   says he worked at Qualizeal
    prashobhpaul.com              (website)    says Qualizeal is the current role
    profile.yaml                  (profile)    says ValidAIte is built at Qualizeal
    InvestIQ repository           (github)     is the code behind Invest.IQ
    works.html                    (website)    says what Invest.IQ is for
    "Microsoft AI Tour Mumbai"    (youtube)    an event in the same AI world

No single source contains those chains. The fabric assembles them, and a node
observed in two or more source systems is flagged `cross_source` — the join key.
"""
from __future__ import annotations

from collections import defaultdict
from itertools import combinations

from . import ontology

# --------------------------------------------------------------------------- types
NODE_TYPES = ["Person", "Organization", "Client", "Role", "Project", "Skill", "Technology", "Domain",
              "Institution", "Degree", "Service", "Channel", "Video", "Place", "Topic", "Event",
              "Platform", "Language", "Document"]

EDGE_TYPES = {
    "WORKED_AT":     ("Person", "Organization"),
    "ROLE_AT":       ("Role", "Organization"),
    "IN_DOMAIN":     ("Role", "Domain"),        # also Project -> Domain
    "FOR_CLIENT":    ("Project", "Client"),
    "BUILT":         ("Person", "Project"),
    "BUILT_AT":      ("Project", "Organization"),
    "USES":          ("Project", "Technology"),  # also Role -> Technology
    "SKILLED_IN":    ("Person", "Skill"),
    "IN_GROUP":      ("Skill", "Topic"),
    "STUDIED_AT":    ("Person", "Institution"),
    "AWARDED_BY":    ("Degree", "Institution"),
    "OFFERS":        ("Person", "Service"),
    "OWNS":          ("Person", "Channel"),
    "PUBLISHED":     ("Channel", "Video"),
    "FILMED_AT":     ("Video", "Place"),
    "ABOUT":         ("Video", "Topic"),
    "COVERS":        ("Video", "Event"),
    "FEATURES":      ("Video", "Person"),        # also Video -> Organization
    "HOSTED_ON":     ("Project", "Platform"),
    "SPEAKS":        ("Person", "Language"),
    "DOCUMENTED_IN": (None, "Document"),
    "CO_OCCURS":     (None, None),
}

# Kinds that may form co-occurrence edges with each other inside one passage.
CO_OCCUR_KINDS = {"Organization", "Project", "Technology", "Domain", "Place", "Topic", "Event", "Client", "Skill"}
# Document-level kinds: every detected entity in a passage is DOCUMENTED_IN its document node.
DOCUMENTED_KINDS = {"Organization", "Project", "Technology", "Domain", "Place", "Client", "Institution", "Event"}

PACKED_RECORD_TYPES = {"document_paragraph", "web_paragraph"}


class KnowledgeGraph:
    def __init__(self):
        self._nodes: dict[tuple[str, str], int] = {}
        self.nodes: list[dict] = []
        self._edges: dict[tuple[int, int, str], dict] = {}
        self._cooc: dict[tuple[int, int], set[int]] = defaultdict(set)

    # ------------------------------------------------------------------ nodes
    def node(self, kind: str, name: str) -> int | None:
        name = (name or "").strip()
        if not name or len(name) > 120:
            return None
        key = (kind, name.lower())
        if key in self._nodes:
            nid = self._nodes[key]
            self.nodes[nid]["mentions"] += 1
            return nid
        nid = len(self.nodes)
        self._nodes[key] = nid
        self.nodes.append({"id": nid, "kind": kind, "name": name, "mentions": 1, "chunks": [], "sources": []})
        return nid

    def observe(self, nid: int | None, chunk_id: int, source_type: str):
        if nid is None:
            return
        n = self.nodes[nid]
        if len(n["chunks"]) < 80 and chunk_id not in n["chunks"]:
            n["chunks"].append(chunk_id)
        if source_type not in n["sources"]:
            n["sources"].append(source_type)

    # ------------------------------------------------------------------ edges
    def edge(self, a: int | None, b: int | None, etype: str, evidence: int | None = None):
        if a is None or b is None or a == b:
            return
        key = (a, b, etype)
        e = self._edges.get(key)
        if e is None:
            e = {"source": a, "target": b, "type": etype, "weight": 0, "evidence": []}
            self._edges[key] = e
        e["weight"] += 1
        if evidence is not None and len(e["evidence"]) < 12 and evidence not in e["evidence"]:
            e["evidence"].append(evidence)

    # ------------------------------------------------------------------ build
    def ingest(self, records, chunk_ids: list[int]):
        """First pass: nodes and same-record typed edges from connector output."""
        person_name = ontology.PERSON
        for rec, cid in zip(records, chunk_ids):
            meta = rec.metadata
            rtype = meta.get("record_type", "")
            st = rec.source_type

            by_kind: dict[str, list[int]] = defaultdict(list)
            for kind, raw in rec.entities:
                if not kind or not raw:
                    continue
                if kind == "Person" and raw != person_name:
                    canon = ontology.canonical("Person", raw) or raw
                else:
                    canon = raw if kind in {"Person", "Role", "Degree", "Service", "Skill", "Video", "Channel",
                                            "Language", "Document", "Platform"} \
                        else (ontology.canonical(kind, raw) or raw)
                nid = self.node(kind, canon)
                self.observe(nid, cid, st)
                if nid is not None:
                    by_kind[kind].append(nid)

            person = self.node("Person", person_name)
            self.observe(person, cid, st)
            orgs, roles, projects = by_kind["Organization"], by_kind["Role"], by_kind["Project"]

            # ---- typed edges by record shape
            if rtype == "role":
                for o in orgs[:1]:
                    self.edge(person, o, "WORKED_AT", cid)
                    for r in roles:
                        self.edge(r, o, "ROLE_AT", cid)
                for r in roles:
                    for d in by_kind["Domain"]:
                        self.edge(r, d, "IN_DOMAIN", cid)
                    for t in by_kind["Technology"]:
                        self.edge(r, t, "USES", cid)
                for o in orgs[1:]:          # clients named in highlights (e.g. American Express)
                    for r in roles:
                        self.edge(r, o, "FOR_CLIENT", cid)

            elif rtype in {"engagement", "project", "repository", "career_project"}:
                for p in projects:
                    self.edge(person, p, "BUILT", cid)
                    for t in by_kind["Technology"]:
                        self.edge(p, t, "USES", cid)
                    for o in orgs:
                        self.edge(p, o, "BUILT_AT", cid)
                    for c in by_kind["Client"]:
                        self.edge(p, c, "FOR_CLIENT", cid)
                    for pl in by_kind["Platform"]:
                        self.edge(p, pl, "HOSTED_ON", cid)
                    for d in by_kind["Domain"]:
                        self.edge(p, d, "IN_DOMAIN", cid)

            elif rtype == "education":
                for i in by_kind["Institution"]:
                    self.edge(person, i, "STUDIED_AT", cid)
                    for d in by_kind["Degree"]:
                        self.edge(d, i, "AWARDED_BY", cid)

            elif rtype == "skill_group":
                for s in by_kind["Skill"]:
                    self.edge(person, s, "SKILLED_IN", cid)
                    for g in by_kind["Topic"]:
                        self.edge(s, g, "IN_GROUP", cid)

            elif rtype == "service":
                for s in by_kind["Service"]:
                    self.edge(person, s, "OFFERS", cid)

            elif rtype == "languages":
                for l in by_kind["Language"]:
                    self.edge(person, l, "SPEAKS", cid)

            elif rtype == "channel":
                for ch in by_kind["Channel"]:
                    self.edge(person, ch, "OWNS", cid)
                    for t in by_kind["Topic"]:
                        self.edge(ch, t, "ABOUT", cid)

            elif rtype == "video":
                for v in by_kind["Video"]:
                    for ch in by_kind["Channel"]:
                        self.edge(ch, v, "PUBLISHED", cid)
                    for pl in by_kind["Place"]:
                        self.edge(v, pl, "FILMED_AT", cid)
                    for t in by_kind["Topic"]:
                        self.edge(v, t, "ABOUT", cid)
                    for ev in by_kind["Event"]:
                        self.edge(v, ev, "COVERS", cid)
                    for pe in by_kind["Person"]:
                        if pe != person:
                            self.edge(v, pe, "FEATURES", cid)
                    for o in orgs:
                        self.edge(v, o, "FEATURES", cid)

            elif rtype in PACKED_RECORD_TYPES or rtype == "faq":
                # Document node for the page/file; everything recognised in it is DOCUMENTED_IN.
                doc_name = meta.get("document_name") or rec.title
                d = self.node("Document", doc_name)
                self.observe(d, cid, st)
                for kind in DOCUMENTED_KINDS:
                    for nid in by_kind[kind]:
                        self.edge(nid, d, "DOCUMENTED_IN", cid)
                if rtype == "web_paragraph" and projects:
                    for p in projects:
                        self.edge(person, p, "BUILT", cid)
                        for t in by_kind["Technology"]:
                            self.edge(p, t, "USES", cid)

            # ---- co-occurrence candidates (promoted to edges only if seen >= 2 passages)
            co_nodes = sorted({nid for k in CO_OCCUR_KINDS for nid in by_kind[k]})
            for a, b in combinations(co_nodes, 2):
                self._cooc[(a, b)].add(cid)

    def promote_cooccurrence(self, min_support: int = 2):
        for (a, b), cids in self._cooc.items():
            if len(cids) < min_support:
                continue
            if any(k[:2] == (a, b) or k[:2] == (b, a) for k in self._edges):
                continue      # a typed edge already explains this pair
            for cid in sorted(cids):
                self.edge(a, b, "CO_OCCURS", cid)

    def bridge_sources(self) -> int:
        """Second pass — the fabric moment. A node observed in two or more source
        systems is a join key; its edges from each source become reachable from the
        others. These joins exist in no single source."""
        bridged = 0
        for n in self.nodes:
            if n["kind"] in {"Person", "Document"}:
                n["cross_source"] = False
                continue
            n["cross_source"] = len(n["sources"]) >= 2
            bridged += int(n["cross_source"])
        return bridged

    def finalize(self, max_edges: int = 4000) -> dict:
        self.promote_cooccurrence()
        cross = self.bridge_sources()
        typed = [e for e in self._edges.values() if e["type"] != "CO_OCCURS"]
        cooc = sorted((e for e in self._edges.values() if e["type"] == "CO_OCCURS"), key=lambda e: -e["weight"])
        edges = sorted(typed, key=lambda e: -e["weight"])[:max_edges]
        edges += cooc[:max(0, max_edges - len(edges))]
        keep = {e["source"] for e in edges} | {e["target"] for e in edges}

        degree: dict[int, int] = defaultdict(int)
        for e in edges:
            degree[e["source"]] += 1
            degree[e["target"]] += 1
        for n in self.nodes:
            n["degree"] = degree.get(n["id"], 0)

        type_counts: dict[str, int] = defaultdict(int)
        for e in edges:
            type_counts[e["type"]] += 1
        kind_counts: dict[str, int] = defaultdict(int)
        for n in self.nodes:
            kind_counts[n["kind"]] += 1

        return {
            "nodes": [n for n in self.nodes if n["id"] in keep or n["mentions"] > 2],
            "edges": edges,
            "node_types": NODE_TYPES,
            "edge_types": sorted(type_counts.keys()),
            "stats": {
                "node_count": len(self.nodes),
                "edge_count": len(edges),
                "cross_source_entities": cross,
                "edges_by_type": dict(type_counts),
                "nodes_by_kind": dict(kind_counts),
            },
        }


def build_knowledge_graph(records, chunk_ids: list[int]) -> dict:
    kg = KnowledgeGraph()
    kg.ingest(records, chunk_ids)
    return kg.finalize()
