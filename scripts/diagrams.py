#!/usr/bin/env python3
"""Workflow diagrams of the major projects, as SVG — written from the READMEs and notes.

Each diagram is a short vertical flow of stages (readable on a phone), with the
facts each stage carries taken from the project's README or the owner's notes.
Nothing here is decorative guesswork: when a fact is not on record, it is left
out. Output: site/assets/diagrams/<project>.svg, picked up by the build's
showcase and shown under the project's curated answer.

    python scripts/diagrams.py
"""
from __future__ import annotations

from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(__file__).resolve().parents[1] / "site" / "assets" / "diagrams"

DIAGRAMS = {
    "knowledgefabric": ("Knowledge Fabric + Knowledge Factory", [
        ("Public sources", ["Website · resume · GitHub repos and code", "YouTube videos and chapters · LinkedIn"]),
        ("Knowledge Factory (GitHub Actions)", ["Syncs every source on a schedule", "Masks confidential client names"]),
        ("Fabric build", ["Chunks with provenance and dates", "BM25 + LSA + MiniLM vectors · typed graph",
                          "Curated answers, each proof resolved to a record"]),
        ("In the browser", ["NLU: typos, Indic scripts, follow-ups, several questions in one",
                            "Curated answer first, hybrid retrieval underneath"]),
        ("Cited answer", ["In Prashobh's own words, with proofs", "Spoken by the 3D twin · videos play inline"]),
    ]),
    "koode": ("Koode · always with you", [
        ("Start", ["Pick how you travel and where to", "8-digit journey number + 6-digit passcode"]),
        ("Share", ["Followers approved by name", "Link works without the app"]),
        ("Travel", ["Live position on OpenStreetMap · realistic ETA range",
                    "Journey rated Normal / Attention / Concern · SOS works offline"]),
        ("Arrive", ["Arrival spotted and confirmed", "Verified journey report"]),
        ("Private by design", ["Followers keep access for an hour", "Then the shared copy is gone"]),
    ]),
    "pachakalokam": ("Pachaka Lokam · the world of cooking", [
        ("Your kitchen", ["What is at home", "Five South Indian regions"]),
        ("Offline web app", ["Smart meal suggestions", "Festival intelligence"]),
        ("Plan", ["Weekly meal plan generator", "Kitchen and grocery list"]),
        ("Run the home", ["Gas cylinder tracker", "Maid, milk and newspaper tracker · smart reminders"]),
        ("Keep and share", ["Favourites · share and import recipes", "Backup and restore"]),
    ]),
    "cogniflow": ("CogniFlow · AI architectures, brought to life", [
        ("Describe", ["Plain language with arrows, or Mermaid", "Lanes with markdown headers"]),
        ("Compile", ["Rule-based, deterministic, no model calls", "Semantic connectors and motion"]),
        ("Architecture graph", ["Nodes, edges, groups", "Editable in the studio"]),
        ("Render", ["Animated SVG · Mermaid · draw.io", "Shareable link"]),
        ("From any LLM", ["MCP server: Claude draws with CogniFlow"]),
    ]),
    "dhinasuthra": ("Dhinasuthra · the shape of your day", [
        ("On your phone", ["Signals of your day, captured on device", "Nothing leaves the phone"]),
        ("Activity repository", ["Your routine as domain events"]),
        ("Rules, not a model", ["131 written IF/THEN rules, each with an ID and weight",
                                "Would rather say nothing than make something up"]),
        ("Asks before it decides", ["You confirm what it is unsure of"]),
        ("Findings", ["Patterns in your daily routine"]),
    ]),
    "iplbuzz": ("IPLBuzz · the world of T20 cricket", [
        ("Season data", ["Matches, players and teams", "Built to be reused every season"]),
        ("Stats engine", ["Live scores and match analytics"]),
        ("Dashboards", ["Live dashboard · advanced analytics"]),
        ("On your phone", ["Install as an app"]),
    ]),
    "hockeyworldcup": ("Hockey World Cup 2026 companion", [
        ("Official match data", ["Every match, as it happens"]),
        ("Prediction engine", ["Backtested model", "One champion probability, everywhere"]),
        ("Graded in public", ["Predictions scored against results"]),
        ("Web and Android", ["Result alerts · AI Lab · tournament centre"]),
    ]),
    "agentbasedsystem": ("AgentBasedSystem · event management assistant", [
        ("Visitor message", []),
        ("Intent agent", ["Rule-based classifier", "Optional provider-agnostic LLM, graceful fallback"]),
        ("LangGraph orchestration", ["classify → route → node → end", "In-process fallback without LangGraph"]),
        ("Agents", ["FAQ · recommender · calendar · registration · session manager"]),
        ("Data", ["Repository layer, schema and seed data"]),
    ]),
}

W, PAD, CARD_W, LINE = 560, 20, 520, 19
ACCENT = ["#2563eb", "#7c3aed", "#0891b2", "#059669", "#d97706"]


def render(title: str, stages: list[tuple[str, list[str]]]) -> str:
    y, parts = 58, []
    for i, (head, lines) in enumerate(stages):
        h = 40 + LINE * len(lines) + (8 if lines else 0)
        c = ACCENT[i % len(ACCENT)]
        parts.append(f'<g><rect x="{PAD}" y="{y}" width="{CARD_W}" height="{h}" rx="12" fill="#ffffff" stroke="#d6dde8"/>'
                     f'<rect x="{PAD}" y="{y}" width="6" height="{h}" rx="3" fill="{c}"/>'
                     f'<circle cx="{PAD + 30}" cy="{y + 22}" r="11" fill="{c}"/>'
                     f'<text x="{PAD + 30}" y="{y + 26}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">{i + 1}</text>'
                     f'<text x="{PAD + 50}" y="{y + 27}" font-size="15" font-weight="700" fill="#0f172a">{escape(head)}</text>')
        for j, ln in enumerate(lines):
            parts.append(f'<text x="{PAD + 50}" y="{y + 50 + j * LINE}" font-size="13" fill="#334155">{escape(ln)}</text>')
        parts.append("</g>")
        y += h
        if i < len(stages) - 1:
            parts.append(f'<path d="M{W // 2} {y + 4} v18" stroke="#94a3b8" stroke-width="2" marker-end="url(#a)"/>')
            y += 28
    H = y + PAD
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" '
            f'font-family="Inter, Segoe UI, Roboto, sans-serif"><title>{escape(title)}</title>'
            f'<desc>{escape(" → ".join(s for s, _ in stages))}</desc>'
            f'<defs><marker id="a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto">'
            f'<path d="M0 0 L10 5 L0 10 z" fill="#94a3b8"/></marker></defs>'
            f'<rect width="{W}" height="{H}" rx="16" fill="#f8fafc"/>'
            f'<text x="{PAD}" y="36" font-size="17" font-weight="800" fill="#0f172a">{escape(title)}</text>'
            + "".join(parts) + "</svg>\n")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, (title, stages) in DIAGRAMS.items():
        (OUT / f"{key}.svg").write_text(render(title, stages), encoding="utf-8")
    print(f"{len(DIAGRAMS)} diagrams → {OUT}")


if __name__ == "__main__":
    main()
