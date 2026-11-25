// ============================================================================
// Semantic NLU — the visitor's question as a sentence embedding
// ============================================================================
//
// The Factory embeds every canon question variant and every chunk with
// all-MiniLM-L6-v2 (pipeline/embed.py → data/vectors.json). Here the same model
// runs in the browser through transformers.js (WebGPU or WASM, ~23 MB, cached
// after the first visit), so a question is matched by meaning: "favourite
// journey" sits next to "which trip changed you the most" with no word shared.
// Loading is lazy and in the background; until it is ready the lexical
// matcher answers, and everything keeps working if the CDN is unreachable.

const LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/transformers.min.js';
const MODEL = 'Xenova/all-MiniLM-L6-v2';

const state = { vectors: null, extractor: null, loading: null, failed: false };

export async function loadVectors(url = 'data/vectors.json') {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    state.vectors = r.ok ? await r.json() : null;
  } catch { state.vectors = null; }
  return state.vectors;
}
export function vectorsReady() { return !!(state.vectors && state.vectors.canon && state.vectors.canon.length); }
export function modelReady() { return !!state.extractor; }

/** Start loading the model; resolves to true when usable. Safe to call many times. */
export function warmModel() {
  if (state.extractor) return Promise.resolve(true);
  if (state.failed) return Promise.resolve(false);
  if (!state.loading) {
    state.loading = (async () => {
      try {
        const tf = await import(LIB);
        tf.env.allowLocalModels = false;
        state.extractor = await tf.pipeline('feature-extraction', MODEL, { dtype: 'q8' });
        return true;
      } catch { state.failed = true; return false; }
    })();
  }
  return state.loading;
}

/** Embed a question: mean pooling + L2 normalisation, as sentence-transformers does. */
export async function embed(text) {
  if (!state.extractor) return null;
  try {
    const out = await state.extractor(String(text), { pooling: 'mean', normalize: true });
    return Array.from(out.data);
  } catch { return null; }
}

export function cosine(a, b) {
  let s = 0; const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Best canon entry by meaning. Returns {id, score, margin} or null.
 * `threshold` is cosine on normalised MiniLM vectors; 0.55 separates paraphrases
 * from merely related questions in practice, and the margin guards ties.
 */
export function matchCanonByVector(qvec, vectors = state.vectors, { threshold = 0.55, margin = 0.03 } = {}) {
  if (!qvec || !vectors || !vectors.canon) return null;
  const scored = [];
  for (const e of vectors.canon) {
    let best = -1;
    for (const v of e.vectors || []) best = Math.max(best, cosine(qvec, v));
    scored.push({ id: e.id, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored[0], next = scored[1];
  if (!top || top.score < threshold) return null;
  if (next && top.score - next.score < margin) return null;   // a tie is not a match
  return { id: top.id, score: top.score, margin: next ? top.score - next.score : 1 };
}

/** Retrieval run from chunk vectors: top-k chunks by cosine to the question. */
export function chunkRun(qvec, vectors = state.vectors, topK = 20) {
  if (!qvec || !vectors || !Array.isArray(vectors.chunks) || !vectors.chunks.length) return [];
  const out = [];
  for (let i = 0; i < vectors.chunks.length; i++) out.push({ chunkIdx: i, score: cosine(qvec, vectors.chunks[i]) });
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, topK);
}
