# My PhD at Anurag University: which knowledge sources can an AI system trust?

Written by Prashobh Paul for the Knowledge Fabric, November 2026.

## What I have joined
I have joined the PhD programme at Anurag University in Hyderabad. My supervisor, my PhD
guide, is Dr. Amarajothi. It continues a thread that started with my M.Tech in Knowledge
Engineering at SRM University: first how knowledge is represented, now how far it can be
trusted.

## Where the question came from
Dr. Amarajothi's research asks which users' ratings cannot be fully trusted, the question of
trust in rating and recommender systems. That idea made me think of the parallel question for
AI systems: which knowledge sources can an AI system trust? A recommender system that takes
every rating at face value is misled by the users whose ratings do not mean what they say. An
AI system that takes every source at face value is misled in the same way, by a stale page, a
copy that drifted from the original, or a claim nobody can trace. I use this very system,
Eidolon, the twin that answers questions about me on top of my Knowledge Fabric, as the
worked example.

## My research question
When an AI system answers from many sources, how should it decide how far to trust each
source, and how should that trust change what it retrieves, what it says and when it declines
to answer? Under it sit three smaller questions. Which signals of trust can a system measure on
its own, without a person labelling every source? How should those signals combine into a
trust score per source, and per claim? And how do we prove that weighting by trust makes the
answers more accurate rather than only different?

## How Eidolon handles trust today
Eidolon already makes trust decisions; it makes them by rules I wrote, not by a measured score.
These rules are the starting point of my PhD.

Provenance on every record. Every record from my website, resume, GitHub, YouTube channel,
LinkedIn and these notes carries the URL where a person can verify it. Its date carries the
method that produced it and a confidence: a timestamp from the source system itself counts
most (0.95), then a revision stamp inside the document (0.85), the PDF metadata (0.60), a date
written in the body text (0.35) and the crawl date (0.30). A record with no recoverable date is
reported as unknown, never given a plausible-looking guess, and freshness scoring must not
treat an unknown date as old.

Curated answers must prove themselves at build. Each answer I write in my own words lists its
evidence links: a website page, a resume record, a repository, a video or this note. The build
resolves every link to the records that prove it, and a link that resolves to nothing is
reported as unresolved instead of being silently accepted. The answer is then shown with those
proofs as citations, and the fabric's own retrieval underneath as corroboration.

Cross-source corroboration. Entity resolution collapses the surface forms of the same project,
employer or event across the website, GitHub, YouTube, the resume and LinkedIn into one node of
the knowledge graph with several sources. A project seen on my website and in my GitHub is one
node with two independent witnesses, and CI refuses a fabric that has no cross-source joins.
The derived confidence of a retrieved answer already measures source consensus and the
agreement between the lexical and semantic retrievers.

Authority and recency. My structured profile states where each block of facts came from. When
the resume and the website disagree, the resume wins; an older resume stays in the index but is
marked as not current, so the newer revision speaks first.

Confidential client names. Client names listed in confidential.yaml are replaced in every
source before indexing, so the system can never quote one. Trust also means the system can be
trusted with what it must not say.

Honest no-answer. When nothing in the sources answers a question, Eidolon says it does not
have that on record and will not guess, instead of stitching unrelated sentences into a
plausible paragraph. Private details are declined outright.

The flag and curator loop. A visitor can flag any answer; the flag becomes a GitHub issue
labelled knowledge-flag. The curator re-asks every flagged question against the current index,
marks it resolved only when retrieval is decisive and covers the question, closes the issues a
sync has fixed, and writes profile stubs for me to complete. It proposes; it never invents
facts. A resolved flag becomes a regression test, so a fixed gap cannot silently reopen.

Golden-set gates. Every pull request runs the proof: every question set, the interview brief
asked in full, determinism over three runs, context independence, paraphrase consistency,
grounding and latency. A change that lowers accuracy fails the check. That is how new knowledge,
including this note, is added without losing accuracy.

## The analogy: unreliable raters and unreliable sources
In a recommender system, a rating is a claim a user makes about an item. In a knowledge system,
a record is a claim a source makes about the world. The mapping I am working from:

| In rating systems | In AI knowledge systems |
|---|---|
| A user whose ratings cannot be fully trusted | A source whose claims cannot be fully trusted |
| A discrepant user, whose rating disagrees with the emotion in their own review | A discrepant source, whose claim disagrees with corroborating sources or with its own structured fields |
| Refining the rating with the review, instead of discarding the user | Re-weighting a source's claims by consistency signals, instead of dropping the source |
| A user's rating history | A source's version history |
| Many users agreeing on an item | Several independent sources agreeing on a fact |

The signals I want to measure for each source:

- Agreement with other sources: the share of its claims that independent sources confirm, and
  the share they contradict.
- Internal consistency: whether its structured fields agree with its own prose, the way a
  rating should agree with its review.
- Consistency over time: whether a later version silently contradicts an earlier one, and
  whether its dates are known and recent, weighted by how confident the date itself is.
- Authority and ownership: whether the source is controlled by the subject, is the system of
  record (a repository's own push dates, a channel's own publish dates), or is a copy.
- Feedback: flags raised against answers that cite it, and whether they were resolved.

## A trust score per source
From those signals I want a trust score between 0 and 1 for every source, and for every claim
it makes. In Eidolon it would act in three places. In retrieval, as a weight on each record's
score, or as one more ranked run in the reciprocal rank fusion that already combines BM25, LSA
and the sentence embeddings. In answering, as a sixth signal in the derived confidence, and as a
rule: a claim from a low-trust source is stated only when a second source corroborates it,
otherwise the twin says it is not on record. And in curation, by sending the lowest-trust
sources to me for review first.

A concrete case: the resume and the website both say I have over eleven years of experience,
while a chatbot source says thirteen. Today a hand-written precedence rule settles it. With a
trust score, the two agreeing sources would outweigh the outlier from the evidence itself, and
the outlier would lose weight only on that claim, the way a discrepant user's rating is refined
rather than the user being thrown out.

## How I plan to evaluate it
Eidolon's golden question sets are the benchmark, and the proof report is the baseline. I plan
to inject controlled faults, stale copies of a page, claims that contradict the other sources and
records without provenance, and measure whether accuracy holds, whether the twin declines rather
than answers from a bad source, and whether its confidence stays calibrated. These are the
directions I am starting my PhD with, not finished results.

## The papers I am building on
These are the base papers for my PhD, from my supervisor Dr. Amarajothi's line of research on
rating and recommender systems.

Refining User Ratings Using User Emotions for Recommender Systems, at iiWAS 2021, the 23rd
International Conference on Information Integration and Web Intelligence, published by ACM
(doi.org/10.1145/3487664.3487666). It applies an emotion detection algorithm to the text of a
user's review and uses the result to refine that user's rating; collaborative filtering then
predicts ratings from the refined ratings. The connection to my question: a signal that cannot
be fully trusted (the star rating) is refined with a second signal from the same source (the
review). For knowledge sources, a claim is refined with the evidence around it: its provenance,
its date and what other sources say.

enemos-p: An enhanced emotion specific prediction for recommender systems, in Expert Systems
with Applications, 2023, volume 227 (doi.org/10.1016/j.eswa.2023.120190). It addresses the
inconsistency between what users rate and what they write, in three stages: extracting emotional
features from reviews, computing refined ratings, and generating recommendations; it was evaluated
on eight Amazon and Yelp datasets with error measures such as MAE and RMSE. The connection: a
measured inconsistency between two signals is treated as information, not as noise to ignore. A
source whose claim is inconsistent with corroborating sources should be re-weighted by how
inconsistent it is.

Emotions in recommender systems for discrepant-users, in Knowledge and Information Systems, 2025,
volume 67 (doi.org/10.1007/s10115-024-02307-z). The connection: the discrepant user, whose rating
and review do not express the same intent, is the idea I want to carry over to a discrepant
source.
TODO (Prashobh): add a one-line summary of this paper from its abstract; the abstract could not
be confirmed when this note was written.

Where I verified these details: the publication records at
https://www.bohrium.com/paper-details/enemos-p-an-enhanced-emotion-specific-prediction-for-recommender-systems/864981006858321922-2452,
https://ouci.dntb.gov.ua/works/45w5jqk9, https://researchr.org/publication/AramandaAV23/bibtex,
https://unpaywall.org/10.1145/3487664.3487666 and
https://api.crossref.org/works/10.1007/s10115-024-02307-z.

## About my supervisor
Name: Dr. Amarajothi.
University: Anurag University, Hyderabad.
Research interest: identifying users whose ratings cannot be fully trusted, that is, trust in
rating and recommender systems.
TODO (Prashobh): add Dr. Amarajothi's profile details here (designation, department and a link
to her university profile). Nothing beyond her name, university and research interest is on
record yet.
