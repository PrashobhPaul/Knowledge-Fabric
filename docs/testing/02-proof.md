# 02 · The proof (`tests/prove.mjs`)

Dated 2026-11-26. One command, one report: `node tests/prove.mjs` writes `tests/reports/PROOF.md`
(for people) and `tests/reports/proof.json` (for diffs). It exits 1 if any claim fails. `ci.yml`
runs it on every pull request and push to `main` and uploads both files as the `proof-report` artifact.
Added in `b4b02ae`.

## What it runs

`answerQuestion()` from `site/js/pipeline.js`, the code visitors run in the browser, against the
built `site/data/index.json` and `semantic.json`, loaded exactly as `tests/qa_eval.mjs` loads them.
The optional in-browser embedding rescue is off (`qvec: null`). No model, network or randomness is involved.

| Option | Effect |
|---|---|
| `node tests/prove.mjs` | Prove the index as built |
| `--build` | Rebuild the index first (`python -m pipeline.build_index ...`) and time it |
| `--json F --md F` | Write the reports elsewhere (used for the before/after runs in `GROWTH.md`) |

## The claims and the latest numbers (`PROOF.md` as committed in `d9000b7`, 2026-11-26)

| # | Claim | How it is checked | Result |
|---|---|---|---|
| 1 | Accuracy | Every case in every `tests/qa_*.json` set, with every check it carries (id, `must`, `must_all`, `cite`, honest decline) | 1,756/1,756 across 15 sets |
| 1a | Brief coverage | Every bullet, scenario and never-skip line of `tests/interview_brief.md` must be asked verbatim in `qa_interview_s1/s2/s3.json` and pass | 82/82 |
| 2 | Determinism | All 264 interview questions answered 3 times in one process: file order, reverse, a fixed shuffle. Answer id and SHA-256 of the answer HTML must match | 264/264 |
| 3 | Context independence | Each interview question asked as a follow-up after "What is Koode?", "Which videos have you made about Spiti?" and "What did you do at TCS?" must give its cold answer | 792/792 (same text 792/792) |
| 4 | Paraphrase consistency | Phrasings grouped by the one curated answer they expect (57 multi-answer cases left out); all must land | 163/163 answers, 1,338 phrasings |
| 5 | Grounding | Each curated answer has resolved evidence; each served curated answer is cited by its own evidence; no client name in any answer or translation | 163/163 · 0 unresolved · 1,574/1,574 · 0 leaks in 1,756 answers |
| 6 | Performance | One `answerQuestion` call per question, timed | p50 18.22 · p95 35.54 · max 164.61 ms (limit p95 ≤ 250 ms) |

Index at that run: 811 chunks · 163 curated answers · 361 documents · 8,840 vocabulary;
`index.json` 3,787,293 bytes, `semantic.json` 1,425,540 bytes; build 5.62 s. All answers served with a
citation (curated, video, repository, retrieval): 1,678/1,678.

## How to read the report

- Each section of `PROOF.md` is one claim. **PASS** means it held for every question; one **FAIL** fails the CI check.
- `a/b` means a of b checks held. A failure is listed under its section with the question, the
  cold answer and what it became (for example `cold iv1-retraining; after "What is Koode?" → koode`).
- Section 1 has one row per set, with columns for each kind of check. Its total row should match 01.
- Section 4 has a collapsible table of every curated answer and its phrasing count. Use it to find thin answers.
- Latency is measured in Node on the machine that ran the proof. A phone is slower, but does the same work.
- `proof.json` keeps a fingerprint (answer id and hash) for every question. Comparing two runs shows which
  answers changed (as in `GROWTH.md`: 0 changed answer, 48 changed text on purpose, 1,671 byte-identical).

## What it caught

Run on the code before its own fix, the proof gave **context 780/792**. This was reproduced on 2026-11-26
by running `b4b02ae`'s `prove.mjs` on its parent `32e294c`. Four interview questions
were hijacked by each of the three previous questions (260/264 per row):
"On that project, what did you do personally…", "What tells you it is time to retrain…",
"If you had to build an AI team from scratch, how would you do it?" and
"How can you tell that an engineer is ready to become an architect?". Fix and guard: [05](05-findings-and-fixes.md).

## What it does not prove

- **Quality of reasoning.** `must_all` checks that rubric points are present as words, not that the
  answer is right, well argued or senior-level. The independent panel grading is in [interview-panel-review.md](interview-panel-review.md).
- **The browser.** No real browser, GPU, voice, lip sync or network. Embeddings are off.
- **The deploy.** `deploy.yml` does not run the proof. See [06](06-open-items-next.md).
