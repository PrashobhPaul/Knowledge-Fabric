"""Knowledge Fabric build orchestrator.

    python -m pipeline.build_index

Pipeline:
    connectors  ->  records  ->  chunks  ->  BM25 (lexical)
                                        ->  LSA   (semantic)
                                        ->  typed knowledge graph
                                        ->  facets
                             ->  site/data/index.json + semantic.json

Inputs come from two places that the Knowledge Factory keeps in step:
    docs_source/          files (resume PDFs, notes) — parsed heading-aware
    knowledge_sources/    what the Factory synced: profile, website, YouTube, GitHub
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

from .bm25_index import build_bm25_index
from .chunker import Chunk, tokenize
from .connectors.base import registry_from
from .docmeta import resolve as resolve_date
from .graph import PACKED_RECORD_TYPES, build_knowledge_graph
from .semantic import build_semantic_index
from .textnorm import analyse, build_vocabulary, chunk_quality, normalize

TARGET_CHARS = 700


def records_to_chunks(records: list) -> tuple[list[Chunk], list]:
    """Documents and web pages are packed to a target size; structured records stay atomic.

    A profile role, a video or a repository is already exactly one complete
    thought — splitting or merging it would damage both retrieval and citation
    precision. Resume paragraphs and website paragraphs, by contrast, are
    fragments and need packing by (document, section, page).
    """
    chunks: list[Chunk] = []
    aligned: list = []
    cid = 0
    doc_ids: dict[str, int] = {}
    buffer: list = []
    buf_key = None

    def doc_id_for(name: str) -> int:
        if name not in doc_ids:
            doc_ids[name] = len(doc_ids)
        return doc_ids[name]

    def flush():
        nonlocal buffer, cid
        if not buffer:
            return
        first = buffer[0]
        text = "\n\n".join(r.text for r in buffer)
        name = first.metadata.get("document_name") or first.title
        chunks.append(Chunk(
            chunk_id=cid, document_id=doc_id_for(name), document_name=name,
            page=first.page, section_path=list(first.section_path),
            paragraph_indices=[r.metadata.get("paragraph_index", 0) for r in buffer],
            text=text, paragraph_excerpt=first.text[:200], tokens=tokenize(text),
        ))
        aligned.append(first)
        cid += 1
        buffer = []

    for rec in records:
        if rec.metadata.get("record_type") not in PACKED_RECORD_TYPES:
            flush()
            name = rec.metadata.get("document_name") or rec.title
            chunks.append(Chunk(
                chunk_id=cid, document_id=doc_id_for(name), document_name=name,
                page=rec.page, section_path=list(rec.section_path),
                paragraph_indices=[0], text=rec.text,
                paragraph_excerpt=rec.text[:200], tokens=tokenize(rec.text),
            ))
            aligned.append(rec)
            cid += 1
            continue
        key = (rec.metadata.get("document_name"), tuple(rec.section_path), rec.page)
        if buf_key is not None and key != buf_key:
            flush()
        buf_key = key
        buffer.append(rec)
        if sum(len(r.text) for r in buffer) >= TARGET_CHARS:
            flush()
    flush()
    return chunks, aligned


FACET_KEYS = ("record_type", "organization", "project", "domain", "year", "place", "topic",
              "format", "kind", "institution", "client", "language")


def build_facets(records: list) -> dict:
    facets: dict = defaultdict(lambda: defaultdict(int))
    for r in records:
        facets["source_type"][r.source_type] += 1
        facets["source_system"][r.source_system] += 1
        for key in FACET_KEYS:
            v = r.metadata.get(key)
            if isinstance(v, list):
                for item in v:
                    if item:
                        facets[key][str(item)] += 1
            elif v:
                facets[key][str(v)] += 1
    return {k: dict(sorted(v.items(), key=lambda kv: -kv[1])[:60]) for k, v in facets.items()}


def load_manifest(ks_dir: Path) -> dict:
    p = ks_dir / "manifest.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}



# ---------------------------------------------------------------------------
# Canon — curated answers, each evidence link resolved to the records that prove it
# ---------------------------------------------------------------------------
_PROFILE_SECTION = {"roles": "role", "engagements": "engagement", "education": "education", "skills": "skill_group",
                    "services": "service", "career_projects": "career_project", "events": "event", "posts": "post",
                    "languages": "languages", "personal": "personal"}


def build_canon(chunks: list[dict]) -> tuple[list[dict], list[str]]:
    """Return (canon entries with resolved evidence chunk ids, unresolved evidence links)."""
    out, unresolved = [], []
    by_url: dict[str, list[int]] = {}
    for i, c in enumerate(chunks):
        u = (c.get("url") or "").split("&t=")[0].rstrip("/")
        if u:
            by_url.setdefault(u, []).append(i)
    seen_ids: set[str] = set()
    for i, c in enumerate(chunks):
        m = c.get("meta") or {}
        if m.get("record_type") != "canon" or m.get("canon_id") in seen_ids:
            continue   # a long answer may span several chunks; the entry is built once, from the full answer
        seen_ids.add(m.get("canon_id"))
        evidence = []
        for ev in m.get("evidence") or []:
            url = ev.get("url", "")
            ids: list[int] = []
            if url.startswith("profile:"):
                section, _, name = url[len("profile:"):].partition("/")
                rtype = _PROFILE_SECTION.get(section, section)
                needle = name.lower()
                for j, ch in enumerate(chunks):
                    mm = ch.get("meta") or {}
                    if mm.get("record_type") != rtype:
                        continue
                    hay = " ".join(str(v) for v in (ch.get("document_name", ""), ch.get("text", "")[:200],
                                                    mm.get("organization", ""), mm.get("project", ""), mm.get("event", ""))).lower()
                    if not needle or needle in hay:
                        ids.append(j)
                        if rtype in ("role", "engagement", "education", "event", "career_project", "service", "skill_group"):
                            break
            elif url.startswith("doc:"):
                needle = url[len("doc:"):].lower().replace("_", " ")
                ids = [j for j, ch in enumerate(chunks)
                       if ch.get("source_type") == "document" and needle in (ch.get("document_name") or "").lower().replace("_", " ")][:3]
            else:
                key = url.split("&t=")[0].rstrip("/")
                ids = list(by_url.get(key, []))
                if not ids:  # a page URL may be cited by records with fragments / query strings
                    ids = [j for j, ch in enumerate(chunks) if (ch.get("url") or "").startswith(key)][:3]
            if not ids:
                unresolved.append(f"{m.get('canon_id')}: {url}")
            evidence.append({"url": url, "source": ev.get("source", ""), "why": ev.get("why", ""), "chunk_ids": ids[:4]})
        out.append({"id": m.get("canon_id"), "chunk_idx": i, "questions": m.get("questions") or [], "answer": m.get("answer") or c.get("text", ""),
                    "keywords": m.get("keywords") or [],
                    "topics": m.get("topics") or [], "evidence": evidence,
                    "project": m.get("showcase") or "", "links": m.get("links") or []})
    return out, unresolved


def _client_rules(ks_dir: Path) -> list[tuple]:
    import re
    import yaml
    f = ks_dir / "profile" / "confidential.yaml"
    if not f.exists():
        return []
    rules = []
    for c in (yaml.safe_load(f.read_text(encoding="utf-8")) or {}).get("clients") or []:
        names = sorted((str(n) for n in c.get("names") or [] if n), key=len, reverse=True)
        if names:
            rules.append((re.compile(r"\b(?:" + "|".join(re.escape(n) for n in names) + r")\b", re.I), str(c.get("as") or "a client")))
    return rules


def _mask(value, rules):
    if isinstance(value, str):
        for rx, rep in rules:
            value = rx.sub(rep, value)
        return value
    if isinstance(value, list):
        return [_mask(v, rules) for v in value]
    if isinstance(value, tuple):
        return tuple(_mask(v, rules) for v in value)
    if isinstance(value, dict):
        return {k: _mask(v, rules) for k, v in value.items()}
    return value


def redact_clients(records: list, ks_dir: Path) -> int:
    """Replace confidential client names (profile/confidential.yaml) in every record."""
    rules = _client_rules(ks_dir)
    if not rules:
        return 0
    n = 0
    for r in records:
        before = (r.text, r.title, repr(r.metadata), repr(getattr(r, "entities", None)))
        r.text = _mask(r.text, rules)
        r.title = _mask(r.title, rules)
        r.metadata = _mask(r.metadata, rules)
        if getattr(r, "entities", None):
            r.entities = [e for e in _mask(list(r.entities), rules)
                          if not (isinstance(e, (list, tuple)) and len(e) > 1 and any(rep == e[1] for _, rep in rules))]
        if before != (r.text, r.title, repr(r.metadata), repr(getattr(r, "entities", None))):
            n += 1
    return n


_ORG_GENERIC = {"technologies", "technology", "enterprises", "services", "medical", "consultancy", "systems",
                "solutions", "tech", "labs", "india", "limited", "private", "global", "group", "the"}


def _squash(t: str) -> str:
    import re
    return re.sub(r"[^a-z0-9]", "", str(t).lower())


def build_showcase(ks_dir: Path, site_dir: Path, canon: list[dict]) -> dict:
    """Per project: how to try it (website links), its source, pictures that explain
    it (an architecture/workflow diagram, repo screenshots) and real code.
    Keyed by the project name the curated answers carry."""
    import json as _json
    projects = {}
    pj = ks_dir / "website" / "projects.json"
    if pj.exists():
        data = _json.loads(pj.read_text(encoding="utf-8"))
        for p in (data if isinstance(data, list) else data.get("projects", [])):
            projects[_squash(p.get("name", ""))] = p
    code = {}
    cj = ks_dir / "github" / "code.json"
    if cj.exists():
        for r in _json.loads(cj.read_text(encoding="utf-8")).get("repos", []):
            code[_squash(r.get("name", ""))] = r
    alias = {"hockeyworldcup": "hockeyworldcup2026women"}
    homes = {}
    rj = ks_dir / "github" / "repos.json"
    if rj.exists():
        rows = _json.loads(rj.read_text(encoding="utf-8"))
        for r in (rows.get("repos", rows) if isinstance(rows, dict) else rows):
            if r.get("homepage"):
                homes[_squash(r.get("name", ""))] = r["homepage"]
    out = {}
    for name in sorted({e.get("project") for e in canon if e.get("project")}):
        k = _squash(name)
        web = projects.get(k) or next((v for kk, v in projects.items() if kk.startswith(k) or k.startswith(kk)), None)
        repo = code.get(k) or code.get(alias.get(k, ""))      # exact repo only: never an older or unrelated one
        links = []
        for l in (web or {}).get("links", []):
            if l.get("url") and not any(x["url"] == l["url"] and x["kind"] == l.get("kind") for x in links):
                links.append({"label": l.get("label", "").split(" · ")[0].strip(), "url": l["url"], "kind": l.get("kind", "live")})
        for l in links:     # the repository was renamed; GitHub Pages does not redirect
            l["url"] = l["url"].replace("prashobhpaul.github.io/Knowledge-Fabric", "prashobhpaul.github.io/Prashobh_Knowledge_Factory")
        home = homes.get(k) or homes.get(alias.get(k, ""))
        if home and not any(l["kind"] == "live" for l in links):
            links.insert(0, {"label": "Open the live app", "url": home, "kind": "live"})
        diagram = site_dir / "assets" / "diagrams" / f"{k}.svg"
        files = (repo or {}).get("files", [])[:2]
        out[name] = {
            "links": links,
            "source": (repo or {}).get("url", "") if repo else "",
            "diagram": f"assets/diagrams/{k}.svg" if diagram.exists() else "",
            "images": [i for i in (repo or {}).get("images", []) if i.get("kind") in ("architecture", "screen")][:4],
            "code": [{"repo": repo["name"], "path": f["path"], "url": f["url"], "language": f["language"],
                      "excerpt": "\n".join(f["excerpt"].splitlines()[:28])} for f in files] if repo else [],
        }
    return out


def build_timeline(chunks: list[dict], ks_dir: Path) -> list[dict]:
    """The career in order, from profile.yaml, with each role's proof record: lets the
    twin answer "Which company did you join after TCS?" from structured data."""
    import yaml
    prof = ks_dir / "profile" / "profile.yaml"
    if not prof.exists():
        return []
    exp = (yaml.safe_load(prof.read_text(encoding="utf-8")) or {}).get("experience") or []
    out = []
    for r in sorted(exp, key=lambda r: str(r.get("start") or "")):
        org = str(r.get("organization") or "")
        if not org:
            continue
        aliases = {org.lower()}
        if r.get("short_name"):
            aliases.add(str(r["short_name"]).lower())
        aliases.update(w for w in org.lower().split() if len(w) >= 4 and w not in _ORG_GENERIC)
        ids = [j for j, ch in enumerate(chunks)
               if (ch.get("meta") or {}).get("record_type") == "role" and org.lower() in
               (str((ch.get("meta") or {}).get("organization", "")) + " " + str(ch.get("text", ""))[:200]).lower()][:2]
        out.append({"organization": org, "short_name": r.get("short_name") or "", "role": r.get("role") or "",
                    "start": str(r.get("start") or ""), "end": str(r.get("end") or ""), "location": r.get("location") or "",
                    "aliases": sorted(aliases), "chunk_ids": ids})
    return out


def build(source_dir: Path, ks_dir: Path, out_path: Path, semantic_path: Path) -> dict:
    print("=" * 66)
    print("  KNOWLEDGE FABRIC - BUILD")
    print("=" * 66)

    connectors = registry_from({"documents": source_dir, "knowledge_sources": ks_dir})
    if not connectors:
        print(f"[!] No sources found ({source_dir}, {ks_dir})", file=sys.stderr)
        sys.exit(1)

    print(f"\n[1/7] Ingesting from {len(connectors)} connector(s)")
    records: list = []
    per_connector: list[dict] = []
    for c in connectors:
        got = list(c.fetch())
        records.extend(got)
        per_connector.append({"name": c.name, "source_type": c.source_type, "records": len(got)})
        print(f"      {c.name:34s} {len(got):>6} records  [{c.source_type}]")
    print(f"      {'TOTAL':34s} {len(records):>6} records")

    # ---- Text normalisation -------------------------------------------------
    # Runs before chunking so that BM25, LSA and the graph all index repaired
    # text. PDF extraction artefacts ("Mea surement") are fixed here, once.
    print("\n[2/7] Normalising text")
    vocab = build_vocabulary([r.text for r in records])
    repaired = 0
    for r in records:
        cleaned = normalize(r.text, vocab)
        if cleaned != r.text:
            repaired += 1
        r.text = cleaned
    print(f"      corpus lexicon {len(vocab)} words · {repaired}/{len(records)} records repaired")
    hidden = redact_clients(records, ks_dir)
    print(f"      client names kept confidential: {hidden} records masked")

    print("\n[3/7] Chunking")
    chunks, aligned = records_to_chunks(records)
    packed = sum(1 for r in aligned if r.metadata.get("record_type") in PACKED_RECORD_TYPES)
    print(f"      {len(chunks)} chunks  ({packed} packed from documents/pages, {len(chunks)-packed} structured)")

    print("\n[4/7] Lexical index (BM25)")
    bm25 = build_bm25_index(chunks)
    print(f"      vocab={len(bm25['vocab'])}  avgdl={bm25['avgdl']:.1f}")

    print("\n[5/7] Semantic index (LSA)")
    semantic = build_semantic_index([c.text for c in chunks])
    if semantic.get("enabled"):
        print(f"      dims={semantic['dims']}  vocab={semantic['stats']['vocabulary']}  "
              f"variance={semantic['explained_variance']:.1%}")
    else:
        print(f"      disabled: {semantic.get('reason')}")

    print("\n[6/7] Knowledge graph")
    graph = build_knowledge_graph(aligned, [c.chunk_id for c in chunks])
    gs = graph["stats"]
    print(f"      {gs['node_count']} nodes  {gs['edge_count']} edges  "
          f"{gs['cross_source_entities']} cross-source entities")
    for et, n in sorted(gs["edges_by_type"].items(), key=lambda kv: -kv[1]):
        print(f"        {et:16s} {n}")

    print("\n[7/7] Assembling index")

    # The browser reads entities using fixed field names (mention_count,
    # chunk_ids, document_ids). Those names are a published contract: graph.js,
    # insights.js and main.js all index them directly, and a renamed field does
    # not fail loudly — it silently yields `undefined` deep inside a click
    # handler. Emit both the legacy names and the richer additions.
    chunk_to_doc = {c.chunk_id: c.document_id for c in chunks}
    entities = []
    for n in graph["nodes"]:
        chunk_ids = n["chunks"]
        document_ids = sorted({chunk_to_doc[c] for c in chunk_ids if c in chunk_to_doc})
        entities.append({
            "id": n["id"], "name": n["name"], "canonical": n["name"].lower(), "kind": n["kind"],
            "mention_count": n["mentions"], "chunk_ids": chunk_ids, "document_ids": document_ids,
            "count": n["mentions"], "mentions": n["mentions"], "chunks": chunk_ids,
            "sources": n["sources"], "cross_source": n.get("cross_source", False),
            "degree": n.get("degree", 0),
        })

    relationships = [{
        "source": e["source"], "target": e["target"], "weight": e["weight"],
        "kind": e["type"], "type": e["type"], "evidence_chunks": e["evidence"],
    } for e in graph["edges"]]

    chunk_entities: list[list[int]] = [[] for _ in chunks]
    idx_of = {c.chunk_id: i for i, c in enumerate(chunks)}
    for n in graph["nodes"]:
        for ch in n["chunks"]:
            i = idx_of.get(ch)
            if i is not None and n["id"] not in chunk_entities[i]:
                chunk_entities[i].append(n["id"])

    manifest = load_manifest(ks_dir)
    crawled = ((manifest.get("sources") or {}).get("website") or {}).get("last_good_sync") \
        or ((manifest.get("sources") or {}).get("website") or {}).get("last_synced") or ""
    documents_meta: dict = {}
    doc_text_head: dict = {}
    for c, rec in zip(chunks, aligned):
        doc_text_head.setdefault(c.document_name, "")
        if len(doc_text_head[c.document_name]) < 4000:
            doc_text_head[c.document_name] += " " + c.text

    for c, rec in zip(chunks, aligned):
        d = documents_meta.setdefault(c.document_name, {
            "id": c.document_id, "name": c.document_name,
            "source_type": rec.source_type, "source_system": rec.source_system,
            "domain": rec.metadata.get("domain", ""),
            "record_type": rec.metadata.get("record_type", ""),
            "doc_type": rec.metadata.get("doc_type", rec.metadata.get("record_type", "")),
            "organization": rec.metadata.get("organization", ""),
            "project": rec.metadata.get("project", ""),
            "url": rec.url, "page_count": rec.metadata.get("page_count", 1),
            "chunk_count": 0,
            **{f"date_{k}": v for k, v in resolve_date(
                source_path=Path(rec.metadata["source_path"]) if rec.metadata.get("source_path") else None,
                text=doc_text_head.get(c.document_name, ""),
                source_timestamp=rec.metadata.get("published") or rec.metadata.get("as_of"),
                crawl_timestamp=crawled if rec.source_type == "website" else None,
            ).items()},
        })
        d["chunk_count"] += 1

    # Sentence layer. Shipped as offsets rather than duplicated strings — the
    # client slices chunk.text, so this costs ~4 numbers per sentence instead of
    # a second copy of the corpus.
    serialized = []
    kind_counts: dict = defaultdict(int)
    for i, (c, rec) in enumerate(zip(chunks, aligned)):
        infos = analyse(c.text, vocab)
        for si in infos:
            kind_counts[si.kind] += 1
        serialized.append({
            "id": c.chunk_id, "document_id": c.document_id, "document_name": c.document_name,
            "page": c.page, "section_path": c.section_path,
            "paragraph_indices": c.paragraph_indices, "text": c.text,
            "paragraph_excerpt": c.paragraph_excerpt, "entities": chunk_entities[i],
            "source_type": rec.source_type, "source_system": rec.source_system,
            "url": rec.url, "meta": rec.metadata,
            "quality": chunk_quality(infos),
            "sents": [{"o": si.offset, "l": si.length, "k": si.kind, "q": si.quality} for si in infos],
        })
    total_sents = sum(kind_counts.values())
    usable = kind_counts.get("prose", 0)
    print(f"      sentences {total_sents} · usable prose {usable} ({usable / max(total_sents, 1):.0%})")
    for k, n in sorted(kind_counts.items(), key=lambda kv: -kv[1]):
        print(f"        {k:10} {n}")

    # ---- Factory ↔ Fabric handshake: what was synced, when -----------------
    chunks_by_source: dict[str, int] = defaultdict(int)
    for s in serialized:
        chunks_by_source[s["source_type"]] += 1
    factory_map = {"website": "website", "youtube": "youtube", "github": "github", "linkedin": "linkedin"}
    sources = []
    for pc in per_connector:
        fsrc = factory_map.get(pc["source_type"])
        fm = (manifest.get("sources") or {}).get(fsrc, {}) if fsrc else {}
        sources.append({
            "source_type": pc["source_type"], "system": pc["name"], "records": pc["records"],
            "chunks": chunks_by_source.get(pc["source_type"], 0),
            "synced_by": "knowledge_factory" if fsrc else "repository",
            "last_synced": fm.get("last_synced", ""), "status": fm.get("status", "committed"),
            "notes": fm.get("notes", []),
        })

    # ---- Curator ledger: open gaps and resolved flags, for the site and the tests
    flags_path = ks_dir / "flags" / "flags.json"
    flags_out = None
    if flags_path.exists():
        try:
            led = json.loads(flags_path.read_text(encoding="utf-8"))
            flags_out = {
                "generated_at": led.get("generated_at", ""),
                "summary": led.get("summary", {"open": 0, "resolved": 0, "regressed": 0}),
                "items": [{
                    "id": f.get("id"), "question": f.get("question", ""), "kind": f.get("kind", ""),
                    "status": f.get("status", ""), "url": f.get("url", ""),
                    "score": (f.get("check") or {}).get("score", 0.0),
                    "nearest": ((f.get("check") or {}).get("top") or {}).get("document", ""),
                } for f in led.get("flags", [])],
            }
            print(f"\n      curator ledger: {flags_out['summary']}")
        except (json.JSONDecodeError, AttributeError):
            flags_out = None

    canon_entries, canon_unresolved = build_canon(serialized)
    for _u in canon_unresolved:
        print(f"      [canon] evidence not found in the index: {_u}")
    print(f"      canon: {len(canon_entries)} curated answers · {len(canon_unresolved)} unresolved evidence links")

    index = {
        "version": "3.0",
        "generator": "knowledge-fabric/personal",
        "subject": (manifest.get("person") or {}).get("name", ""),
        "documents": list(documents_meta.values()),
        "chunks": serialized,
        "entities": entities,
        "relationships": relationships,
        "graph": {"node_types": graph["node_types"], "edge_types": graph["edge_types"], "stats": gs},
        "facets": build_facets(aligned),
        "sources": sources,
        "flags": flags_out,
        "canon": canon_entries,
        "timeline": build_timeline(serialized, ks_dir),
        "showcase": build_showcase(ks_dir, out_path.parent.parent, canon_entries),
        "canon_unresolved": canon_unresolved,
        "factory": {"generated_at": manifest.get("generated_at", ""), "generator": manifest.get("generator", "")},
        "bm25": bm25,
        "retrieval": {
            "modes": ["lexical", "semantic", "hybrid"],
            "default": "hybrid" if semantic.get("enabled") else "lexical",
            "fusion": "reciprocal_rank_fusion", "rrf_k": 60,
        },
        "stats": {
            "document_count": len(documents_meta), "chunk_count": len(chunks),
            "entity_count": len(entities), "relationship_count": len(relationships),
            "vocab_size": len(bm25["vocab"]), "source_count": len(connectors),
            "record_count": len(records),
            "cross_source_entities": gs["cross_source_entities"],
            "semantic_enabled": bool(semantic.get("enabled")),
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    with open(semantic_path, "w", encoding="utf-8") as f:
        json.dump(semantic, f, separators=(",", ":"))

    i_mb = out_path.stat().st_size / 1024 / 1024
    s_mb = semantic_path.stat().st_size / 1024 / 1024
    print(f"\n[OK] {out_path}      {i_mb:.2f} MB")
    print(f"[OK] {semantic_path}  {s_mb:.2f} MB")
    print(f"[OK] total payload    {i_mb + s_mb:.2f} MB")
    print("=" * 66)
    return index


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, default=Path("docs_source"))
    ap.add_argument("--knowledge", type=Path, default=Path("knowledge_sources"))
    ap.add_argument("--out", type=Path, default=Path("site/data/index.json"))
    ap.add_argument("--semantic-out", type=Path, default=Path("site/data/semantic.json"))
    args = ap.parse_args()
    build(args.source, args.knowledge, args.out, args.semantic_out)


if __name__ == "__main__":
    main()
