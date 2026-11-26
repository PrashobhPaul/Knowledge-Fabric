# Growing the knowledge without losing accuracy

A worked example of adding real new information to Eidolon the way the owner would, with the proof
(`node tests/prove.mjs --build`) run before anything was added and again afterwards, on the same
machine with the same command. Raw results: [`proof_before.json`](proof_before.json) (commit `b4b02ae`,
before the change) and [`proof_after.json`](proof_after.json) (after it).

## What was added

Only the facts the owner gave: he has joined the PhD programme at Anurag University (Hyderabad) under
Dr. Amarajothi, and her research on users whose ratings cannot be fully trusted led him to the parallel
question for AI, which knowledge sources an AI system can trust, with Eidolon as the worked example. The
three base papers were checked against their publication records; the sources are listed in the note.

| Added | Where |
|---|---|
| A note in his voice: what he joined and under whom, the research question, how Eidolon handles trust today, the analogy between unreliable raters and unreliable sources, a per-source trust score as his direction, the evaluation plan, the papers he builds on, and "About my supervisor" (name, university, research interest, and a TODO for her profile) | `docs_source/notes/PhD_Anurag_University.md` |
| 9 curated answers (`research-*`): doing a PhD, where, supervisor, topic, which sources an AI can trust, how this system decides, the base papers, what a discrepant user is, and the PhD dates (not on record, so not guessed) | `knowledge_sources/profile/canon_research.yaml` |
| One sentence in the `education` answer (now pursuing a PhD at Anurag University), with the note as its proof, and the same sentence in its four translations | `canon.yaml`, `canon_i18n.yaml` |
| "What is Eidolon?" answered by the Knowledge Fabric answer, with one line in its note | `canon.yaml`, `docs_source/notes/projects/Knowledge_Fabric.md` |
| 32 questions (each curated question as written plus paraphrases, each with the facts it must state) and 4 questions about the supervisor that are not on record and must be declined | `tests/qa_research.json` |

Not added: a `profile.yaml` education record. Its schema has no status field, and the connector writes
"studying from {start} to {end}", so an ongoing PhD without invented dates cannot be expressed there.

## Before and after

| Measure | Before | After | Change |
|---|---:|---:|---|
| Pre-existing question sets (14) | 1,720/1,720 (100%) | 1,720/1,720 (100%) | none |
| New set `qa_research.json` | — | 36/36 (100%) | +36 questions |
| Interview brief asked in full | 82/82 | 82/82 | none |
| Determinism (interview, 3 runs) | 264/264 | 264/264 | none |
| Context independence | 792/792 | 792/792 | none |
| Paraphrase consistency | 154 answers, 1,308 phrasings | 163 answers, 1,338 phrasings | all land, before and after |
| Grounding: curated answers with resolved evidence · unresolved links · client-name leaks | 154/154 · 0 · 0 | 163/163 · 0 · 0 | none |
| Answer latency p50 / p95 / max | 19.89 / 38.45 / 181.90 ms | 19.25 / 41.30 / 149.45 ms | within run-to-run noise (three runs of the unchanged index gave a p95 of 37.7 to 39.9 ms) |
| Index: chunks · curated answers · documents · vocabulary | 786 · 154 · 351 · 8,755 | 811 · 163 · 361 · 8,837 | +25 · +9 · +10 · +82 |
| `site/data/index.json` | 3,692,260 bytes | 3,783,948 bytes | +91,688 (+2.5%) |
| `site/data/semantic.json` | 1,374,255 bytes | 1,425,540 bytes | +51,285 (+3.7%) |
| Build time | 5.62 s | 5.10 s | noise |
| Retrieval evaluation, hybrid: recall@10 · MRR · nDCG@10 (`python -m eval.evaluate --gate`) | 1.000 · 0.963 · 0.948 | 1.000 · 0.963 · 0.947 | gate passes |

### Every pre-existing set, before and after

| Set | Before | After |
|---|---:|---:|
| `qa_coverage.json` | 860/860 | 860/860 |
| `qa_gold.json` | 230/230 | 230/230 |
| `qa_interview_heldout.json` | 15/15 | 15/15 |
| `qa_interview_s1.json` | 77/77 | 77/77 |
| `qa_interview_s2.json` | 96/96 | 96/96 |
| `qa_interview_s3.json` | 76/76 | 76/76 |
| `qa_lang.json` | 54/54 | 54/54 |
| `qa_round2.json` | 60/60 | 60/60 |
| `qa_round3.json` | 48/48 | 48/48 |
| `qa_round4.json` | 60/60 | 60/60 |
| `qa_round5.json` | 51/51 | 51/51 |
| `qa_round6.json` | 43/43 | 43/43 |
| `qa_round7.json` | 40/40 | 40/40 |
| `qa_round8.json` | 10/10 | 10/10 |
| **New: `qa_research.json`** | — | **36/36** |

### What changed in the answers to the 1,720 earlier questions

The proof fingerprints every answer (answer id and a hash of its HTML), so the two runs can be compared
question by question.

- **0** changed which answer they land on.
- **48** changed text, and on purpose: 31 `education` answers now end with the PhD sentence (including
  "Do you have a PhD?", which still leads with the M.Tech), and 17 `knowledge-fabric` answers now name Eidolon.
- **1** retrieval answer changed: "Which videos are about Manali?" cites a different chapter of the same
  Manali video second.
- **1,671** are byte-identical.

## What the proof caught on the way, and the general fix for each

The first build with the new knowledge kept every earlier set at 100%, and `qa_research.json` passed
22 of 28. A wider look found two earlier honest declines that would have changed. Each was fixed at its
cause; no earlier test was edited.

| Caught | Cause | Fix |
|---|---|---|
| "At which university are you pursuing your doctorate?" went to "Are you doing a PhD?"; "Which university is your PhD with?" went to the M.Tech answer | "PhD" is normalised to "education", so only cue phrases can tell the two apart | "a PhD" asks whether there is one (`research-phd`); "your PhD" takes it as given and asks for details (`research-where`, supervisor, topic, papers). A `research-where` variant whose words reduced to `{education}` alone, and so tied with plain education questions, was removed |
| "How should an AI decide which of its knowledge sources are reliable?" and "Can AI trust every source it reads?" were declined | Treated as a pronoun with nothing to point at | `danglingPronoun` (site/js/canon.js): a pronoun whose antecedent the question names itself ("an AI … its", "AI … it reads") is not dangling |
| "Who counts as a discrepant user?" was declined | "counts" is a word no answer used, and the question is not about him | The answer now says who counts as discrepant, and what the term means |
| "What is Eidolon?" and "When will you finish your PhD?" had been honest no-answers; with the new words they would have landed on the trust answer and the topic answer | New vocabulary, no answer that fits | Knowledge, not tuning: Eidolon is now named in the Knowledge Fabric note and answer, and `research-dates` says the dates are not on record and will not be guessed |
| "Can AI trust every source it reads?" asked after "What is Koode?" became "…every source Koode reads" | Follow-up resolution | A strong as-asked curated match (0.75, down from 0.9) is kept when putting the previous subject in leaves no good answer (below 0.6). The real follow-ups in rounds 5 and 6 all resolve to 0.64 or more, so they are unaffected |
| The "closest things I can answer" chips under three off-topic declines picked up research questions | Loose variants ("…mean?", "…believe?") | Removed; the chips match the "before" run again |

The proof still holds the same line for the supervisor. Her phone number, age, education and marital status
are not on record, and all four questions are declined honestly (`qa_research.json` → `no_answer`).

## Left for the owner

- `docs_source/notes/PhD_Anurag_University.md` → "About my supervisor": add Dr. Amarajothi's profile
  details (designation, department, profile link). Nothing beyond her name, university and research
  interest is on record.
- Same note → the 2025 paper in *Knowledge and Information Systems*: add a one-line summary from its abstract.
  The abstract could not be reached when the note was written, so the paper is described only by title,
  venue, year and DOI.
