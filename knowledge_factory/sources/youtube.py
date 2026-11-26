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

Older uploads that are not on the main channel (`extra_channels` by @handle,
`extra_videos` by id) go to extra_videos.json: a handle is resolved to its
channel id from the channel page and read through the same RSS feed; a single
video is read through oEmbed (title, uploader) and its watch page (upload date).
A refusal from YouTube leaves a note and never fails the sync.
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


# --------------------------------------------------------------------------- older uploads
# Channels and videos that are not on the main channel: an old channel named by its
# @handle, and single videos someone else uploaded. Both are read the same keyless
# way as the main channel and kept in youtube/extra_videos.json, which only grows.
# What the owner said about an entry (about, topic, catalogue_where) is never
# overwritten by a sync; YouTube's own fields (title, dates, uploader) are.

EXTRA_FILE = "extra_videos.json"
# A consent cookie keeps YouTube from answering with its cookie-consent page.
YT_HEADERS = {"Accept-Language": "en-US,en;q=0.8", "Cookie": "CONSENT=YES+1"}
# Most precise first: the page's own identifier, then its canonical link, then the
# first channel id the page data mentions.
CHANNEL_ID_RES = (
    re.compile(r'<meta[^>]*itemprop="identifier"[^>]*content="(UC[\w-]{22})"'),
    re.compile(r'<meta[^>]*content="(UC[\w-]{22})"[^>]*itemprop="identifier"'),
    re.compile(r'<link[^>]*rel="canonical"[^>]*href="https://www\.youtube\.com/channel/(UC[\w-]{22})"'),
    re.compile(r'"externalId"\s*:\s*"(UC[\w-]{22})"'),
    re.compile(r'"channelId"\s*:\s*"(UC[\w-]{22})"'),
)
UPLOAD_DATE_RES = (
    re.compile(r'itemprop="(?:uploadDate|datePublished)"[^>]*content="([0-9][^"]+)"'),
    re.compile(r'"(?:uploadDate|publishDate)"\s*:\s*"([0-9][^"]+)"'),
)


def _handle(h: str) -> str:
    h = str(h).strip().rstrip("/").split("/")[-1]
    return h if h.startswith("@") else "@" + h


def channel_id_from_html(html: str) -> str | None:
    for rx in CHANNEL_ID_RES:
        m = rx.search(html or "")
        if m:
            return m.group(1)
    return None


def resolve_handle(handle: str) -> str:
    """@handle -> UC… channel id, read from the public channel page."""
    h = _handle(handle)
    cid = channel_id_from_html(http_get(f"https://www.youtube.com/{h}", headers=YT_HEADERS).text)
    if not cid:
        raise ValueError(f"no channel id on the {h} page")
    return cid


def fetch_oembed(video_id: str) -> dict:
    """Title and uploader of one video, from YouTube's keyless oEmbed endpoint."""
    d = http_get("https://www.youtube.com/oembed", headers=YT_HEADERS,
                 params={"url": f"https://www.youtube.com/watch?v={video_id}", "format": "json"}).json()
    return {"title": d.get("title") or "", "channel": d.get("author_name") or "",
            "channelUrl": d.get("author_url") or "", "thumbnail": d.get("thumbnail_url") or ""}


def upload_date_from_html(html: str) -> str:
    for rx in UPLOAD_DATE_RES:
        m = rx.search(html or "")
        if m:
            return m.group(1)
    return ""


def fetch_upload_date(video_id: str) -> str:
    """oEmbed carries no date; the watch page's metadata does."""
    return upload_date_from_html(http_get(f"https://www.youtube.com/watch?v={video_id}", headers=YT_HEADERS).text)


def _fill(entry: dict, fresh: dict) -> None:
    """YouTube's fields replace what is on record, but an empty answer never erases it."""
    for k, v in fresh.items():
        if v not in (None, "", []):
            entry[k] = v


def sync_extras(cfg: dict, yt_dir: Path) -> list[str]:
    """Sync extra_channels and extra_videos into extra_videos.json. Never raises:
    a refusal from YouTube becomes a note, and what is on record stays."""
    notes: list[str] = []
    path = yt_dir / EXTRA_FILE
    try:
        data = read_json(path, {})
        channels = {_handle(c["handle"]).lower(): c for c in data.get("channels", []) if c.get("handle")}
        videos = {v["id"]: v for v in data.get("videos", []) if v.get("id")}

        for raw in cfg.get("extra_channels") or []:
            h = _handle(raw)
            ch = channels.setdefault(h.lower(), {"handle": h, "url": f"https://www.youtube.com/{h}",
                                                 "title": f"{h[1:]} channel", "pending_sync": True})
            try:
                cid = ch.get("channelId") or resolve_handle(h)
                info, uploads = fetch_rss(cid)
                _fill(ch, {"channelId": cid, "title": info.get("title"), "channelUrl": info.get("url"),
                           "published": info.get("published")})
                ch.update(pending_sync=False, last_synced=now_iso())
                for v in uploads:
                    cur = videos.setdefault(v["id"], {"id": v["id"]})
                    _fill(cur, v)
                    cur.update(channel=ch["title"], channelHandle=h, via=f"channel:{h}", pending_sync=False)
                ch["uploads_in_feed"] = len(uploads)
                notes.append(f"{h}: channel {cid}, {len(uploads)} uploads in its feed")
            except Exception as exc:  # noqa: BLE001 — YouTube refusing is a note, not a failure
                notes.append(f"{h}: not synced ({type(exc).__name__}: {exc}); kept what is on record")

        for vid in cfg.get("extra_videos") or []:
            vid = str(vid).strip()
            v = videos.setdefault(vid, {"id": vid, "title": f"YouTube video {vid}", "pending_sync": True})
            v.setdefault("url", f"https://www.youtube.com/watch?v={vid}")
            try:
                _fill(v, fetch_oembed(vid))
                v.update(pending_sync=False, last_synced=now_iso())
                notes.append(f"{vid}: {v['title']!r} by {v.get('channel') or 'unknown uploader'}")
            except Exception as exc:  # noqa: BLE001
                notes.append(f"{vid}: oEmbed not reached ({type(exc).__name__}: {exc}); kept what is on record")
            if not v.get("publishedAt"):
                try:
                    _fill(v, {"publishedAt": fetch_upload_date(vid)})
                except Exception as exc:  # noqa: BLE001
                    notes.append(f"{vid}: upload date not reached ({type(exc).__name__})")

        for v in videos.values():
            v.setdefault("url", f"https://www.youtube.com/watch?v={v['id']}")
            v.setdefault("thumbnail", f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg")
            v["format"] = _format_for(v.get("duration"), v.get("title", ""))
        out = {**{k: val for k, val in data.items() if k not in ("channels", "videos", "notes", "last_attempt")},
               "source": "factory", "last_attempt": now_iso(), "notes": notes,
               "channels": list(channels.values()),
               "videos": sorted(videos.values(), key=lambda x: x.get("publishedAt") or "", reverse=True)}
        write_json(path, out)
    except Exception as exc:  # noqa: BLE001 — even a broken file must not stop the main sync
        notes.append(f"extra videos skipped ({type(exc).__name__}: {exc})")
    return notes


def sync(config: dict, out_dir: Path, repo_root: Path) -> SyncResult:
    res = SyncResult("youtube")
    cfg = config["youtube"]
    yt_dir = out_dir / "youtube"
    extra_files: list[str] = []
    # Older uploads first, so they are tried even when the main feed refuses.
    if cfg.get("extra_channels") or cfg.get("extra_videos"):
        res.notes.extend(f"extra: {n}" for n in sync_extras(cfg, yt_dir))
        if (yt_dir / EXTRA_FILE).exists():
            extra_files.append(f"{yt_dir.relative_to(repo_root) if yt_dir.is_relative_to(repo_root) else yt_dir}/{EXTRA_FILE}")
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
    res.files = [f"{yt_dir.relative_to(repo_root)}/channel.json", f"{yt_dir.relative_to(repo_root)}/videos.json"] + extra_files
    res.records = len(videos) + 1
    res.notes.append(f"{len(videos)} videos on record ({len(videos) - len(existing)} new)")
    return res
