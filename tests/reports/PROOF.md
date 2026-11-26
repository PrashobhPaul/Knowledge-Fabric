# Eidolon — proof of accuracy and consistency

Generated 2026-11-26 at commit `ed608df + uncommitted changes` by `node tests/prove.mjs` (Node v22.23.5). **Overall: PASS.**

## How to read this

- Every number comes from running the real answer path, `answerQuestion()` in `site/js/pipeline.js` (the code visitors run in the browser), against the real built index `site/data/index.json`, the way `tests/qa_eval.mjs` and the integration test run it (the optional in-browser embedding rescue is off). No model, network or randomness is involved.
- Each section is one claim. **PASS** means it held for every question; one **FAIL** makes the script exit 1, which fails the CI check on the pull request.
- `a/b` means a of b checks held. A question carries every check its test set gives it: the expected answer id, a `must` fact, `must_all` rubric points, a source it must `cite`, or an honest no-answer.
- Latency is measured in Node on the machine that ran the proof; a browser on a phone is slower, but the work is the same. Failures, if any, are listed under their section; full detail is in `tests/reports/proof.json`.

## Summary

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | Accuracy: every question in every `tests/qa_*.json` set | PASS | 6,676/6,676 questions across 17 sets |
| 1a | The interview brief (`tests/interview_brief.md`) is asked in full | PASS | 82/82 brief questions asked verbatim and passed |
| 2 | Determinism: same question, same answer | PASS | 523/523 interview questions identical over 3 runs (id and text hash) |
| 3 | Context independence: a previous question does not change the answer | PASS | 1,569/1,569 follow-up positions land on the cold answer |
| 4 | Paraphrase consistency: every phrasing lands on its answer | PASS | 299/299 curated answers, 5,847 distinct phrasings |
| 5 | Grounding: cited, proven, confidential | PASS | 6,489/6,489 curated answers served are cited by their own evidence · 0 unresolved links · 0 client-name leaks |
| 6 | Performance: p95 ≤ 250 ms | PASS | p50 27.19 ms · p95 50.43 ms · max 268.49 ms over 6,676 questions |

## 1. Accuracy

Same rules as `node tests/qa_eval.mjs <set>`: the expected answer (a wording variant may add a second answer, never lose the expected one), the `must` fact verbatim, every `must_all` rubric point, the `cite`d source among the citations, and an honest "not on record" for questions it must decline.

| Set | Questions | Expected answer | `must` fact | `must_all` rubric (points) | `cite` | Honest no-answer | Passed | Result |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `qa_coverage.json` | 5,477 | 5,395/5,395 | — | — | 82/82 | — | 100.0% | PASS |
| `qa_gold.json` | 230 | 221/221 | 17/17 | — | — | 9/9 | 100.0% | PASS |
| `qa_interview_heldout.json` | 15 | 15/15 | — | — | — | — | 100.0% | PASS |
| `qa_interview_l2.json` | 259 | 259/259 | — | 259/259 (1,307/1,307) | — | — | 100.0% | PASS |
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
| `qa_smartplane.json` | 44 | 41/41 | — | 41/41 (146/146) | — | 3/3 | 100.0% | PASS |
| **Total** | **6,676** | **6,518/6,518** | **270/270** | **581/581 (2,714/2,714)** | **82/82** | **76/76** | **100.0%** | **PASS** |

**Interview brief.** 82 questions, scenarios and "never skip" items are read from `tests/interview_brief.md`; 82 are asked verbatim in `qa_interview_s1/s2/s3.json` and 82 pass every rubric point. The interview sets add paraphrases, and `qa_interview_heldout.json` holds questions written after the answers, as a check against tuning to the wording.

## 2. Determinism

Every interview question (523) answered three times in one process: run 1 in file order, run 2 in reverse order, run 3 in a fixed shuffled order, so an answer cannot depend on what was asked before it or on warm caches. The answer id and the SHA-256 of the full answer HTML must be identical across the runs.

| Set | Questions | Same id ×3 | Same text hash ×3 | Result |
|---|---:|---:|---:|---|
| `qa_interview_heldout.json` | 15 | 15/15 | 15/15 | PASS |
| `qa_interview_l2.json` | 259 | 259/259 | 259/259 | PASS |
| `qa_interview_s1.json` | 77 | 77/77 | 77/77 | PASS |
| `qa_interview_s2.json` | 96 | 96/96 | 96/96 | PASS |
| `qa_interview_s3.json` | 76 | 76/76 | 76/76 | PASS |

## 3. Context independence

Every interview question asked again as a follow-up (`ctx.prev`) after each of three unrelated questions, chosen because each names something a pronoun could wrongly attach to. It must land on the same answer as when asked cold.

| Previous question | Same answer as cold | Same text as cold |
|---|---:|---:|
| "What is Koode?" | 523/523 | 523/523 |
| "Which videos have you made about Spiti?" | 523/523 | 523/523 |
| "What did you do at TCS?" | 523/523 | 523/523 |
| **All** | **1,569/1,569** | **1,569/1,569** |

## 4. Paraphrase consistency

Test phrasings from all sets grouped by the one curated answer they expect (questions that accept several answers by design, 57, are left out). Every curated answer with two or more distinct phrasings is listed; all of its phrasings must land on it.

| Phrasings per answer | Answers | Phrasings | All landed |
|---|---:|---:|---:|
| 7–10 | 10 | 98 | 10/10 |
| 11+ | 289 | 5,749 | 289/289 |
| **All** | **299** | **5,847** | **299/299** |

<details><summary>Every answer and its phrasings</summary>

| Curated answer | Phrasings | Sets | Landed | Result |
|---|---:|---:|---:|---|
| `family` | 66 | 9 | 66/66 | PASS |
| `skills` | 43 | 6 | 43/43 | PASS |
| `current-role` | 40 | 8 | 40/40 | PASS |
| `who` | 37 | 4 | 37/37 | PASS |
| `smartplane-press` | 33 | 2 | 33/33 | PASS |
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
| `iv4-defining-question` | 25 | 2 | 25/25 | PASS |
| `smartplane-specs` | 25 | 2 | 25/25 | PASS |
| `teams` | 25 | 7 | 25/25 | PASS |
| `youtube` | 25 | 7 | 25/25 | PASS |
| `iv2-ka-1000-concurrent` | 24 | 2 | 24/24 | PASS |
| `iv2-knowledge-assistant` | 24 | 2 | 24/24 | PASS |
| `iv4-genai-platform` | 24 | 2 | 24/24 | PASS |
| `proudest` | 24 | 4 | 24/24 | PASS |
| `youtube-why` | 24 | 5 | 24/24 | PASS |
| `iv2-ka-access-revoked` | 23 | 2 | 23/23 | PASS |
| `iv2-ka-deleted-documents` | 23 | 2 | 23/23 | PASS |
| `iv2-ka-vector-db-down` | 23 | 3 | 23/23 | PASS |
| `smartplane-channel` | 23 | 2 | 23/23 | PASS |
| `iv1-prompt-injection` | 22 | 3 | 22/22 | PASS |
| `iv2-rollback` | 22 | 3 | 22/22 | PASS |
| `iv3-accuracy-expectations` | 22 | 3 | 22/22 | PASS |
| `iv3-agents-everywhere` | 22 | 3 | 22/22 | PASS |
| `iv4-scenario-accuracy-promise` | 22 | 2 | 22/22 | PASS |
| `iv4-scenario-agent-incident` | 22 | 2 | 22/22 | PASS |
| `iv4-scenario-build-vs-buy` | 22 | 2 | 22/22 | PASS |
| `iv4-scenario-research-breakthrough` | 22 | 2 | 22/22 | PASS |
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
| `iv4-agent-state-termination` | 21 | 2 | 21/21 | PASS |
| `iv4-agent-testing-paths` | 21 | 2 | 21/21 | PASS |
| `iv4-approval-reversibility` | 21 | 2 | 21/21 | PASS |
| `iv4-baselines` | 21 | 2 | 21/21 | PASS |
| `iv4-coach-seniors` | 21 | 2 | 21/21 | PASS |
| `iv4-commitment` | 21 | 2 | 21/21 | PASS |
| `iv4-communicate-uncertainty` | 21 | 2 | 21/21 | PASS |
| `iv4-deprecation` | 21 | 2 | 21/21 | PASS |
| `iv4-experimental-design` | 21 | 2 | 21/21 | PASS |
| `iv4-fair-benchmarking` | 21 | 2 | 21/21 | PASS |
| `iv4-finops` | 21 | 2 | 21/21 | PASS |
| `iv4-generalization` | 21 | 2 | 21/21 | PASS |
| `iv4-gpu-isolation` | 21 | 2 | 21/21 | PASS |
| `iv4-inject-quality-regression` | 21 | 2 | 21/21 | PASS |
| `iv4-inject-regional-restriction` | 21 | 2 | 21/21 | PASS |
| `iv4-injection-containment` | 21 | 2 | 21/21 | PASS |
| `iv4-mandate-recommend` | 21 | 2 | 21/21 | PASS |
| `iv4-model-families` | 21 | 2 | 21/21 | PASS |
| `iv4-multi-hop` | 21 | 2 | 21/21 | PASS |
| `iv4-no-gatekeeping` | 21 | 2 | 21/21 | PASS |
| `iv4-novelty` | 21 | 2 | 21/21 | PASS |
| `iv4-operationalize-rai` | 21 | 2 | 21/21 | PASS |
| `iv4-ownership` | 21 | 2 | 21/21 | PASS |
| `iv4-paper-to-production` | 21 | 2 | 21/21 | PASS |
| `iv4-paved-road` | 21 | 2 | 21/21 | PASS |
| `iv4-phd-hypothesis` | 21 | 2 | 21/21 | PASS |
| `iv4-policy-runtime-test` | 21 | 2 | 21/21 | PASS |
| `iv4-portfolio-quality` | 21 | 2 | 21/21 | PASS |
| `iv4-prioritize-100` | 21 | 2 | 21/21 | PASS |
| `iv4-provenance-permissions` | 21 | 2 | 21/21 | PASS |
| `iv4-publish-patent` | 21 | 2 | 21/21 | PASS |
| `iv4-quality-root-cause` | 21 | 2 | 21/21 | PASS |
| `iv4-quantization` | 21 | 2 | 21/21 | PASS |
| `iv4-questions-for-panel` | 21 | 2 | 21/21 | PASS |
| `iv4-regulatory-mapping` | 21 | 2 | 21/21 | PASS |
| `iv4-reproduce-failure` | 21 | 2 | 21/21 | PASS |
| `iv4-research-status` | 21 | 2 | 21/21 | PASS |
| `iv4-research-transferable` | 21 | 2 | 21/21 | PASS |
| `iv4-retrieval-eval-independent` | 21 | 2 | 21/21 | PASS |
| `iv4-roadmap-2-3-year` | 21 | 2 | 21/21 | PASS |
| `iv4-sandboxing` | 21 | 2 | 21/21 | PASS |
| `iv4-scenario-90-day-mandate` | 21 | 2 | 21/21 | PASS |
| `iv4-secrets-egress` | 21 | 2 | 21/21 | PASS |
| `iv4-sponsor-committed` | 21 | 2 | 21/21 | PASS |
| `iv4-strategy-to-outcomes` | 21 | 2 | 21/21 | PASS |
| `iv4-technique-maturity` | 21 | 2 | 21/21 | PASS |
| `iv4-telemetry-leakage` | 21 | 2 | 21/21 | PASS |
| `iv4-uncertainty-reporting` | 21 | 2 | 21/21 | PASS |
| `iv4-vendor-assessment` | 21 | 2 | 21/21 | PASS |
| `iv4-version-governance` | 21 | 2 | 21/21 | PASS |
| `koode` | 21 | 8 | 21/21 | PASS |
| `mentors` | 21 | 7 | 21/21 | PASS |
| `research-supervisor` | 21 | 2 | 21/21 | PASS |
| `smartplane-video` | 21 | 2 | 21/21 | PASS |
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
| `iv4-ablation` | 20 | 2 | 20/20 | PASS |
| `iv4-availability-vs-usefulness` | 20 | 2 | 20/20 | PASS |
| `iv4-close` | 20 | 2 | 20/20 | PASS |
| `iv4-consequential-actions` | 20 | 2 | 20/20 | PASS |
| `iv4-contradictory-sources` | 20 | 2 | 20/20 | PASS |
| `iv4-cost-per-task` | 20 | 2 | 20/20 | PASS |
| `iv4-decision-evidence` | 20 | 2 | 20/20 | PASS |
| `iv4-demo-not-production` | 20 | 2 | 20/20 | PASS |
| `iv4-dr-testing` | 20 | 2 | 20/20 | PASS |
| `iv4-human-oversight` | 20 | 2 | 20/20 | PASS |
| `iv4-llm-slos` | 20 | 2 | 20/20 | PASS |
| `iv4-method-assumptions` | 20 | 2 | 20/20 | PASS |
| `iv4-model-routing` | 20 | 2 | 20/20 | PASS |
| `iv4-not-productionized` | 20 | 2 | 20/20 | PASS |
| `iv4-permission-leakage` | 20 | 2 | 20/20 | PASS |
| `iv4-platform-adoption` | 20 | 2 | 20/20 | PASS |
| `iv4-platform-bottleneck` | 20 | 2 | 20/20 | PASS |
| `iv4-prove-multi-agent` | 20 | 2 | 20/20 | PASS |
| `iv4-red-teaming-incidents` | 20 | 2 | 20/20 | PASS |
| `iv4-reference-boundaries` | 20 | 2 | 20/20 | PASS |
| `iv4-retrieval-choice` | 20 | 2 | 20/20 | PASS |
| `iv4-synthetic-generated-content` | 20 | 2 | 20/20 | PASS |
| `iv4-tco-api-vs-self-host` | 20 | 2 | 20/20 | PASS |
| `smartplane-engine` | 20 | 2 | 20/20 | PASS |
| `smartplane-unveiled-by` | 20 | 2 | 20/20 | PASS |
| `smartplane-when` | 20 | 2 | 20/20 | PASS |
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
| `iv4-ai-act-nist-iso` | 19 | 2 | 19/19 | PASS |
| `iv4-architecture-function` | 19 | 2 | 19/19 | PASS |
| `iv4-failure-strategy` | 19 | 2 | 19/19 | PASS |
| `iv4-gp-90-day-slice` | 19 | 2 | 19/19 | PASS |
| `iv4-gp-discovery` | 19 | 2 | 19/19 | PASS |
| `iv4-metrics-levels` | 19 | 2 | 19/19 | PASS |
| `iv4-prior-work` | 19 | 2 | 19/19 | PASS |
| `iv4-privacy-controls` | 19 | 2 | 19/19 | PASS |
| `iv4-reject-use-cases` | 19 | 2 | 19/19 | PASS |
| `iv4-research-changed-opinion` | 19 | 2 | 19/19 | PASS |
| `iv4-retrieval-eval-protocol` | 19 | 2 | 19/19 | PASS |
| `iv4-retrieval-failure-modes` | 19 | 2 | 19/19 | PASS |
| `iv4-risk-tiering` | 19 | 2 | 19/19 | PASS |
| `services` | 19 | 4 | 19/19 | PASS |
| `soccer-ai` | 19 | 5 | 19/19 | PASS |
| `career-history` | 18 | 3 | 18/18 | PASS |
| `iv1-dense-sparse` | 18 | 2 | 18/18 | PASS |
| `iv1-draw-complex` | 18 | 2 | 18/18 | PASS |
| `iv1-mcp-tools` | 18 | 2 | 18/18 | PASS |
| `iv1-reranking` | 18 | 2 | 18/18 | PASS |
| `iv1-training-vs-rag` | 18 | 2 | 18/18 | PASS |
| `iv3-rejected-attractive` | 18 | 2 | 18/18 | PASS |
| `iv4-accountability-unauthorized` | 18 | 2 | 18/18 | PASS |
| `iv4-agent-justification` | 18 | 2 | 18/18 | PASS |
| `iv4-autonomy-criteria` | 18 | 2 | 18/18 | PASS |
| `iv4-beyond-rag` | 18 | 2 | 18/18 | PASS |
| `iv4-centralize-vs-domain` | 18 | 2 | 18/18 | PASS |
| `iv4-gp-build-buy` | 18 | 2 | 18/18 | PASS |
| `iv4-gp-capacity-dr-cost` | 18 | 2 | 18/18 | PASS |
| `iv4-gp-identity-residency` | 18 | 2 | 18/18 | PASS |
| `iv4-gp-model-access` | 18 | 2 | 18/18 | PASS |
| `iv4-gp-runtime-isolation` | 18 | 2 | 18/18 | PASS |
| `iv4-kg-vs-vector` | 18 | 2 | 18/18 | PASS |
| `iv4-major-disagreement` | 18 | 2 | 18/18 | PASS |
| `iv4-mixed-content-retrieval` | 18 | 2 | 18/18 | PASS |
| `iv4-platform-roles` | 18 | 2 | 18/18 | PASS |
| `iv4-platform-slos` | 18 | 2 | 18/18 | PASS |
| `iv4-serving-capacity` | 18 | 2 | 18/18 | PASS |
| `iv4-serving-optimizations` | 18 | 2 | 18/18 | PASS |
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
| `iv4-adaptation-methods` | 17 | 2 | 17/17 | PASS |
| `iv4-agent-boundary` | 17 | 2 | 17/17 | PASS |
| `iv4-changed-decision` | 17 | 2 | 17/17 | PASS |
| `iv4-gp-observability` | 17 | 2 | 17/17 | PASS |
| `iv4-gp-operating-model` | 17 | 2 | 17/17 | PASS |
| `iv4-gp-trust-boundaries` | 17 | 2 | 17/17 | PASS |
| `iv4-inject-cost-shock` | 17 | 2 | 17/17 | PASS |
| `iv4-inject-prompt-injection` | 17 | 2 | 17/17 | PASS |
| `iv4-inject-provider-outage` | 17 | 2 | 17/17 | PASS |
| `iv4-multi-agent-failures` | 17 | 2 | 17/17 | PASS |
| `iv4-project-deep-dive` | 17 | 2 | 17/17 | PASS |
| `location` | 17 | 5 | 17/17 | PASS |
| `research-dates` | 17 | 2 | 17/17 | PASS |
| `research-papers` | 17 | 2 | 17/17 | PASS |
| `research-where` | 17 | 2 | 17/17 | PASS |
| `smartplane-minister` | 17 | 2 | 17/17 | PASS |
| `ai-tour` | 16 | 3 | 16/16 | PASS |
| `android-apps` | 16 | 3 | 16/16 | PASS |
| `birthday` | 16 | 4 | 16/16 | PASS |
| `iv4-attention-kv-cache` | 16 | 2 | 16/16 | PASS |
| `iv4-cio-strategy` | 16 | 2 | 16/16 | PASS |
| `iv4-gp-agent-execution` | 16 | 2 | 16/16 | PASS |
| `iv4-gp-knowledge` | 16 | 2 | 16/16 | PASS |
| `iv4-long-context` | 16 | 2 | 16/16 | PASS |
| `open-source` | 16 | 3 | 16/16 | PASS |
| `pachaka-lokam` | 16 | 6 | 16/16 | PASS |
| `voice-uav` | 16 | 5 | 16/16 | PASS |
| `iv1-ml-task-types` | 15 | 2 | 15/15 | PASS |
| `rvonwheelz` | 15 | 3 | 15/15 | PASS |
| `smartplane-weight` | 15 | 2 | 15/15 | PASS |
| `smartplane-where` | 15 | 2 | 15/15 | PASS |
| `bfsi` | 14 | 4 | 14/14 | PASS |
| `inspiration` | 14 | 5 | 14/14 | PASS |
| `interests` | 14 | 5 | 14/14 | PASS |
| `iplbuzz` | 14 | 3 | 14/14 | PASS |
| `research-trust-sources` | 14 | 2 | 14/14 | PASS |
| `iv4-inject-permission-revocation` | 13 | 2 | 13/13 | PASS |
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
| Curated answers in the index whose evidence resolved to at least one record | 299/299 |
| Evidence links the build could not resolve | 0 |
| Curated answers served in this run (299 distinct) with at least one citation | 6,489/6,489 |
| ...cited by a record from their own evidence list | 6,489/6,489 |
| All answers served (curated, video, repository, retrieval; small talk and declines excluded) with a citation | 6,595/6,595 |
| Served answers containing a client name (Southwest, PwC, American Express, Amex) | 0 of 6,676 |
| Curated answers in the index (and their translations) containing a client name | 0 of 299 |

## 6. Performance

| Measure | Value |
|---|---|
| Questions timed (one `answerQuestion` call each) | 6,676 |
| p50 / p95 / max latency | 27.19 ms / 50.43 ms / 268.49 ms |
| Mean latency · first (cold) call | 29.39 ms · 263.11 ms |
| p95 limit | 250 ms (PASS) |
| Index: chunks · curated answers · documents · vocabulary | 962 · 299 · 501 · 9,856 |
| `site/data/index.json` · `semantic.json` | 5,270,676 bytes (5.03 MB) · 1,478,604 bytes (1.41 MB) |
| Build time | not measured (run with `--build`) |
