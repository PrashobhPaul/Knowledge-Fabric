"""Knowledge Factory orchestrator.

    python -m knowledge_factory.sync                 # every source
    python -m knowledge_factory.sync --only youtube  # one source
    python -m knowledge_factory.sync --dry-run       # fetch, report, write nothing

Each source runs independently. A failure is recorded in the manifest and the
previous output for that source stays on disk — the Fabric build that follows
still has a complete corpus, just a slightly older one for that source.
"""
from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from .common import load_config, now_iso, read_json, write_json
from .sources import github, linkedin, website, youtube

SOURCES = {
    "website": website.sync,
    "youtube": youtube.sync,
    "github": github.sync,
    "linkedin": linkedin.sync,
}

ROOT = Path(__file__).resolve().parents[1]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Sync live sources into knowledge_sources/")
    ap.add_argument("--config", type=Path, default=ROOT / "knowledge_factory" / "config.yaml")
    ap.add_argument("--only", help="comma-separated subset: website,youtube,github,linkedin")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    config = load_config(args.config)
    out_dir = ROOT / config.get("output_dir", "knowledge_sources")
    if args.dry_run:
        out_dir = Path(tempfile.mkdtemp(prefix="factory-dry-"))
    manifest_path = (ROOT / config.get("output_dir", "knowledge_sources")) / "manifest.json"
    manifest = read_json(manifest_path, {"sources": {}})

    wanted = [s.strip() for s in args.only.split(",")] if args.only else list(SOURCES)
    print("=" * 66)
    print("  KNOWLEDGE FACTORY - SYNC")
    print("=" * 66)
    print(f"  person   {config['person']['name']}")
    print(f"  sources  {', '.join(wanted)}")
    print(f"  output   {out_dir}{'  (dry run)' if args.dry_run else ''}\n")

    failures = 0
    for name in wanted:
        fn = SOURCES.get(name)
        if not fn:
            print(f"  ! unknown source {name}")
            continue
        print(f"[{name}]")
        try:
            result = fn(config, out_dir, ROOT)
        except Exception as exc:  # noqa: BLE001 — every source failure is non-fatal
            from .common import SyncResult
            result = SyncResult(name).fail(exc)
            failures += 1
        for note in result.notes:
            print(f"      {note}")
        print(f"      status={result.status} records={result.records}"
              + (f" error={result.error}" if result.error else ""))
        if not args.dry_run:
            entry = result.as_dict()
            if result.status != "ok" and name in manifest["sources"]:
                # Keep the last good sync time visible next to the error.
                entry["last_good_sync"] = manifest["sources"][name].get("last_good_sync") \
                    or manifest["sources"][name].get("last_synced")
            else:
                entry["last_good_sync"] = entry["last_synced"]
            manifest["sources"][name] = entry

    if not args.dry_run:
        manifest["person"] = config["person"]
        manifest["generated_at"] = now_iso()
        manifest["generator"] = "knowledge-factory/1.0"
        write_json(manifest_path, manifest)
        print(f"\n[OK] {manifest_path.relative_to(ROOT)}")
    print("=" * 66)
    return 1 if failures == len(wanted) else 0


if __name__ == "__main__":
    sys.exit(main())
