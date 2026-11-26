# Senior / Enterprise AI Architect interview — the brief the twin must pass

Assessed: (1) genuine understanding of AI, ML, GenAI, Agentic AI; (2) enterprise-grade architecture, not POCs;
(3) hands-on, not team-dependent; (4) decisions from business requirements, cost, performance, security, scale;
(5) leadership, stakeholder communication, delivery ownership. A real architect first asks about business
objectives, users, data, constraints, SLAs, security and budget before drawing components.

## Session 1 — Technical depth
### A. Experience and project ownership
- Walk me through the most complex AI solution you have architected. What was the business problem, architecture, technology stack and outcome?
- What were your personal contributions versus what your engineering team delivered?
- What was the biggest architectural decision you made, and what alternatives did you reject?
- Tell me about an AI implementation that failed or underperformed. What went wrong?
- If you had to rebuild your most successful AI solution today, what would you change?
- Probe: draw the architecture of your most complex project.
### B. Traditional AI and ML
- When would you choose traditional ML over an LLM-based solution?
- Explain the difference between classification, regression, clustering and anomaly detection, with enterprise use cases.
- How would you handle class imbalance in a production classification system?
- How do you identify and manage data drift and concept drift?
- How would you determine whether a model needs retraining?
- Explain the difference between precision, recall, F1, ROC-AUC and PR-AUC. When would you prioritize each?
- Advanced: a fraud model has 99% accuracy but misses 40% of fraudulent transactions. Successful? How would you improve it?
### C. LLM and GenAI
- Explain the architecture of a Transformer. What are attention and self-attention?
- What is the difference between pre-training, fine-tuning, instruction tuning and RAG?
- When would you use LoRA or QLoRA instead of full fine-tuning?
- How do temperature, top-p and token limits influence generation?
- What happens when an LLM hallucinates? How would you minimize it?
- How would you select between open-source and proprietary LLMs for an enterprise?
- How would you optimize inference latency and token consumption?
- Advanced: 10,000 requests/day, GPT inference costs $5,000/month; cut cost 60% without hurting quality.
  Look for: model routing, smaller models, quantization, prompt optimization, semantic caching, batching, distillation,
  selective RAG, evaluation-driven model substitution.
### D. RAG and Agentic AI
- Explain the complete RAG architecture, from document ingestion to response generation.
- How would you select chunk size and overlap?
- What is the difference between dense retrieval, sparse retrieval and hybrid search?
- When would you use reranking?
- How would you handle documents containing tables, images, diagrams and unstructured content?
- Explain the difference between an AI agent, an AI assistant and a traditional workflow automation.
- How do MCP, function calling and tool orchestration differ?
- How would you prevent an agent from entering an infinite execution loop?
- When would you choose a multi-agent architecture over a single-agent architecture?
- Advanced: 20,000 documents, multiple departments, different permissions, frequent updates — design RAG so users only
  retrieve what they are authorized to see. Look for: metadata filtering, identity-aware retrieval, document-level
  permissions, tenant isolation, incremental indexing, auditability, retrieval evaluation.
### E. Testing and evaluation of AI
- How do you evaluate the quality of a RAG system?
- What is the difference between retrieval quality and generation quality?
- How would you test an LLM application for hallucinations?
- How would you build an evaluation dataset?
- How do you test non-deterministic AI applications?
- What is your approach to prompt injection and adversarial testing?

## Session 2 — Enterprise architecture and engineering
### A. Enterprise architecture
- How do you translate a business requirement into an AI solution architecture?
- What are the architectural considerations when deploying an AI application for 10,000 concurrent users?
- How do you design an AI application for high availability and fault tolerance?
- How would you handle multi-tenancy in an enterprise GenAI platform?
- How do you approach authentication, authorization and data security in AI applications?
- How would you design an AI solution that must work across AWS, Azure and GCP?
- What architectural components would you standardize across multiple enterprise AI applications?
- How do you decide whether to use microservices, modular monoliths or serverless architecture?
### B. Whiteboard: Enterprise AI Knowledge Assistant
50,000 documents (SharePoint, Confluence, internal DBs); 5,000 employees; department permissions; PDF, DOCX, PPTX, XLSX,
images; 1,000 concurrent users at peak; multiple LLM providers; strict privacy and audit. Design it production-ready
with RAG and agents where appropriate: architecture, technology choices, deployment, security, evaluation, monitoring.
Expected layers: ingestion (connectors, ETL, OCR, parsing); processing (chunking, metadata, enrichment); storage (object
store, relational DB, vector DB); retrieval (hybrid, reranking, filtering); intelligence (LLM, orchestration, agents);
security (RBAC, ABAC, encryption, tenant isolation); infrastructure (containers, Kubernetes, autoscaling);
observability (logs, traces, metrics, evaluation); governance (audit, lineage, model versioning).
Follow-ups: vector DB goes down? a user loses access to a document? deleted documents disappear from retrieval?
support 1,000 concurrent users? switch LLM provider without changing application logic? keep sensitive information
out of external LLM APIs? measure retrieval quality in production?
### C. AI engineering and deployment
- How do you structure a production-grade Python AI application?
- What is your preferred backend architecture using FastAPI?
- How do you manage asynchronous processing and background jobs?
- How do you implement CI/CD for an AI application?
- How do you manage model versions, prompts and datasets?
- How would you deploy an open-source LLM on Kubernetes?
- How do you manage GPU utilization and inference throughput?
- How do you monitor token consumption, latency and cost?
- How do you design rollback mechanisms for a model or prompt update?
- How do you separate application testing from model evaluation?
### D. Problem-solving: response time 12s→4s; hallucination 18%→<5%; monthly cost ₹8 lakh→₹5 lakh; retrieval
accuracy 72%→90%; concurrent users 200→2,000. Investigation process, priorities, architectural improvements.
A strong candidate does not immediately change the LLM; investigates each layer independently.

## Session 3 — Leadership, consulting and strategy
### A. Architecture leadership
- How do you establish an enterprise AI architecture strategy?
- How do you identify opportunities where AI can deliver measurable business value?
- How do you decide whether an organization should build an AI solution internally or purchase an existing product?
- How do you handle conflicting architectural opinions between engineering teams?
- How do you establish reusable AI frameworks and accelerators?
- How do you ensure architectural consistency across multiple AI projects?
- How do you balance innovation with enterprise governance?
### B. Project and delivery
- You have an AI project with a six-week deadline and unclear requirements. How would you proceed?
- How do you estimate the effort and cost of an AI implementation?
- How do you handle a client who expects 100% accuracy from an LLM?
- What would you do if your team proposed an architecture that you believe is technically incorrect?
- How do you manage technical debt in AI projects?
- How do you measure the success of an AI implementation beyond model accuracy?
### C. Team leadership
- How would you build an AI team from scratch?
- What roles would you hire for an enterprise GenAI implementation?
- How do you mentor junior AI engineers?
- How do you assess whether an engineer is ready to become an AI architect?
- How do you handle a technically strong engineer who cannot communicate effectively with business stakeholders?
### D. Scenarios
1. The client wants to convert all existing workflows into autonomous AI agents. Would you agree? How do you decide which workflows need agents?
2. Leadership wants to drop OpenAI, Anthropic and Google for an entirely self-hosted AI ecosystem. Approach, hidden costs and risks?
3. 25 AI applications built independently, no central governance, monitoring or model registry. Establish enterprise AI governance.
4. The business wants an AI solution in 30 days; data quality and security architecture are insufficient. How do you handle it?
5. Your first 30, 60 and 90 days as an AI Enterprise Architect in our organization.

## Five questions never to skip
1. Draw the most complex AI solution you have personally architected; explain every component and why.
2. An example where you rejected a technically attractive solution because it was not right for the business.
3. An AI application you moved from POC to production; the biggest challenges.
4. Design an enterprise RAG system with 5,000 concurrent users, strict access control and multiple LLM providers.
5. With complete freedom to set our enterprise AI architecture: what would you standardize, what decentralize, and why?

## Scorecard (1–5 each, weighted): AI/ML fundamentals 10%, GenAI/LLM 15%, RAG & Agentic 15%, Enterprise architecture
20%, Cloud/DevOps/engineering 10%, AI testing & governance 10%, Leadership & communication 10%, Business & strategy 10%.
Enterprise architecture < 3 or AI/LLM < 3 disqualifies. Architect vs senior developer: defines the right solution,
evaluates/selects models, designs retrieval strategy, decides where agents are justified, designs infrastructure,
defines security architecture, optimizes total solution economics, establishes standards, translates business
strategy into architecture, owns technical direction.
