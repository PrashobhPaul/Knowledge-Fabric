// ============================================================================
// Multilingual — English by default; Malayalam, Telugu, Tamil and Hindi first-class
// ============================================================================
//
// The fabric is a static site with no translation service behind it, so the
// honest contract is:
//   1. A question is tokenised in its own script (search.js / nlu.js use
//      Unicode-aware tokenisers), so Malayalam, Telugu or Hindi words match
//      Malayalam, Telugu or Hindi evidence (video titles, transcripts).
//   2. A small hand-maintained lexicon maps the names and question words a
//      visitor is likely to use in those scripts onto their English forms, so
//      "ക്വാളിസീൽ എവിടെ" still reaches the English Qualizeal records.
//   3. Evidence in the question's language is preferred when it exists; when it
//      does not, the English evidence is shown and the answer says so.
// Nothing is machine-translated: every sentence stays verbatim from its source.

export const LANGS = {
  en: { code: 'en-IN', label: 'English',   native: 'English' },
  ml: { code: 'ml-IN', label: 'Malayalam', native: 'മലയാളം' },
  te: { code: 'te-IN', label: 'Telugu',    native: 'తెలుగు' },
  ta: { code: 'ta-IN', label: 'Tamil',     native: 'தமிழ்' },
  hi: { code: 'hi-IN', label: 'Hindi',     native: 'हिन्दी' },
};
export const DEFAULT_LANG = 'en';

const SCRIPTS = [
  ['ml', /[ഀ-ൿ]/],
  ['te', /[ఀ-౿]/],
  ['ta', /[\u0B80-\u0BFF]/],
  ['hi', /[ऀ-ॿ]/],
];

/** Language of a text by its script; 'en' for Latin or empty. */
export function detectScript(text) {
  const t = String(text || '');
  for (const [lang, re] of SCRIPTS) if (re.test(t)) return lang;
  return 'en';
}

// Native-script surface forms → English query words. Edit freely; entries are
// matched as substrings of the question so inflected forms still hit.
export const LEXICON = {
  ml: {
    'പ്രശോഭ്': 'prashobh', 'ക്വാളിസീൽ': 'qualizeal', 'ക്വാളിസീല്‍': 'qualizeal', 'മൈക്രോസോഫ്റ്റ്': 'microsoft',
    'സത്യ നാദെല്ല': 'satya nadella', 'ഹൈദരാബാദ്': 'hyderabad', 'കേരള': 'kerala', 'സ്പിതി': 'spiti',
    'മണാലി': 'manali', 'കീ മൊണാസ്ട്രി': 'key monastery', 'ടാബോ': 'tabo', 'യൂട്യൂബ്': 'youtube',
    'വീഡിയോ': 'video', 'ചാനൽ': 'channel', 'ജോലി': 'work role', 'കമ്പനി': 'company', 'പ്രോജക്ട്': 'project',
    'പ്രോജക്റ്റ്': 'project', 'സ്കിൽ': 'skills', 'കഴിവ്': 'skills', 'കഴിവ': 'skills', 'പഠിച്ച': 'study education degree',
    'വിദ്യാഭ്യാസം': 'education', 'എവിടെ': 'where', 'ആരാണ്': 'who is', 'എന്താണ്': 'what is',
    'ഇപ്പോൾ': 'currently', 'കുടുംബം': 'family', 'കുടുംബ': 'family', 'കുട്ടികൾ': 'children', 'മക്കൾ': 'children', 'ഭാര്യ': 'wife', 'അച്ഛൻ': 'father', 'അമ്മ': 'mother', 'യാത്ര': 'travel journey', 'ലിങ്ക്ഡ്ഇൻ': 'linkedin', 'ഗിറ്റ്ഹബ്': 'github', 'കൂടെ ആപ്പ്': 'koode', 'പാചക ലോകം': 'pachaka lokam', 'ബന്ധപ്പെട': 'contact', 'പ്രോജക്റ്റുകൾ': 'projects',
    'നിങ്ങൾ': 'you', 'താങ്കൾ': 'you', 'നിന്ന്': 'hometown', 'നാട്': 'hometown from', 'സ്വദേശം': 'hometown from', 'താമസം': 'live', 'ഹോബി': 'hobbies',
  },
  te: {
    'ప్రశోభ్': 'prashobh', 'క్వాలిజీల్': 'qualizeal', 'మైక్రోసాఫ్ట్': 'microsoft', 'సత్య నాదెళ్ల': 'satya nadella',
    'హైదరాబాద్': 'hyderabad', 'స్పితి': 'spiti', 'మనాలి': 'manali', 'యూట్యూబ్': 'youtube', 'వీడియో': 'video',
    'ఛానల్': 'channel', 'ఉద్యోగం': 'work job role', 'పని': 'work', 'కంపెనీ': 'company', 'ప్రాజెక్ట్': 'project',
    'నైపుణ్యాలు': 'skills', 'చదువు': 'education degree', 'విద్య': 'education', 'ఎక్కడ': 'where',
    'ఎవరు': 'who is', 'ఏమిటి': 'what is', 'ప్రస్తుతం': 'currently', 'కుటుంబం': 'family', 'పిల్లలు': 'children', 'భార్య': 'wife', 'నాన్న': 'father', 'అమ్మ': 'mother', 'ప్రయాణం': 'travel journey',
    'మీరు': 'you', 'మీ': 'your', 'ఉంటారు': 'live', 'సంప్రదించ': 'contact', 'ప్రాజెక్టులు': 'projects', 'సంప్రదించడం': 'contact', 'సంప్రదించాలి': 'contact', 'నుండి': 'hometown', 'వచ్చారు': 'hometown', 'ఊరు': 'hometown from', 'నివసిస్తున్నారు': 'live', 'అభిరుచులు': 'hobbies',
  },
  ta: {
    'பிரஷோப்': 'prashobh', 'நீங்கள்': 'you', 'உங்கள்': 'your', 'உங்களுடைய': 'your', 'எங்கே': 'where', 'எங்கு': 'where',
    'வேலை': 'work', 'பணி': 'work', 'நிறுவனம்': 'company', 'குடும்பம்': 'family', 'குழந்தைகள்': 'children', 'பிள்ளைகள்': 'children',
    'மனைவி': 'wife', 'அப்பா': 'father', 'அம்மா': 'mother', 'திட்டங்கள்': 'projects', 'திட்டம்': 'project', 'ப்ராஜெக்ட்': 'project',
    'படிப்பு': 'education degree', 'கல்வி': 'education', 'யார்': 'who is', 'என்ன': 'what is', 'திறமைகள்': 'skills', 'திறன்கள்': 'skills',
    'யூடியூப்': 'youtube', 'சேனல்': 'channel', 'வீடியோ': 'video', 'பயணம்': 'travel journey', 'சொந்த ஊர்': 'hometown', 'ஊர்': 'hometown',
    'வசிக்கிறீர்கள்': 'live', 'படித்த': 'study education degree', 'தொடர்பு கொள்': 'contact', 'பொழுதுபோக்கு': 'hobbies', 'தொடர்பு': 'contact', 'ஹைதராபாத்': 'hyderabad', 'கேரளா': 'kerala',
    'குவாலிசீல்': 'qualizeal', 'கூடே': 'koode', 'பாசக லோகம்': 'pachaka lokam', 'ஸ்பிதி': 'spiti', 'மணாலி': 'manali',
  },
  hi: {
    'प्रशोभ': 'prashobh', 'क्वालिज़ील': 'qualizeal', 'क्वालिजील': 'qualizeal', 'माइक्रोसॉफ्ट': 'microsoft',
    'सत्या नडेला': 'satya nadella', 'सत्य नडेला': 'satya nadella', 'हैदराबाद': 'hyderabad', 'स्पीति': 'spiti',
    'मनाली': 'manali', 'यूट्यूब': 'youtube', 'वीडियो': 'video', 'चैनल': 'channel', 'काम': 'work',
    'नौकरी': 'job role', 'प्रोजेक्ट्स': 'projects', 'संपर्क': 'contact', 'कौशल': 'skills', 'कंपनी': 'company', 'प्रोजेक्ट': 'project', 'कौशल': 'skills', 'पढ़ाई': 'education degree',
    'शिक्षा': 'education', 'कहाँ': 'where', 'कहां': 'where', 'कौन': 'who is', 'क्या': 'what is',
    'अभी': 'currently', 'परिवार': 'family', 'बच्चे': 'children', 'पत्नी': 'wife', 'पिता': 'father', 'माँ': 'mother', 'यात्रा': 'travel journey',
    'आप': 'you', 'संपर्क': 'contact', 'पढ़ाई': 'study education degree', 'आपके': 'your', 'आपकी': 'your', 'आपका': 'your', 'कहाँ से': 'hometown', 'कहां से': 'hometown', 'रहते': 'live', 'शौक': 'hobbies',
  },
};

/**
 * Expand a question for retrieval: the original text (so same-script evidence
 * matches) plus the English forms of any lexicon entries it contains.
 * @returns {{query:string, lang:string, added:string[]}}
 */
export function expandQuery(question) {
  const q = String(question || '');
  const lang = detectScript(q);
  if (lang === 'en') return { query: q, lang, added: [] };
  const added = [];
  for (const [native, english] of Object.entries(LEXICON[lang] || {})) {
    if (q.includes(native) && !added.includes(english)) added.push(english);
  }
  return { query: added.length ? `${q} ${added.join(' ')}` : q, lang, added };
}

/** Plain-language note when an Indic-script question is answered from English evidence. */
export function languageNote(lang, evidenceLangs) {
  if (lang === 'en') return null;
  const name = LANGS[lang] ? LANGS[lang].label : lang;
  if (evidenceLangs.includes(lang)) return null;
  return `Asked in ${name}; the sources that answer are in English, quoted as they are. Malayalam, Telugu, Tamil and Hindi evidence is used when a video or transcript has it.`;
}
