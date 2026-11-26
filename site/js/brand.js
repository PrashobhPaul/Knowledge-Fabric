// ============================================================================
// Brand & narrative copy — single source of truth
// ============================================================================
//
// Every reader-facing string in the page shell lives here. Re-pointing the
// product at a different person is a change to ONE object, not a search across
// templates. The HTML carries the same text as a no-JS fallback and binds to
// these keys through data-brand / data-copy attributes.
//
// The product is Eidolon (Greek: the living image of a person). It runs on two
// of the owner's projects, the Knowledge Factory and the Knowledge Fabric; those
// project names stay as they are wherever they describe the engine.
//
// Voice: confident, plain, first-hand. Sentence case. Say what the reader gets,
// then how. One idea per string; no string repeats another on the same screen.

export const BRAND = {
  product: 'Eidolon',
  tagline: 'The living knowledge twin of Prashobh Paul',
  // The engine underneath: his own projects, named as projects.
  engine: 'Knowledge Fabric',
  factory: 'Knowledge Factory',
  // The person Eidolon is about — and who built it.
  subject: {
    name: 'Prashobh Paul',
    shortName: 'Prashobh',
    role: 'AI Architect · Agentic and enterprise AI',
    url: 'https://www.prashobhpaul.com',
    github: 'https://github.com/PrashobhPaul',
    youtube: 'https://www.youtube.com/channel/UCaJCnvHRXay79_R737hXFaQ',
    corpusDescription: 'resume, website, LinkedIn, YouTube channel and GitHub',
  },
  builder: {
    name: 'Prashobh Paul',
    unit: 'Personal project',
    unitShort: 'personal',
    url: 'https://github.com/PrashobhPaul/Prashobh_Knowledge_Factory',
  },
  stage: 'Live',

  // ---- assembled strings --------------------------------------------------
  // Keys are generic (clientName / productName / subjectRole) so the markup
  // never changes when the narrative does.
  get clientName()   { return this.subject.name; },
  get productName()  { return this.product; },
  get productTagline() { return this.tagline; },
  get subjectRole()  { return this.subject.role; },
  // The header once read "Prashobh Paul / Built by Prashobh Paul" — the same
  // name twice. The builder credit now lives once, in the footer signature.
  get demoBy()       { return 'Designed and built by ' + this.builder.name; },
  get demoByUnit()   { return 'Runs on the ' + this.factory + ' and the ' + this.engine; },
  get signature()    { return this.builder.name; },

  get footerBrand() {
    return this.product + ' — the living knowledge twin of ' + this.subject.name +
           '. Built from his ' + this.subject.corpusDescription + '; every answer cites its source.';
  },
  get footerNote() {
    // The name is already in the signature beside this line; it is not repeated.
    return '© ' + new Date().getFullYear() + '. Open source. The ' + this.factory +
           ' syncs the sources; the ' + this.engine + ' answers from them, rebuilt on every change.';
  },
  // Sits under the answer, where it is a claim the reader can check.
  get answerAssurance() {
    return 'Every statement above comes from ' + this.subject.shortName +
           '’s own records — resume, website, LinkedIn, YouTube or GitHub — and links back to its source. No model invents a word of it.';
  },
};

// ---------------------------------------------------------------------------
// Narrative copy — outcome first, mechanism second
// ---------------------------------------------------------------------------
export const COPY = {
  hero: {
    placeholder: 'Ask about his work, projects or travels…',
    // The bar that follows the reader down the page: they have seen an answer by then.
    followUp: 'Ask another question…',
  },

  nav: { hero: 'Eidolon', answer: 'Answer', explain: 'Evidence', health: 'Health', insights: 'Corpus' },

  sections: {
    answer: {
      eyebrow: 'The answer',
      title: 'Answers you can check.',
      // Carries one inline element (a citation marker), so it is applied as HTML.
      sub: 'Every sentence is quoted from a real record — his resume, his website, a video, a repository — ' +
           'and linked back to it. Select any <span class="cite-inline-demo" aria-hidden="true">1</span> to open the source.',
    },
    explain: {
      eyebrow: 'The evidence',
      title: 'See exactly why it said that.',
      sub: 'Open any answer down to the records it read, the graph links that joined them and the exact sentence it quoted.',
    },
    health: {
      eyebrow: 'Knowledge health',
      title: 'How complete is the picture?',
      sub: 'Knowledge that lives in one source, can’t be dated, or isn’t corroborated anywhere else is a blind spot. ' +
           'Eidolon measures those blind spots straight from the sources and says which to close first.',
    },
    insights: {
      eyebrow: 'The corpus',
      title: 'What the sources actually cover.',
      sub: 'What the Knowledge Factory has synced and when, where the material runs deep, and the concepts it returns to most.',
    },
  },

  // The four reasons to trust an answer (the "trust pillars" panel).
  value: {
    grounded: {
      title: 'Quoted, not generated',
      body: 'Answers are assembled from sentences that exist in the sources. If no source says it, Eidolon doesn’t either.',
    },
    traceable: {
      title: 'Traceable to the sentence',
      body: 'Each statement links to the resume page, site section, video or repository it came from.',
    },
    connected: {
      title: 'Joined across sources',
      body: 'A project on the website and its repository on GitHub are one node in the graph, so one answer can draw on both.',
    },
    honest: {
      title: 'Honest when unsure',
      body: 'Confidence is measured from the evidence, not displayed as decoration. A weak answer says so, and can be flagged.',
    },
  },
};

function pick(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), COPY);
}

/** Apply brand strings to any element carrying data-brand="key", and narrative
 *  copy to data-copy="path.in.COPY" (text) / data-copy-html (trusted markup) /
 *  data-copy-placeholder. Keeps the markup declarative and means re-branding
 *  never touches the HTML. */
export function applyBrand(root = document) {
  const map = {
    product: BRAND.product,
    productName: BRAND.productName,
    productTagline: BRAND.productTagline,
    clientName: BRAND.clientName,
    subjectRole: BRAND.subjectRole,
    demoBy: BRAND.demoBy,
    demoByUnit: BRAND.demoByUnit,
    signature: BRAND.signature,
    footerBrand: BRAND.footerBrand,
    footerNote: BRAND.footerNote,
    answerAssurance: BRAND.answerAssurance,
    builderName: BRAND.builder.name,
    factory: BRAND.factory,
    engine: BRAND.engine,
  };
  for (const el of root.querySelectorAll('[data-brand]')) {
    const v = map[el.dataset.brand];
    if (v) el.textContent = v;
  }
  for (const el of root.querySelectorAll('[data-copy]')) {
    const v = pick(el.dataset.copy);
    if (typeof v === 'string') el.textContent = v;
  }
  for (const el of root.querySelectorAll('[data-copy-html]')) {
    const v = pick(el.dataset.copyHtml);
    if (typeof v === 'string') el.innerHTML = v;
  }
  for (const el of root.querySelectorAll('[data-copy-placeholder]')) {
    const v = pick(el.dataset.copyPlaceholder);
    if (typeof v === 'string') el.setAttribute('placeholder', v);
  }
  const HREF = { builder: BRAND.builder.url, client: BRAND.subject.url, github: BRAND.subject.github, youtube: BRAND.subject.youtube };
  for (const el of root.querySelectorAll('[data-brand-href]')) {
    const target = HREF[el.dataset.brandHref];
    if (target) el.setAttribute('href', target);
  }
}
