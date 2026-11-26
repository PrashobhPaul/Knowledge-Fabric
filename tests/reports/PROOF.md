# Eidolon — proof of accuracy and consistency

Generated 2026-11-26 at commit `75e34a9 + uncommitted changes` by `node tests/prove.mjs` (Node v22.23.5). **Overall: PASS.**

## How to read this

- Every number comes from running the real answer path, `answerQuestion()` in `site/js/pipeline.js` (the code visitors run in the browser), against the real built index `site/data/index.json`, the way `tests/qa_eval.mjs` and the integration test run it (the optional in-browser embedding rescue is off). No model, network or randomness is involved.
- Each section is one claim. **PASS** means it held for every question; one **FAIL** makes the script exit 1, which fails the CI check on the pull request.
- `a/b` means a of b checks held. A question carries every check its test set gives it: the expected answer id, a `must` fact, `must_all` rubric points, a source it must `cite`, or an honest no-answer.
- Latency is measured in Node on the machine that ran the proof; a browser on a phone is slower, but the work is the same. Failures, if any, are listed under their section; full detail is in `tests/reports/proof.json`.

## Summary

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | Accuracy: every question in every `tests/qa_*.json` set | PASS | 3,770/3,770 questions across 15 sets |
| 1a | The interview brief (`tests/interview_brief.md`) is asked in full | PASS | 82/82 brief questions asked verbatim and passed |
| 2 | Determinism: same question, same answer | PASS | 264/264 interview questions identical over 3 runs (id and text hash) |
| 3 | Context independence: a previous question does not change the answer | PASS | 792/792 follow-up positions land on the cold answer |
| 4 | Paraphrase consistency: every phrasing lands on its answer | PASS | 163/163 curated answers, 3,153 distinct phrasings |
| 5 | Grounding: cited, proven, confidential | PASS | 3,588/3,588 curated answers served are cited by their own evidence · 0 unresolved links · 0 client-name leaks |
| 6 | Performance: p95 ≤ 250 ms | PASS | p50 23.07 ms · p95 42.65 ms · max 238.86 ms over 3,770 questions |

## 1. Accuracy

Same rules as `node tests/qa_eval.mjs <set>`: the expected answer (a wording variant may add a second answer, never lose the expected one), the `must` fact verbatim, every `must_all` rubric point, the `cite`d source among the citations, and an honest "not on record" for questions it must decline.

| Set | Questions | Expected answer | `must` fact | `must_all` rubric (points) | `cite` | Honest no-answer | Passed | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `qa_coverage.json` | 2,874 | 2,793/2,793 | — | — | 81/81 | — | 100.0% | PASS |
| `qa_gold.json` | 230 | 221/221 | 17/17 | — | — | 9/9 | 100.0% | PASS |
| `qa_interview_heldout.json` | 15 | 15/15 | — | — | — | — | 100.0% | PASS |
| `qa_interview_s1.json` | 77 | 77/77 | — | 77/77 (344/344) | — | — | 100.0% | PASS |
| `qa_interview_s2.json` | 96 | 96/96 | — | 96/96 (387/387) | — | — | 100.0% | PASS |
| `qa_interview_s3.json` | 76 | 76/76 | — | 76/76 (396/396) | — | — | 100.0% | PASS |
| `qa_lang.json` | 54 | 52/52 | 52/52 | — | — | 2/2 | 100.0% | PASS |
| `qa_research.json` | 36 | 32/32 | — | 32/32 (134/134) | — | 4/4 | 100.0% | PASS |
| `qa_round2.json` | 60 | 53/53 | 49/49 | — | — | 7/7 | 100.0% | PASS |
| `qa_round3.json` | 48 | 41/41 | 39/39 | — | — | 7/7 | 100.0% | PASS |
| `qa_round4.json` | 60 | 48/48 | 40/40 | — | — | 12/12 | 100.0% | PASS |
| `qa_round5.json` | 51 | 39/39 | 23/23 | — | — | 12/12 | 100.0% | PASS |
| `qa_round6.json` | 43 | 33/33 | 22/22 | — | — | 10/10 | 100.0% | PASS |
| `qa_round7.json` | 40 | 31/31 | 19/19 | — | — | 9/9 | 100.0% | PASS |
| `qa_round8.json` | 10 | 9/9 | 9/9 | — | — | 1/1 | 100.0% | PASS |
| **Total** | **3,770** | **3,616/3,616** | **270/270** | **281/281 (1,261/1,261)** | **81/81** | **73/73** | **100.0%** | **PASS** |

**Interview brief.** 82 questions, scenarios and "never skip" items are read from `tests/interview_brief.md`; 82 are asked verbatim in `qa_interview_s1/s2/s3.json` and 82 pass every rubric point. The interview sets add paraphrases, and `qa_interview_heldout.json` holds questions written after the answers, as a check against tuning to the wording.

## 2. Determinism

Every interview question (264) answered three times in one process: run 1 in file order, run 2 in reverse order, run 3 in a fixed shuffled order, so an answer cannot depend on what was asked before it or on warm caches. The answer id and the SHA-256 of the full answer HTML must be identical across the runs.

| Set | Questions | Same id ×3 | Same text hash ×3 | Result |
|---|---:|---:|---:|---|
| `qa_interview_heldout.json` | 15 | 15/15 | 15/15 | PASS |
| `qa_interview_s1.json` | 77 | 77/77 | 77/77 | PASS |
| `qa_interview_s2.json` | 96 | 96/96 | 96/96 | PASS |
| `qa_interview_s3.json` | 76 | 76/76 | 76/76 | PASS |

## 3. Context independence

Every interview question asked again as a follow-up (`ctx.prev`) after each of three unrelated questions, chosen because each names something a pronoun could wrongly attach to. It must land on the same answer as when asked cold.

| Previous question | Same answer as cold | Same text as cold |
|---|---:|---:|
| "What is Koode?" | 264/264 | 264/264 |
| "Which videos have you made about Spiti?" | 264/264 | 264/264 |
| "What did you do at TCS?" | 264/264 | 264/264 |
| **All** | **792/792** | **792/792** |

## 4. Paraphrase consistency

Test phrasings from all sets grouped by the one curated answer they expect (questions that accept several answers by design, 57, are left out). Every curated answer with two or more distinct phrasings is listed; all of its phrasings must land on it.

| Phrasings per answer | Answers | Phrasings | All landed |
|---|---:|---:|---:|
| 7–10 | 10 | 98 | 10/10 |
| 11+ | 153 | 3,055 | 153/153 |
| **All** | **163** | **3,153** | **163/163** |

<details><summary>Every answer and its phrasings</summary>

| Curated answer | Phrasings | Sets | Landed | Result |
|---|---:|---:|---:|---|
| `family` | 66 | 9 | 66/66 | PASS |
| `skills` | 43 | 6 | 43/43 | PASS |
| `current-role` | 40 | 8 | 40/40 | PASS |
| `who` | 37 | 4 | 37/37 | PASS |
| `education` | 28 | 8 | 28/28 | PASS |
| `iv2-performance-turnaround` | 28 | 3 | 28/28 | PASS |
| `iv3-estimation` | 26 | 2 | 26/26 | PASS |
| `iv1-class-imbalance` | 25 | 2 | 25/25 | PASS |
| `iv2-10k-concurrent-users` | 25 | 2 | 25/25 | PASS |
| `iv2-ka-retrieval-quality-production` | 25 | 2 | 25/25 | PASS |
| `iv2-ka-sensitive-data` | 25 | 2 | 25/25 | PASS |
| `iv2-ka-switch-llm-provider` | 25 | 2 | 25/25 | PASS |
| `iv2-standardize-vs-decentralize` | 25 | 2 | 25/25 | PASS |
| `iv3-build-vs-buy` | 25 | 2 | 25/25 | PASS |
| `iv3-value-opportunities` | 25 | 2 | 25/25 | PASS |
| `teams` | 25 | 7 | 25/25 | PASS |
| `youtube` | 25 | 7 | 25/25 | PASS |
| `iv2-ka-1000-concurrent` | 24 | 2 | 24/24 | PASS |
| `iv2-knowledge-assistant` | 24 | 2 | 24/24 | PASS |
| `proudest` | 24 | 4 | 24/24 | PASS |
| `youtube-why` | 24 | 5 | 24/24 | PASS |
| `iv2-ka-access-revoked` | 23 | 2 | 23/23 | PASS |
| `iv2-ka-deleted-documents` | 23 | 2 | 23/23 | PASS |
| `iv2-ka-vector-db-down` | 23 | 3 | 23/23 | PASS |
| `iv1-prompt-injection` | 22 | 3 | 22/22 | PASS |
| `iv2-rollback` | 22 | 3 | 22/22 | PASS |
| `iv3-accuracy-expectations` | 22 | 3 | 22/22 | PASS |
| `iv3-agents-everywhere` | 22 | 3 | 22/22 | PASS |
| `origins` | 22 | 5 | 22/22 | PASS |
| `projects` | 22 | 4 | 22/22 | PASS |
| `qualizeal-work` | 22 | 3 | 22/22 | PASS |
| `research-phd` | 22 | 2 | 22/22 | PASS |
| `research-topic` | 22 | 2 | 22/22 | PASS |
| `iv1-agent-loops` | 21 | 3 | 21/21 | PASS |
| `iv1-agent-vs-assistant` | 21 | 2 | 21/21 | PASS |
| `iv1-chunking` | 21 | 2 | 21/21 | PASS |
| `iv1-complex-documents` | 21 | 2 | 21/21 | PASS |
| `iv1-contributions` | 21 | 2 | 21/21 | PASS |
| `iv1-drift` | 21 | 2 | 21/21 | PASS |
| `iv1-failure` | 21 | 2 | 21/21 | PASS |
| `iv1-fraud-accuracy` | 21 | 3 | 21/21 | PASS |
| `iv1-nondeterministic` | 21 | 2 | 21/21 | PASS |
| `iv1-rag-evaluation` | 21 | 2 | 21/21 | PASS |
| `iv1-rebuild` | 21 | 2 | 21/21 | PASS |
| `iv2-async-background-jobs` | 21 | 2 | 21/21 | PASS |
| `iv2-fastapi-backend` | 21 | 2 | 21/21 | PASS |
| `iv2-gpu-throughput` | 21 | 2 | 21/21 | PASS |
| `iv2-high-availability` | 21 | 2 | 21/21 | PASS |
| `iv2-llm-on-kubernetes` | 21 | 2 | 21/21 | PASS |
| `iv2-multi-cloud` | 21 | 2 | 21/21 | PASS |
| `iv2-multi-tenancy` | 21 | 2 | 21/21 | PASS |
| `iv2-requirement-to-architecture` | 21 | 2 | 21/21 | PASS |
| `iv2-security-auth` | 21 | 2 | 21/21 | PASS |
| `iv2-token-latency-cost-monitoring` | 21 | 2 | 21/21 | PASS |
| `iv2-versioning` | 21 | 2 | 21/21 | PASS |
| `iv3-30-day-ask` | 21 | 2 | 21/21 | PASS |
| `iv3-accelerators` | 21 | 2 | 21/21 | PASS |
| `iv3-ai-strategy` | 21 | 2 | 21/21 | PASS |
| `iv3-build-team` | 21 | 2 | 21/21 | PASS |
| `iv3-communication-gap` | 21 | 2 | 21/21 | PASS |
| `iv3-conflicting-opinions` | 21 | 2 | 21/21 | PASS |
| `iv3-consistency` | 21 | 2 | 21/21 | PASS |
| `iv3-innovation-governance` | 21 | 2 | 21/21 | PASS |
| `iv3-mentor-juniors` | 21 | 2 | 21/21 | PASS |
| `iv3-six-weeks` | 21 | 2 | 21/21 | PASS |
| `iv3-success-metrics` | 21 | 2 | 21/21 | PASS |
| `iv3-team-wrong-architecture` | 21 | 2 | 21/21 | PASS |
| `koode` | 21 | 8 | 21/21 | PASS |
| `mentors` | 21 | 7 | 21/21 | PASS |
| `research-supervisor` | 21 | 2 | 21/21 | PASS |
| `aidlc` | 20 | 2 | 20/20 | PASS |
| `framework-choice` | 20 | 2 | 20/20 | PASS |
| `iv1-architecture-decision` | 20 | 2 | 20/20 | PASS |
| `iv1-cost-cut` | 20 | 3 | 20/20 | PASS |
| `iv1-hallucination` | 20 | 2 | 20/20 | PASS |
| `iv1-hallucination-testing` | 20 | 2 | 20/20 | PASS |
| `iv1-metrics` | 20 | 2 | 20/20 | PASS |
| `iv1-ml-vs-llm` | 20 | 3 | 20/20 | PASS |
| `iv1-retraining` | 20 | 2 | 20/20 | PASS |
| `iv1-retrieval-vs-generation` | 20 | 2 | 20/20 | PASS |
| `iv2-app-testing-vs-model-eval` | 20 | 2 | 20/20 | PASS |
| `iv2-cicd` | 20 | 2 | 20/20 | PASS |
| `iv2-microservices-monolith-serverless` | 20 | 2 | 20/20 | PASS |
| `iv2-python-app-structure` | 20 | 2 | 20/20 | PASS |
| `iv2-standard-components` | 20 | 2 | 20/20 | PASS |
| `iv3-architect-readiness` | 20 | 2 | 20/20 | PASS |
| `iv3-first-90-days` | 20 | 3 | 20/20 | PASS |
| `iv3-genai-roles` | 20 | 2 | 20/20 | PASS |
| `iv3-self-hosted` | 20 | 3 | 20/20 | PASS |
| `iv3-tech-debt` | 20 | 2 | 20/20 | PASS |
| `tcs-story` | 20 | 5 | 20/20 | PASS |
| `iv1-complex-solution` | 19 | 2 | 19/19 | PASS |
| `iv1-eval-dataset` | 19 | 2 | 19/19 | PASS |
| `iv1-latency-tokens` | 19 | 2 | 19/19 | PASS |
| `iv1-lora` | 19 | 2 | 19/19 | PASS |
| `iv1-multi-agent` | 19 | 2 | 19/19 | PASS |
| `iv1-open-vs-proprietary` | 19 | 2 | 19/19 | PASS |
| `iv1-poc-to-production` | 19 | 2 | 19/19 | PASS |
| `iv1-rag-architecture` | 19 | 2 | 19/19 | PASS |
| `iv1-secure-rag` | 19 | 2 | 19/19 | PASS |
| `iv3-governance-25-apps` | 19 | 2 | 19/19 | PASS |
| `services` | 19 | 4 | 19/19 | PASS |
| `soccer-ai` | 19 | 5 | 19/19 | PASS |
| `career-history` | 18 | 3 | 18/18 | PASS |
| `iv1-dense-sparse` | 18 | 2 | 18/18 | PASS |
| `iv1-draw-complex` | 18 | 2 | 18/18 | PASS |
| `iv1-mcp-tools` | 18 | 2 | 18/18 | PASS |
| `iv1-reranking` | 18 | 2 | 18/18 | PASS |
| `iv1-training-vs-rag` | 18 | 2 | 18/18 | PASS |
| `iv3-rejected-attractive` | 18 | 2 | 18/18 | PASS |
| `knowledge-fabric` | 18 | 4 | 18/18 | PASS |
| `robotics` | 18 | 6 | 18/18 | PASS |
| `training` | 18 | 4 | 18/18 | PASS |
| `why-ai` | 18 | 3 | 18/18 | PASS |
| `art` | 17 | 4 | 17/17 | PASS |
| `contact` | 17 | 5 | 17/17 | PASS |
| `healthcare` | 17 | 3 | 17/17 | PASS |
| `invest-iq` | 17 | 4 | 17/17 | PASS |
| `iv1-sampling` | 17 | 2 | 17/17 | PASS |
| `iv1-transformer` | 17 | 3 | 17/17 | PASS |
| `iv2-enterprise-rag-5000` | 17 | 2 | 17/17 | PASS |
| `iv3-architect-vs-developer` | 17 | 2 | 17/17 | PASS |
| `location` | 17 | 5 | 17/17 | PASS |
| `research-dates` | 17 | 2 | 17/17 | PASS |
| `research-papers` | 17 | 2 | 17/17 | PASS |
| `research-where` | 17 | 2 | 17/17 | PASS |
| `ai-tour` | 16 | 3 | 16/16 | PASS |
| `android-apps` | 16 | 3 | 16/16 | PASS |
| `birthday` | 16 | 4 | 16/16 | PASS |
| `open-source` | 16 | 3 | 16/16 | PASS |
| `pachaka-lokam` | 16 | 6 | 16/16 | PASS |
| `iv1-ml-task-types` | 15 | 2 | 15/15 | PASS |
| `rvonwheelz` | 15 | 3 | 15/15 | PASS |
| `bfsi` | 14 | 4 | 14/14 | PASS |
| `inspiration` | 14 | 5 | 14/14 | PASS |
| `interests` | 14 | 5 | 14/14 | PASS |
| `iplbuzz` | 14 | 3 | 14/14 | PASS |
| `research-trust-sources` | 14 | 2 | 14/14 | PASS |
| `children-message` | 12 | 3 | 12/12 | PASS |
| `tech-mahindra` | 12 | 2 | 12/12 | PASS |
| `agentic-view` | 11 | 4 | 11/11 | PASS |
| `clients` | 11 | 2 | 11/11 | PASS |
| `cogniflow` | 11 | 4 | 11/11 | PASS |
| `dhinasuthra` | 11 | 4 | 11/11 | PASS |
| `experience-years` | 11 | 4 | 11/11 | PASS |
| `family-projects` | 11 | 2 | 11/11 | PASS |
| `favourite-project` | 11 | 2 | 11/11 | PASS |
| `hardest-problem` | 11 | 4 | 11/11 | PASS |
| `hockey` | 11 | 3 | 11/11 | PASS |
| `linkedin-knowledge` | 11 | 2 | 11/11 | PASS |
| `project-stacks` | 11 | 2 | 11/11 | PASS |
| `spiti` | 11 | 2 | 11/11 | PASS |
| `voice-uav` | 11 | 4 | 11/11 | PASS |
| `key-monastery` | 10 | 3 | 10/10 | PASS |
| `research-discrepant-user` | 10 | 2 | 10/10 | PASS |
| `research-eidolon-trust` | 10 | 2 | 10/10 | PASS |
| `sports-projects` | 10 | 2 | 10/10 | PASS |
| `supabase-projects` | 10 | 2 | 10/10 | PASS |
| `try-apps` | 10 | 2 | 10/10 | PASS |
| `typical-day` | 10 | 3 | 10/10 | PASS |
| `what-drives` | 10 | 2 | 10/10 | PASS |
| `why-projects` | 10 | 2 | 10/10 | PASS |
| `languages` | 8 | 3 | 8/8 | PASS |

</details>

## 5. Grounding

| Check | Result |
|---|---|
| Curated answers in the index whose evidence resolved to at least one record | 163/163 |
| Evidence links the build could not resolve | 0 |
| Curated answers served in this run (163 distinct) with at least one citation | 3,588/3,588 |
| ...cited by a record from their own evidence list | 3,588/3,588 |
| All answers served (curated, video, repository, retrieval; small talk and declines excluded) with a citation | 3,692/3,692 |
| Served answers containing a client name (Southwest, PwC, American Express, Amex) | 0 of 3,770 |
| Curated answers in the index (and their translations) containing a client name | 0 of 163 |

## 6. Performance

| Measure | Value |
|---|---|
| Questions timed (one `answerQuestion` call each) | 3,770 |
| p50 / p95 / max latency | 23.07 ms / 42.65 ms / 238.86 ms |
| Mean latency · first (cold) call | 24.62 ms · 132.63 ms |
| p95 limit | 250 ms (PASS) |
| Index: chunks · curated answers · documents · vocabulary | 811 · 163 · 361 · 8,843 |
| `site/data/index.json` · `semantic.json` | 3,753,487 bytes (3.58 MB) · 1,425,540 bytes (1.36 MB) |
| Build time | 5.19 s (`--build`) |
