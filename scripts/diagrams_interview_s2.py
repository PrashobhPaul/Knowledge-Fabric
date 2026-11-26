#!/usr/bin/env python3
"""Whiteboard diagrams for the Session 2 interview answers (canon_interview_s2.yaml).

The architectures Prashobh draws for the enterprise-architecture questions: the
Enterprise AI Knowledge Assistant, permission-aware RAG for 5,000 users with several
LLM providers, the LLM gateway behind the provider-switch and sensitive-data
follow-ups, and the investigation plan for the 12s / 18% / ₹8 lakh challenge. Same
renderer and style as scripts/diagrams.py; each stage carries what the answer says.

    python scripts/diagrams_interview_s2.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from diagrams import OUT, render  # noqa: E402

DIAGRAMS = {
    "iv2-knowledge-assistant": ("Enterprise AI Knowledge Assistant", [
        ("Sources, connectors and ingestion", ["SharePoint · Confluence · internal databases (change events)",
                                               "Parsing: PDF, DOCX, PPTX, XLSX · OCR for scans and images"]),
        ("Chunking, metadata and ACLs", ["Structure-aware chunks on headings and tables",
                                         "Doc ID, version, department, ACL groups, classification"]),
        ("Storage", ["Object store · PostgreSQL (documents, ACLs, lineage)",
                     "Vector + keyword index (OpenSearch)"]),
        ("Permission-filtered hybrid retrieval", ["BM25 + dense, reciprocal rank fusion, ACL filter in query",
                                                  "Cross-encoder reranking · no-answer path"]),
        ("LLM gateway", ["Provider abstraction · routing small vs frontier model",
                         "PII redaction · semantic cache · failover"]),
        ("Orchestration and agents", ["LangGraph router: direct answer, RAG or agent",
                                      "Read-only MCP tools with the user's permissions"]),
        ("Observability, evaluation and audit", ["Logs, OpenTelemetry traces, latency, token and cost metrics",
                                                 "Golden-set release gate · immutable audit and lineage"]),
    ]),
    "iv2-permission-aware-rag": ("Permission-aware enterprise RAG · 5,000 users", [
        ("Sources and ACL sync", ["Documents plus their ACLs from the source systems",
                                  "Adds, updates, permission changes, deletes (tombstones)"]),
        ("Chunk and tag", ["Doc ID, version, ACL groups, department",
                           "Classification and tenant on every chunk"]),
        ("Identity", ["SSO · groups and attributes resolved per user",
                      "RBAC for features · ABAC for data"]),
        ("Pre-filtered hybrid retrieval", ["ACL filter inside the index query, before ranking",
                                           "BM25 + dense (RRF) → cross-encoder reranking"]),
        ("LLM gateway, several providers", ["Adapters · routing by task, cost and classification",
                                            "PII redaction · failover · per-user rate limits"]),
        ("Grounded answer and audit", ["Cited, streamed answer · cache keyed by permissions",
                                       "Immutable audit: user, permissions, chunks, versions"]),
        ("Evaluation", ["Golden set + forbidden-document tests gate releases",
                        "Sampled faithfulness and user feedback in production"]),
    ]),
    "iv2-llm-gateway": ("LLM gateway · switch providers, keep data inside", [
        ("Application asks for a capability", ["A grounded answer, a cheap classification, an embedding",
                                               "One API; no provider SDK in application code"]),
        ("Policy and identity", ["Tenant, user and data classification on every call",
                                 "Rate limits and token budgets"]),
        ("PII redaction", ["Mask personal data, secrets and client names",
                           "Restricted data never leaves the network"]),
        ("Routing and cache", ["Route by task, cost and classification",
                               "Semantic cache scoped by permission"]),
        ("Provider adapters", ["OpenAI · Anthropic · Gemini · Bedrock · Azure OpenAI",
                               "Self-hosted open model (vLLM) for restricted data"]),
        ("Response path", ["Schema validation · output filter · values re-inserted",
                           "Retries, circuit breakers, failover"]),
        ("Release and observe", ["Per-model prompts · golden eval set · canary, rollback",
                                 "Tokens, latency and cost per tenant in the trace"]),
    ]),
    "iv2-performance-plan": ("From 12s, 18% and ₹8 lakh: the investigation plan", [
        ("Measure before changing anything", ["OpenTelemetry trace: latency per stage",
                                              "Labelled eval set · cost per stage (tokens, infra)"]),
        ("Retrieval: 72% → 90%", ["Structure-aware chunking · hybrid BM25 + dense (RRF)",
                                  "Metadata filters · cross-encoder reranking"]),
        ("Hallucination: 18% → under 5%", ["Grounded prompt, citations per claim, no-answer path",
                                           "Grounding check · faithfulness eval in CI"]),
        ("Latency: 12s → 4s", ["Parallel async calls · 5 best chunks, not 20",
                               "Streaming · cached embeddings and answers"]),
        ("Cost: ₹8 lakh → ₹5 lakh", ["Model routing · semantic cache · prompt caching",
                                     "Every substitution passes the eval set"]),
        ("Scale: 200 → 2,000 users", ["Stateless pods · horizontal autoscaling · queueing",
                                      "Gateway quota pooling · load test at 2,000"]),
        ("Change the model last", ["Only if the evaluation still shows a gap"]),
    ]),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (title, stages) in DIAGRAMS.items():
        (OUT / f"{key}.svg").write_text(render(title, stages), encoding="utf-8")
    print(f"{len(DIAGRAMS)} diagrams → {OUT}")


if __name__ == "__main__":
    main()
