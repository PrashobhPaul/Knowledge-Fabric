"""Pipeline tests — parsers, chunker, connectors, ontology, graph, BM25, semantic, factory."""
from __future__ import annotations

import json
import pathlib
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline import ontology  # noqa: E402
from pipeline.bm25_index import build_bm25_index  # noqa: E402
from pipeline.chunker import chunk_paragraphs, tokenize  # noqa: E402
from pipeline.connectors.base import KnowledgeRecord, registry_from  # noqa: E402
from pipeline.graph import build_knowledge_graph  # noqa: E402
from pipeline.parsers import parse_markdown, parse_pdf, parse_text  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


# =============================================================================
# Fixtures
# =============================================================================
@pytest.fixture
def md_doc(tmp_path):
    p = tmp_path / "sample.md"
    p.write_text("""# Top Heading

## Subsection One

The Knowledge Fabric ingests documents and builds a graph. BM25 retrieves passages with citations.

## Subsection Two

The Knowledge Fabric grounds every answer in a document, page, section, and paragraph. BM25 ranking is the retrieval engine.

### Deeper Section

Citations from the Knowledge Fabric include the document name and page number. BM25 scores drive the ranking.
""")
    return p


# =============================================================================
# Parsers
# =============================================================================
def test_markdown_parser_extracts_headings(md_doc):
    parsed = parse_markdown(md_doc)
    assert len(parsed.paragraphs) >= 3
    sections = [p.section_path for p in parsed.paragraphs]
    assert any("Subsection One" in path for path in sections)
    assert any("Deeper Section" in path for path in sections)


def test_text_parser_handles_caps_headings(tmp_path):
    p = tmp_path / "sample.txt"
    p.write_text("INTRODUCTION\n\nThis is the body of the introduction.\n\nDETAILS\n\nThis is the body of the details section.")
    parsed = parse_text(p)
    assert len(parsed.paragraphs) == 2
    assert parsed.paragraphs[0].section_path == ["INTRODUCTION"]


def test_resume_pdf_splits_into_sections():
    """A one-page resume has no blank lines in its extracted text; the parser must
    rebuild paragraphs from layout cues instead of emitting one giant block."""
    pdf = ROOT / "docs_source" / "resume" / "Prashobh_Paul_Resume.pdf"
    if not pdf.exists():
        pytest.skip("resume PDF not present")
    parsed = parse_pdf(pdf)
    assert len(parsed.paragraphs) >= 15
    tops = {p.section_path[0] for p in parsed.paragraphs if p.section_path}
    assert "PROFESSIONAL EXPERIENCE" in tops
    assert any("Qualizeal" in p.section_path for p in parsed.paragraphs)


# =============================================================================
# Chunker / tokeniser
# =============================================================================
def test_chunker_preserves_breadcrumbs(md_doc):
    parsed = parse_markdown(md_doc)
    chunks = chunk_paragraphs(parsed.paragraphs, document_id=0, document_name=md_doc.name)
    assert chunks
    for c in chunks:
        assert c.document_name == md_doc.name and c.text and c.tokens
        assert isinstance(c.section_path, list)


def test_tokenize_lowercases_and_filters():
    tokens = tokenize("Knowledge Fabric uses BM25.")
    assert {"knowledge", "fabric", "bm25"} <= set(tokens)
    assert "." not in tokens


# =============================================================================
# Ontology
# =============================================================================
def test_ontology_collapses_surface_forms():
    assert ontology.canonical("Project", "InvestIQ") == "Invest.IQ"
    assert ontology.canonical("Project", "Invest.IQ") == "Invest.IQ"
    assert ontology.canonical("Organization", "TCS") == "Tata Consultancy Services"
    assert ontology.canonical("Organization", "Tata Consultancy Services (TCS)") == "Tata Consultancy Services"
    assert ontology.canonical("Place", "Kee Monastery") == "Key Monastery"
    assert ontology.canonical("Place", "Key Monastery") == "Key Monastery"


def test_ontology_detect_is_deduplicated_and_typed():
    found = ontology.detect("Built with LangGraph and CrewAI at Qualizeal, then LangGraph again.")
    assert found.count(("Technology", "LangGraph")) == 1
    assert ("Organization", "Qualizeal") in found
    kinds = {k for k, _ in found}
    assert kinds <= set(ontology.ALIASES.keys())


# =============================================================================
# Connectors
# =============================================================================
def test_registry_degrades_gracefully(tmp_path):
    assert registry_from({"documents": tmp_path / "nope", "knowledge_sources": tmp_path / "also_nope"}) == []


def test_profile_connector_verbalises_roles():
    ks = ROOT / "knowledge_sources"
    if not (ks / "profile" / "profile.yaml").exists():
        pytest.skip("profile not present")
    from pipeline.connectors.profile import ProfileConnector
    records = list(ProfileConnector(ks / "profile" / "profile.yaml").fetch())
    roles = [r for r in records if r.metadata["record_type"] == "role"]
    assert roles, "no role records"
    for r in roles:
        assert "worked at" in r.text, r.text[:80]
        assert r.metadata["organization"]
        assert ("Organization", r.metadata["organization"]) in r.entities
    types = {r.metadata["record_type"] for r in records}
    assert {"person_summary", "education", "skill_group", "service", "contact"} <= types


def test_youtube_connector_resolves_places_and_format():
    ks = ROOT / "knowledge_sources" / "youtube"
    if not (ks / "videos.json").exists():
        pytest.skip("youtube data not present")
    from pipeline.connectors.youtube import YouTubeConnector
    records = list(YouTubeConnector(ks).fetch())
    videos = [r for r in records if r.metadata["record_type"] == "video"]
    assert videos
    assert any(r.metadata.get("place") for r in videos), "no video resolved a Place"
    assert all(r.metadata["format"] in {"short", "long", "unknown", "video"} for r in videos)
    assert all(r.url.startswith("https://www.youtube.com/watch?v=") for r in videos)
    assert any(r.metadata["record_type"] == "channel" for r in records)


def test_github_connector_joins_repo_to_project():
    path = ROOT / "knowledge_sources" / "github" / "repos.json"
    if not path.exists():
        pytest.skip("github data not present")
    from pipeline.connectors.github import GitHubConnector
    records = list(GitHubConnector(path).fetch())
    assert records
    projects = {r.metadata["project"] for r in records}
    assert "Invest.IQ" in projects, "InvestIQ repository did not resolve to the Invest.IQ project"
    assert all(r.url.startswith("https://github.com/") for r in records)


def test_website_connector_emits_three_record_shapes():
    ks = ROOT / "knowledge_sources" / "website"
    if not (ks / "pages.json").exists():
        pytest.skip("website data not present")
    from pipeline.connectors.website import WebsiteConnector
    records = list(WebsiteConnector(ks).fetch())
    types = {r.metadata["record_type"] for r in records}
    assert {"web_paragraph", "project", "faq"} <= types
    for r in records:
        assert r.url.startswith("http")


# =============================================================================
# Graph — the cross-source join
# =============================================================================
def test_graph_bridges_sources_on_canonical_project():
    recs = [
        KnowledgeRecord(
            source_type="website", source_system="site", source_id="p", title="Invest.IQ",
            text="Invest.IQ is an AI stock research app built with React and Supabase.",
            metadata={"record_type": "project", "document_name": "site · Works", "project": "Invest.IQ"},
            entities=[("Project", "Invest.IQ"), ("Technology", "React"), ("Technology", "Supabase")]),
        KnowledgeRecord(
            source_type="github", source_system="GitHub", source_id="r", title="InvestIQ",
            text="InvestIQ is a public GitHub repository written in TypeScript.",
            metadata={"record_type": "repository", "document_name": "GitHub · InvestIQ", "project": "Invest.IQ"},
            entities=[("Project", "InvestIQ"), ("Technology", "TypeScript"), ("Platform", "GitHub")]),
    ]
    g = build_knowledge_graph(recs, [0, 1])
    projects = [n for n in g["nodes"] if n["kind"] == "Project"]
    assert len(projects) == 1, [p["name"] for p in projects]
    assert projects[0]["name"] == "Invest.IQ"
    assert set(projects[0]["sources"]) == {"website", "github"}
    assert projects[0]["cross_source"] is True
    assert g["stats"]["cross_source_entities"] == 1
    assert "USES" in g["edge_types"] and "BUILT" in g["edge_types"]


# =============================================================================
# Indexes
# =============================================================================
def test_bm25_index_shape(md_doc):
    parsed = parse_markdown(md_doc)
    chunks = chunk_paragraphs(parsed.paragraphs, document_id=0, document_name=md_doc.name)
    idx = build_bm25_index(chunks)
    assert idx["vocab"] and len(idx["idf"]) == len(idx["vocab"])
    assert len(idx["doc_len"]) == len(chunks)


def test_semantic_index_recovers_vocabulary_neighbours():
    from pipeline.semantic import build_semantic_index, embed_query, semantic_scores
    texts = [
        "Clinical NLP pipelines process hospital EMR records and HL7 clinical data.",
        "Hospital records in EMR systems are parsed by clinical NLP for HL7 data.",
        "EMR and HL7 clinical data flow through NLP pipelines in hospitals.",
        "Travel videos from Spiti Valley show monasteries and mountain roads.",
        "Monasteries in Spiti Valley appear in travel videos about mountains.",
        "Mountain roads and monasteries fill the Spiti travel vlog.",
    ] * 3
    sem = build_semantic_index(texts)
    assert sem["enabled"], sem
    qv = embed_query(sem, "medical patient data processing")
    if qv is None:
        pytest.skip("query terms absent from toy vocabulary")
    scores = semantic_scores(sem, qv)
    best = int(scores.argmax())
    assert "clinical" in texts[best].lower() or "hospital" in texts[best].lower()


# =============================================================================
# End-to-end build + Factory
# =============================================================================
def test_build_emits_browser_contract(tmp_path):
    from pipeline.build_index import build
    docs = ROOT / "docs_source"
    ks = ROOT / "knowledge_sources"
    if not ks.exists():
        pytest.skip("knowledge_sources not present")
    out, sem = tmp_path / "index.json", tmp_path / "semantic.json"
    index = build(docs, ks, out, sem)
    assert index["stats"]["source_count"] >= 2
    assert index["stats"]["cross_source_entities"] > 0, "no entity joins two sources — not a fabric"
    assert "sources" in index and index["sources"], "Factory handshake missing"
    e = index["entities"][0]
    for field in ("id", "name", "kind", "mention_count", "chunk_ids", "document_ids"):
        assert field in e
    ids = {x["id"] for x in index["entities"]}
    for r in index["relationships"]:
        assert r["source"] in ids and r["target"] in ids
    chunk_ids = {c["id"] for c in index["chunks"]}
    for x in index["entities"][:50]:
        for cid in x["chunk_ids"]:
            assert cid in chunk_ids
    assert json.loads(out.read_text())["version"] == "3.0"


def test_factory_youtube_merge_never_forgets_a_video():
    from knowledge_factory.sources.youtube import merge
    existing = [{"id": "a", "title": "Old", "tags": ["x"], "duration": "PT1M", "viewCount": 10}]
    fresh = [{"id": "a", "title": "Old", "viewCount": 12}, {"id": "b", "title": "New #shorts", "viewCount": 1}]
    merged = {v["id"]: v for v in merge(existing, fresh)}
    assert set(merged) == {"a", "b"}
    assert merged["a"]["viewCount"] == 12          # fresh number wins
    assert merged["a"]["tags"] == ["x"]            # richer field kept
    assert merged["a"]["format"] == "short"
    assert merged["b"]["format"] == "short"


def test_factory_faq_filter_drops_bot_voice():
    from knowledge_factory.sources.website import _extract_chatbot_kb
    html = """<script>const KB = [
      { p: /hello/i, q: ['hello','hi'], a: (_) => `Hi there! I'm Prashobh's AI assistant.` },
      { p: /skills/i, q: ['what are his skills'], a: (_) => `His core strengths include GenAI, Agentic AI and NLP. All applied to real problems.` },
      { p: /rag/i, q: ['what is rag'], a: (_) => `RAG stands for Retrieval-Augmented Generation. Prashobh can help you implement it.` },
    ];</script>"""
    faqs = _extract_chatbot_kb(html, "https://example.test/")
    kinds = {f["questions"][0]: f["kind"] for f in faqs}
    assert "hello" not in kinds
    assert kinds["what are his skills"] == "about"
    assert kinds["what is rag"] == "explainer"


# =============================================================================
# Curator — flags to knowledge
# =============================================================================
def test_curator_resolves_covered_flags_and_proposes_the_rest(tmp_path):
    from knowledge_factory.curator import parse_issue, run
    from pipeline.build_index import build
    ks = ROOT / "knowledge_sources"
    if not ks.exists():
        pytest.skip("knowledge_sources not present")
    out, sem = tmp_path / "index.json", tmp_path / "semantic.json"
    build(ROOT / "docs_source", ks, out, sem)
    fixture = json.loads((ROOT / "tests" / "fixtures" / "flags_fixture.json").read_text())
    flags = [parse_issue(i) for i in fixture]
    assert flags[0]["question"] == "What did Prashobh do at Tech Mahindra?"
    assert flags[0]["kind"] == "missing" and flags[0]["trace"] == {"intent": "CAREER"}
    result = run(flags, out, sem, close=False, out_dir=tmp_path / "flags")
    by_id = {f["id"]: f for f in result["ledger"]["flags"]}
    assert by_id[101]["status"] == "resolved", by_id[101]["check"]
    assert by_id[102]["status"] == "open", by_id[102]["check"]
    proposals = (tmp_path / "flags" / "proposals.md").read_text()
    assert "Flag #102" in proposals and "Flag #101" not in proposals
    assert "He spoke at an internal Qualizeal AI session" in proposals   # the reporter's fact, verbatim
    # second run: a resolved flag that is no longer an open issue stays as a regression check
    result2 = run([flags[1]], out, sem, close=False, out_dir=tmp_path / "flags")
    statuses = {f["id"]: f["status"] for f in result2["ledger"]["flags"]}
    assert statuses == {101: "resolved", 102: "open"}


# =============================================================================
# LinkedIn — official export + hand-maintained posts, no crawling
# =============================================================================
def test_linkedin_source_reads_export_and_posts_md(tmp_path):
    import shutil
    from knowledge_factory.sources.linkedin import sync
    out = tmp_path / "knowledge_sources"
    (out / "linkedin").mkdir(parents=True)
    shutil.copytree(ROOT / "tests" / "fixtures" / "linkedin_export", out / "linkedin" / "export")
    (out / "linkedin" / "posts.md").write_text(
        "## 2026-11-20 · https://www.linkedin.com/posts/manual-1\nA hand-pasted post about knowledge graphs and ontologies. #KnowledgeGraphs\n")
    res = sync({"linkedin": {"profile_url": "https://www.linkedin.com/in/x/"}}, out, tmp_path)
    assert res.status == "ok"
    posts = json.loads((out / "linkedin" / "posts.json").read_text())["posts"]
    assert [p["date"] for p in posts] == ["2026-11-20", "2026-10-02"]      # "Short." dropped, newest first
    events = json.loads((out / "linkedin" / "events.json").read_text())["events"]
    assert events[0]["name"] == "Microsoft AI Tour Mumbai 2025" and events[0]["date"] == "2025-12-18"
    extra = json.loads((out / "linkedin" / "profile_extra.json").read_text())
    assert extra["certifications"][0]["authority"] == "Amazon Web Services"

    from pipeline.connectors.linkedin import LinkedInConnector
    records = list(LinkedInConnector(out / "linkedin").fetch())
    types = {r.metadata["record_type"] for r in records}
    assert {"post", "event", "certification"} <= types
    post = next(r for r in records if r.metadata["record_type"] == "post" and "LangGraph" in r.text)
    assert post.text.startswith("Prashobh Paul wrote on LinkedIn on 2 October 2026:")
    assert ("Technology", "LangGraph") in post.entities and ("Domain", "BFSI") in post.entities
    ev = next(r for r in records if r.metadata["record_type"] == "event")
    assert ("Event", "Microsoft AI Tour Mumbai 2025") in ev.entities
    assert all(r.url for r in records)
