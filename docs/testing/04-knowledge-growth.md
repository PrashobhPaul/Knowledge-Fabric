# 04 · Growing the knowledge safely

Dated 2026-11-26. Sources: README "Add new knowledge (GitHub website, no command line)",
`tests/reports/GROWTH.md`, `proof_before.json`, `proof_after.json`, `.github/workflows/ci.yml` and `deploy.yml`.

## The safe path (GitHub website, no command line)

| Step | What you do | What guards it |
|---|---|---|
| 1. Write it down | Add a note in your own words under `docs_source/notes/` (**Add file → Create new file**). For a question you want answered your way, add an entry to a `knowledge_sources/profile/canon_*.yaml` file whose evidence points at the note (`url: doc:My_New_Topic`) | The build resolves every evidence link. One that resolves to nothing fails grounding |
| 2. Add its questions | Add the new questions, with the facts each must state, to a `tests/qa_*.json` set (as `qa_research.json` did) | From now on they are proven on every change |
| 3. Propose a pull request | Commit with **Create a new branch … and start a pull request** | `ci.yml`: pytest, build, integration (90 checks), retrieval eval (report only), and `node tests/prove.mjs` on all question sets. The report is attached as `proof-report` |
| 4. Merge when green | Merge to `main` | `deploy.yml` rebuilds, runs integration and the retrieval gate, and blocks the deploy on failure. The site answers within minutes |

If a new note or answer pulls an existing question onto the wrong answer, the proof fails and names
the question. **Caveat:** the proof runs in `ci.yml`, not in `deploy.yml`. A commit made straight to
`main` deploys if integration and the retrieval gate pass, even when the proof fails. Always use the
pull request. Open item in [06](06-open-items-next.md).

## Worked example: the PhD at Anurag University (`80dc3db`, 2026-11-26)

The owner's new facts: he has joined the PhD programme at Anurag University (Hyderabad) under
Dr. Amarajothi, and his question is which knowledge sources an AI system can trust, with Eidolon as the worked example.

| Added | Where |
|---|---|
| A note in his voice (research question, how Eidolon handles trust, analogy to unreliable raters, a per-source trust score, evaluation plan, 3 base papers, "About my supervisor") | `docs_source/notes/PhD_Anurag_University.md` |
| 9 curated answers (`research-*`). The PhD dates are not on record and are not guessed | `canon_research.yaml` |
| One PhD sentence in `education` and its 4 translations; "What is Eidolon?" answered by the Knowledge Fabric answer | `canon.yaml`, `canon_i18n.yaml` |
| 32 questions with their facts, plus 4 supervisor questions that must be declined | `tests/qa_research.json` |

Not added: a `profile.yaml` education record. Its schema has no status field, so an ongoing PhD
without invented dates cannot be expressed there.

## Before and after (same machine, same command: `node tests/prove.mjs --build`)

| Measure | Before (`b4b02ae`) | After | Change |
|---|---:|---:|---|
| Earlier sets (14) | 1,720/1,720 | 1,720/1,720 | none |
| New `qa_research.json` | — | 36/36 | +36 |
| Brief · determinism · context | 82/82 · 264/264 · 792/792 | 82/82 · 264/264 · 792/792 | none |
| Paraphrase consistency | 154 answers, 1,308 phrasings | 163 answers, 1,338 phrasings | all land |
| Grounding: resolved · unresolved · leaks | 154/154 · 0 · 0 | 163/163 · 0 · 0 | none |
| Latency p50 / p95 / max | 19.89 / 38.45 / 181.90 ms | 19.25 / 41.30 / 149.45 ms | noise (unchanged index: p95 37.7–39.9 ms) |
| Index: chunks · answers · documents · vocab | 786 · 154 · 351 · 8,755 | 811 · 163 · 361 · 8,837 | +25 · +9 · +10 · +82 |
| `index.json` · `semantic.json` | 3,692,260 · 1,374,255 bytes | 3,783,948 · 1,425,540 bytes | +2.5% · +3.7% |
| Retrieval hybrid: recall@10 · MRR · nDCG@10 | 1.000 · 0.963 · 0.948 | 1.000 · 0.963 · 0.947 | gate passes |

Of the 1,720 earlier answers, **0** changed which answer they land on. **48** changed text on purpose
(31 `education` answers gained the PhD sentence, 17 `knowledge-fabric` answers name Eidolon).
**1** retrieval answer cites a different chapter of the same Manali video, and **1,671** are byte-identical.

## What the proof caught on the way (each fixed at its cause; no earlier test edited)

The first build kept every earlier set at 100%, but `qa_research.json` passed 22 of 28. The fixes:
"a PhD" vs "your PhD" cue phrases; `danglingPronoun` in `site/js/canon.js` now accepts an antecedent
the question names itself; the discrepant-user answer says who counts; Eidolon is named in the Knowledge
Fabric note; `research-dates` declines honestly; the strong as-asked match threshold went from 0.9 to 0.75
(it is kept when the follow-up reading scores below 0.6); loose variants were removed so the decline
chips match the before run. Details: `GROWTH.md`.

Left for the owner: supervisor profile details and a summary of the 2025 *Knowledge and Information
Systems* paper (see [06](06-open-items-next.md)).
