"""YouTube source — the channel's uploads as structured records, no API key.

Two acquisition paths, chosen by config:

  RSS (default)   https://www.youtube.com/feeds/videos.xml?channel_id=...
                  Public, keyless, reliable. Returns the latest ~15 uploads
                  with title, description, publish date and view count.
  yt-dlp (full)   If `full: true` and yt-dlp is importable, the complete upload
                  list is pulled with descriptions, tags and durations.

Either way the result is MERGED into the existing videos.json: a video seen
once is never forgotten, and richer fields (tags, duration) already on disk are
kept when the new fetch lacks them. The archive only grows.
"""
from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from pathlib import Path

from ..common import SyncResult, http_get, now_iso, read_json, write_json

NS = {
    "a": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}

VIDEO_KEYS = ("id", "title", "description", "publishedAt", "duration", "viewCount",
              "likeCount", "commentCount", "tags", "url", "thumbnail", "format")


def _format_for(duration: str | None, title: str) -> str:
    """Shorts vs long-form. YouTube does not expose this directly; duration
    under 3 minutes or a #shorts tag is the practical rule."""
    if re.search(r"#short", title, re.I):
        return "short"
    if duration:
        m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration)
        if m:
            h, mi, s = (int(x or 0) for x in m.groups())
            return "short" if (h * 3600 + mi * 60 + s) <= 180 else "long"
    return "unknown"


def fetch_rss(channel_id: str) -> tuple[dict, list[dict]]:
    url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    root = ET.fromstring(http_get(url).content)
    channel = {
        "title": root.findtext("a:title", default="", namespaces=NS),
        "channelId": channel_id,
        "url": next((l.get("href") for l in root.findall("a:link", NS) if l.get("rel") == "alternate"), ""),
        "published": root.findtext("a:published", default="", namespaces=NS),
    }
    videos = []
    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", default="", namespaces=NS)
        group = e.find("media:group", NS)
        desc = group.findtext("media:description", default="", namespaces=NS) if group is not None else ""
        stats = group.find("media:community/media:statistics", NS) if group is not None else None
        videos.append({
            "id": vid,
            "title": e.findtext("a:title", default="", namespaces=NS),
            "description": desc,
            "publishedAt": e.findtext("a:published", default="", namespaces=NS),
            "viewCount": int(stats.get("views")) if stats is not None and stats.get("views") else None,
            "url": f"https://www.youtube.com/watch?v={vid}",
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        })
    return channel, videos


def fetch_full(channel_url: str) -> list[dict]:
    """Whole upload list via yt-dlp, when available. Slow but complete."""
    import yt_dlp  # type: ignore

    opts = {"quiet": True, "extract_flat": False, "skip_download": True, "ignoreerrors": True}
    out = []
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"{channel_url}/videos", download=False)
        for ent in (info or {}).get("entries", []) or []:
            if not ent:
                continue
            dur = ent.get("duration")
            out.append({
                "id": ent.get("id"),
                "title": ent.get("title", ""),
                "description": ent.get("description", "") or "",
                "publishedAt": (f"{ent['upload_date'][:4]}-{ent['upload_date'][4:6]}-{ent['upload_date'][6:]}T00:00:00Z"
                                if ent.get("upload_date") else ""),
                "duration": f"PT{int(dur)}S" if dur else None,
                "viewCount": ent.get("view_count"),
                "likeCount": ent.get("like_count"),
                "commentCount": ent.get("comment_count"),
                "tags": ent.get("tags") or [],
                "url": ent.get("webpage_url") or f"https://www.youtube.com/watch?v={ent.get('id')}",
                "thumbnail": ent.get("thumbnail"),
            })
    return out


def merge(existing: list[dict], fresh: list[dict]) -> list[dict]:
    by_id = {v["id"]: dict(v) for v in existing if v.get("id")}
    for v in fresh:
        if not v.get("id"):
            continue
        cur = by_id.setdefault(v["id"], {})
        for k, val in v.items():
            # Fresh wins for live numbers; existing wins when fresh is empty.
            if val not in (None, "", []) or k not in cur:
                cur[k] = val
    out = []
    for v in by_id.values():
        v.setdefault("url", f"https://www.youtube.com/watch?v={v['id']}")
        v["format"] = _format_for(v.get("duration"), v.get("title", ""))
        out.append({k: v.get(k) for k in VIDEO_KEYS})
    out.sort(key=lambda v: v.get("publishedAt") or "", reverse=True)
    return out


def fetch_transcripts(videos: list[dict], yt_dir: Path, limit: int = 15,
                      languages: tuple[str, ...] = ("en", "en-IN", "en-US", "ml", "te", "hi")) -> tuple[int, str]:
    """Captions via youtube-transcript-api when it is installed; otherwise a note.
    Only videos without a stored transcript are tried, newest first, capped so a
    sync never spends more than a few seconds on it. Failures are per-video."""
    try:
        from youtube_transcript_api import YouTubeTranscriptApi  # type: ignore
    except ImportError:
        return 0, "youtube-transcript-api not installed — transcripts skipped"
    tdir = yt_dir / "transcripts"
    tdir.mkdir(parents=True, exist_ok=True)
    got = 0
    api = YouTubeTranscriptApi()
    for v in videos[:60]:
        vid = v.get("id")
        if not vid or (tdir / f"{vid}.json").exists() or (tdir / f"{vid}.none").exists():
            continue
        if got >= limit:
            break
        try:
            tr = api.fetch(vid, languages=list(languages))
            segs = [{"t": int(s.start), "text": " ".join(s.text.split())} for s in tr if s.text.strip()]
            write_json(tdir / f"{vid}.json", {"videoId": vid, "language": tr.language_code, "source": "youtube-transcript-api",
                                              "segments": segs})
            got += 1
        except Exception as exc:  # noqa: BLE001 — no captions / blocked: remember, don't retry forever
            (tdir / f"{vid}.none").write_text(f"{type(exc).__name__}: {exc}\n", encoding="utf-8")
    return got, f"{got} new transcripts"


def sync(config: dict, out_dir: Path, repo_root: Path) -> SyncResult:
    res = SyncResult("youtube")
    cfg = config["youtube"]
    yt_dir = out_dir / "youtube"
    existing = read_json(yt_dir / "videos.json", {"videos": []}).get("videos", [])
    channel_prev = read_json(yt_dir / "channel.json", {})

    channel, fresh = fetch_rss(cfg["channel_id"])
    res.notes.append(f"rss: {len(fresh)} recent uploads")

    if cfg.get("full"):
        try:
            full = fetch_full(cfg.get("channel_url") or channel["url"])
            fresh = merge(fresh, full)
            res.notes.append(f"yt-dlp: {len(full)} uploads")
        except Exception as exc:  # optional path — RSS result still stands
            res.notes.append(f"yt-dlp unavailable: {exc}")

    videos = merge(existing, fresh)
    if cfg.get("transcripts", True):
        n, note = fetch_transcripts(videos, yt_dir, int(cfg.get("transcript_limit", 15)),
                                    tuple(cfg.get("transcript_languages") or ("en", "en-IN", "en-US", "ml", "te", "hi")))
        res.notes.append(note)
    channel_out = {**channel_prev, **{k: v for k, v in channel.items() if v},
                   "handle": cfg.get("handle", channel_prev.get("handle", "")),
                   "videoCount": len(videos), "last_synced": now_iso()}
    write_json(yt_dir / "channel.json", channel_out)
    write_json(yt_dir / "videos.json", {"videos": videos})
    res.files = [f"{yt_dir.relative_to(repo_root)}/channel.json", f"{yt_dir.relative_to(repo_root)}/videos.json"]
    res.records = len(videos) + 1
    res.notes.append(f"{len(videos)} videos on record ({len(videos) - len(existing)} new)")
    return res
