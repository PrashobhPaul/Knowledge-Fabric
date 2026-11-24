// ============================================================================
// NLG — turning selected evidence into a reply
// ============================================================================
//
// The summariser decides WHICH sentences answer the question. This module
// decides HOW they are said back to the person who asked.
//
// Three things make five retrieved sentences read as an answer rather than a
// search dump, none of which require a language model:
//
//   1. CLEANUP    — remove source furniture the reader should never see
//                   (section labels, repeated headings, "Tagged:" tails).
//   2. FRAMING    — open with a sentence that answers in the shape the question
//                   asked for, naming the subject and where the answer came from.
//   3. COHESION   — connect the supporting facts with discourse markers, so the
//                   reader is told how each one relates to the last.
//
// The evidence stays verbatim and stays cited. We choose the wrapper and the
// connective tissue, not the words of the source.

// ---------------------------------------------------------------------------
// 1. Cleanup — source furniture
// ---------------------------------------------------------------------------
const FURNITURE_WORDS =
  'Professional Summary|Professional Experience|Work Experience|Core Expertise|Core Competencies|' +
  'Technologies|Domains|Education|Contact|Languages|Key Projects|Achievements|Courses|Summary|Overview|' +
  'Introduction|About|Skills|Expertise|Services|Portfolio|Works|Section|Appendix|Note|Table|Figure';

// A furniture word is only a heading when the REAL sentence starts right after
// it — i.e. the next character is an uppercase letter.
const LEADING_FURNITURE = new RegExp(`^(?:(?:${FURNITURE_WORDS})\\b[\\s:.\\-]*)+(?=[A-Z])`, 'i');

// "1-4 ", "3.2.1 ", "01/2015 " at the start of a line
const LEADING_SECTION_NUM = /^(?:[A-Z]?\d+(?:[.\-/]\d+)*\s+){1,3}(?=[A-Z])/;

// Fused heading + body, e.g. "EducationM.Tech ..."
const FUSED_FURNITURE = new RegExp(`^(?:${FURNITURE_WORDS})(?=[A-Z])`);

// Tails that are metadata, not prose.
const TRAILING_TAGS = /\s*Tagged:\s.*$/i;

export function cleanSentence(text) {
  let t = String(text || '').trim();
  t = t.replace(FUSED_FURNITURE, '');
  t = t.replace(TRAILING_TAGS, '');

  for (let i = 0; i < 3; i++) {
    const before = t;
    t = t.replace(LEADING_SECTION_NUM, '');
    t = t.replace(LEADING_FURNITURE, '');
    if (t === before) break;
  }

  // "Education Education in..." — heading immediately restated by the body
  t = t.replace(/^(\w+)\s+\1\b/i, '$1');

  // Leading FAQ question echo: "What are his skills? His core strengths..." -> keep only the answer
  t = t.replace(/^[^.?!]{3,80}\?\s+(?=[A-Z])/, '');

  t = t.replace(/\s{2,}/g, ' ')
       .replace(/\s+([,.;:%)])/g, '$1')
       .replace(/\(\s+/g, '(')
       .trim();

  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ---------------------------------------------------------------------------
// 2. Framing — the opening line
// ---------------------------------------------------------------------------
const CANONICAL = {
  qualizeal: 'Qualizeal', 'tech mahindra': 'Tech Mahindra', yash: 'Yash Technologies', 'yash technologies': 'Yash Technologies',
  brane: 'Brane Enterprises', 'brane enterprises': 'Brane Enterprises', primera: 'Primera Medical Technologies',
  'primera medical': 'Primera Medical Technologies', tcs: 'TCS', 'tata consultancy services': 'TCS',
  amex: 'American Express', 'american express': 'American Express', microsoft: 'Microsoft', pwc: 'PwC',
  'southwest airlines': 'Southwest Airlines', 'srm university': 'SRM University', jntu: 'JNTU Hyderabad',
  rvonwheelz: 'RVonWheelz', 'soccer.ai': 'Soccer.AI', 'soccer ai': 'Soccer.AI', 'invest.iq': 'Invest.IQ', investiq: 'Invest.IQ',
  koode: 'Koode', 'knowledge fabric': 'Knowledge Fabric', 'pachaka lokam': 'Pachaka Lokam', iplbuzz: 'IPLBuzz',
  cogniflow: 'CogniFlow', profitpilot: 'ProfitPilot', validaite: 'ValidAIte', qmentisai: 'QMentisAI',
  langgraph: 'LangGraph', crewai: 'CrewAI', autogen: 'AutoGen', langchain: 'LangChain', aws: 'AWS', gcp: 'GCP',
  nlp: 'NLP', rag: 'RAG', mcp: 'MCP', a2a: 'A2A', genai: 'GenAI', 'generative ai': 'Generative AI', 'agentic ai': 'Agentic AI',
  bfsi: 'BFSI', hl7: 'HL7', fhir: 'FHIR', ros: 'ROS', 'the canvas of earth': 'The Canvas of Earth',
  'canvas of earth': 'The Canvas of Earth', healthcare: 'healthcare', clinical: 'clinical NLP', banking: 'banking',
  robotics: 'robotics', telecom: 'telecom', 'computer vision': 'computer vision', 'ai governance': 'AI governance',
  'multi-agent': 'multi-agent systems', 'fraud detection': 'fraud detection', 'credit scoring': 'credit scoring',
  'interview prep': 'interview preparation', 'corporate training': 'corporate training', spiti: 'Spiti Valley', 'spiti valley': 'Spiti Valley', 'key monastery': 'Key Monastery',
  'kee monastery': 'Key Monastery', 'microsoft ai tour': 'the Microsoft AI Tour', 'satya nadella': 'Satya Nadella',
  '.net': '.NET', openai: 'OpenAI', fastapi: 'FastAPI', pytorch: 'PyTorch', tensorflow: 'TensorFlow', 'hugging face': 'Hugging Face',
};
const GENERIC_FOCUS = new Set(['python', 'typescript', 'javascript', 'react', 'kotlin', 'supabase', 'docker', 'kubernetes', 'mlops']);

function pretty(term) {
  const key = String(term).toLowerCase();
  if (CANONICAL[key]) return CANONICAL[key];
  return key.replace(/\b\w/g, c => c.toUpperCase());
}

/** A readable subject for the opening line. One focus term reads as the subject;
 *  two coordinate ("Koode and Invest.IQ"); more than two are summarised. */
function subjectPhrase(analysis) {
  const f = (analysis.focus || []).filter(t => !GENERIC_FOCUS.has(t) || analysis.focus.length === 1);
  if (!f.length) return null;
  if (f.length === 1) return pretty(f[0]);
  if (f.length === 2) return `${pretty(f[0])} and ${pretty(f[1])}`;
  return `${pretty(f[0])}, ${pretty(f[1])} and more`;
}

// Openers are phrased as a reply to a person. Each intent gets wording that
// matches the shape of what was asked. The subject is Prashobh unless the
// question named something more specific.
const OPENERS = {
  CAREER:            s => `On ${s ? s + ' and ' : ''}Prashobh's career, the sources say`,
  SKILLS:            s => `Prashobh's skills${s ? ' around ' + s : ''}, as the resume and website list them`,
  PROJECTS:          s => `${s ? s : 'The projects Prashobh has built'}, as described across the website and GitHub`,
  EDUCATION:         s => `Prashobh's education${s ? ' at ' + s : ''}, per the profile and resume`,
  SERVICES:          s => `On ${s ? s : 'the services Prashobh offers'}, the website says`,
  CONTACT:           s => `Here is how to reach Prashobh`,
  YOUTUBE:           s => `From The Canvas of Earth${s && !/canvas/i.test(s) ? ', on ' + s : ''}`,
  CHANNEL:           s => `About The Canvas of Earth, Prashobh's YouTube channel`,
  POSTS:             s => `In Prashobh's own words on LinkedIn${s ? ', on ' + s : ''}`,
  EVENTS:            s => `On the events Prashobh has been part of${s ? ', including ' + s : ''}`,
  LANGUAGES:         s => `On the languages Prashobh speaks`,
  DOMAIN_EXPERIENCE: s => `Prashobh's experience${s ? ' in ' + s : ''}, drawn from the career record`,
  TEMPORAL:          s => `The dates on record${s ? ' for ' + s : ''} are`,
  METRICS:           s => `The numbers on record${s ? ' for ' + s : ''} are`,
  LOCATION:          s => `On where Prashobh is based`,
  COMPARISON:        s => `Comparing them, the sources state`,
  OPINION:           s => `Prashobh's view${s ? ' on ' + s : ''}, in his own words from the site`,
  WHO:               s => `In short, here is who Prashobh is`,
  DEFINITION:        s => `${s || 'This'} is described in the sources as`,
  GENERAL:           s => `Here is what the sources say about ${s || 'this'}`,
};

function buildOpener(analysis, sentences) {
  const subject = subjectPhrase(analysis);
  const fn = OPENERS[analysis.intent.name] || OPENERS.GENERAL;
  const srcs = new Set(sentences.map(s => s.chunk.source_type)).size;
  const docs = new Set(sentences.map(s => s.chunk.document_id)).size;
  const scope = srcs > 1 ? ` — drawn from ${srcs} different sources`
              : docs > 1 ? ` — drawn from ${docs} records` : '';
  const line = `${fn(subject)}${scope}:`;
  return line.charAt(0).toUpperCase() + line.slice(1);
}

// ---------------------------------------------------------------------------
// 3. Cohesion — discourse markers between supporting facts
// ---------------------------------------------------------------------------
const CONTINUE    = ['It adds that', 'The same record notes that', 'It also states that'];
const CORROBORATE = ['Separately,', 'Another source states that', 'Elsewhere,'];
const CROSS       = ['From a different source,', 'The GitHub side adds that', 'The website adds that', 'The resume adds that', 'The channel adds that'];
const CONTRAST    = ['However,', 'Note, though, that', 'That said,'];
const SPECIFY     = ['Specifically,', 'In more detail,', 'More precisely,'];

const NEGATION_RE = /\b(not|never|no |cannot|without|however|only|private|educational only|not financial advice)\b/i;

const SOURCE_MARKER = {
  github: 'The GitHub side adds that', website: 'The website adds that', linkedin: 'On LinkedIn he adds that',
  document: 'The resume adds that', youtube: 'The channel adds that', profile: 'The profile adds that',
};

function pickMarker(prev, curr, usedMarkers) {
  let pool;
  if (NEGATION_RE.test(curr.display) && !NEGATION_RE.test(prev.display)) pool = CONTRAST;
  else if (prev.chunk.source_type !== curr.chunk.source_type) {
    const m = SOURCE_MARKER[curr.chunk.source_type];
    pool = m ? [m, ...CROSS.filter(x => x !== m)] : CROSS;
  }
  else if (prev.chunk.document_id !== curr.chunk.document_id) pool = CORROBORATE;
  else if (curr.position > prev.position + 2) pool = SPECIFY;
  else pool = CONTINUE;

  const fresh = pool.filter(m => !usedMarkers.has(m));
  const marker = (fresh.length ? fresh : pool)[0];
  usedMarkers.add(marker);
  return marker;
}

// Every marker is followed by a lowercase continuation unless the next word is
// a proper noun or acronym.
const PROPER_NOUN_RE = /^(?:[A-Z]{2,}|(?:Prashobh|Qualizeal|Tech|Yash|Brane|Primera|Tata|TCS|Microsoft|SRM|JNTU|LangGraph|CrewAI|AutoGen|LangChain|Python|React|Supabase|Kotlin|Koode|Invest|IPLBuzz|RVonWheelz|Soccer|Pachaka|Knowledge|CogniFlow|ProfitPilot|ValidAIte|QMentisAI|The Canvas|Spiti|Tabo|Mumbai|Manali|Hyderabad|India|GitHub|YouTube|LinkedIn|Satya|AWS|GCP|NLP|BFSI|Agentic|Generative|GenAI|AI\b|[A-Z]\.)\b)/;

function decapitalise(text) {
  if (PROPER_NOUN_RE.test(text)) return text;
  if (/^I\b/.test(text)) return text;               // the pronoun, never "i"
  return text.charAt(0).toLowerCase() + text.slice(1);
}

// ---------------------------------------------------------------------------
// 4. Closing — what the answer does not cover
// ---------------------------------------------------------------------------
function buildClosing(analysis, confidence, summary) {
  if (!confidence) return null;

  if (confidence.percent < 30) {
    return `This is a weak match. The sources do not appear to contain a direct answer, ` +
           `so treat the passages above as related context rather than a settled answer.`;
  }
  if (confidence.signals && confidence.signals.sourceConsensus.value < 0.3) {
    return `All of this comes from a single record. Worth confirming against a second source before relying on it.`;
  }
  if (confidence.signals && confidence.signals.queryCoverage.value < 0.5) {
    return `Part of the question is not covered by the records found. Narrowing the wording may surface more.`;
  }
  if (summary && summary.rejected > 12) {
    return `Passages that merely repeated the wording of the question were set aside in favour of those that answer it.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------
export function composeResponse(analysis, sentences, citations, confidence, summary) {
  if (!sentences.length) return { html: '', plain: '', opener: '', closing: null };

  const citeNum = new Map(citations.map(c => [c.chunkIdx, c.num]));
  const opener = buildOpener(analysis, sentences);
  const usedMarkers = new Set();

  const parts = [];
  const plainParts = [];

  sentences.forEach((s, i) => {
    const clean = cleanSentence(s.display);
    if (!clean) return;
    const num = citeNum.get(s.chunkIdx) || 1;

    let body;
    if (i === 0) {
      body = clean;
    } else {
      const marker = pickMarker(sentences[i - 1], s, usedMarkers);
      const joined = decapitalise(clean);
      body = `<span class="answer-marker">${marker}</span> ${joined}`;
      plainParts.push(`${marker} ${joined}`);
    }
    if (i === 0) plainParts.push(clean);

    parts.push(
      `<span class="answer-sent">${body}` +
      `<sup class="cite-ref" data-cite="${num}" title="Source ${num}">[${num}]</sup></span>`
    );
  });

  const closing = buildClosing(analysis, confidence, summary);

  const html =
    `<p class="answer-opener">${escapeHtml(opener)}</p>` +
    `<p class="answer-body">${parts.join(' ')}</p>` +
    (closing ? `<p class="answer-closing">${escapeHtml(closing)}</p>` : '');

  return { html, plain: `${opener} ${plainParts.join(' ')}`, opener, closing };
}

/** The "no answer" reply, phrased as a helpful response rather than an error. */
export function composeNoAnswer(analysis, nearestDoc, rejected) {
  const subject = subjectPhrase(analysis);
  const lead = subject
    ? `I could not find a passage in the sources that answers this about ${escapeHtml(subject)}.`
    : `I could not find a passage in the sources that answers this.`;

  const detail = rejected > 0
    ? `${rejected} passage${rejected === 1 ? '' : 's'} matched the wording of the question but ` +
      `did not contain ${escapeHtml(analysis.intent.wants || 'an answer')} — so they were set aside rather than ` +
      `presented as an answer.`
    : `Nothing in the indexed sources covers this topic.`;

  const next = nearestDoc
    ? `The closest related record is <strong>${escapeHtml(nearestDoc)}</strong>.`
    : '';

  return `<p class="answer-none">${lead}</p>` +
         `<p class="answer-none-detail">${detail} ${next}</p>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
