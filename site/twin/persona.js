// ============================================================================
// Persona — the fabric's cited sentences, spoken in the first person
// ============================================================================
//
// The twin says only what the sources say. No model composes new facts: the
// evidence sentences the fabric selected are rewritten from "Prashobh Paul
// worked at…" to "I worked at…" by rules, and the discourse markers the panel
// uses ("The website adds that…") are replaced by spoken connectors. Every
// factual token survives the rewrite unchanged, so the citations still hold.

const OWNER = 'Prashobh Paul';
const SHORT = 'Prashobh';

// Third-person verb forms that follow the owner's name in fabric records.
// Third-person verb forms that follow the owner's name in fabric records, with
// any adverbs in between ("he also takes" → "I also take").
const VERBS = [['is','am'],['has','have'],['does','do'],['works','work'],['offers','offer'],['builds','build'],
  ['speaks','speak'],['lives','live'],['uses','use'],['leads','lead'],['designs','design'],['runs','run'],
  ['makes','make'],['creates','create'],['holds','hold'],['teaches','teach'],['says','say'],['covers','cover'],
  ['takes','take'],['enjoys','enjoy'],['conducts','conduct'],['thinks','think'],['prefers','prefer'],['chooses','choose'],
  ['brings','bring'],['helps','help'],['advises','advise'],['mentors','mentor'],['attends','attend'],['posts','post'],
  ['writes','write'],['films','film'],['travels','travel'],['gets','get'],['wants','want'],['loves','love'],
  ['knows','know'],['believes','believe'],['focuses','focus'],['specialises','specialise'],['specializes','specialize'],
  ['explains','explain'],['shares','share'],['talks','talk'],['sees','see'],['goes','go'],['stays','stay'],
  ['keeps','keep'],['finds','find'],['likes','like'],['calls','call'],['describes','describe'],['recommends','recommend'],
  ['combines','combine'],['applies','apply'],['delivers','deliver'],['develops','develop'],['spends','spend']];
const ADVERBS = '(?:\\s+(?:also|genuinely|currently|now|still|mainly|mostly|often|usually|regularly|actively|primarily|really|always|never|typically|frequently|generally|personally|already|even|just|only|sometimes|occasionally))*';
const VERB_FIX = VERBS.map(([third, first]) => [new RegExp(`\\bI(${ADVERBS})\\s+${third}\\b`, 'g'), `I$1 ${first}`]);

// Panel connectors that make no sense spoken aloud.
const MARKERS = [
  /^(It adds that|It also states that|The same record notes that|The (website|resume|channel|profile|GitHub side) adds that|On LinkedIn he adds that|Another source states that|From a different source,|In more detail,|More precisely,|Note, though, that|That said,)\s*/i,
];
const CONNECTORS = ['', 'Also, ', 'And ', 'Beyond that, ', 'On top of that, '];

/** Rewrite one evidence sentence into the first person. Facts stay verbatim. */
export function toFirstPerson(sentence) {
  let s = String(sentence || '').trim();
  for (const re of MARKERS) s = s.replace(re, '');
  s = s.replace(/^(Specifically|Separately|Elsewhere|However),\s*/i, '');
  // Possessives and name-bound phrases first (longest match wins).
  s = s.replace(new RegExp(`${OWNER}'s`, 'g'), 'my').replace(new RegExp(`${SHORT}'s`, 'g'), 'my');
  s = s.replace(new RegExp(`${OWNER}’s`, 'g'), 'my').replace(new RegExp(`${SHORT}’s`, 'g'), 'my');
  s = s.replace(/published on The Canvas of Earth by Prashobh Paul/g, 'I published on The Canvas of Earth');
  s = s.replace(/is a public GitHub repository by Prashobh Paul/g, 'is a public GitHub repository of mine');
  s = s.replace(/that Prashobh Paul works on at/g, 'that I work on at');
  s = s.replace(/\bby Prashobh Paul\b/g, 'by me').replace(/\bwith Prashobh Paul\b/g, 'with me');
  s = s.replace(/\bPrashobh Paul\b/g, 'I').replace(/\bPrashobh\b/g, 'I');
  // Pronouns before the verb fix, so "he also takes" becomes "I also take".
  // Pronouns.
  s = s.replace(/\bHe\b/g, 'I').replace(/\bhe\b/g, 'I').replace(/\bHis\b/g, 'My').replace(/\bhis\b/g, 'my')
       .replace(/\bhimself\b/g, 'myself').replace(/\bhim\b/g, 'me');
  for (const [re, to] of VERB_FIX) s = s.replace(re, to);
  s = s.replace(/\bI am an? I\b/g, 'I am'); // "Prashobh is a Prashobh" never occurs, guard anyway
  // "my current role" reads better than "the current role" after a rewrite of "(current role)".
  s = s.replace(/\s*\(current role\)/g, ', my current role');
  // Leading lowercase after a stripped marker.
  s = s.replace(/^\s*([a-z])/, (m, c) => c.toUpperCase());
  return s.replace(/\s{2,}/g, ' ').trim();
}

/** Spoken opener for a yes/no verdict, in the owner's voice. */
export function verdictLine(verdict) {
  if (!verdict) return '';
  if (verdict.kind === 'yes') return 'Yes.';
  if (verdict.kind === 'partial') return 'Not exactly.';
  return 'No, not that I have on record — but here is the closest thing.';
}

/**
 * Build the twin's reply from a fabric result.
 * @returns {{ text:string, spoken:string, sentences:string[] }}
 */
export function firstPersonAnswer(result, { spokenSentences = 3 } = {}) {
  const sents = (result && result.summary && result.summary.sentences) || [];
  const rewritten = sents.map(s => toFirstPerson(s.display || s.text)).filter(Boolean);
  const opener = verdictLine(result && result.verdict);
  const parts = rewritten.map((s, i) => (i === 0 ? s : `${CONNECTORS[Math.min(i, CONNECTORS.length - 1)]}${s.charAt(0).toLowerCase() === s.charAt(0) ? s : (i ? s.charAt(0).toLowerCase() + s.slice(1) : s)}`));
  const text = [opener, ...parts].filter(Boolean).join(' ');
  const spoken = [opener, ...parts.slice(0, spokenSentences)].filter(Boolean).join(' ');
  return { text, spoken, sentences: rewritten };
}

/** What the twin says when the fabric found nothing. */
export function noAnswerLine(lang = 'en') {
  return 'I do not have that on record. Ask me about my work, my projects, my talks, or my travel videos — or flag it and I will add it.';
}
