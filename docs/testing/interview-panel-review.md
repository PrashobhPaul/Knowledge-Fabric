# Interview panel review: Eidolon against the Senior / Enterprise AI Architect brief

Dated 2026-11-26 · branch `prashobh-ai/beautiful-maxwell-qefj4s` · base commit `dfaa6b6` · brief: `tests/interview_brief.md`.
An independent, deliberately demanding panel graded the answers the system actually serves. The panel did not write them.

## Method

| Step | What was done |
|---|---|
| Capture | Rebuilt the index, then a scratch script (not committed) built the same context as `tests/qa_eval.mjs` and called `answerQuestion()` for every brief question verbatim: Sessions 1–3, the whiteboard prompt, its seven follow-ups (asked as the brief words them, after the whiteboard question), the problem-solving prompt and the five never-skip questions. 92 questions, 91 distinct curated answers, 11 with a diagram. Captured: plain-text answer, curated id, diagram, word count. |
| Grade | Each answer 1–5 on technical correctness, architect judgement and trade-offs, clarifying questions on design problems, enterprise concerns (security, cost, scale, governance, evaluation, ownership), concrete personal evidence, and directness. |
| Cross-check | Every career and portfolio claim against `docs_source/notes/*.md`, `knowledge_sources/profile/profile.yaml`, `canon.yaml`, `knowledge_sources/github/*.json`, `README.md` and the test files. Client names (Southwest, PwC, American Express, Amex) searched in every answer. |
| Fix | Every answer below 4 rewritten in `canon_interview_s1.yaml` / `_s3.yaml`, first person, every rubric phrase from `tests/qa_interview_*.json` kept, no new personal facts or metrics. Two factual slips in answers at 4+ also corrected. Re-asked and re-graded. |
| Score | Competency = mean of its questions rounded down to the nearest 0.5 (a demanding panel does not round up); Enterprise architecture a further −0.5, because none of its 24 answers carries enterprise-scale numbers of his own. |

## Scorecard

| Competency | Weight | Questions | Mean before → after | Panel before | Panel after | Why |
|---|---|---|---|---|---|---|
| AI/ML fundamentals | 10% | 7 | 4.64 → 4.64 | 4.5 | 4.5 | Precise, cost-aware; fraud answer leads with "No" and the accuracy paradox |
| GenAI / LLM | 15% | 8 | 4.63 → 4.69 | 4.5 | 4.5 | Correct mechanics, real arithmetic on the cost-cut case; RoPE slip fixed |
| RAG & Agentic | 15% | 10 | 4.75 → 4.75 | 4.5 | 4.5 | Excellent design depth; evidence is portfolio-scale; secure-RAG skips clarifying questions |
| Enterprise architecture | 20% | 24 | 4.58 → 4.65 | 4.0 | 4.0 | Whiteboard and follow-ups are 5s, but no enterprise-scale numbers of his own; POC answer was a checklist (fixed) |
| Cloud / DevOps / engineering | 10% | 10 | 4.70 → 4.70 | 4.5 | 4.5 | Release manifests, eval gates, GPU serving all sound |
| AI testing & governance | 10% | 9 | 4.50 → 4.56 | 4.5 | 4.5 | Layered eval, leakage sets, governance as a platform; false claim about the twin's tests fixed |
| Leadership & communication | 10% | 10 | 4.45 → 4.45 | 4.0 | 4.0 | Sound method; evidence limited to mentoring interns and freshers and "three geographies" |
| Business & strategy | 10% | 13 | 4.46 → 4.58 | 4.0 | 4.5 | Never-skip #2 and estimation were weak (fixed); scenarios are strong |
| **Weighted total** | 100% | 91 answers | 4.58 → 4.63 | **4.30** | **4.35** | Strong hire on knowledge; capped by evidence, not by correctness |

| Disqualifier rule | Before | After |
|---|---|---|
| Enterprise architecture < 3 | 4.0, pass | 4.0, pass |
| AI/LLM < 3 (AI/ML fundamentals and GenAI/LLM) | 4.5 / 4.5, pass | 4.5 / 4.5, pass |

| Architect vs senior developer (brief) | Shown in |
|---|---|
| Defines the right solution · translates strategy | `iv2-requirement-to-architecture`, `iv3-ai-strategy` |
| Evaluates and selects models · total economics | `iv1-open-vs-proprietary`, `iv1-cost-cut`, `iv3-estimation` |
| Retrieval strategy · where agents are justified | `iv1-dense-sparse`, `iv1-secure-rag`, `iv3-agents-everywhere` |
| Infrastructure · security architecture | `iv2-knowledge-assistant`, `iv2-security-auth`, `iv2-multi-tenancy` |
| Standards · owns technical direction | `iv2-standardize-vs-decentralize`, `iv3-conflicting-opinions` ("I make the call") |

## Flags across all answers

| Flag | Finding |
|---|---|
| Client names | None in any served answer (and the proof's grounding check agrees). |
| Unsupported career claims | None. Every employer, date, figure (60+ hospitals, 76→89.5, 300x, 81/78 held-out, 221+9 gold, 27 tests, 0.70/0.55 gates, 1,400+ questions, 60% walk-forward) traces to a note, the profile, `canon.yaml`, repo data or `README.md`. |
| Factual errors | 2: the twin's "every one of its test sets has must-decline questions" (coverage and interview sets have none; 73 in total); rotary embeddings described as "added". Both fixed. |
| Role ambiguity | `iv1-complex-solution` implied he built the whole platform while `iv1-contributions` says his part was the NLP core. Fixed. |
| Generic or checklist answers | `iv1-poc-to-production` (six unranked generic challenges), `iv3-estimation` (process, no number). Fixed. |
| Buzzword lists | None without reasons; `iv3-genai-roles` is the most list-like (4). |
| Dodges | None. Yes/no questions are answered first ("No, it is not successful", "No, not all of them"). |
| Overlong | 3 answers over 500 words (`iv2-knowledge-assistant` 545, `iv2-enterprise-rag-5000` 533, `iv2-performance-turnaround` 528), all whiteboard designs, where length is earned. Median 287 words, about 2 minutes spoken. |
| Repeated boilerplate | 71 of 91 answers close on his own work; Knowledge Fabric appears in 36, AgentBasedSystem 14, CodeFabric 13, ValidAIte/QMentisAI 11, "confidential names masked" 8, the Tech Mahindra "latency and token cost predictable" line 3, "27 tests" 3. Not fixed (all at 4+); listed below as the first thing a tougher panel will notice. |

## Every question, before → after

D = a diagram is attached. Words = served answer length before → after.

| # | Part | Question as asked | Curated answer | Words | Score | Reason |
|---|---|---|---|---|---|---|
| 1 | S1-A | Walk me through the most complex AI solution you have architected.… | `iv1-complex-solution` | 355→383 | 3.5 → 4 | Concrete problem, layers, stack, reach; before: claimed the whole platform while the next answer says his part was the NLP core. Now states his part; still no business-outcome metric |
| 2 | S1-A | What were your personal contributions versus what your engineering… | `iv1-contributions` | 264→264 | 4.5 → 4.5 | Explicit personal vs team split, credit by name, public code as proof |
| 3 | S1-A | What was the biggest architectural decision you made, and what… | `iv1-architecture-decision` | 308→308 | 4 → 4 | Real rejected alternatives and costs; but the "biggest decision" is a personal static site, enterprise parallel is one sentence |
| 4 | S1-A | Tell me about an AI implementation that failed or underperformed.… | `iv1-failure` | 312→312 | 4 → 4 | Genuine own failure (overfit test set, held-out 81/78); first story is a rescue, not a failure |
| 5 | S1-A | If you had to rebuild your most successful AI solution today, what… | `iv1-rebuild` | 288→288 | 4.5 → 4.5 | Keep/change split, privacy by architecture, eval first, refuses one-big-model |
| 6 | S1-A | Probe: draw the architecture of your most complex project. | `iv1-draw-complex` (D) | 349→349 | 4.5 → 4.5 | Six layers each with a why, diagram attached, hedges to KF for the GenAI-era system |
| 7 | S1-B | When would you choose traditional ML over an LLM-based solution? | `iv1-ml-vs-llm` | 261→261 | 4.5 → 4.5 | Clear selection criteria, hybrid pattern, cost point; Yash/TCS evidence |
| 8 | S1-B | Explain the difference between classification, regression, clustering… | `iv1-ml-task-types` | 249→249 | 4.5 → 4.5 | Correct, metric per task, enterprise cases, how they combine |
| 9 | S1-B | How would you handle class imbalance in a production classification… | `iv1-class-imbalance` | 269→269 | 4.5 → 4.5 | Resample train folds only, threshold as business decision, label delay |
| 10 | S1-B | How do you identify and manage data drift and concept drift? | `iv1-drift` | 268→268 | 4.5 → 4.5 | P(X) vs P(Y|X), PSI bands, root cause before retrain |
| 11 | S1-B | How would you determine whether a model needs retraining? | `iv1-retraining` | 261→261 | 4.5 → 4.5 | Four evidence signals, challenger/shadow, walk-forward example |
| 12 | S1-B | Explain the difference between precision, recall, F1, ROC-AUC and… | `iv1-metrics` | 277→277 | 5 → 5 | Precise incl. ROC-AUC meaning, PR baseline, cost-weighted threshold |
| 13 | S1-B | Advanced: a fraud model has 99% accuracy but misses 40% of fraudulent… | `iv1-fraud-accuracy` | 382→382 | 5 → 5 | Direct "No", accuracy paradox, tiered thresholds, features, label delay |
| 14 | S1-C | Explain the architecture of a Transformer. What are attention and… | `iv1-transformer` | 298→318 | 4.5 → 5 | Correct and architect-relevant; fixed slip that rotary encodings are "added" (they rotate Q/K) |
| 15 | S1-C | What is the difference between pre-training, fine-tuning, instruction… | `iv1-training-vs-rag` | 277→277 | 4.5 → 4.5 | "Fine-tune for behaviour, RAG for knowledge", permissions argument |
| 16 | S1-C | When would you use LoRA or QLoRA instead of full fine-tuning? | `iv1-lora` | 293→293 | 5 → 5 | Memory maths, QLoRA NF4, merge vs multi-adapter serving |
| 17 | S1-C | How do temperature, top-p and token limits influence generation? | `iv1-sampling` | 259→259 | 4.5 → 4.5 | Correct mechanics, sane defaults, temp-0 non-determinism caveat |
| 18 | S1-C | What happens when an LLM hallucinates? How would you minimize it? | `iv1-hallucination` | 297→297 | 4.5 → 4.5 | Causes plus layered mitigations, "do not generate" option |
| 19 | S1-C | How would you select between open-source and proprietary LLMs for an… | `iv1-open-vs-proprietary` | 289→289 | 4.5 → 4.5 | Six criteria, TCO break-even, gateway portfolio |
| 20 | S1-C | How would you optimize inference latency and token consumption? | `iv1-latency-tokens` | 280→280 | 4.5 → 4.5 | Measure first, concrete levers, eval gate on every change |
| 21 | S1-C | Advanced: 10,000 requests/day, GPT inference costs $5,000/month; cut… | `iv1-cost-cut` | 414→414 | 5 → 5 | Does the arithmetic, eval gate first, every look-for lever with numbers |
| 22 | S1-D | Explain the complete RAG architecture, from document ingestion to… | `iv1-rag-architecture` (D) | 343→343 | 5 → 5 | Offline/online paths, ACL in query, citation check, diagram |
| 23 | S1-D | How would you select chunk size and overlap? | `iv1-chunking` | 275→275 | 5 → 5 | Embedding truncation, structure first, measured choice |
| 24 | S1-D | What is the difference between dense retrieval, sparse retrieval and… | `iv1-dense-sparse` | 273→273 | 5 → 5 | Failure modes, RRF maths, measured uplift per mode |
| 25 | S1-D | When would you use reranking? | `iv1-reranking` | 280→280 | 4.5 → 4.5 | When and when not, latency cost, decided on numbers |
| 26 | S1-D | How would you handle documents containing tables, images, diagrams… | `iv1-complex-documents` | 300→300 | 4.5 → 4.5 | Typed elements, tables to SQL, VLM descriptions |
| 27 | S1-D | Explain the difference between an AI agent, an AI assistant and a… | `iv1-agent-vs-assistant` | 294→294 | 4.5 → 4.5 | "Who decides the next step", spectrum, own examples |
| 28 | S1-D | How do MCP, function calling and tool orchestration differ? | `iv1-mcp-tools` | 287→287 | 5 → 5 | Three layers cleanly separated; MCP servers he built |
| 29 | S1-D | How would you prevent an agent from entering an infinite execution loop? | `iv1-agent-loops` | 286→286 | 5 → 5 | Hard limits, loop detection, forced-conclusion flag in his own agent |
| 30 | S1-D | When would you choose a multi-agent architecture over a single-agent… | `iv1-multi-agent` | 264→264 | 4.5 → 4.5 | Single-agent default, five justifications, counterexample |
| 31 | S1-D | Advanced: 20,000 documents, multiple departments, different… | `iv1-secure-rag` (D) | 417→417 | 4.5 → 4.5 | Every look-for incl. leakage set; designs without a single clarifying question |
| 32 | S1-E | How do you evaluate the quality of a RAG system? | `iv1-rag-evaluation` | 289→289 | 4.5 → 4.5 | Three layers, calibrated judge, real CI thresholds |
| 33 | S1-E | What is the difference between retrieval quality and generation quality? | `iv1-retrieval-vs-generation` | 262→262 | 5 → 5 | Oracle-context trick, diagnosis order |
| 34 | S1-E | How would you test an LLM application for hallucinations? | `iv1-hallucination-testing` | 277→284 | 4 → 4.5 | Claim-level scoring, four case types; fixed false claim that every one of the twin's test sets has must-decline cases |
| 35 | S1-E | How would you build an evaluation dataset? | `iv1-eval-dataset` | 276→276 | 4.5 → 4.5 | Sources, coverage, rubric labels, held-out, real counts |
| 36 | S1-E | How do you test non-deterministic AI applications? | `iv1-nondeterministic` | 257→257 | 4.5 → 4.5 | Property assertions, statistical pass rates |
| 37 | S1-E | What is your approach to prompt injection and adversarial testing? | `iv1-prompt-injection` | 301→301 | 4.5 → 4.5 | Direct/indirect, least privilege, OWASP LLM Top 10, garak/PyRIT |
| 38 | S2-A | How do you translate a business requirement into an AI solution… | `iv2-requirement-to-architecture` | 311→311 | 5 → 5 | Clarifying questions first, problem classes, NFR per layer, ADRs |
| 39 | S2-A | What are the architectural considerations when deploying an AI… | `iv2-10k-concurrent-users` | 313→313 | 5 → 5 | Turns sessions into RPS; quota, not web tier, is the bottleneck |
| 40 | S2-A | How do you design an AI application for high availability and fault… | `iv2-high-availability` | 313→313 | 4.5 → 4.5 | Degraded mode per dependency, quality counted as availability |
| 41 | S2-A | How would you handle multi-tenancy in an enterprise GenAI platform? | `iv2-multi-tenancy` | 309→309 | 5 → 5 | Silo/pool/bridge, cache leakage, isolation tests in CI |
| 42 | S2-A | How do you approach authentication, authorization and data security… | `iv2-security-auth` | 305→305 | 4.5 → 4.5 | RBAC vs ABAC, model never decides access, PII gateway |
| 43 | S2-A | How would you design an AI solution that must work across AWS, Azure… | `iv2-multi-cloud` | 292→292 | 4.5 → 4.5 | Asks why, portable core, data gravity |
| 44 | S2-A | What architectural components would you standardize across multiple… | `iv2-standard-components` | 293→293 | 4.5 → 4.5 | Eight components ordered by value, each with a reason |
| 45 | S2-A | How do you decide whether to use microservices, modular monoliths or… | `iv2-microservices-monolith-serverless` | 295→295 | 4.5 → 4.5 | Modular-monolith default, AI-specific split points |
| 46 | S2-B | Whiteboard: Enterprise AI Knowledge Assistant. 50,000 documents… | `iv2-knowledge-assistant` (D) | 545→545 | 5 → 5 | Clarifies, states assumptions, all nine expected layers, rejected options, failure modes, diagram |
| 47 | S2-B FU | Vector DB goes down? | `iv2-ka-vector-db-down` | 288→288 | 5 → 5 | Index as derived artifact, BM25 fallback, never ungrounded |
| 48 | S2-B FU | A user loses access to a document? | `iv2-ka-access-revoked` | 260→260 | 5 → 5 | Sync plus query-time claims, late check, cache invalidation |
| 49 | S2-B FU | Deleted documents disappear from retrieval? | `iv2-ka-deleted-documents` | 268→268 | 5 → 5 | Tombstones, query-time filter, orphan metric, erasure audit |
| 50 | S2-B FU | Support 1,000 concurrent users? | `iv2-ka-1000-concurrent` | 285→285 | 4.5 → 4.5 | Users to load, backpressure; closer repeats the Tech Mahindra line |
| 51 | S2-B FU | Switch LLM provider without changing application logic? | `iv2-ka-switch-llm-provider` (D) | 271→271 | 5 → 5 | Behaviour, not API, breaks; embeddings need re-index |
| 52 | S2-B FU | Keep sensitive information out of external LLM APIs? | `iv2-ka-sensitive-data` (D) | 286→286 | 4.5 → 4.5 | Classification-driven routing, placeholder round-trip |
| 53 | S2-B FU | Measure retrieval quality in production? | `iv2-ka-retrieval-quality-production` | 285→285 | 5 → 5 | Rephrase signal, judged samples, replayable traces |
| 54 | S2-C | How do you structure a production-grade Python AI application? | `iv2-python-app-structure` | 256→256 | 4.5 → 4.5 | One-way layers, injected LLM, real repo example |
| 55 | S2-C | What is your preferred backend architecture using FastAPI? | `iv2-fastapi-backend` | 282→282 | 4.5 → 4.5 | Thin routers, DI for auth, SSE, jobs off the request path |
| 56 | S2-C | How do you manage asynchronous processing and background jobs? | `iv2-async-background-jobs` | 273→273 | 4.5 → 4.5 | Idempotent jobs, DLQ, durable workflows |
| 57 | S2-C | How do you implement CI/CD for an AI application? | `iv2-cicd` | 290→290 | 5 → 5 | AI gate with floors, blue-green index alias |
| 58 | S2-C | How do you manage model versions, prompts and datasets? | `iv2-versioning` | 284→284 | 5 → 5 | Release manifest ties model, prompt, index, eval |
| 59 | S2-C | How would you deploy an open-source LLM on Kubernetes? | `iv2-llm-on-kubernetes` | 301→301 | 5 → 5 | Sizing first, vLLM, weight caching, GPU-aware scaling |
| 60 | S2-C | How do you manage GPU utilization and inference throughput? | `iv2-gpu-throughput` | 273→273 | 4.5 → 4.5 | Right-size, batch, quantise, schedule; measured |
| 61 | S2-C | How do you monitor token consumption, latency and cost? | `iv2-token-latency-cost-monitoring` | 293→293 | 4.5 → 4.5 | Gateway attribution, OTel GenAI conventions, quality beside cost |
| 62 | S2-C | How do you design rollback mechanisms for a model or prompt update? | `iv2-rollback` | 306→306 | 5 → 5 | Pointer change, staged canary, embedding/state edge cases |
| 63 | S2-C | How do you separate application testing from model evaluation? | `iv2-app-testing-vs-model-eval` | 270→270 | 4.5 → 4.5 | Injected adapter as the boundary |
| 64 | S2-D | Problem-solving: response time 12s→4s; hallucination 18%→<5%; monthly… | `iv2-performance-turnaround` (D) | 528→528 | 4.5 → 4.5 | Does not touch the model first, per-layer order; 528 words, double closer |
| 65 | S3-A | How do you establish an enterprise AI architecture strategy? | `iv3-ai-strategy` | 291→291 | 4.5 → 4.5 | Business-first, four-part strategy, quarterly review |
| 66 | S3-A | How do you identify opportunities where AI can deliver measurable… | `iv3-value-opportunities` | 286→286 | 4.5 → 4.5 | Pain with a number, value x feasibility, 300x ticket classifier |
| 67 | S3-A | How do you decide whether an organization should build an AI solution… | `iv3-build-vs-buy` | 299→299 | 4.5 → 4.5 | Five questions, three-year TCO, blend behind own gateway |
| 68 | S3-A | How do you handle conflicting architectural opinions between… | `iv3-conflicting-opinions` | 260→260 | 4.5 → 4.5 | Drivers first, ADRs, spike, then decides and owns it |
| 69 | S3-A | How do you establish reusable AI frameworks and accelerators? | `iv3-accelerators` | 284→284 | 4.5 → 4.5 | Harvest, not design; run as products; TCS date tagger |
| 70 | S3-A | How do you ensure architectural consistency across multiple AI projects? | `iv3-consistency` | 277→277 | 4.5 → 4.5 | Few mandatory standards, paved road, fitness functions |
| 71 | S3-A | How do you balance innovation with enterprise governance? | `iv3-innovation-governance` | 269→269 | 4 → 4 | Three risk lanes, governance in the platform; evidence is a sentiment |
| 72 | S3-B | You have an AI project with a six-week deadline and unclear… | `iv3-six-weeks` | 268→268 | 4.5 → 4.5 | Fix date and quality, flex scope, golden set as definition of done |
| 73 | S3-B | How do you estimate the effort and cost of an AI implementation? | `iv3-estimation` | 262→329 | 3.5 → 4.5 | Before: process only, no worked number or evidence. Now: run-cost arithmetic, range method, designed-out run cost |
| 74 | S3-B | How do you handle a client who expects 100% accuracy from an LLM? | `iv3-accuracy-expectations` | 272→272 | 5 → 5 | Human baseline, error types, system reliability over model accuracy |
| 75 | S3-B | What would you do if your team proposed an architecture that you… | `iv3-team-wrong-architecture` | 281→281 | 5 → 5 | Questions first, one-way vs two-way doors, private dissent |
| 76 | S3-B | How do you manage technical debt in AI projects? | `iv3-tech-debt` | 263→263 | 4.5 → 4.5 | AI-specific debt, register, fixed sprint share |
| 77 | S3-B | How do you measure the success of an AI implementation beyond model… | `iv3-success-metrics` | 268→268 | 4 → 4 | Four layers, override rate insight; no personal evidence |
| 78 | S3-C | How would you build an AI team from scratch? | `iv3-build-team` | 289→289 | 4.5 → 4.5 | Roadmap-first, small end-to-end core, hires for judgement |
| 79 | S3-C | What roles would you hire for an enterprise GenAI implementation? | `iv3-genai-roles` | 282→282 | 4 → 4 | Complete but list-heavy; reasoning only on the two most-skipped roles |
| 80 | S3-C | How do you mentor junior AI engineers? | `iv3-mentor-juniors` | 279→279 | 4.5 → 4.5 | Own mentors, four-part method, 76 to 89.5 lesson |
| 81 | S3-C | How do you assess whether an engineer is ready to become an AI… | `iv3-architect-readiness` | 292→292 | 4.5 → 4.5 | Five observable traits, stretch assignment as the test |
| 82 | S3-C | How do you handle a technically strong engineer who cannot… | `iv3-communication-gap` | 272→272 | 4.5 → 4.5 | Specific feedback, structure, co-present, protect the strength |
| 83 | S3-D | The client wants to convert all existing workflows into autonomous AI… | `iv3-agents-everywhere` | 415→415 | 5 → 5 | Direct "No", five-criterion portfolio, prove then widen autonomy |
| 84 | S3-D | Leadership wants to drop OpenAI, Anthropic and Google for an entirely… | `iv3-self-hosted` | 381→381 | 5 → 5 | Hidden costs enumerated, hybrid phased path behind a gateway |
| 85 | S3-D | 25 AI applications built independently, no central governance,… | `iv3-governance-25-apps` (D) | 347→347 | 5 → 5 | See first, triage, control plane, waves by risk, coverage metric |
| 86 | S3-D | The business wants an AI solution in 30 days; data quality and… | `iv3-30-day-ask` | 374→374 | 5 → 5 | Negotiates scope, not security; explicit risk acceptance |
| 87 | S3-D | Your first 30, 60 and 90 days as an AI Enterprise Architect in our… | `iv3-first-90-days` (D) | 384→384 | 4.5 → 4.5 | Listen/decide/deliver with deliverables per phase, diagram |
| 88 | NS1 | Draw the most complex AI solution you have personally architected;… | `iv1-draw-complex` (D) | 349→349 | 4.5 → 4.5 | Six layers each with a why, diagram attached, hedges to KF for the GenAI-era system |
| 89 | NS2 | An example where you rejected a technically attractive solution… | `iv3-rejected-attractive` | 314→345 | 3.5 → 4 | Before: only personal projects, enterprise case a one-liner. Now: airline SDLC case with option, reason, trade-off, plus the verifiable one |
| 90 | NS3 | An AI application you moved from POC to production; the biggest… | `iv1-poc-to-production` | 326→333 | 3 → 4 | Before: generic six-item checklist, no single biggest challenge, role unclear. Now: names and argues the biggest challenge, states his part; still no scale or outcome numbers |
| 91 | NS4 | Design an enterprise RAG system with 5,000 concurrent users, strict… | `iv2-enterprise-rag-5000` (D) | 533→533 | 5 → 5 | Clarifies, assumes, ACL inside query, gateway, fail-closed identity |
| 92 | NS5 | With complete freedom to set our enterprise AI architecture: what… | `iv2-standardize-vs-decentralize` | 329→329 | 4.5 → 4.5 | Clear rule, paved roads, federated model |

## Fixes

| Answer | File | Before | After | What changed |
|---|---|---|---|---|
| `iv1-poc-to-production` (never-skip #3) | `canon_interview_s1.yaml` | 3 | 4 | Names the single biggest challenge (grounding) and why it cannot be patched after launch; ranks the other four; states his part (architecture and path to production) against the team's; merges the generic "operations" and "trust" items into monitoring. |
| `iv3-rejected-attractive` (never-skip #2) | `canon_interview_s3.yaml` | 3.5 | 4 | Leads with client work: on the airline SDLC programme, one big autonomous generation rejected for Kiro's spec-driven flow, with the reason and the trade-off; Knowledge Fabric kept as the verifiable example, CogniFlow compressed. |
| `iv3-estimation` | `canon_interview_s3.yaml` | 3.5 | 4.5 | Adds a worked run-cost calculation consistent with the cost-cut answer ($5,000 a month to under $1,500 with 70% routing and a 20% cache hit rate), the range, proof, re-quote method, team-weeks per layer, and a designed-out run cost from his own system. |
| `iv1-complex-solution` | `canon_interview_s1.yaml` | 3.5 | 4 | States his part (the NLP core; EMR integration and rollout were team work) so it agrees with `iv1-contributions`; points to Knowledge Fabric as the GenAI-era system he architected end to end; trimmed. |
| `iv1-hallucination-testing` | `canon_interview_s1.yaml` | 4 | 4.5 | Replaces the false "every one of its test sets" with "more than seventy questions it must decline", and the overclaim "tested this way" with "generates no text, so its tests target the decline half". |
| `iv1-transformer` | `canon_interview_s1.yaml` | 4.5 | 5 | Positional information: sinusoidal or learned vectors added in the original design, rotary embeddings applied to queries and keys in most current LLMs. |

Side finding while fixing: the phrase "trust is won or lost" in one curated answer put "won" into the vocabulary and flipped two must-decline questions ("Who won the 2022 World Cup?", "Who won IPL 2025?") into wrong curated answers. Reworded; both decline again. The decline path depends on corpus vocabulary, so any answer edit can move it; the proof catches it, but only if it is run.

## What a tougher panel would still probe

| # | Weakness | Why it costs marks | What would fix it (needs Prashobh, not the panel) |
|---|---|---|---|
| 1 | No enterprise-scale numbers of his own | Every design answer is textbook-correct, but the evidence beneath is portfolio-scale (a static site, CLI tools). The only scaled production system, the note reader across 60+ hospitals, is pre-LLM and from an NLP-engineer role. No users, QPS, p95, cost or accuracy from Tech Mahindra or Qualizeal. | Two or three cleared, anonymised figures from Tech Mahindra or Qualizeal work: users, latency, cost per conversation, an accuracy or deflection number. |
| 2 | Formulaic closers | 71 of 91 answers end on his own work; Knowledge Fabric in 36. Over three sessions it reads as a template and invites "what else have you got?". | Keep the tie-in only where it is the strongest evidence; vary or drop the rest, especially the repeated Tech Mahindra line and "27 tests". |
| 3 | Thin client-work stories | The airline and STLC programmes appear only as "Kiro spec-driven" and "agents at defined steps". No hard decision, stakeholder conflict, failure or metric from paid work; the biggest decision and the failure story are personal projects. | One client-work story told end to end: the decision, who disagreed, what it cost, what changed. |
| 4 | Leadership evidence | Method answers are strong, but evidence is mentoring interns and freshers and "teams across three geographies". No team size, hiring record, or a conflict he resolved with named outcomes. | Team sizes and one concrete people story from Tech Mahindra or Qualizeal. |
| 5 | Live-panel robustness of the twin | It answers only what is curated: an unplanned drill-down ("what was the p95 at Tech Mahindra?") gets a decline or the nearest answer. A clipped or merged question stitches two answers (the problem-solving prompt cut at "retrieval" returned the turnaround plus dense-vs-sparse answers, 801 words). Decline decisions shift with vocabulary (above). | Curate the likely second-level drill-downs; cap stitched answers; add an off-topic decline regression that runs on every canon edit (the proof already does; keep it mandatory). |

## Verification after the fixes

| Check | Result |
|---|---|
| `python -m pipeline.build_index …` | 163 curated answers, 0 unresolved evidence links |
| `node tests/qa_eval.mjs` on all 15 `tests/qa_*.json` | every set 100%, every no-answer declined |
| `node tests/integration.test.mjs` | 90 passed, 0 failed |
| `python -m pytest -q` | 23 passed |
| `node tests/prove.mjs --build` | PASS: accuracy 1,756/1,756, brief coverage 82/82, determinism 264/264, context 792/792, paraphrase 163 answers / 1,338 phrasings, grounding ok, p95 35.5 ms |
| Re-ask of all 92 brief questions | same curated id and diagram for every question as before the fixes |
