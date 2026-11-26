# Eidolon: testing and verification record

Dated 2026-11-26 · branch `prashobh-ai/beautiful-maxwell-qefj4s` · covers commits up to `d9000b7`.
This folder tracks what we tested, what we proved, and what still has to be proved.

## What is being tested

Eidolon is the living knowledge twin of Prashobh Paul: a static GitHub Pages site with no backend.
The **Knowledge Factory** gathers his sources (website, resume, YouTube, GitHub, LinkedIn export,
his own notes). The **Knowledge Fabric** builds one index from them (BM25 + LSA, fused by RRF, and a
typed graph). On top sit **163 curated answers** in his words (`knowledge_sources/profile/canon*.yaml`),
each with evidence links that the build resolves to real records. The 3D twin speaks the cited
sentences in the first person. At answer time no model writes text: every answer is curated text or
quoted sentences, so every claim can be checked against a source.

## How it is tested (layers)

| Layer | What it proves | Run locally | Size now | Where CI runs it |
|---|---|---|---|---|
| pytest | Parsers, connectors, ontology, graph, BM25/LSA, Factory, curator, canon resolution, embed fallback | `pytest tests/ -v` | 23 tests | `ci.yml` |
| Index integrity | The build has documents, chunks, entities, typed edges, cross-source joins, ≥2 sources | inline step in `ci.yml` | 7 asserts | `ci.yml` |
| Retrieval eval | recall@5/10, MRR, nDCG@10 per mode (lexical, semantic, hybrid) | `python -m eval.evaluate [--gate]` | 18 gold cases (`eval/gold_set.yaml`) | `ci.yml` report only; `deploy.yml` with `--gate` (hybrid recall@5 ≥ 0.70, MRR ≥ 0.55) blocks the deploy |
| Integration | The real `site/js` modules run against the real `site/data`: contracts, routing, confidence, health, flags, twin, canon, 14 question sets | `node tests/integration.test.mjs` | 90 checks in 15 groups | `ci.yml` and `deploy.yml` (blocks the deploy) |
| Question sets | Each question lands on the right answer with its facts, rubric points, citation or honest decline | `node tests/qa_eval.mjs tests/qa_round5.json` | 15 sets, 1,756 questions | inside integration (14 sets) and the proof (all 15) |
| Proof | Accuracy, brief coverage, determinism, context independence, paraphrase consistency, grounding, latency | `node tests/prove.mjs [--build]` | one report | `ci.yml` (PRs and pushes to `main`); report uploaded as the `proof-report` artifact |

Build the index first (CI does the same):
`pip install -r pipeline/requirements.txt` then
`python -m pipeline.build_index --source docs_source --knowledge knowledge_sources --out site/data/index.json --semantic-out site/data/semantic.json`.
`node tests/prove.mjs --build` rebuilds and times it in one step.

Other workflows feed testing without being tests: `factory.yml` (Mondays 02:17 UTC) refreshes sources,
which triggers the deploy and its gates. `curator.yml` (Mondays 03:17 UTC and on new `knowledge-flag`
issues) re-asks flagged questions; resolved flags become the integration check "every resolved flag still answers".

## Latest results

| Measure | Result | Source |
|---|---|---|
| All question sets | 1,756/1,756 (100%) across 15 sets | `tests/reports/PROOF.md` |
| Interview brief asked verbatim | 82/82 | `PROOF.md` |
| Determinism (264 interview questions × 3 runs) | 264/264 | `PROOF.md` |
| Context independence | 792/792 | `PROOF.md` |
| Paraphrase consistency | 163/163 answers, 1,338 phrasings | `PROOF.md` |
| Grounding | 163/163 resolved · 0 unresolved links · 0 client-name leaks | `PROOF.md` |
| Latency p50 / p95 / max | 18.22 / 35.54 / 164.61 ms (limit p95 ≤ 250 ms) | `PROOF.md` |
| Retrieval, hybrid | recall@10 1.000 · MRR 0.963 · nDCG@10 0.947, gate passes | `GROWTH.md` |
| Integration · pytest | 90/90 · 23/23 | commits `c84a684`, `d9000b7` |
| Independent interview panel | weighted 4.35 of 5 (4.30 before fixes), no disqualifier | `interview-panel-review.md` |

Re-run for this record on 2026-11-26 from a clean build of `d9000b7`: integration 90 passed, pytest
23 passed, the eval gave the same hybrid numbers, and `prove.mjs` passed with the same counts as `PROOF.md`.
The latency differed only by noise.

## Files in this folder

- [01-question-sets.md](01-question-sets.md): every `tests/qa_*.json` set, its size, its rules for a pass, its result
- [02-proof.md](02-proof.md): what `tests/prove.mjs` proves, the latest numbers, how to read the report
- [03-interview-readiness.md](03-interview-readiness.md): the Senior AI Architect brief and how it was covered
- [04-knowledge-growth.md](04-knowledge-growth.md): how to add knowledge safely; the PhD before/after evidence
- [05-findings-and-fixes.md](05-findings-and-fixes.md): dated log of real defects found by testing and their guards
- [06-open-items-next.md](06-open-items-next.md): what is not yet proven and what to prove next
- [interview-panel-review.md](interview-panel-review.md): independent panel grading of every brief answer (`d9000b7`)

Reports this record draws on: [`tests/reports/PROOF.md`](../../tests/reports/PROOF.md),
[`tests/reports/GROWTH.md`](../../tests/reports/GROWTH.md), `proof_before.json`, `proof_after.json`.
