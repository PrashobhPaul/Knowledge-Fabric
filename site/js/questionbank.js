import { tokenize, synonymTokens } from './search.js?v=5';
// ============================================================================
// Question bank — the tested set
// ============================================================================
//
// Every question here is RUN against the built corpus by tests/integration.test.mjs
// and must produce a cited answer. That is the honest way to offer suggestions:
// choose the questions the sources genuinely answer, rather than inflating a
// score for questions they do not.
//
// Nothing here is cached or pre-written. Asking one of these runs the same
// retrieval, summarisation and confidence path as any typed question — so a
// visitor who goes off-script gets a number computed the identical way.
//
// Grouped by intent so the set demonstrably exercises the NLU router.

export const QUESTION_BANK = [
  // --- Who ---
  'Who is Prashobh Paul?',
  'What does Prashobh do?',
  'Give me a short bio of Prashobh.',

  // --- Career ---
  'Where does Prashobh work currently?',
  'What is Prashobh’s current role at Qualizeal?',
  'What did Prashobh do at Tech Mahindra?',
  'What did Prashobh work on at Primera Medical Technologies?',
  'What was Prashobh’s role at Yash Technologies?',
  'What did Prashobh build at Brane Enterprises?',
  'What did Prashobh do at TCS?',
  'List all the companies Prashobh has worked at.',

  // --- Domain experience ---
  'What is Prashobh’s experience in healthcare NLP?',
  'Has Prashobh worked in BFSI or banking?',
  'What robotics work has Prashobh done?',
  'What is Prashobh’s experience with agentic AI?',
  'What is Prashobh’s experience with AI governance?',

  // --- Skills ---
  'What are Prashobh’s core skills?',
  'Which agent frameworks does Prashobh use?',
  'What is Prashobh’s tech stack?',
  'Which cloud platforms does Prashobh work with?',
  'Which programming languages does Prashobh use?',

  // --- Projects ---
  'What projects has Prashobh built?',
  'What is Koode?',
  'What is Invest.IQ?',
  'What is RVonWheelz?',
  'What is Pachaka Lokam?',
  'What is IPLBuzz?',
  'What is Soccer.AI?',
  'What is the Knowledge Fabric project?',
  'What is ValidAIte?',
  'Which of Prashobh’s projects are built with Supabase?',
  'Which projects are available as Android apps?',

  // --- Education ---
  'Where did Prashobh study?',
  'What degree does Prashobh have?',

  // --- Services ---
  'What services does Prashobh offer?',
  'Does Prashobh do corporate training?',
  'Can I hire Prashobh for consulting?',
  'Does Prashobh offer interview preparation?',

  // --- Contact & location ---
  'How can I contact Prashobh?',
  'Where is Prashobh based?',

  // --- YouTube ---
  'What is The Canvas of Earth?',
  'What videos has Prashobh made about Spiti Valley?',
  'Which videos cover Tabo Monastery?',
  'What did Prashobh film at the Microsoft AI Tour in Mumbai?',
  'Which videos are about Manali?',
  'What is the Key Monastery video about?',
  'How many subscribers does The Canvas of Earth have?',

  // --- LinkedIn posts & events ---
  'What has Prashobh posted about on LinkedIn?',
  'What does Prashobh say about knowledge factories and ontologies?',
  'What events has Prashobh attended?',
  'Did Prashobh attend the Microsoft AI Tour?',

  // --- Dates & numbers ---
  'When did Prashobh join Qualizeal?',
  'How many years of experience does Prashobh have?',
  'When did Prashobh graduate?',

  // --- Opinions & explainers (his own words on the site) ---
  'How does Prashobh choose an architecture?',
  'What does Prashobh think of LangChain?',
  'What is agentic AI according to Prashobh?',
  'Is MCP better than A2A?',
  'What languages does Prashobh speak?',
];

const STOP = new Set([
  'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'into', 'onto',
  'and', 'or', 'but', 'if', 'as', 'so', 'than', 'then',
  'this', 'that', 'these', 'those', 'there', 'here',
  'it', 'its', 'do', 'does', 'did', 'done', 'can', 'could', 'would', 'should',
  'who', 'whom', 'what', 'when', 'where', 'why', 'how', 'which', 'whose',
  'i', 'me', 'my', 'you', 'your', 'we', 'our', 'they', 'their', 'he', 'his', 'him',
  'about', 'need', 'needs', 'needed', 'use', 'used', 'using', 'get', 'got',
  'much', 'many', 'any', 'some', 'will', 'shall', 'may', 'might', 'must', 'have', 'has', 'had',
  'prashobh', 'paul', 'prashobhs', 's',
]);

// Light two-phase stemmer (plural, then verb) so singular/plural and simple
// verb forms collide during matching without mangling non-plurals.
function stem(t) {
  if (t.length <= 3) return t;
  if (t.endsWith('ies') && t.length > 4) t = t.slice(0, -3) + 'y';
  else if (/(ches|shes|xes|zes|sses)$/.test(t)) t = t.slice(0, -2);
  else if (t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.endsWith('ing') && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith('ed') && t.length > 4) t = t.slice(0, -2);
  return t;
}

function contentSet(text, vocab) {
  const toks = tokenize(text).filter(t => !STOP.has(t));
  const set = new Set();
  for (const t of toks) {
    set.add(stem(t));
    if (vocab) for (const s of synonymTokens(t, vocab)) set.add(stem(s));
  }
  return set;
}

function setSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / Math.sqrt(a.size * b.size);
}

let _bankSets = null;
let _bankVocab = null;
function ensureBankSets(vocab) {
  if (_bankSets && _bankVocab === vocab) return;
  _bankVocab = vocab;
  _bankSets = QUESTION_BANK.map(q => contentSet(q, vocab));
}

// Find the closest bank question to `query`. Returns { question, score, index }
// or null. `score` is a 0..1 similarity; the caller decides the threshold.
export function matchQuestionBank(query, opts = {}) {
  const vocab = opts.vocab || null;
  ensureBankSets(vocab);
  const qSet = contentSet(query, vocab);
  if (qSet.size === 0) return null;
  let best = -1, bestScore = 0;
  for (let i = 0; i < _bankSets.length; i++) {
    const s = setSimilarity(qSet, _bankSets[i]);
    if (s > bestScore) { bestScore = s; best = i; }
  }
  if (best < 0) return null;
  return { question: QUESTION_BANK[best], score: bestScore, index: best };
}
