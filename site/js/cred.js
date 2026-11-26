// ============================================================================
// Credibility facts — the short strip under the hero, read from the index
// ============================================================================
//
// Six numbers a visitor would otherwise have to dig for, each computed from the
// same built index the answers come from, so the strip can never drift from
// the record. Every fact carries its own source line, shown on hover or tap.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

function ym(s) {
  const m = /^(\d{4})-(\d{2})/.exec(String(s || ''));
  return m ? { y: +m[1], m: +m[2] - 1 } : null;
}

function listPhrase(xs) {
  if (xs.length <= 1) return xs.join('');
  return xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
}

/**
 * @param {Object} index  the built index
 * @param {Date}   now
 * @returns {{ current: Object|null, facts: Array<{key, value, label, tip}> }}
 */
export function credibilityFacts(index, now = new Date()) {
  const facts = [];
  const timeline = [...(index.timeline || [])].sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const chunks = index.chunks || [];
  const rt = (c) => (c.meta && c.meta.record_type) || '';

  // Years in AI: from the first role on the career timeline to today.
  const first = timeline[0];
  const start = first && ym(first.start);
  if (start) {
    const months = (now.getFullYear() - start.y) * 12 + (now.getMonth() - start.m);
    const years = Math.floor(months / 12);
    facts.push({
      key: 'years', value: years, suffix: '+', label: 'years in AI',
      tip: `Since ${MONTHS[start.m]} ${start.y}, his first role: ${first.role} at ${first.organization}.`,
    });
  }

  // Organisations on the career timeline.
  const orgs = [...new Set(timeline.map(t => t.short_name || t.organization).filter(Boolean))];
  if (orgs.length) {
    facts.push({
      key: 'companies', value: orgs.length, label: 'companies',
      tip: `From the career timeline: ${listPhrase(orgs)}.`,
    });
  }

  // Products: projects with a live app, source or architecture diagram on record.
  const products = Object.keys(index.showcase || {});
  if (products.length) {
    facts.push({
      key: 'products', value: products.length, label: 'products built',
      tip: `With a live app, source code or architecture on record: ${listPhrase(products)}.`,
    });
  }

  // Public repositories, one record each.
  const repos = new Set(chunks.filter(c => rt(c) === 'repository').map(c => c.document_id)).size;
  if (repos) {
    facts.push({
      key: 'repos', value: repos, label: 'public repositories',
      tip: `Repositories indexed from GitHub · PrashobhPaul.`,
    });
  }

  // Videos on his channel, long-form and Shorts.
  const videos = chunks.filter(c => rt(c) === 'video');
  if (videos.length) {
    const shorts = videos.filter(c => (c.meta || {}).format === 'short').length;
    const channel = chunks.find(c => rt(c) === 'channel');
    const name = channel && channel.meta && channel.document_name ? channel.document_name.replace(/^YouTube · /, '') : 'his channel';
    facts.push({
      key: 'videos', value: videos.length, label: 'videos published',
      tip: `On ${name}: ${videos.length - shorts} long-form videos and ${shorts} Shorts.`,
    });
  }

  // Spoken languages.
  const langs = (index.entities || []).filter(e => e.kind === 'Language').map(e => e.name);
  if (langs.length) {
    facts.push({
      key: 'languages', value: langs.length, label: 'languages spoken',
      tip: `${listPhrase(langs)}.`,
    });
  }

  const cur = timeline.find(t => !t.end) || null;
  return {
    current: cur ? { role: cur.role, organization: cur.organization, location: cur.location || '' } : null,
    facts,
  };
}
