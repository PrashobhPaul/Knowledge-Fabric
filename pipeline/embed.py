"""Sentence embeddings for the fabric — the semantic NLU behind the canon and retrieval.

Runs after build_index. With `sentence-transformers` and the model available
(the deploy workflow has both), it writes site/data/vectors.json:

    { "model": "sentence-transformers/all-MiniLM-L6-v2", "dims": 384,
      "canon":  [{"id": "...", "vectors": [[...], ...]}],   # one vector per question variant
      "chunks": [[...], ...] }                              # one vector per index chunk, same order

The browser embeds the visitor's question with the same model (transformers.js,
mean pooling, L2-normalised) and compares by cosine, so "favourite journey" and
"the trip that changed you" land together without a keyword in common.

Without the model (offline builds, CI without the download) it writes nothing
and the site falls back to the lexical matcher. Never fails the build.

    python -m pipeline.embed --index site/data/index.json --out site/data/vectors.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", default="site/data/index.json")
    ap.add_argument("--out", default="site/data/vectors.json")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError:
        print("[embed] sentence-transformers not installed — lexical matching only")
        return 0
    try:
        model = SentenceTransformer(args.model)
    except Exception as exc:  # noqa: BLE001 — no network, no model: degrade, do not fail
        print(f"[embed] model unavailable ({type(exc).__name__}) — lexical matching only")
        return 0
    idx = json.loads(Path(args.index).read_text(encoding="utf-8"))
    canon_out = []
    for e in idx.get("canon") or []:
        qs = [str(q) for q in e.get("questions") or []]
        vecs = model.encode(qs, normalize_embeddings=True).tolist() if qs else []
        canon_out.append({"id": e["id"], "vectors": [[round(x, 4) for x in v] for v in vecs]})
    texts = [c.get("text", "")[:1000] for c in idx.get("chunks") or []]
    cvecs = model.encode(texts, normalize_embeddings=True, batch_size=64).tolist() if texts else []
    out = {"model": args.model, "dims": len(cvecs[0]) if cvecs else 384,
           "canon": canon_out, "chunks": [[round(x, 4) for x in v] for v in cvecs]}
    Path(args.out).write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"[embed] {len(canon_out)} canon entries · {len(cvecs)} chunks · {Path(args.out).stat().st_size/1e6:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
