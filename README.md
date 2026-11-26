<h2 align="center">Prashobh Paul</h2>

<h1 align="center">Eidolon</h1>

<p align="center"><em>The living knowledge twin of Prashobh Paul</em></p>

<p align="center">
Eidolon (Greek: the living image of a person) is the site this repository publishes. Ask it anything about Prashobh and his 3D twin answers in his voice, in the first person, with every sentence quoted from his resume, website, YouTube channel or GitHub and linked to its source, beside a live knowledge graph, source lineage and knowledge health. It runs on two of his projects, described below: the <strong>Knowledge Factory</strong>, which gathers the sources, and the <strong>Knowledge Fabric</strong>, which links, retrieves and cites them.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Sources-Resume%20%C2%B7%20Website%20%C2%B7%20YouTube%20%C2%B7%20GitHub-blue" />
  <img src="https://img.shields.io/badge/Knowledge%20Graph-Typed%20%C2%B7%20Cross--source-purple" />
  <img src="https://img.shields.io/badge/Retrieval-Hybrid%20BM25%20%2B%20LSA-green" />
  <img src="https://img.shields.io/badge/Explainable-Every%20sentence%20cited-orange" />
  <img src="https://img.shields.io/badge/Backend-None%20%28GitHub%20Pages%29-lightgrey" />
</p>

---

> **Live:** the site is published by GitHub Pages from this repository.
> Ask it *"Where does Prashobh work currently?"*, *"What is Koode?"*, or
> *"What videos has he made about Spiti Valley?"* — every sentence in the reply is
> quoted from a source and linked to it.

---

# Two halves, one loop

Most "personal knowledge base" demos stop at indexing a folder. This one has a
supply chain. Two components, deliberately separated, meet at one folder:

```
      ┌──────────────────────── KNOWLEDGE FACTORY ────────────────────────┐
      │  knowledge_factory/   acquisition — goes and GETS the knowledge    │
      │                                                                    │
      │   website.py   crawls prashobhpaul.com → sections, project cards,  │
      │                the site assistant's hand-written Q&A, the resume   │
      │   youtube.py   channel RSS (no API key) → every upload, merged,    │
      │                never forgets a video                               │
      │   github.py    repositories + README excerpts                      │
      │   sync.py      orchestrator; one failing source never blocks       │
      │                the others; writes manifest.json                    │
      └─────────────────────────────┬──────────────────────────────────────┘
                                    │  commits to
                                    ▼
                 knowledge_sources/           docs_source/
                   profile/profile.yaml        resume/*.pdf   ← downloaded by the Factory
                   website/{pages,projects,faq}.json
                   youtube/{channel,videos}.json
                   github/repos.json
                   manifest.json              ← what was synced, when, how many records
                                    │  read by
                                    ▼
      ┌──────────────────────── KNOWLEDGE FABRIC ─────────────────────────┐
      │  pipeline/   indexing — turns the knowledge into one answerable    │
      │              network                                               │
      │                                                                    │
      │   connectors/  5 connectors → one KnowledgeRecord shape            │
      │   ontology.py  "InvestIQ" = "Invest.IQ", "TCS" = "Tata Consultancy │
      │                Services", "Kee Monastery" = "Key Monastery"        │
      │   graph.py     typed graph: WORKED_AT · BUILT · USES · FILMED_AT … │
      │                nodes seen in ≥2 sources are flagged cross_source   │
      │   bm25 + LSA   hybrid retrieval, fused by reciprocal rank          │
      │   build_index  → site/data/index.json + semantic.json              │
      └─────────────────────────────┬──────────────────────────────────────┘
                                    ▼
                          site/   static · client-side · $0
```

**The loop closes with feedback.** Every answer leaves a *trace* (question, intent,
confidence, sources) in the visitor's browser, shown in the Traces panel. A weak
answer offers *Flag this answer*, which opens a pre-filled GitHub Issue labelled
`knowledge-flag` — no backend, no token. The **Curator** (`knowledge_factory/curator.py`,
run by `curator.yml` weekly and on every new flag) re-asks each flagged question
against the freshly synced sources, closes the flags the sync fixed, keeps them as
regression checks, and opens one PR with a `profile.yaml` stub per remaining gap for
a human to complete. The curator proposes; it never invents a fact.

```
   visitor asks  ──▶  trace (browser)  ──▶  weak? ──▶  Flag ──▶  GitHub Issue (knowledge-flag)
                                                                        │
   next build answers it  ◀──  human completes stub  ◀──  curator PR  ◀─┘  (re-checked against fresh sources;
   and the integration test keeps it answered                               fixed ones auto-closed)
```

**The sync is automated.** `factory.yml` runs every Monday (or on demand),
re-syncs the sources and commits what changed. That commit triggers
`deploy.yml`, which rebuilds the fabric, runs the quality gates and republishes
the site. New video on the channel, new repository on GitHub, updated resume on
the website — the fabric learns it within a week with nobody running anything.

---

# What is running today

| Capability | Implementation |
|---|---|
| Multi-source acquisition | `knowledge_factory/` — website crawler, YouTube RSS, GitHub API, LinkedIn data export, resume download |
| Multi-source ingestion | `pipeline/connectors/` — resume PDF, structured profile, website, LinkedIn, YouTube, GitHub → one record shape |
| Entity resolution | `pipeline/ontology.py` — surface forms collapse to canonical nodes across sources |
| Typed knowledge graph | `pipeline/graph.py` — 23 node types, 25 edge types, cross-source flag |
| Lexical retrieval | BM25, client-side, with morphological + synonym expansion |
| Semantic retrieval | LSA over TF-IDF, int8-quantised, embedded in-browser (no model download) |
| Hybrid retrieval | Reciprocal Rank Fusion (k = 60) |
| Question understanding | 18 intents (career, skills, projects, education, services, contact, posts, events, YouTube, …) with evidence routing |
| Extractive answers | MMR sentence selection, focus gate, relevance floor — verbatim, cited, never paraphrased |
| Derived confidence | Weighted geometric mean of 5 measured retrieval signals |
| Yes/no questions | A verdict first (**Yes / Partly / No**) decided by whether one evidence sentence carries the predicate; a "No" still hands over the nearest material |
| Scope | "currently / now / today" restricts a career answer to the current role, read in full (role line + responsibilities) — never the whole history |
| Whole-record reading | Once a record's opening line answers, its continuation sentences are read too (the duties behind a role, what a project does), with a strong second source always allowed in |
| Cross-source joins | Every answer ends with openable cards: project page ↔ GitHub repository ↔ engagement; a question about a topic reaches the website project *and* its code |
| Languages & voice | English by default; Malayalam, Telugu and Hindi questions are tokenised in their own script, carried onto English records by a small lexicon (`site/js/multilingual.js`), and answered from same-language evidence when a video or transcript has it. Mic input and spoken answers use the browser's speech APIs (`site/js/voice.js`), no backend |
| Video depth | Chapters parsed from descriptions and transcript windows (60 s) are records of their own, cited with `&t=…s` links so an answer can point into a video at the right second |
| Knowledge health | Coverage, connectivity, provenance, extraction quality, freshness — each with its formula |
| Factory ↔ Fabric visibility | Source strip on the site: which systems fed it, how many records, when last synced |
| Evaluation gate | `eval/gold_set.yaml` — recall / MRR / nDCG per retrieval mode; CI fails on regression |
| Feedback loop | Traces in-browser · flags as GitHub Issues · curator re-checks, auto-closes, proposes `profile.yaml` stubs · resolved flags become regression tests |
| Deployment | GitHub Pages. No backend, no vector DB, no API keys, no cost |

---

# The fabric moment

The typed graph infers edges **across** source systems. No single source contains
this chain:

```
works.html                      (website)   "Koode lets family and friends know you're okay…"
      │  DOCUMENTED_IN
      ▼
    Koode                       ← Project node, observed on the WEBSITE and on GITHUB
      │  USES                               │  HOSTED_ON
      ▼                                     ▼
  Kotlin · Jetpack Compose · Supabase     GitHub (PrashobhPaul/Koode, last pushed Oct 2026)
      ▲  SKILLED_IN
      │
  Prashobh Paul  ── WORKED_AT ──▶ Qualizeal ── (ROLE_AT) ── AI Architect, AI-CoE   (resume + profile + website)
      │  OWNS
      ▼
  The Canvas of Earth ── PUBLISHED ──▶ "We Met Satya Nadella! Microsoft AI Tour Mumbai"
                                            │  COVERS            │  FEATURES
                                            ▼                    ▼
                                 Microsoft AI Tour Mumbai 2025   Microsoft   ← also in the website FAQ
```

A Project seen on the website *and* on GitHub is one node with two sources. The
website says what it is for; the repository says how it is built and when it last
moved. Ask *"What is Koode?"* and the answer draws on both — and the graph panel
says so, in plain language, with the two documents that share almost no wording.

Current build: **73 cross-source entities** out of 348 nodes.

---

# Measured, not asserted

Every build runs the retrieval gold set (`eval/gold_set.yaml`) in all three
modes and fails the deploy below the floor. Current numbers (`python -m eval.evaluate`):

```
corpus: 811 chunks · 361 documents · 12 sources
gold set: 18 cases (lexical · semantic · structured · cross-source · robustness)

mode          recall@5  recall@10      MRR   nDCG@10
----------------------------------------------------
lexical          1.000      1.000    0.963     0.951
semantic         0.944      0.944    0.824     0.876
hybrid           1.000      1.000    0.963     0.945
```

The browser integration test (`tests/integration.test.mjs`) runs the real
`site/js` modules against the real `site/data` on every push: every question in
the question bank must produce a cited answer, travel videos must never answer a
career question, a question about one employer must not be answered from another,
and the fabric must have cross-source joins.

The same test runs **3,734 questions about Prashobh** through the exact answer path
visitors use (`site/js/pipeline.js`): the golden set (`tests/qa_gold.json`, 221 +
9 to decline), seven harder rounds written afterwards (`tests/qa_round2…8.json`),
the language set (`tests/qa_lang.json`), the interview sets (`tests/qa_interview_s1/s2/s3.json`,
every rubric point checked, plus the held-out `qa_interview_heldout.json`) and the
coverage set (`tests/qa_coverage.json`: 2,874 questions, every wording of all 163
curated answers, every video and every public repo; regenerate it with
`python3 tests/gen_coverage.py`). The rounds cover paraphrases, typos and texting
shorthand, Malayalam / Telugu / Tamil / Hindi, several questions in one, side-by-side
comparisons, before/after career questions answered from the role dates, follow-ups
that say "it" or "there", greetings and introductions, private details, errands and
off-topic questions, which must be declined honestly. Rounds 6 and 7 were first run
untuned, as held-out checks (81% and 78%), and fixed from there; every set passes in
full now. `node tests/qa_eval.mjs tests/qa_round5.json` prints any miss with its top candidates.

**One report proves it all.** `node tests/prove.mjs` (CI runs it on every pull request,
and the deploy runs it as a gate before the Pages upload) writes
[`tests/reports/PROOF.md`](tests/reports/PROOF.md). Latest run: accuracy 3,770/3,770
questions across 15 `tests/qa_*.json` sets (with `qa_research.json`), the interview
brief asked in full (82/82), determinism 264/264 over three runs, context independence
792/792, paraphrase consistency 163/163 curated answers over 3,153 phrasings, grounding
with 0 unresolved links and 0 client-name leaks, and p95 latency 42.7 ms against a
250 ms limit. Any failure fails the check; `--build` also rebuilds and times the index.

The full testing record, what was proven, the defects found and fixed, and what to
prove next, is in [`docs/testing/README.md`](docs/testing/README.md).

---

# Using it from the GitHub website (no command line)

### The canon — your own answers, each with proof
`knowledge_sources/profile/canon.yaml` holds the major questions answered the way you answer them. The build resolves every evidence link (a website page, resume record, repo, video or post) to the records that prove it and refuses silently unproven claims (they are reported as unresolved). A matching question gets your answer verbatim, the proofs as citations, and the fabric's own retrieval beneath as corroboration; the twin speaks it in full. Edit the file on GitHub to add or refine answers.

### The twin — your 3D, speaking self in the hero
The avatar (left) answers beside the knowledge graph (right), lips synced to the audio, in your own voice once the one-time **Voice bake** workflow has run (no runtime API). It only rewrites cited sentences to the first person; it never generates facts. Cited videos play inline at the cited second. Setup: `twin/README.md`.

### Publish the site

1. Open the repository on github.com → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Open the **Actions** tab → **Build and Deploy to GitHub Pages** → **Run workflow**.
4. The site URL appears on the workflow run page when it finishes (about two minutes).

### Refresh the knowledge (run the Factory)

1. **Actions** tab → **Knowledge Factory — sync sources** → **Run workflow**.
2. Optionally type a subset in the box, e.g. `youtube` or `website,github`.
3. The Factory commits whatever changed; the deploy workflow then rebuilds the site automatically.

It also runs by itself every Monday.

### Change the facts about you

- **Structured facts** (roles, education, skills, services, current engagements):
  edit `knowledge_sources/profile/profile.yaml` in the GitHub editor (pencil icon)
  and commit. The site rebuilds.
- **Resume**: upload the new PDF to the website (the Factory downloads it) or
  drop it into `docs_source/resume/` directly.
- **New aliases** (a new project name, a new place in your videos): add a line to
  `pipeline/ontology.py` so the graph joins it across sources.
- **Point the whole thing at another person**: edit `knowledge_factory/config.yaml`,
  `knowledge_sources/profile/profile.yaml`, `pipeline/ontology.py` and
  `site/js/brand.js`. Nothing else references the subject.

### Add new knowledge (GitHub website, no command line)

1. **Write it down where the fabric reads it.** For something new in your life or work, add a
   note in `docs_source/notes/` (**Add file → Create new file**, e.g. `docs_source/notes/My_New_Topic.md`),
   in your own words. For a question you want answered your way, add an entry to a
   `knowledge_sources/profile/canon_*.yaml` file (same fields as `canon.yaml`) whose evidence points
   at that note: `url: doc:My_New_Topic`.
2. **Propose it as a pull request.** Choose **Create a new branch … and start a pull request**
   when you commit. CI rebuilds the fabric and runs the proof (`node tests/prove.mjs`): every
   question set, determinism, context, paraphrases, grounding (an evidence link that resolves to
   nothing fails it) and latency. The report is attached to the run as `proof-report`.
3. **Merge when the check is green.** The merge to `main` triggers the deploy; the site answers
   the new question within minutes.

The proof blocks anything that lowers accuracy: if a new note or answer pulls an existing
question onto the wrong answer, the check fails and names the question. Add your new questions
to a `tests/qa_*.json` set so they are proven on every change after. `tests/reports/GROWTH.md`
shows this done end to end for the PhD at Anurag University.

### Add your LinkedIn profile, posts and events

LinkedIn cannot be crawled (login-walled, and against its terms), so the Factory
reads the **official data export**:

1. On LinkedIn: **Settings & Privacy → Data privacy → Get a copy of your data →
   Download larger data archive**. LinkedIn emails a ZIP within ~24 hours.
2. Unzip it. On GitHub, open `knowledge_sources/linkedin/export/` → **Add file →
   Upload files** → drop `Shares.csv` (posts), `Events.csv`, `Certifications.csv`,
   `Honors.csv`, `Publications.csv`, `Projects.csv`, `Recommendations_Received.csv`,
   `Skills.csv`. Commit.
3. The next Factory run (or **Actions → Knowledge Factory → Run workflow** with
   `linkedin`) turns them into posts, events, certifications, honors, publications
   and recommendations. Each becomes a typed node (`POSTED`, `ATTENDED`, `HOLDS`,
   `DISCUSSES`) and a citable record linking back to LinkedIn.

For a single post without an export, paste it into
`knowledge_sources/linkedin/posts.md` (date · URL heading, then the text). Major
events you attended or spoke at can also go straight into `profile.yaml` → `events`.

### Close a knowledge gap (the feedback loop)

1. On the site, a weak answer shows **Flag as missing / wrong / outdated**. Click it; a
   GitHub Issue opens pre-filled with the question and trace. Submit it.
2. The **Knowledge Curator** workflow runs (on the new issue, and every Monday). If the
   current sources already answer the question, it closes the issue with a comment.
3. Otherwise it opens a PR titled `curator: N proposed knowledge update(s)` containing
   `knowledge_sources/flags/proposals.md` with one stub per gap. Complete the fact in
   `profile.yaml` (GitHub editor, pencil icon) and merge.
4. The next deploy answers it, and the integration test keeps it answered forever.

Open gaps are visible on the site under **Explainability → Flags · curator gap board**
and as a risk card in **Knowledge Health**.

### Review before publishing

`knowledge_sources/profile/profile.yaml` → `engagements` names client programmes
(self-reported). Delete any line you do not want on a public site before merging.

---

# Local development (optional)

```bash
pip install -r pipeline/requirements.txt

python -m knowledge_factory.sync          # Factory: pull live sources
python -m pipeline.build_index            # Fabric: build index + graph + semantic layer
python -m eval.evaluate                   # measure retrieval quality
node tests/integration.test.mjs           # browser contract + answer quality
pytest tests/ -v                          # pipeline + factory unit tests

./scripts/dev.sh                          # build + serve on http://localhost:8000
./scripts/dev.sh --sync                   # sync first, then build + serve
```

---

# Repository structure

```
knowledge_factory/            THE FACTORY — acquisition + curation
  config.yaml                   who/what to sync (person, website, channel, GitHub user)
  sync.py                       orchestrator; per-source failure isolation; manifest
  curator.py                    flags → re-check → auto-close / proposals (the feedback loop)
  sources/website.py            crawl + project cards + assistant FAQ + resume download
  sources/youtube.py            RSS (keyless) with merge-never-forget; optional yt-dlp
  sources/github.py             repositories + README excerpts
  sources/linkedin.py           official data export + posts.md → posts, events, credentials
knowledge_sources/            Factory output, committed (deterministic Fabric input)
  profile/profile.yaml          hand-curated structured facts
  website/  youtube/  github/   synced JSON
  manifest.json                 sync status per source
  flags/flags.json              curator ledger: open gaps, resolved + regression set
  flags/proposals.md            stubs for a human to complete
docs_source/resume/           resume PDFs (current + archived revision)
pipeline/                     THE FABRIC — indexing
  connectors/                   base · documents · profile · website · youtube · github · linkedin
  ontology.py                   canonical names + detection
  graph.py                      typed cross-source knowledge graph
  parsers.py · chunker.py       heading-aware parsing (incl. line-structured resume PDFs)
  textnorm.py                   PDF artefact repair + sentence quality classification
  bm25_index.py · semantic.py   lexical + LSA semantic indexes
  docmeta.py                    date resolution with provenance (source timestamp → PDF → crawl)
  build_index.py                orchestrator → site/data/
eval/                         gold set + Recall/MRR/nDCG harness with CI gate
site/                         static site (GitHub Pages)
  js/nlu.js                     16 intents, focus extraction, evidence routing
  js/answer.js · summarize.js   MMR extractive summarisation, focus gate, relevance floor,
                                whole-record reading, yes/no verdicts
  js/related.js                 cross-source "explore" cards (project ↔ repo ↔ video@timestamp)
  js/multilingual.js · voice.js English default; Malayalam / Telugu / Hindi lexicon, mic in, spoken answers
  js/compose.js                 reply framing + discourse markers + cleanup
  js/confidence.js              5-signal derived confidence
  js/graph.js · graphvalue.js   knowledge galaxy + "what the graph contributed"
  js/health.js · rings.js       knowledge health with formulas
  js/brand.js                   every reader-facing string, in one object
  js/traces.js                  trace ledger, flag links, curator gap board
tests/                        pytest suite + browser integration test
.github/workflows/
  factory.yml                   scheduled source sync → commit
  curator.yml                   flags → ledger commit + proposals PR
  deploy.yml                    build + gates + Pages deploy (triggered by that commit)
  ci.yml                        tests + build + integration + evaluation on PRs
```

---

# Design decisions worth explaining

**Why a Factory at all.** The Fabric is deterministic: same files in, same index
out. That is what makes the quality gates meaningful and the site reproducible.
Something still has to fetch the files — and fetching is where things fail
(a site down, a feed empty, an API rate-limited). Isolating acquisition means a
failed source leaves last week's data in place and records the failure in the
manifest, instead of shipping a half-empty fabric.

**Why the Factory commits its output.** Because the build must not depend on the
network. Every Pages deploy, every CI run and every local checkout sees exactly
the knowledge that was reviewed in a commit. The manifest makes staleness visible
on the site itself.

**Why verbalise structured records.** A YAML block `{organization: Qualizeal,
start: 2026-01}` is invisible to retrieval. The sentence "Prashobh Paul has
worked at Qualizeal as AI Architect since January 2026" is retrievable by the
same BM25 and LSA that serve the resume PDF, and still carries its typed facets
for filtering and graph construction.

**Why LSA and not a transformer.** A sentence-transformer means a model download
at build time and a 20 MB+ payload in the browser, which breaks the zero-cost
static constraint. Truncated SVD over TF-IDF ships as 0.4 MB of int8 vectors and
closes the vocabulary gap this corpus actually has ("hospital records" vs "EMR /
HL7 clinical data"). The eval harness exists so a transformer can be compared
against it honestly later.

**Why the focus gate and relevance floor.** A personal corpus is small, so weak
sentences that share a word with the question are always available to pad an
answer. A two-sentence answer that is right beats a five-sentence answer that
drifts; and a question that names Tech Mahindra must never be answered from the
Yash Technologies record, however well the words match.

**Why the site assistant's Q&A is harvested.** The personal site ships a
deterministic chatbot whose answers were hand-written by the subject. That is
first-party curated knowledge — the highest-quality text on the site — sitting
inside a `<script>` tag where no search engine reads it. The Factory lifts it
out, drops guardrail and small-talk entries, and tags the rest as *about* the
person or an *explainer* in their own words.

---

# Roadmap

- **Transcripts.** YouTube captions as a sixth record type, so the fabric can answer *what was said* in a video, not only what it is about.
- **LinkedIn posts and articles** as a connector (export-based, since there is no public API).
- **Transformer re-ranker** evaluated against the LSA baseline using the existing harness.
- **Temporal reasoning** over the career timeline ("what was he doing in 2019?") using the typed `start`/`end` facets.

---

# License

MIT
