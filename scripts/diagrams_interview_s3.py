#!/usr/bin/env python3
"""Interview diagrams, Session 3 (leadership, consulting and strategy), as SVG.

Two answers in knowledge_sources/profile/canon_interview_s3.yaml are easier to
follow drawn than read: the enterprise AI governance framework (Scenario 3, 25
AI applications with no central governance) and the first 30, 60 and 90 days
as an AI Enterprise Architect (Scenario 5). Each diagram is a short vertical
flow of stages in the same style as scripts/diagrams.py, and says only what the
curated answer says. Output: site/assets/diagrams/iv3-<name>.svg, referenced
from the answer's `diagram` field.

    python scripts/diagrams_interview_s3.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from diagrams import OUT, render  # noqa: E402

DIAGRAMS = {
    "iv3-governance": ("Enterprise AI governance for 25 independent apps", [
        ("Inventory and triage", ["Every app: owner, models, data, users, cost",
                                  "Risk tier per app · close critical gaps now"]),
        ("Central AI gateway", ["Every model call: auth, logging, redaction",
                                "Rate limits · cost per app · approved models"]),
        ("Model and prompt registry", ["Versions, lineage and rollback"]),
        ("Evaluation and observability", ["Golden sets and CI gates per app",
                                          "Traces · latency · cost · quality · drift"]),
        ("Operating model", ["Governance council · architecture review board",
                             "Risk-tiered policies · reference architecture"]),
        ("Migrate in waves", ["Highest risk first · consolidate duplicates",
                              "Measure coverage, incidents and cost"]),
    ]),
    "iv3-90days": ("First 30, 60 and 90 days as AI Enterprise Architect", [
        ("Days 1–30 · Listen and map", ["Business, CIO, CISO, data owners, AI teams",
                                        "Inventory every AI app, model, vendor, risk",
                                        "Current state · use cases by value, feasibility"]),
        ("Days 31–60 · Decide and design", ["Principles · target reference architecture",
                                            "Gateway · registry · evaluation · observability",
                                            "Risk tiers · review board · lighthouse picks"]),
        ("Days 61–90 · Deliver and scale", ["First lighthouse piloted against its baseline",
                                            "Platform live · first apps onboarded",
                                            "12-month roadmap · operating model · metrics"]),
        ("By day 90", ["A strategy the organisation helped shape",
                       "A governed platform · one use case showing value"]),
    ]),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (title, stages) in DIAGRAMS.items():
        (OUT / f"{key}.svg").write_text(render(title, stages), encoding="utf-8")
    print(f"{len(DIAGRAMS)} diagrams → {OUT}")


if __name__ == "__main__":
    main()
