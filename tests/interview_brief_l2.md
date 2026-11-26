# Enterprise GenAI Architect --- Advanced Interview Playbook

## Three 60-minute sessions \| PhD-level technical depth \| Enterprise-scale architectural judgment

**Purpose:** Assess whether the candidate can operate one level above a
senior AI/GenAI architect: define enterprise AI strategy, reason from
first principles, make defensible architecture trade-offs, establish
governance and operating models, and translate research into production
capability.

**Candidate profile:** Experienced AI/GenAI architect pursuing a PhD.\
**Interview principle:** Evaluate evidence, not vocabulary. Ask for
specific decisions, artifacts, measurements, failure modes, alternatives
rejected, and the candidate's personal contribution.

------------------------------------------------------------------------

## Interview philosophy and expected bar

At this level, do not spend substantial time testing familiarity with
frameworks or asking for textbook definitions. The candidate should
demonstrate:

1.  **Research depth:** Understand the state of the art, identify
    limitations in published approaches, design rigorous experiments,
    and distinguish evidence from hype.
2.  **Architectural synthesis:** Convert ambiguous business goals into a
    coherent target architecture and operating model across data,
    models, agents, platforms, security and people.
3.  **Systems thinking:** Reason about reliability, latency, throughput,
    cost, safety, privacy, observability, change management and failure
    containment as coupled concerns.
4.  **Technical authority:** Challenge assumptions, quantify trade-offs,
    define standards and explain when not to use GenAI.
5.  **Production accountability:** Show evidence of systems operated in
    production, including incidents, adoption, quality, cost and
    measurable business outcomes.
6.  **Executive influence:** Communicate a multi-year direction while
    making pragmatic delivery decisions.

### Suggested scoring scale

  -----------------------------------------------------------------------
  Score                               Interpretation
  ----------------------------------- -----------------------------------
  1                                   Surface-level; cannot explain
                                      mechanisms or provide evidence

  2                                   Working knowledge; relies on
                                      patterns without strong trade-off
                                      reasoning

  3                                   Competent architect; sound design
                                      and practical experience

  4                                   Advanced; anticipates failure
                                      modes, quantifies trade-offs and
                                      demonstrates ownership

  5                                   Exceptional; original insight,
                                      rigorous evidence, enterprise-wide
                                      judgment and research-to-production
                                      impact
  -----------------------------------------------------------------------

For every answer, record **claim**, **evidence**, **measurement**,
**candidate's ownership**, and **unresolved risk**.

------------------------------------------------------------------------

# Session 1 --- Research depth, model science and advanced GenAI

**Duration:** 60 minutes\
**Objective:** Establish whether the candidate has deep technical
understanding and can connect PhD-level research to practical enterprise
GenAI.

## 1. Research and PhD discussion --- 12 minutes

1.  State your PhD research problem in one precise sentence. What is the
    central hypothesis, and what would falsify it?
2.  What is the strongest prior work related to your research? Where
    does it fall short?
3.  What is genuinely novel in your contribution: the problem
    formulation, method, dataset, evaluation, theory, or application?
4.  Which baselines have you compared against, and why are they fair and
    sufficiently strong?
5.  Describe your experimental design. How do you control confounders,
    data leakage, benchmark contamination and cherry-picking?
6.  What evidence would convince a skeptical reviewer that your method
    generalizes beyond the dataset or benchmark on which it was
    developed?
7.  Which research result has changed your architectural opinion? Give a
    concrete example.
8.  What part of your research is transferable to production, and what
    part is currently impractical?

**Deep probes** - Explain the assumptions under which your method
works. - What is the ablation that most clearly demonstrates which
component creates value? - How do you report uncertainty, statistical
significance and reproducibility? - If your result cannot be reproduced
by another team, what would you investigate first?

**Strong evidence:** Clear hypothesis, rigorous baselines, reproducible
experiments, honest limitations, awareness of current literature, and a
credible path from research to deployment.

## 2. Model and inference architecture --- 13 minutes

1.  Explain the architectural implications of transformer attention,
    context length, KV caching and decoding strategy for production
    inference.
2.  How would you choose between dense, mixture-of-experts,
    encoder-decoder and smaller task-specific models for different
    enterprise workloads?
3.  Compare full fine-tuning, instruction tuning, PEFT/LoRA,
    distillation, continued pre-training and retrieval augmentation.
    What problem does each solve, and what does it not solve?
4.  How would you evaluate quantization trade-offs across quality,
    memory, throughput and hardware?
5.  How would you design model routing across frontier APIs, self-hosted
    open-weight models and specialist models?
6.  What are the operational implications of speculative decoding,
    continuous batching, prefix caching and tensor parallelism?
7.  How would you determine whether a quality problem is caused by the
    model, prompt, retrieval, tools, data or task decomposition?

**Deep probes** - Estimate the serving capacity needed for a stated
request rate and output-token profile. State assumptions. - Explain the
impact of long context on latency, memory and answer quality. - How
would you benchmark models fairly across providers with different
tokenization, rate limits and hidden infrastructure?

## 3. Advanced RAG and knowledge systems --- 13 minutes

1.  When does conventional RAG stop being the right abstraction? Compare
    RAG with long-context approaches, fine-tuning, knowledge graphs and
    database/query-based retrieval.
2.  Design a retrieval strategy for mixed content: tables, scanned PDFs,
    diagrams, code, audio transcripts and frequently changing records.
3.  How would you evaluate retrieval independently from answer
    generation?
4.  Explain how you would choose between dense, sparse, hybrid,
    graph-based and learned retrieval.
5.  What are the failure modes of chunking, embedding similarity and
    semantic search? How would you detect them?
6.  How do you preserve provenance, temporal validity, document
    versioning and access permissions throughout ingestion and
    retrieval?
7.  How would you handle contradictory sources, stale content and
    questions with insufficient evidence?
8.  How would you design retrieval for multi-hop questions that require
    joining facts across documents or systems?

**Deep probes** - Define a retrieval evaluation protocol including
recall@k, precision@k, MRR/nDCG and task-level success. - How do you
prevent permission leakage through cached results, rerankers, summaries
and generated answers? - When would a knowledge graph materially
outperform a vector index? What evidence would you require?

## 4. Agentic systems and reasoning workflows --- 12 minutes

1.  Define the boundary between deterministic workflow orchestration,
    tool-using agents and autonomous multi-agent systems.
2.  What evidence justifies adding an agent rather than implementing a
    deterministic service?
3.  How do you reason about planning, state, memory, tool selection,
    retries and termination?
4.  How would you design an agent that performs consequential actions in
    enterprise systems?
5.  How do you contain prompt injection from retrieved content, tool
    outputs and external websites?
6.  What are the failure modes of multi-agent collaboration, shared
    memory and delegated subtasks?
7.  How would you test an agent when multiple valid execution paths
    exist?
8.  How would you implement human approval, reversibility, idempotency
    and auditability?

**Deep probes** - Define measurable criteria for agent autonomy and
escalation. - How would you prove that a multi-agent design is better
than a single agent or workflow? - What is your strategy for sandboxing
tools and limiting blast radius?

## 5. Research-to-production synthesis --- 10 minutes

1.  Describe a research idea you chose not to productionize. Why?
2.  How do you turn a paper into a reproducible internal experiment and
    then a production decision?
3.  What is your framework for deciding whether a new model or agent
    technique is mature enough for enterprise use?
4.  What would you publish, patent, open-source or retain as proprietary
    capability, and how would you make that decision?

**Session 1 output:** A view of the candidate's research rigor,
technical depth, scientific skepticism and ability to separate promising
research from production-ready engineering.

------------------------------------------------------------------------

# Session 2 --- Enterprise architecture, platform strategy and operational excellence

**Duration:** 60 minutes\
**Objective:** Test whether the candidate can design and govern an
enterprise-wide GenAI capability rather than a single application.

## 1. Architecture strategy and operating model --- 10 minutes

1.  How would you define a 2--3 year enterprise GenAI architecture
    roadmap?
2.  Which capabilities should be centralized as a platform and which
    should remain owned by product/domain teams?
3.  How would you create a paved road for teams without forcing every
    use case into the same architecture?
4.  Define your reference architecture boundaries: AI gateway, model
    serving, orchestration, knowledge services, evaluation, identity,
    policy and observability.
5.  How would you govern model, prompt, agent, tool, dataset and
    knowledge-base versions?
6.  What architectural standards would you mandate, recommend or leave
    to team discretion?
7.  How would you avoid creating a centralized platform bottleneck?

**Deep probes** - What are the platform's internal product interfaces
and service-level objectives? - How would you measure platform adoption
and developer productivity? - What is your deprecation strategy when a
shared model or framework changes?

## 2. Whiteboard challenge: Enterprise GenAI platform --- 25 minutes

### Scenario

A global enterprise wants a secure GenAI platform supporting 30,000
employees across multiple business units and regions.

**Known requirements** - 100+ candidate use cases across knowledge
assistance, software engineering, customer operations and workflow
automation. - Data distributed across SharePoint, Confluence, databases,
data lakes and SaaS applications. - Different data residency, retention
and access-control requirements by region and business unit. - Multiple
model providers, including external APIs and self-hosted open-weight
models. - Peak demand of 3,000 concurrent interactive users, plus
asynchronous batch workloads. - Strict auditability, human approval for
consequential actions and measurable cost controls. - Existing cloud,
identity, data and security platforms must be reused where sensible. -
The business expects an initial production release in 90 days.

### Candidate assignment

Design the **enterprise target architecture and the first 90-day
delivery slice**. The candidate should lead discovery by identifying
missing requirements before drawing the design.

Ask the candidate to cover:

1.  Logical architecture and trust boundaries.
2.  Identity, authorization, data classification and regional isolation.
3.  Model access, routing, fallback, evaluation and provider
    abstraction.
4.  Knowledge ingestion, indexing, retrieval and source-of-truth
    strategy.
5.  Agent/workflow execution, tool registry, approvals and action
    controls.
6.  Runtime isolation, secrets, network egress and data-loss prevention.
7.  Observability, audit, evaluation, incident response and model
    lifecycle.
8.  Capacity, availability, disaster recovery and cost management.
9.  Build-versus-buy decisions and integration with existing enterprise
    platforms.
10. Migration, adoption, ownership and operating model.

### Challenge the design with injects

Introduce these one at a time, after the candidate has presented an
initial design:

-   **Provider outage:** The primary model provider is unavailable
    during a critical business period. What degrades, what fails over,
    and what quality guarantees remain?
-   **Regional restriction:** A business unit's data cannot leave its
    country. How do you enforce this end-to-end, including telemetry and
    support access?
-   **Permission revocation:** A user loses access to a source document.
    How quickly does that restriction take effect in indexes, caches,
    summaries and agent memory?
-   **Prompt injection:** A retrieved document instructs the agent to
    exfiltrate data or invoke a privileged tool. What controls prevent
    the action?
-   **Cost shock:** Usage triples and monthly spend exceeds budget by
    40%. What controls act automatically, and who owns exceptions?
-   **Quality regression:** A new model version improves benchmark
    scores but causes a material decline in one business workflow. How
    do you detect, isolate and roll back?

### What a strong design should demonstrate

  -----------------------------------------------------------------------
  Dimension                           Evidence to look for
  ----------------------------------- -----------------------------------
  Architecture                        Clear boundaries, contracts, trust
                                      zones and failure domains

  Security                            Identity-aware authorization at
                                      retrieval and action time

  Model strategy                      Routing, fallback, evaluation gates
                                      and portability without false
                                      abstraction

  Knowledge                           Provenance, freshness, deletion,
                                      permissions and hybrid retrieval

  Agents                              Least privilege, bounded autonomy,
                                      approvals and reversible actions

  Reliability                         SLOs, graceful degradation,
                                      retries, circuit breakers and DR

  Economics                           Unit economics, quotas, budgets,
                                      chargeback/showback and
                                      optimization

  Governance                          Versioning, lineage, audit, policy
                                      enforcement and accountable
                                      ownership

  Delivery                            Credible 90-day scope,
                                      dependencies, acceptance criteria
                                      and adoption plan
  -----------------------------------------------------------------------

**Do not reward diagram complexity.** Reward simplicity, explicit
assumptions, quantified trade-offs and clear ownership.

## 3. Reliability, security and operational engineering --- 15 minutes

1.  How would you define SLOs for an LLM-backed service when response
    quality is probabilistic?
2.  Which metrics belong at model, retrieval, agent, application and
    business-process levels?
3.  How do you distinguish availability from usefulness and correctness?
4.  Design a failure strategy for model API errors, rate limits,
    malformed outputs, tool timeouts and vector-store degradation.
5.  How would you test disaster recovery for a platform whose state
    spans databases, vector indexes, object stores, prompts and model
    configurations?
6.  How do you secure model-serving infrastructure and isolate workloads
    in a shared GPU environment?
7.  How would you manage secrets, tool permissions, network egress and
    sensitive data in prompts and traces?
8.  How do you prevent sensitive information from leaking through logs,
    feedback systems, evaluation datasets or observability vendors?

## 4. Economics and portfolio prioritization --- 10 minutes

1.  How do you calculate cost per successful task rather than cost per
    token?
2.  How would you build a FinOps model for shared GenAI infrastructure?
3.  Which use cases should be rejected even if technically feasible?
4.  How do you compare API inference, self-hosting and hybrid serving on
    total cost of ownership?
5.  How would you prioritize 100 proposed use cases across value,
    feasibility, risk, reuse and time-to-value?

**Session 2 output:** A defensible enterprise architecture, an operating
model, a credible initial delivery plan and evidence of sound
engineering judgment.

------------------------------------------------------------------------

# Session 3 --- Executive judgment, governance, research leadership and strategic influence

**Duration:** 60 minutes\
**Objective:** Determine whether the candidate can influence enterprise
direction, lead complex programs and make accountable decisions.

## 1. Executive communication and strategic choices --- 12 minutes

1.  The CIO asks, "What should our enterprise GenAI strategy be?" Give a
    concise answer suitable for a five-minute executive discussion.
2.  How do you translate AI strategy into measurable business outcomes
    and an investment roadmap?
3.  How would you explain to a board why an apparently successful GenAI
    demo is not yet production-ready?
4.  How do you handle an executive sponsor who has committed publicly to
    an agentic solution before feasibility has been established?
5.  How would you communicate uncertainty, risk and limitations without
    blocking innovation?
6.  Describe a time you changed a senior stakeholder's decision using
    technical and business evidence.

**Probe:** Ask for the exact metric, decision, stakeholder concern and
outcome---not just the narrative.

## 2. Governance, safety and regulatory readiness --- 13 minutes

1.  Design a risk-tiering framework for enterprise GenAI use cases.
2.  How would you operationalize responsible AI principles rather than
    leave them as policy statements?
3.  How would you map a use case to applicable regulatory and
    contractual obligations across jurisdictions?
4.  What controls are needed for privacy, data retention, copyright,
    explainability and auditability?
5.  How would you assess third-party models and vendors for security,
    resilience, data use and contractual risk?
6.  How would you govern synthetic data, generated content and
    AI-assisted decisions?
7.  How do you establish red-teaming, incident classification,
    escalation and post-incident learning?
8.  Where should human oversight be mandatory, and how do you avoid
    approval becoming a rubber stamp?

**Deep probes** - Who is accountable when an agent takes an unauthorized
action? - What evidence would you retain to reconstruct a disputed
AI-assisted decision? - How do you test whether a policy is actually
enforced at runtime?

## 3. Leadership and organizational design --- 10 minutes

1.  How would you organize an enterprise AI architecture function and
    its relationship with platform engineering, security, data, product
    and business teams?
2.  What roles and skills are needed to operate a mature GenAI platform?
3.  How do you build architecture capability in teams without making the
    architecture group a gatekeeping function?
4.  Describe a major disagreement with engineering, security or business
    leadership. How did you resolve it?
5.  How do you coach senior engineers to think in terms of systems,
    economics and business outcomes?
6.  How would you assess architecture quality across a portfolio of
    independently delivered AI products?

## 4. High-pressure decision scenarios --- 15 minutes

### Scenario A --- The accuracy promise

A business leader has promised 99.9% answer accuracy for an open-domain
enterprise assistant. The available evaluation set shows 91% task
success.

**Ask:** What do you do in the next 48 hours? What do you communicate,
measure, constrain and renegotiate?

### Scenario B --- The autonomous agent incident

An agent used a valid tool with excessive permissions and modified
thousands of business records.

**Ask:** What is your immediate response? How do you contain the
incident, preserve evidence, restore state, determine root cause and
redesign controls?

### Scenario C --- The research breakthrough

Your PhD research suggests a new retrieval or reasoning approach that
outperforms the existing solution in a controlled benchmark but
increases operational complexity.

**Ask:** What evidence and gates are required before adoption? How do
you design a fair pilot and decide whether to scale?

### Scenario D --- The build-versus-buy conflict

A vendor offers a fast, polished GenAI platform. Your engineering team
argues for building internally to retain control and reduce long-term
cost.

**Ask:** How do you structure the decision? What should be evaluated,
and how do you avoid ideological bias?

### Scenario E --- The 90-day mandate

You are appointed Enterprise GenAI Architect. Leadership expects visible
outcomes in 90 days, but the organization has fragmented data,
duplicated tools, no evaluation standards and unclear ownership.

**Ask:** Present your 30/60/90-day plan, including deliverables,
decision forums, dependencies, risks and measurable outcomes.

## 5. Candidate's questions and close --- 10 minutes

Reserve time for the candidate to ask questions. Assess whether they ask
about: - Business strategy and the problems the organization is trying
to solve. - Existing architecture, constraints and technical debt. -
Executive sponsorship, decision rights and accountability. - Data
maturity, security posture and platform ownership. - Success measures,
adoption and operational responsibilities. - Research collaboration,
publication or IP expectations where relevant.

A senior architect's questions can reveal how they frame problems and
whether they understand the organizational conditions required for
success.

**Session 3 output:** Evidence of executive maturity, governance
judgment, leadership, accountability and strategic influence.

------------------------------------------------------------------------

# Consolidated evaluation scorecard

Score each dimension from 1 to 5. Multiply the score by the weight and
divide by 5 to calculate weighted points.

  Competency                                         Weight   Score (1--5)   Weighted points
  ----------------------------------------------- --------- -------------- -----------------
  Research rigor and scientific reasoning                10                
  Model science and inference architecture               10                
  Advanced RAG, knowledge and retrieval                  10                
  Agentic systems and bounded autonomy                   10                
  Enterprise architecture and platform strategy          20                
  Security, governance and responsible AI                10                
  Reliability, operations and economics                  10                
  Executive communication and business judgment          10                
  Leadership and organizational influence                 5                
  **Total**                                         **100**                

### Decision guidance

  Weighted score   Recommendation
  ---------------- --------------------------------------------------
  90--100          Exceptional; enterprise-wide technical authority
  80--89           Strong; recommend for Enterprise GenAI Architect
  70--79           Credible; assess gaps against role scope
  60--69           Borderline for this level
  Below 60         Not recommended for this level

### Non-negotiable gates

Do not let a high aggregate score hide a critical weakness.

-   **Enterprise architecture:** Below 3/5 is a significant concern.
-   **Security and governance:** Below 3/5 is a significant concern for
    enterprise ownership.
-   **Production reliability and operations:** Below 3/5 indicates
    insufficient evidence of production accountability.
-   **Research rigor:** For a PhD candidate, inability to explain
    hypothesis, baselines, limitations and reproducibility is a material
    concern.
-   **Ownership:** If the candidate cannot distinguish their own
    contribution from the team's work, downgrade the relevant
    competency.

------------------------------------------------------------------------

# Evidence capture sheet

Use this section during the interview. Prefer concrete evidence over
impressions.

## Candidate and interview details

-   Candidate:
-   Current role:
-   PhD area / research title:
-   Institution:
-   Years of relevant experience:
-   Interviewer:
-   Date:

## Project deep-dive record

For each major project discussed, capture:

-   Business problem and users:
-   Candidate's precise role and decision authority:
-   Architecture and key components:
-   Scale: users, requests, data volume, regions:
-   Quality and reliability measures:
-   Latency and throughput:
-   Cost and unit economics:
-   Security and governance controls:
-   Production incidents and lessons:
-   Business outcome:
-   What the candidate would redesign:

## Research assessment record

-   Research question and hypothesis:
-   Novel contribution:
-   Strongest baseline:
-   Dataset and evaluation design:
-   Ablation and reproducibility:
-   Generalization evidence:
-   Limitations and threats to validity:
-   Production applicability:
-   Publication / implementation status:

## Final recommendation

-   Overall score:
-   Strongest evidence:
-   Most material gaps:
-   Risks if hired:
-   Role scope at which the candidate would succeed:
-   Recommended decision: Strong hire / Hire / Hold for further
    assessment / No hire
-   Follow-up validation required:

------------------------------------------------------------------------

# Interviewer notes: How to keep the bar high

1.  **Ask "why" and "what evidence?" repeatedly.** A list of tools is
    not an architecture.
2.  **Request diagrams and assumptions.** The candidate should make the
    system legible, not hide behind terminology.
3.  **Change the constraints mid-discussion.** Strong architects adapt
    without losing the core design principles.
4.  **Ask for numbers.** Require estimates for throughput, latency,
    cost, availability, data volume and quality. Reward explicit
    assumptions, not false precision.
5.  **Test failure thinking.** Ask what breaks, how it is detected, who
    responds and how recovery works.
6.  **Separate research excellence from architecture excellence.** A PhD
    is evidence of research training, not automatic evidence of
    production judgment.
7.  **Validate ownership.** Ask what the candidate personally decided,
    built, measured, operated and learned.
8.  **Do not reward unnecessary complexity.** The strongest design is
    the simplest one that satisfies the real constraints.
9.  **Look for intellectual honesty.** A senior candidate should be
    comfortable saying what they do not know and explaining how they
    would resolve it.
10. **Close on accountability.** Ask what outcome they would personally
    commit to and what conditions they would need to deliver it.

## The defining question

> "Imagine you are accountable for the enterprise's GenAI direction for
> the next three years. What capabilities would you build, what would
> you deliberately avoid building, what would you standardize, what
> would you leave to individual teams, and what evidence would tell you
> that the strategy is working?"

A genuine Enterprise GenAI Architect should be able to answer this with
a coherent strategy, explicit trade-offs, measurable outcomes and a
realistic execution model---not merely a technology stack.
