# 03 · Interview readiness: Senior / Enterprise AI Architect

Dated 2026-11-26. The brief is `tests/interview_brief.md` (added in `c72405d`): three sessions, five
"never skip" questions and a weighted scorecard. The weights are AI/ML fundamentals 10%, GenAI/LLM 15%,
RAG & Agentic 15%, Enterprise architecture 20%, Cloud/DevOps/engineering 10%, AI testing & governance 10%,
Leadership & communication 10% and Business & strategy 10%. A score below 3 in enterprise architecture
or AI/LLM disqualifies.

## How the brief was covered

| Session | Answers (file, ids) | Diagrams | Test cases · rubric points | Commit |
|---|---|---|---|---|
| 1 Technical depth: ownership, traditional ML, LLM/GenAI, RAG & agents, testing AI; never-skip #1, #3 | 38 (`canon_interview_s1.yaml`, `iv1-*`) | 3: clinical NLP platform, RAG pipeline, permission-aware RAG | 77 · 344 | `9689943` |
| 2 Enterprise architecture and engineering: the Knowledge Assistant whiteboard and its 7 follow-ups (each its own answer), the 12 s / 18% / ₹8 lakh turnaround; never-skip #4, #5 | 29 (`canon_interview_s2.yaml`, `iv2-*`) | 4: knowledge assistant, permission-aware RAG, LLM gateway, performance plan | 96 · 387 | `fd2df8f` |
| 3 Leadership, consulting, strategy: all five scenarios, first 90 days, architect vs senior developer; never-skip #2 | 25 (`canon_interview_s3.yaml`, `iv3-*`) | 2: enterprise AI governance, 30/60/90 plan | 76 · 396 | `7d21413` |
| **Total** (PR #20) | **92 new curated answers** | **9** (`site/assets/diagrams/iv*.svg`) | **249 · 1,127**, plus 15 held-out = **264 tests** | `c84a684` |

How the answers were written (commit messages):
- They draw only on his recorded work, and every evidence link resolves. Client names are anonymised
  (for example "a major US airline").
- Design answers open with the questions and assumptions, then give the layers, the choices and the
  rejected alternatives. A diagram is shown under its answer as "The architecture, as I would draw it" (`af5fef6`).
- They are curated answers only. They are left out of the BM25 and semantic indexes, so their long
  prose never crowds out website, GitHub or video evidence (`c84a684`).

## How it is checked

| Check | What it means | Result |
|---|---|---|
| Rubric (`must_all`) | Each case lists the look-for points the answer must name, e.g. `iv1-complex-solution` needs "business problem", "snomed", "the stack", "the outcome" | 249/249 cases, 1,127/1,127 points |
| Brief asked verbatim | Every bullet, scenario and never-skip line of the brief is a test case and passes | 82/82 |
| Paraphrases | Each brief question also appears in other wordings | in the 249 |
| Held-out phrasings | 15 questions written by the parent session, not the answer authors (`qa_interview_heldout.json`) | **12/15 untuned**, then fixed, now 15/15 |
| Determinism | 3 runs in 3 orders, same id and same text hash | 264/264 |
| Context independence | Same answer after 3 unrelated previous questions | 780/792 when first measured, 792/792 after the fix |

The held-out fixes (`c84a684`) were general, not per-question. A split question combines answers only
when every piece matches strongly, "crashes" and "outage" read as "down", and overlapping answers got
precise cues. The answers already in the canon were kept stable as it grew (`4cc0cfb`; see [05](05-findings-and-fixes.md)).

Two brief items are paragraphs, not bullet lines, so the 82-question check does not pick them up: the
Session 2 whiteboard and the Session 2 problem-solving challenge. Both are covered by their own answers
and cases: `iv2-knowledge-assistant` plus the seven `iv2-ka-*` follow-ups, and `iv2-performance-turnaround`.

## What this proves and what it does not

- **Proven:** every brief question has an answer in his voice, grounded in his record. The answer is
  reached from the exact wording and from paraphrases, names its rubric points, and does not change
  with run order or the previous question.
- **Graded independently** (`d9000b7`): a panel asked all 92 brief prompts verbatim (the bullets plus
  the whiteboard, its 7 follow-ups and the problem-solving prompt) and graded each served answer 1–5.
  The 4 answers below 4 were rewritten, taking the weighted score from 4.30 to 4.35, with no disqualifier.
  Details: [interview-panel-review.md](interview-panel-review.md).
- **Not proven:** how a live human panel would score it, or how it holds up under unplanned drill-downs.
  The panel names its weak points: no enterprise-scale numbers of his own, formulaic closers, thin
  client-work stories and thin leadership evidence. A rubric point present as a word is not a good answer.
- **Next:** a harder, principal-level interview. Its preparation plan is in [06](06-open-items-next.md).
