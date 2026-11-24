"""LinkedIn source — profile extras, posts and events from the official data export.

LinkedIn has no public API and its pages require a login, so this source does
not crawl. It reads two things that are already on disk:

  knowledge_sources/linkedin/export/*.csv   the official "Get a copy of your data"
                                            export (Shares, Positions, Education,
                                            Certifications, Honors, Publications,
                                            Projects, Events, Recommendations…)
  knowledge_sources/linkedin/posts.md       posts pasted by hand, one per block:

      ## 2026-11-20 · https://www.linkedin.com/posts/...
      Post text…

Both are merged into posts.json / events.json / profile_extra.json. Nothing is
fetched from linkedin.com. Re-export every few months and upload the CSVs; the
rest of the pipeline treats the result like any other synced source.
"""
from __future__ import annotations

import csv
import re
from datetime import datetime
from pathlib import Path

from ..common import SyncResult, write_json

POST_BLOCK_RE = re.compile(r"^##\s*(\d{4}-\d{2}-\d{2})?\s*(?:[·\-|]\s*)?(https?://\S+)?\s*$", re.M)


def _norm(h: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", h.strip().lower()).strip("_")


def _rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8-sig") as f:
        # LinkedIn exports sometimes carry a one-line notice before the header.
        head = f.readline()
        f.seek(0)
        if "," not in head:
            f.readline()
        return [{_norm(k): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(f)]


def _date(s: str) -> str:
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%b %Y", "%m/%d/%Y", "%d %b %Y", "%Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d") if fmt != "%b %Y" and fmt != "%Y" \
                else datetime.strptime(s, fmt).strftime("%Y-%m-01" if fmt == "%b %Y" else "%Y-01-01")
        except ValueError:
            continue
    return s[:10] if re.match(r"\d{4}-\d{2}-\d{2}", s) else ""


def _find(export: Path, *names: str) -> Path | None:
    for n in names:
        for p in export.glob("*.csv"):
            if p.stem.lower().replace("_", "").replace(" ", "") == n.lower().replace("_", "").replace(" ", ""):
                return p
    return None


def parse_posts_md(path: Path) -> list[dict]:
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    posts = []
    parts = POST_BLOCK_RE.split(text)
    # split() yields: [pre, date, url, body, date, url, body, ...]
    for i in range(1, len(parts), 3):
        date, url, body = parts[i] or "", parts[i + 1] or "", (parts[i + 2] or "").strip()
        if not body:
            continue
        posts.append({"id": f"manual:{url or date or len(posts)}", "date": date, "url": url,
                      "text": body, "source": "posts.md"})
    return posts


def sync(config: dict, out_dir: Path, repo_root: Path) -> SyncResult:
    res = SyncResult("linkedin")
    cfg = config.get("linkedin", {})
    li_dir = out_dir / "linkedin"
    export = li_dir / "export"
    profile_url = cfg.get("profile_url", "")

    # ---- posts: export + manual, de-duplicated by URL
    posts: dict[str, dict] = {}
    shares = _find(export, "Shares") if export.exists() else None
    for r in _rows(shares) if shares else []:
        text = r.get("sharecommentary") or r.get("share_commentary") or ""
        if len(text) < 20:
            continue
        url = r.get("sharelink") or r.get("share_link") or ""
        posts[url or text[:60]] = {"id": url or f"share:{len(posts)}", "date": _date(r.get("date", "")),
                                   "url": url, "text": text, "shared_url": r.get("sharedurl") or r.get("shared_url") or "",
                                   "source": "export/Shares.csv"}
    for p in parse_posts_md(li_dir / "posts.md"):
        posts.setdefault(p["url"] or p["text"][:60], p)
    posts_out = sorted(posts.values(), key=lambda p: p.get("date") or "", reverse=True)

    # ---- events
    events = []
    ev = _find(export, "Events") if export.exists() else None
    for r in _rows(ev) if ev else []:
        name = r.get("event_name") or r.get("eventname") or r.get("name") or ""
        if not name:
            continue
        events.append({"name": name, "date": _date(r.get("event_time") or r.get("eventtime") or r.get("date", "")),
                       "url": r.get("external_url") or r.get("externalurl") or "", "role": r.get("role") or "attendee",
                       "source": "export/Events.csv"})

    # ---- profile extras: things the website and resume do not carry
    extra: dict = {"profile_url": profile_url}
    for key, names, fields in (
        ("certifications", ("Certifications",), ("name", "authority", "started_on", "finished_on", "url", "license_number")),
        ("honors", ("Honors",), ("title", "description", "issued_on", "issuer")),
        ("publications", ("Publications",), ("name", "published_on", "description", "publisher", "url")),
        ("projects", ("Projects",), ("title", "description", "url", "started_on", "finished_on")),
        ("recommendations", ("Recommendations_Received", "RecommendationsReceived"), ("first_name", "last_name", "company", "job_title", "text", "creation_date")),
        ("skills", ("Skills",), ("name",)),
        ("courses", ("Courses",), ("name", "number")),
        ("languages", ("Languages",), ("name", "proficiency")),
    ):
        p = _find(export, *names) if export.exists() else None
        rows = _rows(p) if p else []
        extra[key] = [{f: r.get(f, "") for f in fields} for r in rows if any(r.get(f) for f in fields)]

    write_json(li_dir / "posts.json", {"profile_url": profile_url, "posts": posts_out})
    write_json(li_dir / "events.json", {"events": events})
    write_json(li_dir / "profile_extra.json", extra)
    res.files = [f"{li_dir.relative_to(repo_root)}/{n}" for n in ("posts.json", "events.json", "profile_extra.json")]
    res.records = len(posts_out) + len(events) + sum(len(v) for v in extra.values() if isinstance(v, list))
    res.notes.append(f"{len(posts_out)} posts · {len(events)} events · "
                     f"{sum(len(v) for v in extra.values() if isinstance(v, list))} profile extras")
    if not export.exists() or not any(export.glob("*.csv")):
        res.notes.append("no LinkedIn export found — upload the CSVs from 'Get a copy of your data' to "
                         "knowledge_sources/linkedin/export/ to index posts, certifications, honors and events")
    return res
