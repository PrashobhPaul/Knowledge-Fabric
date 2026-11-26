#!/usr/bin/env python3
"""Architecture diagrams for the interview answers (canon_interview_s1.yaml), as SVG.

The whiteboard questions of Session 1 are answered with a drawing as well as words:
the most complex system he architected (the clinical NLP platform behind the
physician's note reader), the end-to-end RAG architecture, and permission-aware
RAG. Same renderer and rules as scripts/diagrams.py: a short vertical flow of
stages, each carrying only what the answer itself says.

    python scripts/diagrams_interview_s1.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from diagrams import OUT, render  # noqa: E402

DIAGRAMS = {
    "iv1-clinical-nlp-platform": ("Clinical NLP platform · physician's note reader", [
        ("EMR sources", ["Epic and Meditech across 60+ US hospitals", "HL7 messages · FHIR resources · MAR medication records"]),
        ("Ingestion and per-patient collation", ["Physician notes, nursing notes, medication records", "Brought together for each patient"]),
        ("Clinical NLP", ["Abbreviations · negation · spelling variants", "Many small, separately tested components"]),
        ("Ontology mapping", ["SNOMED · LOINC · ICD-10", "One vocabulary joins every hospital's notes"]),
        ("Patient relationship graph", ["Conditions, medications, labs and events"]),
        ("Real-time analytics and the note reader", ["Predictive models for patient outcomes", "Every finding traced back to its source"]),
    ]),
    "iv1-rag-pipeline": ("RAG, from document ingestion to response", [
        ("Sources and connectors", ["SharePoint · Confluence · databases · file shares", "Change detection · ACLs copied from the source"]),
        ("Parse, enrich, chunk", ["Layout-aware parsing, OCR for scans", "Metadata · structure-aware chunks"]),
        ("Index", ["Vector index + BM25 keyword index", "Content hashes for incremental updates"]),
        ("Retrieve", ["Permission and metadata filters inside the query", "Hybrid search fused with RRF · cross-encoder rerank"]),
        ("Generate", ["Token-budgeted context with source IDs", "Cited answer · guardrails · honest no-answer"]),
        ("Evaluate and observe", ["Golden set in CI · traces · user feedback", "Cost and latency per request"]),
    ]),
    "iv1-permission-aware-rag": ("Permission-aware RAG for 20,000 documents", [
        ("Sources with their ACLs", ["SharePoint · Confluence · databases", "Content and permissions synced together"]),
        ("Incremental indexing", ["Change feeds · content hashes · re-embed only what changed", "Permission changes and deletes applied first"]),
        ("Permission-tagged index", ["Every chunk: ACL, department, classification, version", "Separate namespaces and keys for HR, legal, finance"]),
        ("Identity-aware retrieval", ["SSO identity and groups resolved per request", "Pre-filter inside hybrid search · deny by default"]),
        ("Grounded generation", ["The LLM sees only authorized chunks", "Citations · caches keyed by permission set"]),
        ("Audit and evaluation", ["Who asked, what was retrieved, what was answered", "Leakage test set: zero leaked chunks gates every deploy"]),
    ]),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (title, stages) in DIAGRAMS.items():
        (OUT / f"{key}.svg").write_text(render(title, stages), encoding="utf-8")
    print(f"{len(DIAGRAMS)} diagrams → {OUT}")


if __name__ == "__main__":
    main()
