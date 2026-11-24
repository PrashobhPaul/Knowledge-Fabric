// ============================================================================
// NLU — question understanding for a personal knowledge corpus
// ============================================================================
//
// The failure this module exists to prevent:
//
//   Q: "What did Prashobh build at Primera Medical?"
//   A: "'Key Monastery Explained' is a long-form video published on The Canvas
//       of Earth …"  — because a travel video description happens to contain
//       "built" four times.
//
// Retrieval is not the problem there. What is missing is any representation of
// what the *question* is asking for. A question about a job wants a career
// record; it can never be satisfied by a video, however many query words that
// video contains.
//
// So before retrieval is scored we decide three things:
//   1. intent   — what kind of answer would satisfy this question
//   2. focus    — which named things the question is about (orgs, projects, places…)
//   3. routing  — which record types can plausibly answer it, as multiplicative priors
//
// No model, no training data. Cue patterns over a closed domain, which is the
// right tool when the intent space is small and known.

const TOKEN_RE = /[A-Za-z0-9]+/g;

const STOP = new Set(['the','a','an','of','for','to','in','on','at','is','are','was','were',
  'be','been','do','does','did','what','which','how','why','when','where','who','whom','and',
  'or','but','if','then','with','by','from','as','that','this','these','those','it','its',
  'can','could','should','would','will','shall','may','might','must','i','we','you','they',
  'my','our','your','their','me','us','them','about','into','over','under','than','so','such',
  'he','his','him','prashobh','paul','prashobhs']);

// ---------------------------------------------------------------------------
// Intents
// ---------------------------------------------------------------------------
// cues       : regexes on the raw question
// answerCues : phrases a *satisfying answer sentence* tends to contain — a soft
//              prior on sentence scoring, not a filter.
// prefer     : record types / source types multiplied UP
// penalise   : record types / source types multiplied DOWN
// wants      : short label shown in the UI so the routing is legible
export const INTENTS = {
  CAREER: {
    cues: [/\b(job|jobs|role|roles|position|employ(er|ed|ment)?|career|company|companies)\b/i,
           /\bwork(ed|s|ing)?\s+(at|for|currently|now|today)\b/i, /\bwhere (does|did|is) .* (work|working|employed)/i,
           /\bexperience (at|with|in)\b/i, /\bwhat (did|does|has) .* (do|did|done|build|built|work on|worked on) at\b/i,
           /\bcurrent(ly)? (role|position|job|work|working)/i, /\b(joined|left|moved to|hired by)\b/i],
    answerCues: [[/\b(has worked|worked|works) at\b/i, 1.0], [/\b(since|from) [A-Z][a-z]+ 20\d\d\b/, 0.9],
                 [/\b(led|built|designed|architected|spearhead|mentored|developed)\b/i, 0.7],
                 [/\bcurrent role\b/i, 0.8], [/\b(architect|engineer|scientist|leader)\b/i, 0.5]],
    prefer: { role: 1.6, document: 1.25, web_paragraph: 1.1, faq: 1.0 },
    penalise: { video: 0.05, channel: 0.1, repository: 0.4, skill_group: 0.5, service: 0.4 },
    wants: 'a career fact',
  },
  SKILLS: {
    cues: [/\b(skills?|expertise|technolog(y|ies)|tech stack|stack|tools?|frameworks?|languages?|proficien|cloud|platforms?)\b/i,
           /\bgood at\b/i, /\bknow(s|ledge of)?\b.*\b(python|langgraph|aws|react|kotlin)\b/i,
           /\bwhat (does|can) .* (use|work with)\b/i],
    answerCues: [[/\bskills? in\b/i, 1.0], [/\binclude\b/i, 0.7], [/\btech stack\b/i, 0.9],
                 [/\b(langgraph|crewai|autogen|langchain|python|aws|gcp|react|kotlin|typescript)\b/i, 0.8],
                 [/\bexpertise\b/i, 0.6]],
    prefer: { skill_group: 1.7, faq: 1.2, document: 1.15, project: 1.05, repository: 1.05 },
    penalise: { video: 0.05, channel: 0.1, education: 0.5 },
    wants: 'a list of skills',
  },
  PROJECTS: {
    cues: [/\b(projects?|apps?|applications?|built|build|building|made|created|developed|portfolio|side[- ]projects?|repositor(y|ies)|github|open[- ]source)\b/i,
           /\bwhat (has|did) .* (build|built|make|made|create)/i, /\bwhat is (koode|invest\.?iq|iplbuzz|rvonwheelz|pachaka lokam|soccer\.?ai|knowledge fabric|cogniflow|profitpilot)\b/i],
    answerCues: [[/\b(is|was) (a|an|the) [^.]{3,60}(app|application|dashboard|planner|companion|platform|demo|repository|project)\b/i, 1.0],
                 [/\bbuilt (with|for|to)\b/i, 0.9], [/\b(react|typescript|supabase|kotlin|python|javascript|pwa|android)\b/i, 0.6],
                 [/\b(live at|source code|download|open source)\b/i, 0.6], [/\bI built\b/i, 0.8]],
    prefer: { project: 1.7, repository: 1.4, engagement: 1.3, career_project: 1.3, web_paragraph: 1.1 },
    penalise: { video: 0.08, channel: 0.1, education: 0.3, languages: 0.1 },
    wants: 'a project description',
  },
  EDUCATION: {
    cues: [/\b(educat|degree|university|college|studied|study|graduat|m\.?tech|b\.?tech|masters?|bachelor|academic|school|alma mater)/i],
    answerCues: [[/\bearned a\b/i, 1.0], [/\b(m\.tech|b\.tech|master|bachelor)\b/i, 0.9],
                 [/\buniversity\b/i, 0.7], [/\b20(0|1)\d\b/, 0.4]],
    prefer: { education: 1.8, document: 1.2, faq: 1.1 },
    penalise: { video: 0.05, channel: 0.1, repository: 0.2, project: 0.3 },
    wants: 'an education fact',
  },
  SERVICES: {
    cues: [/\b(services?|consult|hire|hiring|freelance|training|workshop|interview prep|coaching|mentor|advisory|engage|availab|offer|rate|pricing|price|cost)/i,
           /\bcan (i|we) (hire|book|work with)\b/i, /\bdoes .* (offer|provide|conduct)\b/i],
    answerCues: [[/\boffers?\b/i, 1.0], [/\b(consulting|training|workshop|interview preparation|coaching|advisory)\b/i, 0.9],
                 [/\b(available|freelance|engagement)\b/i, 0.7], [/\bdepends on (scope|the problem)\b/i, 0.5]],
    prefer: { service: 1.7, faq: 1.5, web_paragraph: 1.2 },
    penalise: { video: 0.05, channel: 0.1, repository: 0.2, education: 0.3 },
    wants: 'a services answer',
  },
  CONTACT: {
    cues: [/\b(contact|reach|email|e-mail|linkedin|whatsapp|phone|call|connect|schedule|calendly|website|url|link|follow)\b/i,
           /\bhow (do|can) i (reach|contact|connect|find)\b/i],
    answerCues: [[/\b(reached|contact|connect)\b/i, 1.0], [/https?:\/\//, 0.9], [/\b(linkedin|github|youtube|website)\b/i, 0.7]],
    prefer: { contact: 2.0, faq: 1.3 },
    penalise: { video: 0.05, channel: 0.3, repository: 0.3, role: 0.4 },
    wants: 'contact details',
  },
  YOUTUBE: {
    cues: [/\b(youtube|video|videos|vlog|vlogs|shorts|filmed|film|watch|uploaded|views)\b/i,
           /\b(spiti|tabo|manali|monastery|chandratal|himachal|mumbai|kala ghoda|travel(led|ling)?|trip)\b/i],
    answerCues: [[/\bis a (YouTube Short|long-form video|video)\b/i, 1.0], [/\bpublished on\b/i, 0.9],
                 [/\bYouTube channel\b/i, 0.9], [/\b(views|subscribers)\b/i, 0.6], [/\bduration of\b/i, 0.5]],
    prefer: { video: 1.6, channel: 1.6, personal: 1.2, faq: 0.9 },
    penalise: { role: 0.2, skill_group: 0.1, education: 0.1, repository: 0.3, service: 0.1 },
    wants: 'a video or channel fact',
  },
  DOMAIN_EXPERIENCE: {
    cues: [/\b(healthcare|clinical|hospital|bfsi|banking|finance|financial|fraud|telecom|robotics|robot|nlp|computer vision|agentic|genai|generative|llm|rag|multi[- ]agent|governance)\b.*\b(experience|work|background|done|built|expertise)\b/i,
           /\b(experience|work|background|expertise) (in|with|on) (healthcare|clinical|bfsi|banking|telecom|robotics|nlp|agentic|genai|generative ai|llms?|rag|computer vision)\b/i,
           /\bhas .* worked (in|on|with)\b/i],
    answerCues: [[/\b(healthcare|clinical|bfsi|banking|telecom|robotics|nlp|agentic|generative)\b/i, 0.9],
                 [/\b(built|led|designed|developed|architected)\b/i, 0.8], [/\bat [A-Z][A-Za-z]+\b/, 0.5]],
    prefer: { role: 1.5, faq: 1.3, document: 1.2, engagement: 1.2 },
    penalise: { video: 0.05, channel: 0.1, education: 0.3, languages: 0.1 },
    wants: 'domain experience',
  },
  TEMPORAL: {
    cues: [/\bwhen (was|were|did|does|is)\b/i, /\bwhat (date|year|month)\b/i, /\bhow (long|many years|old|recent)\b/i,
           /\bsince when\b/i, /\b(timeline|chronolog)/i],
    answerCues: [[/\b(19|20)\d{2}\b/, 1.0], [/\b(since|from|until|to) [A-Z][a-z]+ 20\d\d\b/, 1.0],
                 [/\b(published|created|last updated|joined|graduat)/i, 0.7], [/\byears of experience\b/i, 0.8]],
    prefer: { role: 1.4, education: 1.3, video: 1.0, repository: 1.0, channel: 1.0 },
    penalise: { skill_group: 0.3, service: 0.2 },
    wants: 'a date or duration',
  },
  CHANNEL: {
    cues: [/\b(channel|subscribers?|canvas of earth)\b/i, /\bwhat is the canvas of earth\b/i],
    answerCues: [[/\bYouTube channel\b/i, 1.0], [/\b(subscribers|views|videos)\b/i, 0.8], [/\bniche\b/i, 0.6]],
    prefer: { channel: 2.4, personal: 1.2, video: 0.9 },
    penalise: { role: 0.2, skill_group: 0.1, education: 0.1, repository: 0.3, service: 0.1 },
    wants: 'a channel fact',
  },
  LANGUAGES: {
    cues: [/\b(speaks?|spoken|fluent|fluency|mother tongue|native language|malayalam|hindi|telugu|tamil)\b/i,
           /\blanguages?\b.*\bspeak|\bspeak.*\blanguages?\b/i],
    answerCues: [[/\bspeaks\b/i, 1.0], [/\bproficiency\b/i, 0.9]],
    prefer: { languages: 2.6, personal: 1.1 },
    penalise: { skill_group: 0.3, video: 0.1, repository: 0.1 },
    wants: 'the languages spoken',
  },
  METRICS: {
    cues: [/\bhow many\b/i, /\bhow much\b/i, /\b(number of|count of|total)\b/i, /\b(subscribers?|views|stars|repositories|videos|years)\b.*\?/i,
           /\bmost (popular|viewed|watched|starred)\b/i],
    answerCues: [[/\b\d[\d,.]*\s*(thousand|million|views|subscribers|videos|stars|years|hospitals|geographies)\b/i, 1.0],
                 [/\babout \d/i, 0.8], [/\b\d+\+\b/, 0.6]],
    prefer: { channel: 1.5, video: 1.2, repository: 1.2, person_summary: 1.2, role: 1.1 },
    penalise: { service: 0.3, contact: 0.3 },
    wants: 'a number',
  },
  LOCATION: {
    cues: [/\bwhere (is|does|did) .* (based|live|located|from|work)/i, /\b(based|located|location|city|lives?|hometown)\b/i,
           /\bwhich city\b/i, /\bremote\b/i],
    answerCues: [[/\bbased (in|out of)\b/i, 1.0], [/\b(hyderabad|chennai|cochin|india)\b/i, 0.9], [/\bremote\b/i, 0.6]],
    prefer: { person_summary: 1.6, faq: 1.4, role: 1.2, contact: 1.1 },
    penalise: { video: 0.2, skill_group: 0.1, repository: 0.2 },
    wants: 'a location',
  },
  COMPARISON: {
    cues: [/difference between/i, /\bvs\.?\b|versus/i, /compare[ds]?|comparison/i, /better than|instead of/i],
    answerCues: [/compared (to|with)/i, /whereas|while|however|unlike/i, /difference|differs?/i, /both|either|complementary/i],
    prefer: { faq: 1.3, document: 1.1 },
    penalise: { video: 0.2 },
    wants: 'a comparison',
  },
  OPINION: {
    cues: [/\bwhat does .* think (of|about)\b/i, /\b(opinion|view|take|thoughts?) on\b/i, /\bhow does .* (approach|choose|decide)\b/i,
           /\b(explain|what is|what are) (rag|mcp|a2a|agentic ai|an? agent|llms?|a knowledge graph|an? ontology|prompt engineering|vibe coding|conversational ai|nlp|nlu|data science|ai ethics|the transformer)\b/i],
    answerCues: [[/\b(is|are|refers? to|stands for)\b/i, 0.8], [/\b(problem-first|depends on|not hype)\b/i, 0.9],
                 [/\bin simple terms\b/i, 0.7]],
    prefer: { faq: 1.8, working_style: 1.4, person_about: 1.1 },
    penalise: { video: 0.1, channel: 0.1, repository: 0.3, education: 0.2 },
    wants: 'a viewpoint or explanation',
  },
  WHO: {
    cues: [/^who is\b/i, /\btell me about (prashobh|him|yourself)\b/i, /\bwho (are|am) (you|prashobh)\b/i, /\bintroduce\b/i,
           /\b(summary|overview|background|bio|biography|profile)\b/i, /\bwhat does (prashobh|he) do\b/i, /\bshort bio\b/i],
    answerCues: [[/\bis an? (AI Architect|AI Solutions Leader|independent)\b/i, 1.0], [/\byears of experience\b/i, 0.9],
                 [/\bspanning\b/i, 0.7], [/\bdesigns? and builds?\b/i, 0.7], [/\bjourney spans\b/i, 0.9],
                 [/\bindependent AI\b/i, 0.9], [/\barchitect and hands-on builder\b/i, 0.8], [/\bbased in\b/i, 0.6]],
    prefer: { person_summary: 2.4, person_about: 2.0, faq: 1.2, web_paragraph: 1.2, document: 1.1 },
    penalise: { video: 0.05, repository: 0.1, skill_group: 0.4, languages: 0.3, career_project: 0.3, service: 0.4, engagement: 0.5, contact: 0.3 },
    wants: 'a short biography',
  },
  DEFINITION: {
    cues: [/^what (is|are) (a |an |the )?[\w\s.-]+\??$/i, /define|definition of/i, /what does .* stand for/i, /\bmeaning of\b/i],
    answerCues: [/\bis a\b|\bis an\b|\bare\b/, /refers? to/i, /stands for/i, /means/i],
    prefer: { project: 1.3, faq: 1.3, engagement: 1.2, repository: 1.1, channel: 1.1 },
    penalise: { video: 0.5 },
    wants: 'a definition',
  },
};

export const DEFAULT_INTENT = {
  name: 'GENERAL', answerCues: [], prefer: { profile: 1.15, document: 1.1, faq: 1.05 },
  penalise: { video: 0.6 }, wants: 'a direct answer',
};

// Named things worth recognising as the question's focus. Lowercase; longest wins.
const FOCUS_TERMS = [
  // organisations
  'qualizeal','tech mahindra','yash technologies','yash','brane enterprises','brane','primera medical','primera',
  'tata consultancy services','tcs','american express','amex','microsoft','southwest airlines','pwc',
  'srm university','jntu',
  // projects
  'rvonwheelz','soccer.ai','soccer ai','invest.iq','investiq','koode','knowledge fabric','pachaka lokam','iplbuzz',
  'cogniflow','profitpilot','dhinasuthra','tripwise','codefabric','validaite','qmentisai','medical note reader',
  'ehr parser','ai ticket classifier','quadrupedal robot','enterprise genai assistant',
  // technologies
  'langgraph','crewai','autogen','langchain','python','typescript','javascript','react','supabase','kotlin',
  'jetpack compose','aws','gcp','neo4j','fastapi','tensorflow','pytorch','hugging face','ros','hl7','fhir','rag',
  'microsoft agent framework','kiro','.net','docker','kubernetes','mlops','openai','claude','gemini','mcp','a2a',
  // domains
  'healthcare','clinical','bfsi','banking','telecom','robotics','nlp','computer vision','agentic ai','generative ai',
  'genai','ai governance','multi-agent','fraud detection','credit scoring','interview prep','corporate training',
  // places & channel
  'spiti','spiti valley','tabo','kaza','key monastery','kee monastery','chandratal','chicham','atal tunnel','langza',
  'manali','hadimba','reckong peo','rampur','himachal','himalayas','mumbai','kala ghoda','hyderabad','chennai','cochin',
  'antarctica','the canvas of earth','canvas of earth','microsoft ai tour','satya nadella',
];

// Mutually-exclusive entity families. A sentence about Tech Mahindra cannot
// answer a question about Qualizeal, however well its words match.
export const ENTITY_FAMILIES = {
  organization: ['qualizeal', 'tech mahindra', 'yash technologies', 'brane enterprises', 'primera medical',
                 'tata consultancy services', 'tcs', 'american express'],
  project: ['rvonwheelz', 'soccer.ai', 'invest.iq', 'koode', 'knowledge fabric', 'pachaka lokam', 'iplbuzz',
            'cogniflow', 'profitpilot', 'validaite', 'qmentisai', 'dhinasuthra', 'tripwise'],
  place: ['spiti', 'tabo', 'kaza', 'key monastery', 'chandratal', 'chicham', 'atal tunnel', 'langza', 'manali',
          'mumbai', 'kala ghoda', 'antarctica'],
};

// A focus term and the other spellings a source may use for the same thing.
// "tcs" in the question must match "Tata Consultancy Services" in the profile.
const FOCUS_ALIASES = {
  tcs: ['tata consultancy services'], 'tata consultancy services': ['tcs'],
  'primera medical': ['primera'], 'yash technologies': ['yash'], 'brane enterprises': ['brane'],
  amex: ['american express'], 'invest.iq': ['investiq'], investiq: ['invest.iq'],
  'soccer.ai': ['soccer ai', 'worldcup2026fifa', 'fifa2026'], 'knowledge fabric': ['knowledge-fabric'],
  'pachaka lokam': ['pachakalokam', 'pachaka-lokam'], 'key monastery': ['kee monastery', 'ki monastery'],
  'the canvas of earth': ['canvas of earth'], 'spiti valley': ['spiti'], 'microsoft ai tour': ['ai tour'],
  'agentic ai': ['agentic', 'multi-agent', 'multi agent'], healthcare: ['clinical', 'hospital', 'emr', 'medical'],
  clinical: ['healthcare', 'emr', 'hospital'], bfsi: ['banking', 'credit scoring', 'fraud', 'financial'],
  banking: ['bfsi', 'credit', 'fraud'], robotics: ['robot', 'autonomous navigation', 'slam'],
  nlp: ['natural language', 'text analytics'], 'ai governance': ['governance'], genai: ['generative ai'],
  'generative ai': ['genai'], 'corporate training': ['training', 'workshop'], 'interview prep': ['interview preparation'],
  langgraph: ['lang graph'], 'computer vision': ['object detection'], chandratal: ['chandrathal'],
  'satya nadella': ['satya'], 'srm university': ['srm'], jntu: ['jntu hyderabad'],
};

/** True when the text names the focus term or one of its known spellings. */
export function focusMatches(text, focus) {
  const low = String(text).toLowerCase();
  if (low.includes(focus)) return true;
  return (FOCUS_ALIASES[focus] || []).some(a => low.includes(a));
}

/** Entities of the same family present in a text, for conflict detection. */
export function familyMembers(text, family) {
  const low = String(text).toLowerCase();
  return ENTITY_FAMILIES[family].filter(t => low.includes(t));
}

export function tokens(text) {
  return (String(text).toLowerCase().match(TOKEN_RE) || []).filter(t => t.length > 1);
}

// Light two-phase stemmer so "study"/"studying", "work"/"worked", "graduate"/
// "graduating" collide when the question is compared with a sentence. Applied to
// BOTH sides, so it can only ever add matches, never invent asymmetric ones.
export function stem(t) {
  if (t.length <= 3) return t;
  if (t.endsWith('ies') && t.length > 4) t = t.slice(0, -3) + 'y';
  else if (/(ches|shes|xes|zes|sses)$/.test(t)) t = t.slice(0, -2);
  else if (t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
  if (t.endsWith('ing') && t.length > 5) t = t.slice(0, -3);
  else if (t.endsWith('ed') && t.length > 4) t = t.slice(0, -2);
  else if (t.endsWith('ly') && t.length > 5) t = t.slice(0, -2);
  return t;
}

export function contentTokens(text) {
  return tokens(text).filter(t => !STOP.has(t)).map(stem);
}

/** Classify intent by cue-pattern hits. Ties break toward the more specific
 *  intent, since specific intents carry stronger routing priors. */
// What KIND of thing the question names tells us a lot about the answer shape:
// naming an employer is a career question even when the verb is "build".
const FOCUS_KIND_BONUS = {
  CAREER:   ENTITY_FAMILIES.organization,
  PROJECTS: ENTITY_FAMILIES.project,
  YOUTUBE:  ENTITY_FAMILIES.place,
  CHANNEL:  ['canvas of earth'],
};

export function classifyIntent(question) {
  const q = String(question || '');
  const low = q.toLowerCase();
  let best = null, bestScore = 0;
  for (const [name, spec] of Object.entries(INTENTS)) {
    let score = 0;
    for (const re of spec.cues) if (re.test(q)) score += 1;
    // DEFINITION and COMPARISON are generic shapes; let topical intents win ties.
    if (score && (name === 'DEFINITION' || name === 'COMPARISON')) score -= 0.5;
    const bonusTerms = FOCUS_KIND_BONUS[name];
    if (bonusTerms && bonusTerms.some(t => low.includes(t))) score += 1;
    if (score > bestScore) { bestScore = score; best = { name, ...spec }; }
  }
  return best || { ...DEFAULT_INTENT };
}

/** Record types the intent prefers so strongly that their chunks should be in
 *  the evidence pool even when retrieval missed them — "Who is Prashobh?" has
 *  no content words, so BM25 cannot find the one-paragraph summary on its own. */
export function anchorRecordTypes(intent, threshold = 1.5) {
  return Object.entries(intent.prefer || {}).filter(([, w]) => w >= threshold).map(([rt]) => rt);
}

/** Entities the question is about — used for focus bonuses and to detect when
 *  a candidate sentence is about something else entirely. */
export function extractFocus(question) {
  const low = String(question || '').toLowerCase();
  const found = [];
  for (const term of FOCUS_TERMS) {
    if (new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(low)) {
      found.push(term);
    }
  }
  found.sort((a, b) => b.length - a.length);
  const kept = [];
  for (const f of found) if (!kept.some(k => k.includes(f))) kept.push(f);
  return kept;
}

// Sentences that talk ABOUT the assistant/site rather than the person — a
// distraction from every question except one about the site itself.
export const META_SITE_RE =
  /\b(this assistant|the assistant|chatbot|knowledge base at query time|intent engine)\b/i;

/**
 * Evidence prior for a chunk given the question intent.
 * Multiplicative, so it reshapes ranking without discarding retrieval signal.
 */
export function evidencePrior(chunk, intent) {
  const rt = (chunk.meta && chunk.meta.record_type) || '';
  const st = chunk.source_type || '';
  let prior = 1.0;
  if (intent.prefer) {
    if (intent.prefer[rt]) prior *= intent.prefer[rt];
    if (intent.prefer[st]) prior *= intent.prefer[st];
  }
  if (intent.penalise) {
    if (intent.penalise[rt]) prior *= intent.penalise[rt];
    if (intent.penalise[st]) prior *= intent.penalise[st];
  }
  // An older resume revision is still evidence, but the current one outranks it.
  if (chunk.meta && chunk.meta.current === false) prior *= 0.7;
  // Chunk-level prose quality from the build (0..1).
  if (typeof chunk.quality === 'number') prior *= (0.55 + 0.45 * chunk.quality);
  return prior;
}

/**
 * Re-rank retrieval results by intent-conditioned evidence priors.
 * Runs BEFORE the summariser sees the pool — if the top-12 passages are all
 * travel videos because they contain "built", the useful career records were
 * never in the pool to begin with.
 */
export function rerankByIntent(ranked, chunks, intent, { keep = 24 } = {}) {
  const scored = ranked.map(r => {
    const chunk = chunks[r.chunkIdx];
    const prior = chunk ? evidencePrior(chunk, intent) : 0;
    return { ...r, baseScore: r.score, prior, score: r.score * prior };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter(r => r.prior > 0.12).slice(0, keep);
}

export function analyseQuestion(question) {
  const intent = classifyIntent(question);
  const focus = extractFocus(question);
  const terms = contentTokens(question);
  return {
    question, intent, focus, terms,
    isIdentifierLookup: /\b[A-Za-z]+_[A-Za-z0-9_]+\b/.test(question) || /\bhttps?:\/\//.test(question),
    expects: intent.wants || DEFAULT_INTENT.wants,
  };
}
