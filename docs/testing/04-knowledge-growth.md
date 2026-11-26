# 04 · Growing the knowledge safely

Dated 2026-11-26. Sources: README "Add new knowledge (GitHub website, no command line)",
`tests/reports/GROWTH.md`, `proof_before.json`, `proof_after.json`, `.github/workflows/ci.yml` and `deploy.yml`.

## The safe path (GitHub website, no command line)

| Step | What you do | What guards it |
|---|---|---|
| 1. Write it down | Add a note in your own words under `docs_source/notes/` (**Add file → Create new file**). For a question you want answered your way, add an entry to a `knowledge_sources/profile/canon_*.yaml` file whose evidence points at the note (`url: doc:My_New_Topic`) | The build resolves every evidence link. One that resolves to nothing fails grounding |
| 2. Add its questions | Add the new questions, with the facts each must state, to a `tests/qa_*.json` set (as `qa_research.json` did) | From now on they are proven on every change |
| 3. Propose a pull request | Commit with **Create a new branch … and start a pull request** | `ci.yml`: pytest, build, integration (90 checks), retrieval eval (report only), and `node tests/prove.mjs` on all question sets. The report is attached as `proof-report` |
| 4. Merge when green | Merge to `main` | `deploy.yml` rebuilds, runs integration and the retrieval gate, and blocks the deploy on failure. The site answers within minutes |

If a new note or answer pulls an existing question onto the wrong answer, the proof fails and names
the question. **Caveat:** the proof runs in `ci.yml`, not in `deploy.yml`. A commit made straight to
`main` deploys if integration and the retrieval gate pass, even when the proof fails. Always use the
pull request. Open item in [06](06-open-items-next.md).

## Worked example: the PhD at Anurag University (`80dc3db`, 2026-11-26)

The owner's new facts: he has joined the PhD programme at Anurag University (Hyderabad) under
Dr. Amarajothi, and his question is which knowledge sources an AI system can trust, with Eidolon as the worked example.

| Added | Where |
|---|---|
| A note in his voice (research question, how Eidolon handles trust, analogy to unreliable raters, a per-source trust score, evaluation plan, 3 base papers, "About my supervisor") | `docs_source/notes/PhD_Anurag_University.md` |
| 9 curated answers (`research-*`). The PhD dates are not on record and are not guessed | `canon_research.yaml` |
| One PhD sentence in `education` and its 4 translations; "What is Eidolon?" answered by the Knowledge Fabric answer | `canon.yaml`, `canon_i18n.yaml` |
| 32 questions with their facts, plus 4 supervisor questions that must be declined | `tests/qa_research.json` |

Not added: a `profile.yaml` education record. Its schema has no status field, so an ongoing PhD
without invented dates cannot be expressed there.

## Before and after (same machine, same command: `node tests/prove.mjs --build`)

| Measure | Before (`b4b02ae`) | After | Change |
|---|---:|---:|---|
| Earlier sets (14) | 1,720/1,720 | 1,720/1,720 | none |
| New `qa_research.json` | — | 36/36 | +36 |
| Brief · determinism · context | 82/82 · 264/264 · 792/792 | 82/82 · 264/264 · 792/792 | none |
| Paraphrase consistency | 154 answers, 1,308 phrasings | 163 answers, 1,338 phrasings | all land |
| Grounding: resolved · unresolved · leaks | 154/154 · 0 · 0 | 163/163 · 0 · 0 | none |
| Latency p50 / p95 / max | 19.89 / 38.45 / 181.90 ms | 19.25 / 41.30 / 149.45 ms | noise (unchanged index: p95 37.7–39.9 ms) |
| Index: chunks · answers · documents · vocab | 786 · 154 · 351 · 8,755 | 811 · 163 · 361 · 8,837 | +25 · +9 · +10 · +82 |
| `index.json` · `semantic.json` | 3,692,260 · 1,374,255 bytes | 3,783,948 · 1,425,540 bytes | +2.5% · +3.7% |
| Retrieval hybrid: recall@10 · MRR · nDCG@10 | 1.000 · 0.963 · 0.948 | 1.000 · 0.963 · 0.947 | gate passes |

Of the 1,720 earlier answers, **0** changed which answer they land on. **48** changed text on purpose
(31 `education` answers gained the PhD sentence, 17 `knowledge-fabric` answers name Eidolon).
**1** retrieval answer cites a different chapter of the same Manali video, and **1,671** are byte-identical.

## What the proof caught on the way (each fixed at its cause; no earlier test edited)

The first build kept every earlier set at 100%, but `qa_research.json` passed 22 of 28. The fixes:
"a PhD" vs "your PhD" cue phrases; `danglingPronoun` in `site/js/canon.js` now accepts an antecedent
the question names itself; the discrepant-user answer says who counts; Eidolon is named in the Knowledge
Fabric note; `research-dates` declines honestly; the strong as-asked match threshold went from 0.9 to 0.75
(it is kept when the follow-up reading scores below 0.6); loose variants were removed so the decline
chips match the before run. Details: `GROWTH.md`.

Left for the owner: supervisor profile details and a summary of the 2025 *Knowledge and Information
Systems* paper (see [06](06-open-items-next.md)).

## Second growth: the smart plane press and videos (`6f46a39`, `3c29809`, `ed608df`, 2026-11-26)

The owner's new facts: two Telugu newspaper clippings about his 2012 B.Tech project, the smart plane
(Eenadu, Jangaon edition, "The little plane flew"; Namasthe Telangana, Monday 24 September 2012, page 8,
"With the sky as the limit"), his old YouTube channel @Phoenix007Super, made for the smart plane robot
work, and a demonstration video (`VomUVZ0IKeM`) uploaded by someone at the college. YouTube cannot be
reached from where this was written, so the Factory was taught to fetch the videos itself.

| Added | Where |
|---|---|
| Both clippings transcribed: paper, date, page, Telugu headline with translation, every fact marked "as reported", the uncertain ones listed, and his own account (voice control with HMM speech recognition) kept apart | `docs_source/notes/press/Smart_Plane_Press_2012.md` |
| The two links, what they are in his words, what the sync still has to fill | `docs_source/notes/press/Smart_Plane_Videos.md` |
| Factory: `extra_channels` (handle → channel id from the channel page → RSS) and `extra_videos` (oEmbed for title and uploader, watch page for the date) into `youtube/extra_videos.json`. Tried before the main feed; a refusal is a note, never a failed sync | `knowledge_factory/config.yaml`, `knowledge_factory/sources/youtube.py` |
| Seed records for both links, placeholder titles, `pending_sync: true` | `knowledge_sources/youtube/extra_videos.json` |
| Connector: a channel record and video records with their real channel and a "smart plane" topic; the catalogue answer says where an older upload really is | `pipeline/connectors/youtube.py`, `site/js/pipeline.js` |
| 10 curated answers (`smartplane-*`: press, specs, weight, engine, unveiled-by, minister, when, video, channel, where) | `canon_smartplane.yaml` |
| `voice-uav` names Eenadu, Namasthe Telangana and the video, takes "Tell me about your smart plane", and gives up its "newspaper" cue | `canon.yaml` |
| 41 questions with their facts plus 3 details the clippings do not give (speed, cost, range) that must be declined; added to the integration rounds | `tests/qa_smartplane.json` |
| 5 offline tests: handle and date parsing, a full fake sync, a refused sync, the connector records | `tests/test_youtube_extras.py` |

Not added: the sensor list and which dimension is the length or the wingspan (not transcribed), which
Namasthe Telangana profiles name him (not legible), the Eenadu issue date (not in the transcription; the
unveiling date 15 September 2012 is inferred from "Saturday, Engineers' Day" and marked so), and the
spelling of the director and principal (transliterated, marked uncertain).

### Before and after (same machine, `node tests/prove.mjs` on a fresh build)

| Measure | Before (`28456e7`) | After (`ed608df`) | Change |
|---|---:|---:|---|
| Earlier sets (16) | 6,441/6,441 | 6,632/6,632 | the 6,441 still pass; coverage regenerated, +191 wordings |
| New `qa_smartplane.json` | — | 44/44 (146/146 rubric points, 3/3 declines) | +44 |
| All sets | 6,441/6,441 | 6,676/6,676 | 17 sets |
| Brief · determinism · context | 82/82 · 523/523 · 1,569/1,569 | 82/82 · 523/523 · 1,569/1,569 | none |
| Paraphrase consistency | 289 answers, 5,633 phrasings | 299 answers, 5,847 phrasings | all land |
| Grounding: resolved · unresolved · leaks | 289/289 · 0 · 0 | 299/299 · 0 · 0 | none |
| Latency p50 / p95 / max | 25.42 / 47.15 / 346.69 ms | 27.19 / 50.43 / 268.49 ms | +1.8 ms p50, +3.3 ms p95; limit 250 ms |
| Index: chunks · answers · documents · vocab | 937 · 289 · 487 · 9,785 | 962 · 299 · 501 · 9,856 | +25 · +10 · +14 · +71 |
| `index.json` · `semantic.json` | 5,190,955 · 1,450,117 bytes | 5,270,676 · 1,478,604 bytes | +1.5% · +2.0% |
| Retrieval hybrid: recall@10 · MRR · nDCG@10 | 1.000 · 0.963 · 0.945 | 1.000 · 0.963 · 0.948 | gate passes |

Of the 6,441 earlier answers, **0** changed which answer they land on. **16** changed text on purpose
(`voice-uav` gained the press and video sentence), **4** declines offer a smart plane question among their
"closest things I can answer" chips (for example "Who is the prime minister of India?" now suggests "Did a
minister appreciate your project?"), **1** retrieval answer cites a different chapter of the same Manali
video, and **6,420** are byte-identical. The after report says "ed608df + uncommitted changes": the only
uncommitted change during that run was the one-line link in `docs/testing/README.md`.

### What the proof caught on the way (each fixed at its cause; no earlier test edited)

- Cue words that reached too far: "analyser robot" pulled "Have you built robots?" onto `voice-uav`, and
  "weather analyser" pulled "What is the weather today?" there too (gold and round 5). Both cues were
  removed. Generic cue phrases ("where did", "how big", "write about", "technical details", "youtube
  video", "built", "government") were dropped before the first run for the same reason.
- "Which other YouTube channel did you run for the smart plane?" moved to the video answer once "robot
  work" was taken out of the channel answer; the cue "other youtube channel" brought it back.
- Two question variants were too thin to separate answers ("What was the smart plane made of?" keeps only
  "smart plane" once stop words go), so they were made specific.
- Facts with an apostrophe or ampersand cannot be checked, because answers are HTML-escaped: the rubric
  checks "Engineers" and "department" instead of "Engineers' Day" and "R&D".
- `cite` checks run only in the coverage set, so the catalogue question about the demonstration video is
  checked by its id (`catalogue`) and wording in `qa_smartplane.json`; coverage checks the citation.
- `tests/gen_coverage.py` builds variants from a Python set, so its order changes from run to run with the
  same content; a regenerated file whose questions are unchanged is not committed.

Open items: "Who was the pilot?" is answered, before and after this change, by the interview answer
`iv1-poc-to-production` ("pilot" as in a pilot project), so it is not a decline case; his own account says
he flew the plane by voice. Impersonal questions about details not on record ("What was the top speed of
the smart plane?") are declined, but the same question with "your" ("How much did your smart plane cost?")
is answered with the specifications. Left for the owner: upload the scans to `docs_source/press/`, run the
Factory once (Actions → Knowledge Factory → Run workflow, `youtube`) to replace the placeholder titles, and
confirm the sensors, the dimension labels, the two spellings and "0.6 cc", kept as printed (model engines
are often sized in cubic inches, and a ".60" engine is about 10 cc).
