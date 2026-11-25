"""Shared helpers for Factory sources — HTTP with a polite UA, JSON I/O, time."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import requests

USER_AGENT = "knowledge-factory/1.0 (+https://github.com/PrashobhPaul/Prashobh_Knowledge_Factory)"
TIMEOUT = 30


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def http_get(url: str, **kw) -> requests.Response:
    headers = {"User-Agent": USER_AGENT, **kw.pop("headers", {})}
    resp = requests.get(url, headers=headers, timeout=TIMEOUT, **kw)
    resp.raise_for_status()
    return resp


def read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Stable key order and trailing newline so diffs in git stay reviewable.
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False, sort_keys=False) + "\n",
                    encoding="utf-8")


def load_config(path: Path) -> dict:
    import yaml
    return yaml.safe_load(path.read_text(encoding="utf-8"))


class SyncResult:
    """What one source produced. The manifest is built from these."""

    def __init__(self, source: str):
        self.source = source
        self.records = 0
        self.files: list[str] = []
        self.status = "ok"
        self.error: str | None = None
        self.notes: list[str] = []

    def fail(self, exc: Exception) -> "SyncResult":
        self.status = "error"
        self.error = f"{type(exc).__name__}: {exc}"
        return self

    def as_dict(self) -> dict:
        return {
            "status": self.status,
            "last_synced": now_iso(),
            "records": self.records,
            "files": self.files,
            "error": self.error,
            "notes": self.notes,
        }
