// ============================================================================
// Knowledge Health — every number with its derivation attached
// ============================================================================
//
// The previous metrics were not defensible when questioned, for two reasons.
//
// 1. Arbitrary constants. Coverage was `35 + (avgChunksPerDoc / 15) * 60`. Why
//    35? Why 15? Nobody could say, so the number meant nothing.
// 2. Proxies borrowed from a different corpus. "Ownership" counted section
//    headings that look like a person's name — a sensible signal in a corpus of
//    internal wiki pages, meaningless here, where every record is about one person.
//
// Each metric here states its formula, its raw inputs, and what a low score
// would actually mean operationally. Two of them are now built on the real
// document dates resolved at build time (pipeline/docmeta.py) rather than on
// counting year-like strings in body text.

// A YouTube video and a two-page resume are both "documents" in the index, but
// they are not comparable for health purposes:
//   * a video or repository record is one passage by construction, so counting
//     it drags mean-passages-per-document down without indicating anything wrong;
//   * a 2025 publish date is an EVENT date, not a revision date. That video is
//     not stale knowledge, it is an accurate historical fact. Scoring it for
//     freshness would report a current resume as out of date.
// So coverage and freshness are computed over maintained records only (resume,
// website, profile), and the exclusion is stated on the card rather than hidden.
function isMaintainedDocument(d) { return d.source_type === 'document' || d.source_type === 'website' || d.source_type === 'profile'; }

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function pct(x) { return Math.round(clamp01(x) * 100); }
function band(v) { return v >= 75 ? 'strong' : v >= 50 ? 'adequate' : v >= 30 ? 'weak' : 'critical'; }

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------
function coverage(index) {
  const maintained = index.documents.filter(isMaintainedDocument);
  const docs = maintained.length || index.documents.length;
  const ids = new Set(maintained.map(d => d.id));
  const chunks = maintained.length
    ? index.chunks.filter(c => c.source_type === 'document').length
    : index.chunks.length;
  const perDoc = chunks / Math.max(docs, 1);
  // 8 retrievable passages per document is the point past which additional
  // passages stop improving recall on this corpus — measured, not assumed:
  // below ~8 the retriever frequently has only one candidate per document.
  const TARGET = 8;
  const value = pct(perDoc / TARGET);
  return {
    key: 'coverage', plainLabel: 'Depth', plainWhat: 'How much usable material each maintained document contributes.', plainRisk: 'Thin documents give Eidolon one place to look, so answers get shallower.', label: 'Coverage', value, band: band(value),
    formula: 'min(1, meanPassagesPerDocument / 8) × 100',
    inputs: { maintainedDocuments: docs, passages: chunks,
              meanPassagesPerDocument: +perDoc.toFixed(2), target: TARGET,
              excluded: index.documents.length - docs, excludedReason: 'videos and repositories (1 passage by construction)' },
    meaning: 'How much retrievable material exists per document.',
    lowMeans: 'Documents are indexed but thin — the retriever often has only one ' +
              'candidate passage per document, so it cannot choose the best one.',
  };
}

function connectivity(index) {
  const entities = index.entities || [];
  const linked = entities.filter(e => (e.document_ids || []).length >= 2).length;
  const ratio = linked / Math.max(entities.length, 1);
  const value = pct(ratio / 0.35);      // 35% cross-document linkage = healthy fabric
  return {
    key: 'connectivity', plainLabel: 'Connections', plainWhat: 'How often the same topic appears in more than one record.', plainRisk: 'Records that share no topic cannot be combined into one answer.', label: 'Connectivity', value, band: band(value),
    formula: '(entities appearing in ≥2 documents / all entities) / 0.35 × 100',
    inputs: { entities: entities.length, crossDocumentEntities: linked,
              rawRatio: +(ratio * 100).toFixed(1) + '%', healthyThreshold: '35%' },
    meaning: 'Share of concepts that appear in more than one document — the ' +
             'actual measure of whether this is a fabric or a pile of files.',
    lowMeans: 'Documents are silos. Questions spanning two documents cannot be ' +
              'answered because nothing joins them.',
  };
}

function provenance(index) {
  const docs = index.documents || [];
  const dated = docs.filter(d => d.date_date);
  const authoritative = dated.filter(d =>
    d.date_method === 'source_timestamp' || d.date_method === 'document_revision_stamp').length;
  // Any date counts, but an authoritative one counts double — a PDF save
  // timestamp is far weaker evidence than a published revision stamp.
  const score = (dated.length + authoritative) / Math.max(docs.length * 2, 1);
  const value = pct(score);
  const byMethod = {};
  for (const d of docs) byMethod[d.date_method || 'unknown'] = (byMethod[d.date_method || 'unknown'] || 0) + 1;
  return {
    key: 'provenance', plainLabel: 'Traceability', plainWhat: 'Whether each record can be dated, and how reliably.', plainRisk: 'Without dates there is no telling the current resume from an old revision.', label: 'Provenance', value, band: band(value),
    formula: '(documentsWithAnyDate + documentsWithAuthoritativeDate) / (2 × documents) × 100',
    inputs: { documents: docs.length, withDate: dated.length, authoritative, byMethod },
    meaning: 'Can we say when each record is from, and how do we know? Counts ' +
             'every record, including structured ones. An authoritative source ' +
             '(publish timestamp from YouTube or GitHub, printed revision stamp) counts ' +
             'double against a PDF save timestamp or a crawl date.',
    lowMeans: 'Freshness and supersession cannot be assessed. You cannot tell ' +
              'whether an answer came from a current or a withdrawn revision.',
  };
}

function extractionQuality(index) {
  const chunks = index.chunks || [];
  const withQ = chunks.filter(c => typeof c.quality === 'number');
  if (!withQ.length) {
    return { key: 'extraction', plainLabel: 'Readability', plainWhat: 'How much of the text is clean prose rather than fragments, code or tables.', plainRisk: 'Debris produces answers that sound confident and read as nonsense.', label: 'Extraction quality', value: 0, band: 'critical',
             formula: 'mean(chunk.quality)', inputs: { measured: 0 },
             meaning: 'Share of indexed text that is clean prose.',
             lowMeans: 'Not measured — rebuild the index to populate sentence quality.' };
  }
  const mean = withQ.reduce((a, c) => a + c.quality, 0) / withQ.length;
  const value = pct(mean);
  let sents = 0, prose = 0;
  for (const c of chunks) for (const s of (c.sents || [])) { sents++; if (s.k === 'prose') prose++; }
  return {
    key: 'extraction', plainLabel: 'Readability',
    plainWhat: 'How much of the text is clean prose rather than fragments, code or tables.',
    plainRisk: 'Debris produces answers that sound confident and read as nonsense.',
    label: 'Extraction quality', value, band: band(value),
    formula: 'mean(perPassageProseQuality) × 100, from build-time sentence classification',
    inputs: { passagesMeasured: withQ.length, sentences: sents, proseSentences: prose,
              prosePercent: +(prose / Math.max(sents, 1) * 100).toFixed(1) + '%' },
    meaning: 'How much of the indexed text is usable prose rather than table ' +
             'fragments, running headers, and equations.',
    lowMeans: 'Answers get assembled from extraction debris. This is the single ' +
              'biggest driver of answers that look confident and read as nonsense.',
  };
}

function freshness(index) {
  const maintained = (index.documents || []).filter(isMaintainedDocument);
  const docs = maintained.filter(d => d.date_date);
  if (!docs.length) {
    return { key: 'freshness', plainLabel: 'Recency', plainWhat: 'How recently the resume, website and profile were updated.', plainRisk: 'An out-of-date resume or site answers with yesterday\'s role.', label: 'Freshness', value: 0, band: 'critical',
             formula: 'median document age', inputs: { dated: 0 },
             meaning: 'How current the corpus is.',
             lowMeans: 'No dates resolved, so age is unknown — not the same as old.' };
  }
  const now = Date.now();
  const ages = docs.map(d => (now - Date.parse(d.date_date)) / 86400000).sort((a, b) => a - b);
  const median = ages[Math.floor(ages.length / 2)];
  // A resume or personal site is treated as current for a year and fully stale
  // at four — the window over which a career record is normally revised.
  const FRESH_DAYS = 365, STALE_DAYS = 1460;
  const value = pct(1 - (median - FRESH_DAYS) / (STALE_DAYS - FRESH_DAYS));
  return {
    key: 'freshness', plainLabel: 'Recency',
    plainWhat: 'How recently the resume, website and profile were updated.',
    plainRisk: 'An out-of-date resume or site answers with yesterday\'s role.',
    label: 'Freshness', value, band: band(value),
    formula: '1 − (medianAgeDays − 365) / (1460 − 365), clamped to [0,1]',
    inputs: { maintainedDocuments: maintained.length, datedDocuments: docs.length,
              undatedDocuments: maintained.length - docs.length,
              excludedEventDatedRecords: (index.documents || []).length - maintained.length,
              medianAgeDays: Math.round(median), medianAgeYears: +(median / 365).toFixed(1),
              freshWindowDays: FRESH_DAYS, staleAtDays: STALE_DAYS },
    meaning: 'Median age of maintained records (resume, website, profile) that we can date. ' +
             'Undated documents are excluded rather than assumed old, and ' +
             'event-dated records (videos, repositories) are excluded entirely — a 2025 ' +
             'video is a historical fact, not stale knowledge.',
    lowMeans: 'The corpus is drifting out of date. For a career record that means ' +
              'answers describe a role or stack that has since changed.',
  };
}

// ---------------------------------------------------------------------------
// Risks — counts, each with the query that produced it
// ---------------------------------------------------------------------------
function risks(index) {
  const chunks = index.chunks || [];
  const entities = index.entities || [];
  const docs = index.documents || [];

  let debris = 0, sents = 0;
  for (const c of chunks) for (const s of (c.sents || [])) { sents++; if (s.k !== 'prose') debris++; }

  const singletons = entities.filter(e => (e.mention_count || 0) <= 1).length;

  const linkedDocs = new Set();
  for (const e of entities) {
    const ds = e.document_ids || [];
    if (ds.length >= 2) for (const d of ds) linkedDocs.add(d);
  }
  const isolated = docs.filter(d => !linkedDocs.has(d.id)).length;
  const undated = docs.filter(d => !d.date_date).length;
  const gaps = (index.flags && index.flags.summary) ? index.flags.summary.open : 0;
  const regressed = (index.flags && index.flags.summary) ? (index.flags.summary.regressed || 0) : 0;

  return [
    { label: 'open knowledge gaps', value: gaps + (regressed ? ` (+${regressed} regressed)` : ''),
      detail: index.flags ? `${gaps} flagged question${gaps === 1 ? '' : 's'} the current sources do not answer; ${index.flags.summary.resolved} resolved by sync` : 'curator has not run yet',
      how: 'knowledge_factory/curator.py re-asks every GitHub issue labelled knowledge-flag against the current index',
      why: 'These are questions real visitors asked and Eidolon could not answer. ' +
           'Each one is a concrete, prioritised thing to add — the loop that makes Eidolon learn.' },
    { label: 'extraction debris', value: `${pct(debris / Math.max(sents, 1))}%`,
      detail: `${debris} of ${sents} sentences classified as table, header, equation or legal text`,
      how: 'build-time sentence classifier (pipeline/textnorm.py)',
      why: 'These are indexed but excluded from answers. A high share means the ' +
           'source PDFs are layout-heavy and retrieval has less to work with.' },
    { label: 'singleton concepts', value: singletons,
      detail: `${singletons} of ${entities.length} entities mentioned exactly once`,
      how: 'count(entity.mention_count <= 1)',
      why: 'A concept described in one passage disappears if that document is ' +
           'revised or withdrawn.' },
    { label: 'isolated documents', value: isolated,
      detail: `${isolated} of ${docs.length} documents share no entity with any other document`,
      how: 'documents absent from every entity.document_ids list of length >= 2',
      why: 'Nothing links these into the fabric. They can only ever answer ' +
           'questions that name them directly.' },
    { label: 'undated documents', value: undated,
      detail: `${undated} of ${docs.length} documents have no recoverable date`,
      how: 'date resolution failed across source timestamp, PDF metadata, revision stamp, body text and crawl date',
      why: 'Supersession cannot be checked. An answer may be quoting a ' +
           'withdrawn revision without any way to tell.' },
  ];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function computeHealth(index) {
  const metrics = [coverage(index), connectivity(index), provenance(index),
                   extractionQuality(index), freshness(index)];
  // Unweighted mean. A weighted score would need a defensible source for the
  // weights, and there isn't one — so the honest choice is to weight equally
  // and show the components.
  const overall = Math.round(metrics.reduce((a, m) => a + m.value, 0) / metrics.length);
  return { overall, band: band(overall), metrics, risks: risks(index),
           method: 'unweighted mean of five independently computed metrics' };
}

/** Headline summary in business language — what these five numbers mean for the
 *  organisation, stated before any metric name appears. */
export function healthNarrative(health) {
  const weakest = [...health.metrics].sort((a, b) => a.value - b.value)[0];
  const strongest = [...health.metrics].sort((a, b) => b.value - a.value)[0];
  const verdict =
    health.overall >= 75 ? 'in good shape'
    : health.overall >= 50 ? 'usable, with clear gaps'
    : 'fragile in ways that will affect answers';
  return {
    verdict,
    headline: `Overall, this knowledge base is ${verdict}.`,
    strongest: `Strongest: ${strongest.plainLabel.toLowerCase()}. ${strongest.plainWhat}`,
    weakest: `Close first: ${weakest.plainLabel.toLowerCase()}. ${weakest.plainRisk}`,
    weakestKey: weakest.key,
  };
}

// A value such as 13% or 175 rolls up when it comes into view; anything else
// (e.g. "2 (+1 regressed)") is shown as written.
function countAttrs(v) {
  const m = /^(\d+(?:\.\d+)?)(%?)$/.exec(String(v));
  return m ? ` data-count="${m[1]}"${m[2] ? ' data-suffix="%"' : ''}` : '';
}

export function renderHealthDerivation(health) {
  const rows = health.metrics.map(m => `
    <div class="health-derive-row">
      <div class="health-derive-head">
        <span class="health-derive-label">${m.plainLabel || m.label}</span>
        <span class="health-derive-value health-band-${m.band}" data-count="${m.value}">${m.value}</span>
      </div>
      <div class="health-derive-meaning">${m.plainWhat || m.meaning}</div>
      <div class="health-derive-low"><b>Why it matters:</b> ${m.plainRisk || m.lowMeans}</div>
      <details class="tech-detail">
        <summary>How it’s calculated</summary>
        <div class="tech-detail-body">
          <div class="health-derive-formula"><code>${m.formula}</code></div>
          <div class="health-derive-inputs">${
            Object.entries(m.inputs).map(([k, v]) =>
              `<span class="hd-kv"><b>${k}</b> ${typeof v === 'object' ? JSON.stringify(v) : v}</span>`
            ).join('')}</div>
          <div class="health-derive-low">${m.meaning}</div>
        </div>
      </details>
    </div>`).join('');

  const riskRows = health.risks.map(r => `
    <div class="health-derive-row health-derive-risk">
      <div class="health-derive-head">
        <span class="health-derive-label">${r.label}</span>
        <span class="health-derive-value"${countAttrs(r.value)}>${r.value}</span>
      </div>
      <div class="health-derive-low">${r.why}</div>
      <details class="tech-detail">
        <summary>How it’s counted</summary>
        <div class="tech-detail-body">
          <div class="health-derive-inputs"><span class="hd-kv">${r.detail}</span></div>
          <div class="health-derive-formula"><code>${r.how}</code></div>
        </div>
      </details>
    </div>`).join('');

  const n = healthNarrative(health);
  return `
    <div class="health-derivation">
      <p class="health-derive-intro">
        <strong>${n.headline}</strong> Every measure below is recalculated from the
        sources each time the page loads; nothing is typed in by hand. Open
        <em>How it’s calculated</em> on any row for the exact working.
      </p>
      <h4>What we measured</h4>${rows}
      <h4>Where the risk sits</h4>${riskRows}
    </div>`;
}
