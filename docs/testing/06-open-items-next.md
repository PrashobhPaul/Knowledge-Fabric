# 06 · Open items: what is not yet proven, and what to prove next

Dated 2026-11-26. Everything in 01–05 is proven in Node, against the built index, with embeddings off.
The items below are outside that boundary or not yet done.

## Not yet proven

| Item | Where it stands | What would prove it |
|---|---|---|
| Video transcripts | **10 of 50** videos have a transcript (`knowledge_sources/youtube/transcripts/`, all from vidIQ: 8 English, 1 Hindi, 1 Malayalam; 50 in `videos.json`). The session that fetched them reported 27 waiting for vidIQ credits on 2026-12-04, 7 music-only and 6 with no captions. That split is not yet recorded in the repo | Fetch the 27. Store a `<id>.none` with its reason for the 13 that have no words, so the Factory stops retrying. Add questions that quote each new transcript at its second (as `qa_round8.json` does) |
| Real devices | No automated test covers the GPU silk shader (~30 fps target), avatar frame rate, which voice is picked per language (male first, female only as fallback), lip-sync drift, or phone layout (measured once at iPhone 13 width, `78cd987`) | A dated checklist on a mid-range Android phone, an iPhone and a desktop, for each of the 5 languages: fps, voice chosen, lip sync, layout |
| Live site, end to end | No test opens the deployed page in a browser. The CDNs were blocked in the sandbox, so three.js with the import map, the avatar, the graph library and transformers.js were never run together | A browser smoke test against the Pages URL after deploy: the avatar loads (not the portrait), the cache-bust stamp is present, and a few questions give the proof's answer ids |
| Embedding path | The proof runs with `qvec: null`. The integration check uses synthetic 3-d vectors, and pytest only tests the fallback with no model. The real all-MiniLM-L6-v2 vectors (`deploy.yml`) were never run here because Hugging Face was blocked. On the live site the embeddings can rescue a question the word matcher found nothing for (`29f2449`), so live answers can differ from the proof | Run the proof with real vectors and question embeddings and diff the fingerprints against the embeddings-off run. Every proven decline must stay a decline or be justified |
| Deploy gate | `prove.mjs` runs in `ci.yml` only. `deploy.yml` gates on integration and the retrieval eval, so `qa_research.json`, determinism, context, paraphrase, grounding and latency are not checked before a deploy | Add `node tests/prove.mjs` to `deploy.yml`, or require the CI check on `main` (branch protection cannot be checked from the repo) |
| Avatar import map | Fixed in `c88b14f`, with no guard (05) | An integration check that the page's import map resolves `'three'` |
| Coverage set is stale | `qa_coverage.json` was generated when only `canon.yaml` (62 answers) existed. Regenerated from all 163 answers at `d9000b7`, it gives 2,874 questions: 2,870 pass, and the 4 wordings of one `iv1-transformer` question are declined (05) | Fix the pronoun case, then run `python tests/gen_coverage.py` after a build and commit the new set, so all 163 answers are covered on every change |
| Answer quality | `must_all` checks that words are present, not that the reasoning is sound. The panel (`d9000b7`) graded the 92 brief prompts at 4.35 weighted, with no disqualifier | The panel's "what a tougher panel would still probe" list in [interview-panel-review.md](interview-panel-review.md); the evidence items need the owner (below) |
| README numbers | "Measured, not asserted" still shows 239 chunks · 97 records · 5 sources and 532 questions. The eval now reports 811 chunks · 361 documents · 12 sources, and the proof covers 1,756 questions | Update that section, or point it at `PROOF.md` |

## Owner TODOs (only Prashobh can supply these)

| TODO | Where |
|---|---|
| Supervisor profile: Dr. Amarajothi's designation, department and profile link | `docs_source/notes/PhD_Anurag_University.md` → "About my supervisor" |
| A one-line summary, from its abstract, of the 2025 *Knowledge and Information Systems* paper | same note (the abstract could not be reached) |
| Review the translations of the 12 most-asked answers in ml/te/ta/hi. `qa_lang.json` checks only one fact per answer | `knowledge_sources/profile/canon_i18n.yaml` ("Prashobh: correct any wording here") |
| LinkedIn post links: the 2026-11-24 post has no URL; the 2026-11-01 post still needs its text pasted | `knowledge_sources/linkedin/posts.md` |
| Interview evidence the panel asked for: 2–3 cleared, anonymised enterprise-scale figures (users, latency, cost, accuracy) from Tech Mahindra or Qualizeal; one client-work story told end to end; team sizes and one people story | `canon_interview_s*.yaml`, via a note under `docs_source/notes/` |
| Koode website text: the website says thirty minutes, while the README and the twin say an hour. Fix the website so the sources agree (the Factory re-crawls it weekly) | prashobhpaul.com, Koode page |

## Next: the team's harder, principal-level interview

The brief is already in the repo: `tests/interview_brief_l2.md` (`dfaa6b6`), "Enterprise GenAI Architect:
Advanced Interview Playbook". It has three 60-minute sessions:
- **Session 1:** research depth, model science and advanced GenAI. 35 numbered questions in 5 blocks, opening with the PhD.
- **Session 2:** enterprise architecture, platform strategy and operations. 20 numbered questions plus a 25-minute whiteboard with injects.
- **Session 3:** executive judgment, governance and research leadership. 20 numbered questions plus scenarios A–E.

The scorecard has 9 competencies, and 80–89 means "Strong; recommend". The non-negotiable gates are
enterprise architecture, security and governance, and production reliability (each below 3/5 is a concern),
plus research rigor and ownership. The listed weights add up to 95, not the stated 100; confirm with the team.

Preparation plan, reusing what worked for the senior brief (03):
1. **Answers grounded only in his record.** Record claim, evidence, measurement, ownership and unresolved risk for each, as the playbook's capture sheet asks. Also curate the likely second-level drill-downs (panel item 5).
2. **The research block needs the owner.** The PhD note states the research question and an evaluation plan: the golden sets as benchmark, the proof as baseline, and injected faults. It has no falsifiable hypothesis, competing baselines, ablations or results yet ("directions …, not finished results"), and the L2 research block asks for exactly these. Until the owner supplies them, the twin must say so (as `research-dates` does) and not invent them.
3. **Test sets** `qa_interview_l2_*.json` with `must_all` rubric points, plus a held-out set written by someone other than the answer authors. Run it untuned first and record the score.
4. **Extend the brief check in `prove.mjs`.** It reads single-line `- …?` / `N. …?` items from `interview_brief.md` only. The L2 playbook wraps its questions over several lines (just 14 lines match as written), so wrapped lines must be joined.
5. **Grade independently against the L2 scorecard** before calling it passed. Keep the proof's determinism and context checks at 100% as the canon grows.
