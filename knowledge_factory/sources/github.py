"""GitHub source — public repositories as structured project records.

Uses the unauthenticated REST API (60 requests/hour is plenty for one user's
repository list) plus the raw README of each non-fork repository, capped so a
single verbose README cannot dominate retrieval. If GITHUB_TOKEN is present in
the environment (it is, inside GitHub Actions) it is used for the higher limit.
"""
from __future__ import annotations

import os
from pathlib import Path

from ..common import SyncResult, http_get, read_json, write_json

API = "https://api.github.com"
RAW = "https://raw.githubusercontent.com"

REPO_KEYS = ("name", "full_name", "description", "language", "topics", "stargazers_count",
             "forks_count", "created_at", "pushed_at", "html_url", "homepage", "fork",
             "archived", "readme")


def _headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    tok = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if tok:
        h["Authorization"] = f"Bearer {tok}"
    return h


def _readme(full_name: str, default_branch: str, cap: int) -> str:
    for name in ("README.md", "readme.md", "README.MD", "README"):
        try:
            text = http_get(f"{RAW}/{full_name}/{default_branch}/{name}").text
        except Exception:
            continue
        return text[:cap]
    return ""


def sync(config: dict, out_dir: Path, repo_root: Path) -> SyncResult:
    res = SyncResult("github")
    cfg = config["github"]
    gh_dir = out_dir / "github"
    prev = {r["name"]: r for r in read_json(gh_dir / "repos.json", {"repos": []}).get("repos", [])}

    repos, page = [], 1
    while True:
        batch = http_get(f"{API}/users/{cfg['user']}/repos",
                         params={"per_page": 100, "page": page, "type": "owner", "sort": "pushed"},
                         headers=_headers()).json()
        if not batch:
            break
        repos.extend(batch)
        page += 1
        if len(batch) < 100:
            break

    out = []
    for r in repos:
        if r.get("fork") and not cfg.get("include_forks"):
            continue
        rec = {k: r.get(k) for k in REPO_KEYS if k != "readme"}
        old = prev.get(r["name"], {})
        # Only refetch a README when the repo moved since last sync.
        if old.get("pushed_at") == r.get("pushed_at") and old.get("readme") is not None:
            rec["readme"] = old["readme"]
        else:
            rec["readme"] = _readme(r["full_name"], r.get("default_branch", "main"),
                                    int(cfg.get("readme_max_chars", 4000)))
        out.append(rec)

    out.sort(key=lambda r: r.get("pushed_at") or "", reverse=True)
    write_json(gh_dir / "repos.json", {"user": cfg["user"], "repos": out})
    res.files = [f"{gh_dir.relative_to(repo_root)}/repos.json"]
    res.records = len(out)
    res.notes.append(f"{len(out)} repositories ({sum(1 for r in out if r.get('readme'))} with README)")
    return res
