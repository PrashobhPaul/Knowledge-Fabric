#!/usr/bin/env bash
# Local dev: optionally sync sources (Factory), build the index (Fabric), serve the site.
#   ./scripts/dev.sh            build + serve
#   ./scripts/dev.sh --sync     sync live sources first, then build + serve
set -e
cd "$(dirname "$0")/.."

echo "[*] Installing dependencies..."
pip install -q -r pipeline/requirements.txt

if [ "${1:-}" = "--sync" ]; then
  echo "[*] Knowledge Factory: syncing live sources..."
  python -m knowledge_factory.sync
fi

echo "[*] Knowledge Fabric: building index..."
python -m pipeline.build_index --source docs_source --knowledge knowledge_sources \
  --out site/data/index.json --semantic-out site/data/semantic.json

echo "[*] Serving site at http://localhost:8000  (Ctrl+C to stop)"
python -m http.server 8000 --directory site
