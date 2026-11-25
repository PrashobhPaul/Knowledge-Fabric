// ============================================================================
// Related — the cross-source "explore further" strip under every answer
// ============================================================================
//
// An answer about a project should hand the reader the project page AND its
// repository; an answer about a video should hand them the video at the right
// second; a "no" should still point at the nearest thing that exists. The
// knowledge graph already joins these (a Project node seen on the website and
// on GitHub is one node). This module walks that join and renders it as cards.

import { evidencePrior, termSatisfied } from './nlu.js?v=7';

const KIND_ORDER = ['project', 'repository', 'video', 'chapter', 'transcript', 'post', 'event', 'engagement'];
const MAX_CARDS = 6;

function card(kind, title, url, sub, extra = {}) {
  return { kind, title, url, sub, ...extra };
}

function stripExt(name) {
  return String(name || '').replace(/\.(pdf|docx?|md|markdown|txt)$/i, '').replace(/_/g, ' ');
}

/** Cards for one chunk, by its record type. */
function cardsFor(chunk) {
  const m = chunk.meta || {};
  const rt = m.record_type || '';
  const out = [];
  if (rt === 'project') {
    if (m.live_url) out.push(card('project', m.project || chunk.document_name, m.live_url, 'open the app'));
    if (m.source_url) out.push(card('repository', `${m.project || ''} · source`, m.source_url, 'GitHub repository'));
    if (!m.live_url && !m.source_url && chunk.url) out.push(card('project', m.project || chunk.document_name, chunk.url, 'on the website'));
  } else if (rt === 'repository') {
    out.push(card('repository', m.project || chunk.document_name, chunk.url, `GitHub · ${m.language || 'code'}${m.pushed ? ' · updated ' + String(m.pushed).slice(0, 7) : ''}`));
  } else if (rt === 'video' || rt === 'chapter' || rt === 'transcript') {
    const t = m.t_label ? ` · ▶ ${m.t_label}` : '';
    out.push(card('video', m.video_title || chunk.document_name, chunk.url,
                  `${rt === 'video' ? (m.format === 'short' ? 'YouTube Short' : 'YouTube video') : 'YouTube' }${t}`,
                  { thumbnail: m.thumbnail || '', videoId: m.video_id || '', t: m.t || 0 }));
  } else if (rt === 'post') {
    out.push(card('post', chunk.document_name.replace(/^LinkedIn · /, ''), chunk.url, 'LinkedIn post'));
  } else if (rt === 'event') {
    out.push(card('event', m.event || chunk.document_name, chunk.url, 'event'));
  } else if (rt === 'engagement') {
    out.push(card('engagement', m.project || chunk.document_name, chunk.url, `at ${m.organization || 'Qualizeal'}`));
  }
  return out;
}

/**
 * Join: for every Project named in the citations (or the question's focus),
 * find its website card AND its repository, whichever the answer cited.
 */
function projectJoins(citations, analysis, index) {
  const names = new Set();
  for (const c of citations) {
    const p = c.chunk.meta && c.chunk.meta.project;
    if (p) names.add(String(p).toLowerCase());
  }
  for (const f of (analysis && analysis.focus) || []) names.add(f.toLowerCase().replace(/\s+/g, ' '));
  if (!names.size) return [];
  const out = [];
  for (const ch of index.chunks) {
    const m = ch.meta || {};
    if (!m.project) continue;
    const p = String(m.project).toLowerCase();
    if (![...names].some(n => p === n || p.replace(/[.\s-]/g, '') === n.replace(/[.\s-]/g, ''))) continue;
    if (m.record_type === 'project' || m.record_type === 'repository' || m.record_type === 'engagement') out.push(...cardsFor(ch));
  }
  return out;
}

/**
 * @param {Object}  args
 * @param {Array}   args.citations   the answer's citations
 * @param {Array}   args.ranked      full retrieval pool ({chunkIdx, score}) — for "nearest" when the answer is weak
 * @param {Object}  args.analysis
 * @param {Object}  args.index
 * @param {boolean} args.weak        true when the answer is a no / not-directly / low confidence
 */
export function relatedItems({ citations = [], ranked = [], analysis = null, index, weak = false }) {
  const cards = [];
  const seen = new Set();
  const push = (c) => {
    // Engagements share the website URL, so they de-duplicate by name.
    const key = c.kind === 'engagement' ? `engagement:${c.title}` : (c.url || c.title).replace(/&t=\d+s$/, '');
    if (!c.url || seen.has(key)) return;
    seen.add(key);
    cards.push(c);
  };

  // 1. What the answer actually cited, resolved to openable things.
  for (const c of citations) for (const k of cardsFor(c.chunk)) push(k);
  // 2. Cross-source joins for any project involved.
  for (const k of projectJoins(citations, analysis, index)) push(k);
  // 2b. A current-role answer hands over the current engagements.
  if (analysis && analysis.scope === 'current') {
    for (const ch of index.chunks) {
      if ((ch.meta || {}).record_type === 'engagement') for (const k of cardsFor(ch)) push(k);
    }
  }
  // 3. When the answer is weak, the nearest openable things from retrieval —
  //    "not what you asked, but the closest that exists".
  if (weak) {
    for (const r of ranked.slice(0, 16)) {
      const ch = index.chunks[r.chunkIdx];
      if (!ch) continue;
      // Same routing the answer obeys: a career question does not get a
      // travel Short as "related", a YouTube question does not get a project.
      if (analysis && evidencePrior(ch, analysis.intent, analysis.scope) < 0.5) continue;
      for (const k of cardsFor(ch)) push(k);
      if (cards.length >= MAX_CARDS) break;
    }
  }
  // A yes/no question's related cards are the ones that bear on what was asked:
  // "teach AI" → the AI Tour video before the Christmas Short.
  if (analysis && analysis.polar && analysis.predicate && analysis.predicate.length) {
    // Platform words ("on YouTube") are satisfied by every card of that platform
    // and so say nothing about which card bears on the question.
    const PLATFORM = new Set(['youtube', 'video', 'videos', 'channel', 'linkedin', 'github', 'website', 'site', 'online', 'post', 'posts']);
    const terms = analysis.predicate.filter(p => !PLATFORM.has(p.term));
    const hits = (c) => terms.filter(p => termSatisfied(`${c.title} ${c.sub}`, p)).length;
    const scored = cards.map(c => ({ c, h: hits(c) }));
    const any = scored.some(x => x.h > 0);
    const keep = any ? scored.filter(x => x.h > 0) : scored;
    keep.sort((a, b) => b.h - a.h || KIND_ORDER.indexOf(a.c.kind) - KIND_ORDER.indexOf(b.c.kind));
    return keep.slice(0, MAX_CARDS).map(x => x.c);
  }
  cards.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));
  return cards.slice(0, MAX_CARDS);
}

const ICON = { project: '◆', repository: '⌥', video: '▶', post: 'in', event: '◎', engagement: '◆' };

export function renderRelated(cards, { label = 'Explore' } = {}) {
  if (!cards.length) return '';
  return `
    <div class="related">
      <span class="related-label">${escapeHtml(label)}</span>
      <div class="related-cards">
        ${cards.map(c => `
          <a class="related-card" data-kind="${escapeHtml(c.kind)}" href="${escapeHtml(c.url)}" target="_blank" rel="noreferrer"${c.videoId ? ` data-video="${escapeHtml(c.videoId)}" data-t="${Number(c.t) || 0}" title="Play here"` : ''}>
            ${c.thumbnail ? `<img class="related-thumb" src="${escapeHtml(c.thumbnail)}" alt="" loading="lazy" />`
                          : `<span class="related-icon" aria-hidden="true">${ICON[c.kind] || '•'}</span>`}
            <span class="related-body">
              <span class="related-title">${escapeHtml(c.title)}</span>
              <span class="related-sub">${escapeHtml(c.sub)}</span>
            </span>
          </a>`).join('')}
      </div>
    </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
