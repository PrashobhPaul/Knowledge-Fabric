// ============================================================================
// Brand & narrative copy — single source of truth
// ============================================================================
//
// Every reader-facing string lives here. Re-pointing the product at a different
// person is a change to ONE object, not a search across templates. Change
// `subject` below and the whole narrative re-labels itself.
//
// The product is Eidolon (Greek: the living image of a person). It runs on two
// of the owner's projects, the Knowledge Factory and the Knowledge Fabric; those
// project names stay as they are wherever they describe the engine.
//
// Copy guidance: lead with what the reader gets, keep the method underneath it.

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
    role: 'AI Architect · Agentic AI · Enterprise AI',
    url: 'https://www.prashobhpaul.com',
    corpusDescription: 'resume, personal website, LinkedIn posts, YouTube channel and GitHub repositories',
  },
  builder: {
    name: 'Prashobh Paul',
    unit: 'Personal project',
    unitShort: 'personal',
    url: 'https://github.com/PrashobhPaul/Prashobh_Knowledge_Factory',
  },
  stage: 'Live',

  // ---- assembled strings --------------------------------------------------
  // The HTML binds to these keys via data-brand="…". Keys are kept generic
  // (clientName / productName / demoBy) so the markup never changes when the
  // narrative does.
  get clientName()   { return this.subject.name; },
  get productName()  { return this.product; },
  get demoBy()       { return 'Built by ' + this.builder.name; },
  get demoByUnit()   { return 'Runs on ' + this.factory + ' + ' + this.engine; },
  get productTagline() { return this.tagline; },
  get subjectRole()  { return this.subject.role; },

  get footerBrand() {
    return this.product + ', the living knowledge twin of ' + this.subject.name +
           '. Everything public about him, assembled from his ' + this.subject.corpusDescription +
           ' and answered with citations.';
  },
  get footerNote() {
    return '© ' + new Date().getFullYear() + ' ' + this.builder.name +
           '. Open source. Runs on the ' + this.engine + '; sources are refreshed by the ' + this.factory +
           ' and rebuilt by GitHub Actions.';
  },
  // Belongs beside the answer, where it is a claim the reader can check.
  get answerAssurance() {
    return 'Every statement below is quoted from a source about ' + this.subject.shortName +
           ' — the resume, the website, a LinkedIn post, a video or a repository — and linked to it. Nothing is generated or paraphrased.';
  },
};

// ---------------------------------------------------------------------------
// Narrative copy — outcome first, mechanism second
// ---------------------------------------------------------------------------
export const COPY = {
  hero: {
    title: ['Eidolon', 'The living knowledge twin of Prashobh Paul'],
    sub: 'The resume, the website, the YouTube channel and the GitHub repositories already hold the ' +
         'answers. Eidolon finds them, links them across sources, answers in his own voice, and shows exactly where each one came from.',
    placeholder: 'Ask Eidolon about Prashobh’s work, projects, skills or travels…',
  },

  sections: {
    answer: {
      eyebrow: 'The Answer',
      title: 'Answers you can check.',
      sub: 'Written as a reply, not a search result — with every statement carrying the source it came from.',
    },
    explain: {
      eyebrow: 'The Evidence',
      title: 'See exactly why it said that.',
      sub: 'Every answer opens up: which records were consulted, which were set aside, and how confident the system is.',
    },
    health: {
      eyebrow: 'Knowledge Health',
      title: 'How complete is the picture?',
      sub: 'Knowledge that sits in one source, that nobody can date, or that no other source corroborates is a gap. This is that gap, measured.',
    },
    insights: {
      eyebrow: 'The Corpus',
      title: 'What the sources actually cover.',
      sub: 'Where knowledge concentrates, where it thins out, and which topics depend on a single source.',
    },
  },

  value: {
    grounded: {
      title: 'Nothing is invented',
      body: 'Answers are assembled from sentences that exist in the sources. If no source says it, the system does not say it either.',
    },
    traceable: {
      title: 'Every claim is checkable',
      body: 'Each statement links to the resume page, website section, video or repository it came from.',
    },
    honest: {
      title: 'It tells you when it is unsure',
      body: 'Confidence is measured from the evidence found, not displayed as decoration. A weak answer is labelled as one.',
    },
    connected: {
      title: 'It connects separate sources',
      body: 'A project on the website and its repository on GitHub are linked automatically, so questions that span both can be answered.',
    },
  },
};

/** Apply brand strings to any element carrying data-brand="key". Keeps the
 *  markup declarative and means re-branding never touches the HTML. */
export function applyBrand(root = document) {
  const map = {
    product: BRAND.product,
    productName: BRAND.productName,
    productTagline: BRAND.productTagline,
    clientName: BRAND.clientName,
    subjectRole: BRAND.subjectRole,
    demoBy: BRAND.demoBy,
    demoByUnit: BRAND.demoByUnit,
    footerBrand: BRAND.footerBrand,
    footerNote: BRAND.footerNote,
    answerAssurance: BRAND.answerAssurance,
    builderName: BRAND.builder.name,
    factory: BRAND.factory,
  };
  for (const el of root.querySelectorAll('[data-brand]')) {
    const v = map[el.dataset.brand];
    if (v) el.textContent = v;
  }
  for (const el of root.querySelectorAll('[data-brand-href]')) {
    const target = el.dataset.brandHref === 'builder' ? BRAND.builder.url : BRAND.subject.url;
    if (target) el.setAttribute('href', target);
  }
}
