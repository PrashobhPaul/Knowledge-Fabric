// ============================================================================
// Canon — the curated answers, in the owner's own words, with their proofs
// ============================================================================
//
// knowledge_sources/profile/canon.yaml holds the major questions answered the
// way the owner answers them. The build resolves each evidence link to the
// records that prove it, and ships `index.canon`. At answer time a question that
// matches a canon entry gets the canon answer verbatim, cited with those proof
// records — and the retrieval result stays underneath as corroboration.

import { tokenize } from './search.js?v=5';

const STOP = new Set(['the', 'is', 'are', 'was', 'were', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by',
  'and', 'or', 'do', 'does', 'did', 'what', 'which', 'how', 'who', 'where', 'when', 'tell', 'me', 'about', 'i', 'you',
  'your', 'his', 'he', 'him', 'prashobh', 'paul', 'prashobhs', 's', 'can', 'could', 'would', 'should', 'has', 'have', 'had',
  'any', 'some', 'all', 'please', 'give', 'show',
  // function words and conversational filler: never evidence of a topic
  'may', 'might', 'must', 'shall', 'will', 'many', 'much', 'more', 'most', 'very', 'really', 'just', 'also', 'too', 'so',
  'know', 'tell', 'say', 'said', 'like', 'kind', 'sort', 'type', 'thing', 'things', 'stuff', 'ever', 'still', 'yet',
  'till', 'until', 'now', 'currently', 'today', 'there', 'here', 'this', 'that', 'these', 'those', 'it', 'its', 'my', 'me',
  'we', 'our', 'us', 'they', 'them', 'their', 'u', 'ur', 'yours', 'yourself', 'im', 'whats', 'wats', 'hows', 'whos',
  'get', 'got', 'go', 'went', 'make', 'made', 'use', 'used', 'using', 'want', 'wanted', 'need', 'one', 'ones',
  'been', 'being', 'be', 'am', 'if', 'then', 'than', 'as', 'from', 'into', 'out', 'up', 'down', 'over', 'not', 'no',
  'yes', 'ok', 'okay', 'hi', 'hello', 'hey', 'mr', 'sir', 'dear', 'lot', 'lots', 'little', 'bit', 'good', 'best',
  'take', 'stand', 'attend', 'attended', 'attending', 'lines', 'line', 'sentence', 'sentences', 'paragraph', 'bullet', 'bullets', 'describe', 'explain', 'elaborate', 'define', 'brief', 'briefly', 'few', 'words', 'word', 'short', 'detail', 'details', 'detailed', 'different', 'difference', 'differ', 'compare', 'comparison', 'versus', 'vs', 'better', 'between', 'similar', 'anything', 'something', 'everything', 'anyone', 'someone', 'buddy', 'bro', 'dude', 'mate', 'man', 'pls', 'plz', 'kindly', 'actually', 'basically', 'exactly', 'quickly', 'briefly', 'happened', 'happen']);
function stem(t) {
  if (t.length <= 3) return t;
  if (t.endsWith('ies') && t.length > 4) t = t.slice(0, -3) + 'y';
  else if (/(ches|shes|xes|zes|sses)$/.test(t)) t = t.slice(0, -2);
  else if (t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.endsWith('ing') && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith('ed') && t.length > 4) t = t.slice(0, -2);
  return t;
}
// Visitor words → the words the canon uses. Applied to the question only.
const SYNONYMS = {
  kids: 'children', kid: 'child', spouse: 'wife', husband: 'wife', dad: 'father', mom: 'mother', mum: 'mother',
  job: 'work', employer: 'company', firm: 'company', organisation: 'company', organization: 'company', org: 'company',
  hometown: 'from', native: 'from', birthplace: 'born', bday: 'birthday', age: 'born',
  hobby: 'hobbies', pastime: 'hobbies', teach: 'training', teaches: 'training', teaching: 'training', tutorials: 'training',
  resume: 'career', cv: 'career', qualifications: 'education', qualification: 'education', degree: 'education',
  vlog: 'youtube', vlogs: 'youtube', video: 'youtube', channel: 'youtube', films: 'videos',
  painting: 'art', paintings: 'art', drawings: 'art', drawing: 'art', sketch: 'art',
  motivates: 'drives', motivation: 'drives', inspires: 'inspiration', mentor: 'mentors', guru: 'mentors',
  gear: 'camera', equipment: 'camera', apps: 'projects', app: 'project', repo: 'github', repos: 'github', code: 'github',
  favourite: 'favourite', favorite: 'favourite', hardest: 'hardest', toughest: 'hardest', difficult: 'hardest',
};
const norm = (t) => SYNONYMS[t] || t;
Object.assign(SYNONYMS, { masters: 'education', master: 'education', mtech: 'education', btech: 'education', bachelors: 'education',
  graduate: 'education', graduated: 'education', university: 'education', college: 'education', phd: 'education',
  married: 'wife', marriage: 'wife', children: 'children', sons: 'son', daughters: 'daughter',
  apk: 'android', apks: 'android', mobile: 'android', phone: 'android', smartphone: 'android',
  football: 'soccer', fifa: 'soccer', carpool: 'pooling', carpooling: 'pooling', rideshare: 'pooling',
  meals: 'meal', recipes: 'meal', recipe: 'meal', cooking: 'meal', cook: 'meal', kitchen: 'meal',
  diagrams: 'diagram', architectures: 'architecture', poet: 'poems', poetry: 'poems', poems: 'poems',
  role: 'role', models: 'model', freelancing: 'freelance', freelancer: 'freelance', hire: 'hire', hiring: 'hire',
  salary: 'salary', crash: 'down', crashes: 'down', crashed: 'down', outage: 'down', outages: 'down' });
// "B.Tech" and "M.Tech" would tokenise to a bare "tech" (and match Tech Mahindra).
const pre = (q) => String(q).replace(/\b([bm])\.\s?tech\b/gi, '$1tech');
// Texting shorthand → words ("wher do u work" → "where do you work").
const SHORT = [[/\bu\b/gi, 'you'], [/\bur\b/gi, 'your'], [/\br\b/gi, 'are'], [/\bwher\b/gi, 'where'], [/\b(wat|wht|wot)\b/gi, 'what'],
  [/\babt\b/gi, 'about'], [/\bhw\b/gi, 'how'], [/\btel\b/gi, 'tell'], [/\b(pls|plz)\b/gi, 'please'], [/\bn\b/gi, 'and'], [/\bwanna\b/gi, 'want to']];
export const casual = (q) => SHORT.reduce((t, [re, w]) => t.replace(re, w), String(q));
const setOf = (q) => new Set(tokenize(pre(q)).filter(t => !STOP.has(t)).map(t => stem(norm(t))));

// One-edit typo tolerance for words of five letters or more ("How may kids" → "many").
function close(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length === b.length && a[i] === b[j + 1] && a[i + 1] === b[j]) { i += 2; j += 2; continue; }
    if (a.length > b.length) i++; else if (a.length < b.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
function sim(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) { if (b.has(t)) { inter++; continue; } for (const u of b) if (close(t, u)) { inter++; break; } }
  return inter / Math.sqrt(a.size * b.size);
}
/** Keyword hits: how many of an entry's hand-listed cue words/phrases the question contains. */
function keywordHits(question, entry) {
  const q = ' ' + String(question).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const toks = tokenize(q).map(t => stem(norm(t)));
  let hits = 0;
  for (const k of entry.keywords || []) {
    const kk = String(k).toLowerCase();
    if (kk.includes(' ')) { if (q.includes(' ' + kk + ' ')) hits++; continue; }
    const ks = stem(norm(kk));
    if (toks.some(t => t === ks || close(t, ks))) hits++;
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Matching model: every entry is a bag of distinctive stems (its question
// variants + its cue keywords) and a set of cue phrases. A question's words are
// weighted by how distinctive they are across all entries (IDF), so "Koode"
// outweighs "app", and words no entry knows ("capital", "France") pull the
// score down, which is how off-topic questions fall through to "no answer".
// ---------------------------------------------------------------------------
const MODEL_CACHE = new WeakMap();
const A_WEIGHT = 0.6;          // a word found only in the answer text counts at 60%
function model(canon) {
  let m = MODEL_CACHE.get(canon);
  if (m) return m;
  const entries = canon.map(e => {
    const qbag = new Set();
    for (const v of e.questions || []) for (const t of setOf(v)) qbag.add(t);
    const phrases = [];
    for (const k of e.keywords || []) {
      const kk = String(k).toLowerCase().trim();
      if (kk.includes(' ')) phrases.push(kk);
      for (const t of setOf(kk)) qbag.add(t);   // a cue phrase's words are topic vocabulary too
    }
    const abag = new Set([...setOf(e.answer || '')].filter(t => !qbag.has(t)));
    return { e, qbag, abag, phrases, variants: (e.questions || []).map(v => setOf(v)) };
  });
  const df = new Map(), dfQ = new Map();
  for (const x of entries) {
    for (const t of new Set([...x.qbag, ...x.abag])) df.set(t, (df.get(t) || 0) + 1);
    for (const t of x.qbag) dfQ.set(t, (dfQ.get(t) || 0) + 1);
  }
  m = { entries, df, dfQ, N: entries.length, vocab: [...df.keys()] };
  MODEL_CACHE.set(canon, m);
  return m;
}
const normQ = (s) => ' ' + String(s).toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}\s.]/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
const ABOUT_HIM = /\b(you|your|yours|yourself|u|ur|prashobh|paul|he|his|him|himself)\b/i;
const IMPERATIVE = /^\s*(please\s+)?(write|generate|create|compose|translate|calculate|solve|draw|code|summari[sz]e|make me|give me a)\b/i;
// Errands asked of the twin itself ("Can you book me a flight?"): a task, never a question about him.
const TASK = /^\s*(please\s+)?((can|could|will|would)\s+(you|u)\s+(please\s+)?)?(book|order|buy|reserve|schedule|remind|send me|send|call me|email me|text me|play|translate|calculate|solve|generate|compose|summari[sz]e|write|draft|proofread|review my|edit my|fix my|draw me|tell me a joke|sing)\b/i;
const COMPARE = /\b(compare|comparison|compared|versus|vs|difference|differences|differ|different|similar|similarities|better than|which is better)\b/i;
const VIDEO_LIST = /\b(which|what|list|show|find|any)\b.*\b(videos?|vlogs?|episodes?)\b/i;

// Proper names (projects, people, places, products) are read from the answers
// themselves: capitalised words that do not start a sentence ("Koode",
// "Chandratal", "Roshy", "Kotlin"). A question naming one is about that thing.
function entityVocab(m) {
  if (m.entityVocab) return m.entityVocab;
  const ent = new Set();
  const GENERIC = new Set(['i', 'ai', 'my', 'the', 'and', 'yes', 'no']);
  for (const x of m.entries) {
    const texts = [x.e.answer || '', ...(x.e.questions || [])];
    for (const t of texts) {
      for (const mm of String(t).matchAll(/(?<=[a-z0-9,;:)] )([A-Z][\p{L}0-9.'’-]*)/gu)) {
        for (const w of setOf(mm[1])) if (!GENERIC.has(w) && w.length >= 3) ent.add(w);
      }
    }
  }
  // A word also used in lower case ("tech stack", "world") is a common word, not a name.
  for (const x of m.entries) {
    for (const t of [x.e.answer || '', ...(x.e.questions || [])]) {
      for (const mm of String(t).matchAll(/(?:^|[\s(])([a-z][\p{L}0-9'’-]*)/gu)) for (const w of setOf(mm[1])) ent.delete(w);
    }
  }
  m.entityVocab = ent;
  return ent;
}

function scoreAll(question, canon) {
  const m = model(canon);
  const ENT = entityVocab(m);
  const qs = setOf(question);
  const qn = normQ(question);
  // Unknown words count, but less than the rarest known word: they signal an
  // off-topic question without drowning a clear topical match.
  // A word no answer knows weighs as much as the rarest known word: a question
  // mostly about something unknown ("relocation") is not about him.
  const idf = (t) => Math.log(1 + m.N / (m.df.get(t) || 1));
  const resolved = [...qs].map(t => m.df.has(t) ? t : (m.vocab.find(u => close(t, u)) || t));
  const total = resolved.reduce((a, t) => a + idf(t), 0);
  const entities = resolved.filter(t => ENT.has(t));
  const unknown = resolved.some(t => !m.df.has(t));   // a word none of his answers use
  // Every named thing in the question must be known to the answer; if no entry
  // knows them all, knowing one is enough.
  const anyKnowsAll = entities.length > 1 && m.entries.some(x => entities.every(t => x.qbag.has(t) || x.abag.has(t)));
  const someHomeAll = entities.length > 0 && m.entries.some(x => entities.every(t => x.qbag.has(t)));
  return m.entries.map(x => {
    const knows = (t) => x.qbag.has(t) || x.abag.has(t);
    let matched = 0;
    for (const t of resolved) {
      if (x.qbag.has(t)) matched += idf(t);
      else if (x.abag.has(t)) matched += A_WEIGHT * idf(t);
    }
    const cov = total ? matched / total : 0;
    let s = 0;
    for (const v of x.variants) s = Math.max(s, sim(qs, v));
    const p = x.phrases.filter(ph => qn.includes(' ' + ph + ' ') || qn.includes(' ' + ph)).length;
    const knowsEntity = !entities.length || (anyKnowsAll ? entities.every(knows) : entities.some(knows));
    const home = entities.filter(t => x.qbag.has(t)).length;          // this entry is "about" the named thing
    const namedEntity = entities.some(knows);
    // Either the entry is about the named thing, or a cue phrase fired, or it
    // covers at least half of what the question asks.
    // Either the entry is about the named things, a cue phrase fired, it knows
    // every named thing asked about, or it covers most of the question.
    const ok = knowsEntity && (home > 0 || p > 0 || cov >= 0.6 || (entities.length > 0 && entities.every(knows)));
    const raw = 0.62 * cov + 0.22 * s + 0.16 * Math.min(p, 2) + 0.15 * Math.min(home, 2);
    const score = ok ? (someHomeAll && home === 0 ? 0.7 * raw : raw) : 0;
    return { id: x.e.id, entry: x.e, score, cov, s, p, rare: namedEntity, home, unknown };
  }).sort((a, b) => (b.score - a.score) || (b.s - a.s));
}

// Exact-match form: punctuation-free, and the same whether asked of "you" or "Prashobh".
const normV = (s) => String(s).toLowerCase().replace(/[’']/g, '')
  .replace(/\bprashobh paul\b/g, 'prashobh').replace(/\bprashobhs\b/g, 'your')
  .replace(/\b(does|is|has|was) prashobh\b/g, (m, v) => ({ does: 'do', is: 'are', has: 'have', was: 'were' }[v]) + ' you')
  .replace(/\bprashobh\b/g, 'you').replace(/\bhis\b/g, 'your').replace(/\b(he|him)\b/g, 'you')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** One question → its best canon entry, or null. */
function matchOne(question, canon, threshold) {
  const qn = normV(question);
  for (const e of canon) if ((e.questions || []).some(v => normV(v) === qn)) return { entry: e, score: 1 };
  const aboutHim = ABOUT_HIM.test(question);
  if (!aboutHim && IMPERATIVE.test(question)) return null;     // a task, not a question about him
  const ranked = scoreAll(question, canon);
  const top = ranked[0];
  if (!top || top.score < threshold) return null;
  // Not about him: it must be mostly in his vocabulary, or name one of his things
  // without bringing in words his answers never use ("Who won the 2022 World Cup?").
  // ...or name one of my own products outright ("Is Dhinasuthra a calendar?"): a
  // question about my product is about me, even in words my answers never use.
  if (!aboutHim && !(top.cov >= 0.75 || (top.rare && !top.unknown) || namedEntries(question, model(canon)).includes(top.entry))) return null;
  return { entry: top.entry, score: Math.min(1, top.score) };
}

function entitiesOf(question, m) {
  const ENT = entityVocab(m);
  return [...setOf(question)].map(t => m.df.has(t) ? t : (m.vocab.find(u => close(t, u)) || t)).filter(t => ENT.has(t));
}
// Each entry's own subject, from its "What is X?" question: "Soccer.AI", "Koode".
const squash = (t) => String(t).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function entryNames(m) {
  if (m.names) return m.names;
  m.names = m.entries.map(x => (x.e.questions || [])
    .map(v => (String(v).match(/^(?:[Ww]hat is|[Ww]hat's|[Ww]hat are|[Ww]hat does)\s+(?:[Tt]he\s+)?([A-Z][^?]{2,40}?)(?:\s+project|\s+do|\s+mean)?\?*$/) || [])[1])
    .filter(n => n && n.split(/\s+/).length <= 4 && !/\b(you|your|his)\b/i.test(n)).map(squash).filter(n => n.length >= 5));
  return m.names;
}
function rawName(m, entry) {
  const x = m.entries.find(y => y.e === entry);
  for (const v of (x ? x.e.questions : []) || []) {
    const n = (String(v).match(/^(?:[Ww]hat is|[Ww]hat's|[Ww]hat does)\s+(?:[Tt]he\s+)?([A-Z][^?]{2,40}?)(?:\s+project|\s+do|\s+mean)?\?*$/) || [])[1];
    if (n) return n;
  }
  return '';
}
const entityWordsOf = (q, m) => entitiesOf(q, m);
function namedEntries(question, m) {
  const q = squash(question), names = entryNames(m), hits = [];
  m.entries.forEach((x, i) => {
    const at = Math.min(...names[i].map(n => { const k = q.indexOf(n); return k < 0 ? Infinity : k; }));
    if (at < Infinity) hits.push({ e: x.e, at });
  });
  return hits.sort((a, b) => a.at - b.at).map(h => h.e);
}
const knowsWord = (m, entry, t) => { const x = m.entries.find(y => y.e === entry); return !!x && (x.qbag.has(t) || x.abag.has(t)); };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ym = (v) => { const [y, mo] = String(v || '').split('-'); return y ? (mo ? `${MONTHS[Number(mo) - 1]} ${y}` : y) : ''; };
const listOf = (xs) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const orgName = (r) => r.organization + (r.short_name ? ` (${r.short_name})` : '');
const city = (r) => String(r.location || '').split(',')[0].trim();

/**
 * "Which company did you join after TCS?" / "What did you do before Tech Mahindra?":
 * answered from the ordered career in profile.yaml, cited by the role record.
 */
export function matchTimeline(question, timeline, canon = []) {
  if (!Array.isArray(timeline) || timeline.length < 2) return null;
  for (const [i, r] of timeline.entries()) {
    for (const a of r.aliases || []) {
      const re = new RegExp(`\\b(after|before|prior to|following)\\s+(?:(?:you|i)\\s+)?(?:left|leaving|quit|quitting|joined|joining|working at|worked at|your time at|my time at|at|the)?\\s*${escRe(a)}\\b`, 'i');
      const mm = question.match(re);
      if (!mm) continue;
      // A curated answer that owns this exact phrase ("before qualizeal") says it better.
      const phrase = `${mm[1].toLowerCase()} ${a}`;
      if ((canon || []).some(e => (e.keywords || []).some(k => String(k).toLowerCase() === phrase))) return null;
      const after = /^(after|following)$/i.test(mm[1]);
      const x = r.short_name || r.organization;
      let text, target;
      if (after) {
        if (i === timeline.length - 1) { target = r; text = `${x} is where I am now: I joined in ${ym(r.start)} as ${r.role}.`; }
        else {
          target = timeline[i + 1];
          const rest = timeline.slice(i + 2);
          text = `After ${x} I joined ${orgName(target)} in ${city(target)} as ${target.role}, from ${ym(target.start)} to ${target.end ? ym(target.end) : 'now'}.`
            + (rest.length ? ` After that came ${listOf(rest.map(t => t.organization))}${rest[rest.length - 1].end ? '' : ', where I am now'}.` : '');
        }
      } else {
        if (i === 0) { target = r; text = `${x} was my first job: I started there in ${ym(r.start)} as ${r.role}, in ${city(r)}.`; }
        else {
          target = timeline[i - 1];
          const rest = timeline.slice(0, i - 1).reverse();
          text = `Right before ${x} I was ${target.role} at ${orgName(target)}, from ${ym(target.start)} to ${ym(target.end)}.`
            + (rest.length ? ` Before that: ${listOf(rest.map(t => t.organization))}, where I started my career.` : '');
        }
      }
      const evidence = [{ url: `profile:roles/${target.organization}`, source: 'resume', why: `${target.role}, ${ym(target.start)} to ${target.end ? ym(target.end) : 'now'}`, chunk_ids: target.chunk_ids || [] }];
      return { entry: { id: 'timeline', answer: text, evidence, questions: [] }, score: 0.9 };
    }
  }
  return null;
}

/** "Where do you work and how many kids do you have?" → its separate questions. */
export function splitIntents(question) {
  return String(question)
    .split(/\?+\s*|;\s*|,?\s+(?:and|also|plus|&)\s+(?=(?:what|where|when|who|whom|how|which|why|do|does|did|is|are|was|were|can|could|will|tell|have|has|any)\b)/i)
    .map(s => s.trim()).filter(s => tokenize(s).length >= 2 || contentWords(s).length > 0);
}

/** Several curated answers as one reply, in the order asked. */
function composite(matches, missed = [], compare = false) {
  const entries = [];
  for (const r of matches) if (!entries.includes(r.entry)) entries.push(r.entry);
  if (entries.length === 1 && !missed.length) return matches[0];
  return {
    entry: { id: entries.map(e => e.id).join('+'), answer: entries.map(e => e.answer).join(' '),
             evidence: entries.flatMap(e => e.evidence || []), questions: [], parts: entries },
    score: Math.min(...matches.map(r => r.score)), parts: entries, missed, compare,
  };
}

/**
 * Best canon answer for a question, or null. A question that asks several
 * things gets each answer I have on record (and says which part I do not); a
 * question comparing two of my things gets both, side by side.
 */
export function matchCanon(question, canon, { threshold = 0.3, timeline = null } = {}) {
  if (!Array.isArray(canon) || !canon.length) return null;
  question = casual(question);
  const qn = normV(question);
  for (const e of canon) if ((e.questions || []).some(v => normV(v) === qn)) return { entry: e, score: 1 };
  if (isImperativeTask(question)) return null;
  const m = model(canon);
  const ents = entitiesOf(question, m);
  // "Which videos are about Manali?": the videos themselves (retrieval) answer that.
  if (VIDEO_LIST.test(question) && ents.length && !ents.some(t => m.entries.some(x => x.qbag.has(t)))) return null;
  const tl = matchTimeline(question, timeline, canon);
  if (tl) return tl;

  const parts = splitIntents(question);
  if (parts.length >= 2 && parts.length <= 4) {
    const him = ABOUT_HIM.test(question);
    const firstEnts = entitiesOf(parts[0], m);
    const got = [], missed = [];
    for (const p of parts) {
      // carry the person ("and what are his hobbies") and the thing ("and how does it work")
      const pronoun = /\b(it|its|their|they|them|those|these|that|this|there)\b/i.test(p) && !entitiesOf(p, m).length;
      const topic = firstEnts.length ? firstEnts.join(' ') : (pronoun && p !== parts[0] ? contentWords(parts[0]).join(' ') : '');
      const carried = (him && !ABOUT_HIM.test(p) ? 'your ' : '') + p + (entitiesOf(p, m).length ? '' : ' ' + topic);
      const r = matchOne(carried, canon, threshold);
      if (r) got.push(r);
      else if ((scoreAll(p, canon)[0] || {}).unknown) missed.push(p);
    }
    const ids = new Set(got.map(r => r.entry.id));
    if (ids.size >= 2 || (ids.size === 1 && missed.length)) return composite(got, missed);
  } else {
    // "Tell me about Spiti and your YouTube channel": topics joined by "and" or commas.
    // Only when every piece is clearly one of my answers.
    const him = ABOUT_HIM.test(question);
    const frags = question.replace(/[?!.]+\s*$/, '').split(/\s*,\s*(?:and\s+)?|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    if (frags.length >= 2 && frags.length <= 4 && frags.every(f => contentWords(f).length)) {
      const whole = matchOne(question, canon, threshold);
      if (whole && whole.score >= 0.9) return whole;    // "difference between pre-training, fine-tuning and RAG" is one question
      const got = frags.map(f => matchOne((him && !ABOUT_HIM.test(f) ? 'your ' : '') + f, canon, 0.6));   // every piece must stand on its own
      if (got.every(Boolean) && new Set(got.map(r => r.entry.id)).size >= 2) {
        // "your favourite poet and artist": one answer whose topic covers every piece says it in one.
        const single = matchOne(question, canon, threshold);
        const qb = single ? m.entries.find(x => x.e === single.entry).qbag : null;
        if (qb && frags.every(f => [...setOf(f)].every(t => qb.has(t)))) return single;
        return composite(got);
      }
    }
  }

  // Two of my things compared by name ("Invest.IQ vs Soccer.AI", "Koode or Pachaka Lokam?").
  if (COMPARE.test(question)) {
    const named = namedEntries(question, m);
    if (named.length >= 2) return composite(named.map(e => ({ entry: e, score: 0.9 })), [], true);
  }
  // Two or more of my named things, compared or asked about together.
  if (ents.length >= 2) {
    const ranked = scoreAll(question, canon);
    const homes = [];
    const qb = (r) => m.entries.find(x => x.e === r.entry).qbag;
    for (const t of ents) {
      const others = (r) => ents.filter(u => u !== t && qb(r).has(u)).length;
      const best = ranked.filter(r => qb(r).has(t)).sort((a, b) => (others(a) - others(b)) || (b.score - a.score))[0];
      if (!best) { homes.length = 0; break; }
      if (!homes.some(h => h.entry === best.entry)) homes.push({ entry: best.entry, score: Math.max(threshold, Math.min(1, best.score)) });
    }
    if (homes.length >= 2) {
      const compare = COMPARE.test(question);
      const single = compare ? null : matchOne(question, canon, threshold);
      if (compare || !single || !ents.every(t => knowsWord(m, single.entry, t))) return composite(homes, [], compare);
    }
  }
  return matchOne(question, canon, threshold);
}

export function isImperativeTask(question) { question = casual(question); return TASK.test(question) || (!ABOUT_HIM.test(question) && IMPERATIVE.test(question)); }

// ---------------------------------------------------------------------------
// Conversation: greetings and introductions before the question, small talk on
// its own, and follow-ups that say "it" about the previous question's subject.
// ---------------------------------------------------------------------------
const GREET = /^(hi+|hello|helo|hey|namaste|namaskar|good (morning|afternoon|evening)|greetings|yo)\b[\s,!.]*((prashobh|paul|sir|there|buddy|friend|all|everyone)\b[\s,!.]*)?/i;
const INTRO = /^(i am|i'm|im|my name is|this is)\s+[^.?!]{1,60}[.!]\s*/i;
/** The question itself, without "Hi, I'm Rahul." in front of it. */
// Conversational wrappers around the real question ("Quick question:", "Can you tell me…").
const PREAMBLE = /^(quick question|just curious|curious|one more (thing|question)|by the way|btw|also|ok(ay)?|so|well|and|i was wondering|question)\b[\s,:;!.-]+/i;
const ASK = /^((can|could|would|will) (you|u) (please )?(tell|let) me( know)?|please tell me|tell me,|i (want|wanted|would like|'d like|wish) to know|i('m| am) curious( to know)?|do you mind telling me)\b[\s,:]*/i;
export function focus(question) {
  let t = String(question).trim();
  for (let k = 0; k < 4; k++) {
    const b = t;
    t = t.replace(GREET, '').replace(INTRO, '').replace(PREAMBLE, '').replace(ASK, '').trim();
    if (t === b) break;
  }
  t = t.replace(/\.\s*\?$/, '?');
  return t || String(question).trim();
}
const SMALL = [
  ['greet', /^(hi+|hello|helo|hey|namaste|namaskar|good (morning|afternoon|evening)|greetings|yo)( (prashobh|paul|sir|there|buddy|friend))?( how are you( doing)?( today)?)?$/],
  ['howareyou', /^how are you( doing)?( today)?$/],
  ['thanks', /^(thanks|thank you|thank u|thankyou|thx|ty|cool|great|awesome|nice|super|ok|okay|got it)( so much| a lot| very much)?( prashobh| sir)?$/],
  ['bye', /^(bye|goodbye|good bye|see you|see ya|good night|take care|cya)( prashobh| sir)?$/],
];
const SMALL_REPLY = {
  greet: 'Hi! I am Prashobh, or rather the knowledge twin of me. Ask me about my work, my projects, my travels or my family.',
  howareyou: 'I am doing well, thank you for asking. What would you like to know about me?',
  thanks: 'You are welcome. Ask me anything else about my work, my projects or my travels.',
  bye: 'Thank you for stopping by. You can reach me through prashobhpaul.com anytime.',
};
/** Small talk on its own ("Hi", "Thank you") → { kind, text }, else null. */
export function smallTalk(question) {
  const t = casual(question).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  for (const [kind, re] of SMALL) if (re.test(t)) return { kind, text: SMALL_REPLY[kind] };
  return null;
}
const PRONOUN = /\b(it|its|that|this|they|them|those|these|there)\b/i;
const QWORD = /^(What|Tell|Who|Whom|Where|When|How|Which|Why|Did|Do|Does|Is|Are|Was|Were|Can|Could|Have|Has|And|So|Me|About)$/;
/** The thing a question was about, as the visitor wrote it ("Key Monastery", "TCS"). */
function subjectOf(prev, m) {
  const ENT = entityVocab(m), names = entryNames(m).flat();
  const phrases = [...String(prev).matchAll(/([A-Z][\p{L}0-9.'’-]*(?:\s+[A-Z][\p{L}0-9.'’-]*)*)/gu)]
    .map(x => x[1].split(/\s+/).filter(w => !QWORD.test(w)).join(' ')).filter(Boolean);
  const good = phrases.filter(p => {
    const sq = squash(p);
    return [...setOf(p)].some(t => ENT.has(t)) || names.some(n => sq.includes(n) || (sq.length >= 5 && n.includes(sq)));
  });
  if (good.length) return good[good.length - 1];
  return entitiesOf(prev, m).join(' ');
}
/**
 * "Who built it?" after "What is Koode?" → "Who built Koode?"; "What did you do
 * there?" after "Did you work at Primera?" → "...do at Primera?". Only when the
 * question names nothing itself; without a previous subject it stays as asked.
 */
export function resolveFollowUp(question, prev, canon) {
  if (!prev || !PRONOUN.test(question) || !Array.isArray(canon) || !canon.length) return question;
  const at = pointingBack(question);
  if (at < 0) return question;
  const m = model(canon);
  if (entitiesOf(question, m).length || namedEntries(question, m).length) return question;
  const subj = subjectOf(prev, m);
  if (!subj) return question;
  const w = question.slice(at).match(PRONOUN)[0];
  const rep = /^its$/i.test(w) ? `${subj}'s` : /^there$/i.test(w) ? `at ${subj}` : subj;
  return question.slice(0, at) + rep + question.slice(at + w.length);
}

// Pronouns that do not point at the previous question: "tell that an engineer is
// ready" (a clause follows), "it is time to retrain" and "is it worth" (nothing is
// meant by "it"), "is there a video" (existence), and "If you had to build a team,
// how would you do it?" (the question names its own antecedent before the comma).
const COPULA_BEFORE = /\b(is|was|are|were|'s)\s+$/i;
const CLAUSE_AFTER = /^that\s+(a|an|the|you|your|we|our|they|their|he|his|she|her|i|my|it|its|this|these|those|there|someone|everyone|people|users?|nobody)\b/i;
// "it is time to retrain", "is it worth building", "it is hard to hire for": an adjective
// or "time" with its own clause after it. "Is it hard to use?" keeps "it" (the thing).
const EXPL_TAIL = '(?:time\\b|(?:worth|possible|impossible|hard|easy|difficult|better|best|important|necessary|ok|okay|fine|wise|safe|right|wrong|fair|enough|likely|unlikely|common|normal|useful|sensible)\\s+(?:to\\s+\\w+\\s+\\w+|\\w+ing\\s+\\w+|that\\b|if\\b|when\\b|whether\\b))';
const EXPLETIVE_IT = new RegExp(`^it\\s+(?:is|was|'s|would be|will be|might be|may be|becomes?)\\s+(?:\\w+\\s+){0,2}?${EXPL_TAIL}`, 'i');
const EXPLETIVE_IT_ASKED = new RegExp(`^it\\s+(?:be\\s+)?(?:\\w+\\s+){0,2}?${EXPL_TAIL}`, 'i');   // after "is / would / will"
const AUX_BEFORE = /\b(is|was|would|will)\s+$/i;
const EXISTENTIAL = /^there\s+(is|are|was|were|'s|will be|would be|must be|should be|might be|has been|have been)\b/i;
const EXISTENTIAL_ASKED = /\b(is|are|was|were|will|would|could|can|has|have|should|might)\s+$/i;   // "is there", "are there"
const OWN_ANTECEDENT = /\b(?:a|an|the)\s+[A-Za-z][\w-]*|\s[A-Z][\w.-]*/;   // "an AI", "the ai platform", a name mid-question
const LEAD_CLAUSE =/^(if|when|whenever|suppose|supposing|say|imagine|given|once|assuming|after|before|while|since|because|as soon as)\b[^,]{8,},/i;
/** Index of the first pronoun that refers to an earlier question, or -1. */
export function pointingBack(question) {
  const q = String(question);
  const lead = (q.match(LEAD_CLAUSE) || [''])[0].length;
  for (const mm of q.matchAll(new RegExp(PRONOUN.source, 'gi'))) {
    const w = mm[0].toLowerCase(), rest = q.slice(mm.index), before = q.slice(0, mm.index);
    if (lead && mm.index >= lead) continue;                                          // antecedent in its own leading clause
    if (w === 'that' && CLAUSE_AFTER.test(rest) && !COPULA_BEFORE.test(before)) continue;   // "tell that an engineer is…"
    if (w === 'it' && (EXPLETIVE_IT.test(rest) || (AUX_BEFORE.test(before) && EXPLETIVE_IT_ASKED.test(rest)))) continue;
    if (w === 'it' && /\bwhen\s+$/i.test(before) && /^it\s+comes\s+to\b/i.test(rest)) continue;   // "when it comes to"
    if (w === 'there' && (EXISTENTIAL.test(rest) || EXISTENTIAL_ASKED.test(before))) continue;
    return mm.index;
  }
  return -1;
}
/**
 * "What is self-attention and how is it different from attention?": the question
 * names its own subject, a topic word, in an earlier clause. A pronoun never means
 * a noun of its own clause ("What time is it?"), and a verb joined by "and" is not
 * a new clause ("Who designed and built it?"), so only words before the last clause
 * break count: punctuation, or "and / or / but" opening a new question.
 */
const CLAUSE_BREAK = /[,;:.?!]|\b(?:and|or|but|so)\s+(?=(?:how|why|what|when|where|which|who|is|are|was|were|does|do|did|can|could|would|should|will|has|have)\b)/gi;
function namesOwnSubject(before, m) {
  const breaks = [...String(before).matchAll(CLAUSE_BREAK)];
  if (!breaks.length) return false;
  const earlier = String(before).slice(0, breaks[breaks.length - 1].index);
  return tokenize(pre(casual(earlier)).toLowerCase()).some(t => !STOP.has(t) && t.length > 2 && m.dfQ.has(stem(norm(t))));
}
/** A pronoun with nothing to point at ("Who built it?" as a first question). */
export function danglingPronoun(question, canon) {
  if (!PRONOUN.test(question) || ABOUT_HIM.test(question) || !Array.isArray(canon) || !canon.length) return false;
  const at = pointingBack(question);
  // "How should an AI decide which of its sources…", "Can AI trust every source it reads?":
  // the question names what its pronoun means before using it.
  if (at < 0 || OWN_ANTECEDENT.test(question.slice(0, at))) return false;
  const m = model(canon);
  if (namesOwnSubject(question.slice(0, at), m)) return false;
  return !entitiesOf(question, m).length && !namedEntries(question, m).length && /\b(it|its|they|them)\b/i.test(question);
}

/**
 * Why the curated layer must stay out of a question, or null: an errand ("Can
 * you book me a flight?"), a pronoun with nothing to point at, or a request for
 * videos about a place no curated answer covers (the videos themselves answer it).
 */
export function canonDecline(question, canon) {
  if (!Array.isArray(canon) || !canon.length) return null;
  question = casual(question);
  if (isImperativeTask(question)) return 'task';
  if (danglingPronoun(question, canon)) return 'dangling';
  const m = model(canon), ents = entitiesOf(question, m);
  if (VIDEO_LIST.test(question) && ents.length && !ents.some(t => m.entries.some(x => x.qbag.has(t)))) return 'video-list';
  return null;
}

// A measurable detail asked for: its price, speed, range or altitude. A curated
// answer that never states it does not answer it, however well the rest matches
// ("How much did your smart plane cost?" is not answered by its specifications).
const ATTRIBUTES = [
  [/\bhow much (?:did|does|do|would|will|was|is|were)\b.*\bcost\b|\bwhat (?:did|does|do|was|is|were)\b.*\bcost\b|\bprice of\b|\bhow expensive\b/i,
    ['cost', 'price', 'budget', 'spend', 'spent', 'rupee', 'lakh', 'crore', 'dollar', 'expensive', 'cheap']],
  [/\bhow fast\b|\b(?:top|maximum|max|cruising|flight|flying) speed\b|\bspeed of (?:the|your|his|its|that)\b|\bwhat speed\b/i,
    ['speed', 'fast', 'kmph', 'mph', 'latency', 'velocity', 'millisecond']],
  [/\bhow far\b|\b(?:flight|flying|maximum|max|top) range\b|\bwhat (?:was|is) (?:the|its|your|his) range\b|\brange of (?:the|your|his|its|that) (?:smart )?(?:plane|drone|uav|aircraft|robot)\b/i,
    ['range', 'distance', 'far', 'kilometre', 'kilometer', 'km', 'mile']],
  [/\baltitude\b|\bhow high (?:did|does|could|can|would|will)\b.*\b(?:fly|go|climb)\b/i,
    ['altitude', 'height', 'feet', 'metre', 'meter']],
];
export function unknownAttribute(question, entry, canon) {
  if (!entry || !Array.isArray(canon)) return false;
  const m = model(canon);
  return ATTRIBUTES.some(([re, words]) => re.test(question) && !words.some(w => knowsWord(m, entry, stem(norm(w)))));
}

/** Same word, allowing plurals, -ing/-ed and one typo ("Padma" ~ "Padme"). */
export function sameWord(a, b) {
  const x = stem(norm(String(a).toLowerCase())), y = stem(norm(String(b).toLowerCase()));
  return x === y || close(x, y);
}

/** Content words of a question (no function words), as typed. */
export function contentWords(question) { return tokenize(String(question)).filter(t => !STOP.has(t)); }

/** All entries scored, best first (diagnostics for the evaluator). */
export function rankCanon(question, canon) { return scoreAll(question, canon); }

/** Nearest canon questions, for a visitor whose question matched nothing. */
export function suggestCanon(question, canon, n = 3) {
  if (!Array.isArray(canon)) return [];
  const qs = setOf(question);
  const scored = canon.map(e => ({ e, s: Math.max(keywordHits(question, e) * 0.3, ...(e.questions || []).map(v => sim(qs, setOf(v)))) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map(x => x.e.questions[0]);
  if (scored.length) return scored;
  // Nothing related: offer the questions most visitors start with.
  return ['who', 'current-role', 'projects'].map(id => (canon.find(e => e.id === id) || {}).questions?.[0]).filter(Boolean).slice(0, n);
}

export function splitSentences(text) {
  return String(text).split(/(?<=[.!?])\s+(?=[A-Z"'(])/).map(s => s.trim()).filter(Boolean);
}

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A code excerpt as a collapsible card, with a permalink to the exact lines. */
export function codeCardHtml(c, open = false) {
  const lines = (c.url.match(/#L(\d+)-L(\d+)/) || []).slice(1);
  return `<details class="sc-code"${open ? ' open' : ''}><summary>From the code · <span class="sc-path">${esc(c.repo)}/${esc(c.path)}</span></summary>`
    + `<pre><code class="lang-${esc(c.language)}">${esc(c.excerpt)}</code></pre>`
    + `<a class="sc-code-link" href="${esc(c.url)}" target="_blank" rel="noopener">Open on GitHub${lines.length ? `, lines ${lines[0]}–${lines[1]}` : ''} ↗</a></details>`;
}

/**
 * Proof you can touch, under a curated answer: try or download the app, see how
 * it works (a workflow diagram, real screens), read the code, read the post.
 */
export function showcaseHtml(entries, showcase = {}) {
  const blocks = [];
  for (const e of entries) {
    const sc = e.project ? showcase[e.project] : null;
    const btns = [], html_pre = [];
    if (sc) {
      for (const l of sc.links || []) {
        if (l.kind === 'download') btns.push(`<a class="sc-btn sc-primary" href="${esc(l.url)}" target="_blank" rel="noopener">⬇ Download ${esc(e.project)} for Android</a>`);
        else if (l.kind === 'live') btns.push(`<a class="sc-btn sc-primary" href="${esc(l.url)}" target="_blank" rel="noopener">▶ Try ${esc(e.project)} now</a>`);
      }
      if (sc.source) btns.push(`<a class="sc-btn" href="${esc(sc.source)}" target="_blank" rel="noopener">View the source on GitHub</a>`);
    }
    // an architecture drawn for this answer (the whiteboard questions)
    if (e.diagram && !(sc && sc.diagram)) html_pre.push(`<figure class="sc-figure"><img src="${esc(e.diagram)}" loading="lazy" alt="Architecture: ${esc((e.questions || [''])[0])}"><figcaption>The architecture, as I would draw it</figcaption></figure>`);
    for (const l of e.links || []) btns.push(`<a class="sc-btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`);
    let html = (btns.length ? `<div class="sc-cta">${btns.join('')}</div>` : '') + html_pre.join('');
    if (sc && sc.diagram) html += `<figure class="sc-figure"><img src="${esc(sc.diagram)}" loading="lazy" alt="How ${esc(e.project)} works"><figcaption>How ${esc(e.project)} works</figcaption></figure>`;
    if (sc && (sc.images || []).length) html += `<div class="sc-shots">${sc.images.map(i => `<a href="${esc(i.url)}" target="_blank" rel="noopener"><img src="${esc(i.url)}" loading="lazy" alt="${esc(e.project)}: ${esc(i.path.split('/').pop())}"></a>`).join('')}</div>`;
    if (sc && (sc.code || []).length) html += codeCardHtml(sc.code[0]);
    if (html) blocks.push(`<div class="showcase" data-project="${esc(e.project || e.id)}">${html}</div>`);
  }
  return blocks.join('');
}

/**
 * Replace a retrieval result's answer with the canon answer, cited by its proof
 * records. The retrieval citations are kept after the proofs as corroboration.
 */
export function applyCanon(result, match, chunks, showcase = {}) {
  const { entry } = match;
  const parts = entry.parts || [entry];
  const citations = [];
  const seen = new Map();
  const addCite = (idx, why) => {
    if (idx == null || !chunks[idx]) return null;
    if (seen.has(idx)) return seen.get(idx);
    const c = { num: citations.length + 1, chunkIdx: idx, chunk: chunks[idx], score: 1, confidence: 1, why };
    seen.set(idx, c); citations.push(c); return c;
  };
  const partRefs = parts.map(e => {
    const own = [];
    for (const ev of e.evidence || []) for (const idx of (ev.chunk_ids || []).slice(0, 1)) { const c = addCite(idx, ev.why); if (c && c.why && !own.includes(c)) own.push(c); }
    return own;
  });
  for (const c of (result.citations || []).slice(0, 3)) addCite(c.chunkIdx, '');
  const sentences = splitSentences(entry.answer);
  const refHtml = (cs) => cs.map(c => `<sup class="cite-ref" data-cite="${c.num}" title="${esc(c.why)}">[${c.num}]</sup>`).join('');
  // In the visitor's language when a curated translation exists; the English
  // original, the source of record, stays one tap away.
  const lang = match.lang && match.lang !== 'en' ? match.lang : null;
  const tr = (e) => (lang && e.i18n && e.i18n[lang]) || null;
  const translated = lang && parts.every(tr);
  const body = parts.map((e, i) => translated
    ? `<p class="answer-body answer-canon" lang="${esc(lang)}">${esc(tr(e))} ${refHtml(partRefs[i])}</p>`
    : `<p class="answer-body answer-canon">${esc(e.answer)} ${refHtml(partRefs[i])}</p>`).join('')
    + (translated ? `<details class="answer-original"><summary>My original answer, in English</summary>${parts.map(e => `<p>${esc(e.answer)}</p>`).join('')}</details>` : '');
  const missed = (match.missed || []).length
    ? `<p class="answer-closing">${match.missed.map(q => `“${esc(q)}”`).join(', ')}: nothing on record, so I will not guess.</p>` : '';
  const html =
    `<p class="answer-opener">${match.compare ? 'Side by side, in Prashobh\'s own words:' : 'In Prashobh\'s own words:'}</p>` +
    body + missed + showcaseHtml(parts, showcase) +
    `<p class="answer-closing">Curated answer. Each proof below is a record from the website, resume, GitHub, YouTube or LinkedIn; Eidolon's own retrieval is listed after them.</p>`;
  return {
    ...result,
    answerHtml: html,
    citations,
    canon: { id: entry.id, answer: entry.answer, evidence: entry.evidence, score: match.score,
             sentences: translated ? parts.map(tr).flatMap(t => t.split(/(?<=[.!?।])\s+/)).filter(Boolean) : sentences,
             lang: translated ? lang : 'en' },
    summary: { ...(result.summary || {}), sentences: sentences.map((s, i) => ({ text: s, display: s, chunkIdx: citations[0] ? citations[0].chunkIdx : 0, chunk: citations[0] ? citations[0].chunk : chunks[0], final: 1, position: i, tokens: new Set(), signals: {} })) },
    lowConfidence: false,
    verdict: null,
  };
}
