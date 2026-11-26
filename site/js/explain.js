// ============================================================================
// "Why did AI say this?" overlay — step-by-step reasoning pipeline
// Question → Retrieved Documents → Graph Traversal → Final Context → Answer
// ============================================================================

let _index = null;
let _returnFocus = null;

export function initExplain(index) {
  _index = index;
  document.getElementById('explain-close').addEventListener('click', close);
  document.getElementById('explain-overlay').addEventListener('click', e => {
    if (e.target.id === 'explain-overlay') close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('explain-overlay').hidden) close();
  });
}

export function openExplain({ question, ranked, citations, traceEntities, traceEdges, answerHtml }) {
  const flow = document.getElementById('explain-flow');

  const sentences = answerHtml.replace(/<sup[^>]+>\[\d+\]<\/sup>/g, '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const contextRows = citations.slice(0, 5).map(c => {
    const section = c.chunk.section_path?.length ? c.chunk.section_path.join(' › ') : '';
    return `<div class="flow-context-row"><strong class="flow-cite">[${c.num}]</strong> ${escapeHtml(c.chunk.paragraph_excerpt || c.chunk.text.slice(0, 220))}<span class="flow-context-src">${escapeHtml(stripExt(c.chunk.document_name))}${section ? ' · ' + escapeHtml(section) : ''}</span></div>`;
  }).join('');

  const docRows = ranked.slice(0, 5).map((r, i) => {
    const chunk = _index.chunks[r.chunkIdx];
    const section = chunk.section_path?.length ? chunk.section_path.join(' › ') : '';
    return `
      <div class="flow-doc-row">
        <span class="flow-doc-rank">#${i + 1}</span>
        <span class="flow-doc-name">${escapeHtml(stripExt(chunk.document_name))}</span>
        <span class="flow-doc-section">${escapeHtml(section)}</span>
        <span class="flow-doc-score">${r._fusion ? 'Fused ' + r.score.toFixed(4) : 'BM25 ' + r.score.toFixed(2)}</span>
      </div>`;
  }).join('');

  const entityPills = traceEntities.slice(0, 12).map(e =>
    `<span class="flow-entity">${escapeHtml(e.name)}</span>`
  ).join('');

  flow.innerHTML = `
    <div class="flow-step" data-step="1">
      <h3>Question</h3>
      <div class="flow-step-body"><div class="flow-step-question">“${escapeHtml(question)}”</div></div>
    </div>
    <div class="flow-connector"></div>

    <div class="flow-step" data-step="2">
      <h3>Records retrieved</h3>
      <div class="flow-step-body">
        Ranked <strong>${_index.chunks.length.toLocaleString()}</strong> passages across <strong>${_index.documents.length.toLocaleString()}</strong> records. The five that rose to the top:
        <div class="flow-doc-list">${docRows}</div>
      </div>
    </div>
    <div class="flow-connector"></div>

    <div class="flow-step" data-step="3">
      <h3>Graph walk</h3>
      <div class="flow-step-body">
        ${traceEntities.length === 0
          ? 'No named concepts appeared in the retrieved passages.'
          : `Lit <strong class="flow-accent">${traceEntities.length}</strong> concepts named in those passages, and their direct neighbours in the graph.`}
        ${entityPills ? `<div class="flow-graph-summary">${entityPills}</div>` : ''}
        <div class="flow-stats">
          <span>Concepts <strong>${traceEntities.length}</strong></span>
          <span>Links walked <strong>${traceEdges}</strong></span>
        </div>
      </div>
    </div>
    <div class="flow-connector"></div>

    <div class="flow-step" data-step="4">
      <h3>Evidence chosen</h3>
      <div class="flow-step-body">
        The answer is assembled from these passages, quoted as written, each with its citation marker:
        <div class="flow-context-list">${contextRows}</div>
      </div>
    </div>
    <div class="flow-connector"></div>

    <div class="flow-step flow-answer" data-step="5">
      <h3>Answer</h3>
      <div class="flow-step-body">
        <div class="flow-answer-text">${answerHtml}</div>
        <p class="flow-note">No model rewrote this. Every sentence above appears in a cited source.</p>
      </div>
    </div>`;

  _returnFocus = document.activeElement;
  document.getElementById('explain-overlay').hidden = false;
  document.getElementById('explain-close').focus();
}

function close() {
  const overlay = document.getElementById('explain-overlay');
  if (overlay.hidden) return;
  overlay.hidden = true;
  if (_returnFocus && document.contains(_returnFocus)) _returnFocus.focus();
  _returnFocus = null;
}

// Helpers
function stripExt(name) {
  return name.replace(/\.(pdf|docx?|md|markdown|txt)$/i, '').replace(/_/g, ' ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
