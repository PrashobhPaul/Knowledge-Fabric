#!/usr/bin/env python3
"""Whiteboard diagrams for the Enterprise GenAI Architect advanced interview (canon_interview_l2.yaml).

The architectures and plans Prashobh draws for the next-level playbook
(tests/interview_brief_l2.md): the Enterprise GenAI platform for 30,000 employees
and its first 90-day slice, the capacity and cost sizing behind it, the
serving-capacity estimate, the risk-tiering framework, the response to the
autonomous agent incident (Scenario B), and the PhD hypothesis with its planned
evaluation on Eidolon. Same renderer and style as scripts/diagrams.py; each stage
carries only what the answer says, and the PhD diagram shows a plan, not results.

    python scripts/diagrams_interview_l2.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from diagrams import OUT, render  # noqa: E402

DIAGRAMS = {
    "iv4-genai-platform": ("Enterprise GenAI platform · 30,000 employees", [
        ("Discovery before drawing", ["Top use cases and owners · residency scope · actions",
                                      "Assume ~20 req/s peak · 99.9% · resident data in-region"]),
        ("Experiences", ["Chat, IDE and workflow front ends · API clients",
                         "No secrets; identity and tenant attached at the edge"]),
        ("Global control plane (metadata only)", ["Identity · policy as code · registries · AI inventory",
                                                  "Evaluation service · FinOps · never stores content"]),
        ("Regional data plane, one cell per region", ["AI gateway: route by classification, evaluated fallback",
                                                      "Permission-aware retrieval · agent runtime · audit"]),
        ("Model providers", ["External APIs via in-region private endpoints",
                             "Self-hosted open-weight models for restricted data"]),
        ("Enterprise systems, via the tool gateway only", ["Tool registry with risk classes · on-behalf-of tokens",
                                                           "Approvals with diffs · idempotency · before-states"]),
        ("First 90-day slice", ["One region · two read-only use cases",
                                "Gateway, retrieval, eval gate, audit and showback"]),
    ]),
    "iv4-gp-90-day-slice": ("The first 90-day slice: thin, vertical, live", [
        ("Weeks 1-3: discovery and decisions", ["Golden sets drafted with the business owner",
                                                "Identity, network, procurement requested day one"]),
        ("Weeks 4-8: build on the paved road", ["Gateway with two providers · ingestion with ACL sync",
                                                "Hybrid retrieval, reranking · red-team from week six"]),
        ("Weeks 9-11: pilot", ["100 to 300 users · measure against the baseline · fix"]),
        ("Week 12: go or no-go on written criteria", ["Golden-set target · zero forbidden-document failures",
                                                      "p95 first token under 2 s · cost per successful task"]),
        ("Out of scope, said explicitly", ["Autonomous writes · second region · self-hosted GPUs",
                                           "Customer-facing use · the other 98 use cases"]),
    ]),
    "iv4-gp-capacity": ("Sizing the platform: capacity, availability, cost", [
        ("Load", ["3,000 users, a request every 2-3 min ≈ 20 req/s peak",
                  "2,000 input + 300 output tokens per request"]),
        ("Monthly volume", ["~8 million requests · ~18 billion tokens before batch",
                            "Illustrative $2 per million tokens ≈ $36,000 a month"]),
        ("Availability", ["99.9% ≈ 43 minutes a month · multi-provider failover",
                          "Degrade: cited retrieval-only answers, queued batch",
                          "Agents drop to read-only"]),
        ("Disaster recovery inside each jurisdiction", ["Config and prompts as code · audit write-once",
                                                        "Indexes: snapshot (minutes) or rebuild (hours)",
                                                        "Drills every quarter"]),
        ("Cost controls", ["Quotas and budgets per business unit · alerts at 80%",
                           "Showback first, chargeback later",
                           "Cost per successful task as the unit"]),
    ]),
    "iv4-serving-capacity": ("Estimating serving capacity, assumptions stated", [
        ("Assume", ["20 req/s · 2,000 in / 300 out tokens per request",
                    "70B-class model in FP8 on H100 80 GB GPUs",
                    "Targets: TTFT < 1.5 s · ~25 tokens/s per stream at p95"]),
        ("Token demand", ["Decode: 20 × 300 = 6,000 tokens/s",
                          "Prefill: 20 × 2,000 = 40,000 tokens/s"]),
        ("Concurrency, Little's law", ["L = λ × W = 20 × ~13 s ≈ 260 sequences in flight"]),
        ("Memory", ["~320 KB KV cache per token (FP16)",
                    "260 × 2,300 tokens ≈ 190 GB · half with FP8 KV",
                    "Plus 70 GB of FP8 weights"]),
        ("Replicas, from a measured per-replica rate", ["4-GPU replica at 2,000 output tokens/s → 3 at peak",
                                                        "+30% headroom and N+1 → 5 replicas, 20 GPUs"]),
        ("Challenge the inputs", ["Output length and per-stream latency move it most",
                                  "Compare with the API price and a smaller model"]),
    ]),
    "iv4-risk-tiering": ("Risk tiers for GenAI: the worst dimension decides", [
        ("Score seven dimensions at intake", ["Impact on individuals · autonomy · data sensitivity",
                                              "Exposure · scale · reversibility · regulatory domain"]),
        ("Tier 0 · prohibited", ["EU AI Act Article 5 practices and company red lines",
                                 "Not built, whatever the business case"]),
        ("Tier 1 · high", ["Annex III areas · irreversible or financial actions",
                           "Impact assessment · independent validation · red-team",
                           "Designed human oversight · risk-council approval"]),
        ("Tier 2 · medium", ["Customer-facing generation · reversible writes",
                             "Eval and red-team gates · AI disclosure to users",
                             "Labelled content · sampled human review"]),
        ("Tier 3 · low", ["Internal, read-only productivity",
                          "Paved road · standard gates · self-certification"]),
        ("Re-tier on any material change", ["New data, tools, autonomy or market",
                                            "NIST AI RMF MAP · ISO/IEC 42001 impact assessment"]),
    ]),
    "iv4-agent-incident": ("Scenario B: an over-permissioned agent", [
        ("Contain, in minutes", ["Kill switch · revoke credentials · remove the tool",
                                 "Pause queues · check other agents with the same grant"]),
        ("Preserve evidence", ["Freeze audit log, traces, prompts and versions",
                               "Tool-call logs write-once · legal hold if needed"]),
        ("Scope and restore", ["Which records, fields, runs, downstream systems",
                               "Roll back from recorded before-states",
                               "Point-in-time restore of affected records only"]),
        ("Root cause, blameless, by layer", ["Why could it: excessive permissions (design)",
                                             "Why did it · why was it not stopped or noticed"]),
        ("Redesign controls", ["Narrow tools · scopes intersected with user rights",
                               "Write limits that pause the agent · bulk approvals",
                               "Dry runs · regression test · access review"]),
    ]),
    "iv4-trust-research": ("PhD direction: trusting knowledge sources", [
        ("Question (a plan, not results)", ["How far should an AI system trust each source?",
                                            "How should trust change retrieval and answers?"]),
        ("Signals the system measures itself", ["Corroboration · internal and temporal consistency",
                                                "Date confidence (0.95 to 0.30) · authority · feedback"]),
        ("Where trust would act", ["A weight in retrieval (one more run in RRF)",
                                   "A signal in confidence · the rule for when to decline"]),
        ("Test bed: Eidolon", ["Golden question sets as the benchmark",
                               "Proof report as the baseline",
                               "Injected faults: stale copies, contradictions"]),
        ("Falsified if", ["No gain beyond the confidence interval",
                          "Gain only by declining more",
                          "Recency or source count does as well",
                          "Gain vanishes on corpora I did not build"]),
    ]),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (title, stages) in DIAGRAMS.items():
        (OUT / f"{key}.svg").write_text(render(title, stages), encoding="utf-8")
    print(f"{len(DIAGRAMS)} diagrams → {OUT}")


if __name__ == "__main__":
    main()
