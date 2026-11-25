"""YouTube connector — the channel and every upload as verbalised, typed records.

A video title like "Key Monastery Explained | History, Prayer Halls & Om Mani
Padme Hum #shortvideo #spiti" carries places, topics and a format. Verbalising
it, and resolving the places and topics through the ontology, is what connects
a travel video to the Place node that also appears in a photo story, and the
"Microsoft AI Tour" vlog to the AI work on the resume.
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Iterator

from .. import ontology
from .base import KnowledgeRecord, sanitize

HASHTAG_RE = re.compile(r"#(\w+)")
CHAPTER_RE = re.compile(r"(?m)^\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:[–\-—:|]\s*)?([^\d\s].*?)\s*$")
CHAPTER_HEAD_RE = re.compile(r"(?mi)^\s*(chapters?|timestamps?|time\s*stamps?)\s*:?\s*$")
WINDOW_SECONDS = 60          # transcript windows: one citable record per ~minute
WINDOW_CHARS = 420


def _secs(stamp: str) -> int:
    parts = [int(p) for p in stamp.split(":")]
    return parts[0] * 3600 + parts[1] * 60 + parts[2] if len(parts) == 3 else parts[0] * 60 + parts[1]


def _stamp(sec: int) -> str:
    return f"{sec // 3600}:{(sec % 3600) // 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60}:{sec % 60:02d}"

URL_RE = re.compile(r"https?://\S+")
DETECT_KINDS = ("Place", "Topic", "Event", "Person", "Organization", "Domain", "Technology")


def _date(iso: str) -> tuple[str, str]:
    """ISO timestamp -> ('16 November 2025', '2025')."""
    if not iso:
        return "", ""
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return f"{d.day} {d.strftime('%B %Y')}", str(d.year)
    except ValueError:
        return iso[:10], iso[:4]


def _duration(iso: str | None) -> tuple[str, int]:
    if not iso:
        return "", 0
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso)
    if not m:
        return "", 0
    h, mi, s = (int(x or 0) for x in m.groups())
    total = h * 3600 + mi * 60 + s
    if total < 60:
        return f"{total} seconds", total
    if total < 3600:
        return f"{mi} minute{'s' if mi != 1 else ''}" + (f" {s} seconds" if s else ""), total
    return f"{h} hour{'s' if h != 1 else ''} {mi} minutes", total


def _views(n) -> str:
    if n is None:
        return ""
    n = int(n)
    if n >= 1_000_000:
        return f"about {n / 1_000_000:.1f} million views"
    if n >= 1_000:
        return f"about {n / 1_000:.1f} thousand views"
    return f"{n} views"


def _clean_desc(desc: str) -> tuple[str, list[str]]:
    tags = [t.lower() for t in HASHTAG_RE.findall(desc or "")]
    # Chapter lists become their own timestamped records; in prose they are noise.
    text = CHAPTER_HEAD_RE.sub("", CHAPTER_RE.sub("", desc or ""))
    text = HASHTAG_RE.sub("", text)
    text = URL_RE.sub("", text)
    text = re.sub(r"[\U0001F300-\U0001FAFF☀-➿]", " ", text)   # emoji
    text = sanitize(text.replace("\n", " "))
    return text, tags


def _lang_of(text: str) -> str:
    """Script-based language tag: ml / te / hi for Malayalam, Telugu, Devanagari; else en."""
    t = text or ""
    if re.search(r"[\u0D00-\u0D7F]", t):
        return "ml"
    if re.search(r"[\u0C00-\u0C7F]", t):
        return "te"
    if re.search(r"[\u0900-\u097F]", t):
        return "hi"
    return "en"


class YouTubeConnector:
    name = "YouTube"
    source_type = "youtube"

    def __init__(self, root: Path):
        self.root = Path(root)
        self.videos = json.loads((root / "videos.json").read_text(encoding="utf-8")).get("videos", [])
        cp = root / "channel.json"
        self.channel = json.loads(cp.read_text(encoding="utf-8")) if cp.exists() else {}
        self.channel_title = sanitize(self.channel.get("title")) or "YouTube channel"
        self.name = f"YouTube · {self.channel_title}"

    def _channel(self) -> Iterator[KnowledgeRecord]:
        c = self.channel
        if not c:
            return
        created, cyear = _date(c.get("published", ""))
        desc, _ = _clean_desc(c.get("description", ""))
        stats = []
        if c.get("subscriberCount"):
            stats.append(f"about {c['subscriberCount'] / 1000:.1f} thousand subscribers")
        if c.get("viewCount"):
            stats.append(_views(c["viewCount"]).replace("about ", "about "))
        if c.get("videoCount"):
            stats.append(f"{c['videoCount']} videos")
        text = (f"{self.channel_title} is {ontology.PERSON}'s YouTube channel"
                f"{' (' + c['handle'] + ')' if c.get('handle') else ''}"
                f"{', created in ' + created.split(' ', 1)[1] if created else ''}. "
                f"{desc} "
                f"{'As of ' + c['stats_as_of'] + ' the channel has ' + ', '.join(stats) + '. ' if stats and c.get('stats_as_of') else ''}"
                f"{'Its niche is ' + sanitize(c['niche']) + ', covering ' + ', '.join(c.get('subNiches', [])) + '.' if c.get('niche') else ''}")
        yield KnowledgeRecord(
            source_type=self.source_type, source_system=self.name, source_id=f"channel:{c.get('channelId')}",
            title=self.channel_title, text=sanitize(text),
            section_path=["YouTube", self.channel_title, "Channel"], url=c.get("url", ""),
            metadata={"record_type": "channel", "document_name": f"YouTube · {self.channel_title}",
                      "domain": "YouTube", "year": cyear, "published": c.get("published", ""),
                      "subscribers": c.get("subscriberCount"), "views": c.get("viewCount"),
                      "topic": c.get("niche", "")},
            entities=[("Person", ontology.PERSON), ("Channel", self.channel_title), ("Platform", "YouTube")]
                     + ontology.detect(text, ("Topic", "Place", "Domain")))

    def _videos(self) -> Iterator[KnowledgeRecord]:
        for v in self.videos:
            title = sanitize(v.get("title"))
            if not title or not v.get("id"):
                continue
            when, year = _date(v.get("publishedAt", ""))
            dur_text, dur_s = _duration(v.get("duration"))
            fmt = v.get("format") or "video"
            fmt_label = {"short": "YouTube Short", "long": "long-form video"}.get(fmt, "video")
            desc, tags = _clean_desc(v.get("description", ""))
            all_tags = sorted({*tags, *[t.lower() for t in (v.get("tags") or [])]})
            clean_title = sanitize(HASHTAG_RE.sub("", title).rstrip(" |-"))
            text = (f"'{clean_title}' is a {fmt_label} published on {self.channel_title} by {ontology.PERSON}"
                    f"{' on ' + when if when else ''}"
                    f"{' with a duration of ' + dur_text if dur_text else ''}. ")
            if desc:
                text += desc + (" " if desc.endswith(".") else ". ")
            if v.get("viewCount") is not None:
                text += f"It has {_views(v['viewCount'])}"
                text += f" and {v['commentCount']} comments. " if v.get("commentCount") else ". "
            if all_tags:
                text += f"Tagged: {', '.join(all_tags[:12])}."
            text = sanitize(text)

            ents = [("Person", ontology.PERSON), ("Video", clean_title[:80]), ("Channel", self.channel_title)]
            detected = ontology.detect(f"{title} {desc} {' '.join(all_tags)}", DETECT_KINDS)
            # Topic "Travel" only if nothing more specific in the title says otherwise is fine —
            # detection is additive; the graph weights by evidence.
            ents += [e for e in detected if e not in ents]
            places = [c for k, c in detected if k == "Place"]
            topics = [c for k, c in detected if k == "Topic"]
            events = [c for k, c in detected if k == "Event"]
            yield KnowledgeRecord(
                source_type=self.source_type, source_system=self.name, source_id=f"video:{v['id']}",
                title=clean_title, text=text,
                section_path=["YouTube", self.channel_title, year or "Undated", fmt_label.title()],
                url=v.get("url") or f"https://www.youtube.com/watch?v={v['id']}",
                metadata={"record_type": "video", "document_name": clean_title[:90], "domain": "YouTube",
                          "video_id": v["id"], "published": v.get("publishedAt", ""), "year": year,
                          "format": fmt, "duration_seconds": dur_s, "views": v.get("viewCount"),
                          "place": places[0] if places else "", "places": places,
                          "topic": topics[0] if topics else "", "topics": topics, "event": events[0] if events else "",
                          "thumbnail": v.get("thumbnail"), "lang": _lang_of(f"{title} {desc}")},
                entities=ents)

    # ------------------------------------------------------------ chapters & transcripts
    def _transcript(self, vid: str) -> dict | None:
        p = self.root / "transcripts" / f"{vid}.json"
        if not p.exists():
            return None
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return None
        return data if data.get("language", "en").startswith("en") and data.get("segments") else None

    def _video_depth(self, v: dict) -> Iterator[KnowledgeRecord]:
        """Chapters (from the description) and transcript windows — each a citable
        record whose URL opens the video at that second. This is what lets an
        answer say 'at 1:36 he describes seeing Satya Nadella in person' and
        link straight to it."""
        title = sanitize(HASHTAG_RE.sub("", v.get("title", "")).rstrip(" |-"))
        vid = v["id"]
        _, year = _date(v.get("publishedAt", ""))
        base = v.get("url") or f"https://www.youtube.com/watch?v={vid}"
        doc = title[:90]
        common = {"document_name": doc, "domain": "YouTube", "video_id": vid, "year": year,
                  "published": v.get("publishedAt", ""), "video_title": title, "thumbnail": v.get("thumbnail")}
        chapters = [(_secs(t), sanitize(name)) for t, name in CHAPTER_RE.findall(v.get("description") or "")]
        transcript = self._transcript(vid)
        tlang = (transcript or {}).get("language", "")[:2] if transcript else ""
        segs = (transcript or {}).get("segments", [])

        def text_between(a: int, b: int | None) -> str:
            return " ".join(s["text"] for s in segs if s["t"] >= a and (b is None or s["t"] < b))

        if chapters:
            for i, (t, name) in enumerate(chapters):
                nxt = chapters[i + 1][0] if i + 1 < len(chapters) else None
                spoken = text_between(t, nxt)[:WINDOW_CHARS * 2]
                text = (f"At {_stamp(t)} in the video '{title}', the chapter '{name}' begins. "
                        f"{spoken}").strip()
                yield KnowledgeRecord(
                    source_type=self.source_type, source_system=self.name, source_id=f"chapter:{vid}:{t}",
                    title=f"{title} — {name}", text=text,
                    section_path=["YouTube", self.channel_title, title[:60], "Chapters"],
                    url=f"{base}&t={t}s",
                    metadata={**common, "record_type": "chapter", "t": t, "t_label": _stamp(t), "chapter": name,
                              "place": "", "topic": ""},
                    entities=[("Person", ontology.PERSON), ("Video", title[:80])]
                             + ontology.detect(f"{name} {spoken}", DETECT_KINDS))
        if segs and not chapters:
            # No chapters: window the transcript by time and size.
            window: list[dict] = []
            start = segs[0]["t"]
            for s in segs + [None]:
                flush = s is None or (s["t"] - start >= WINDOW_SECONDS and sum(len(w["text"]) for w in window) >= 120) \
                        or sum(len(w["text"]) for w in window) >= WINDOW_CHARS
                if flush and window:
                    spoken = " ".join(w["text"] for w in window)
                    text = f"At {_stamp(start)} in the video '{title}', {ontology.PERSON} says: {spoken}"
                    yield KnowledgeRecord(
                        source_type=self.source_type, source_system=self.name, source_id=f"transcript:{vid}:{start}",
                        title=f"{title} @ {_stamp(start)}", text=text,
                        section_path=["YouTube", self.channel_title, title[:60], "Transcript"],
                        url=f"{base}&t={start}s",
                        metadata={**common, "record_type": "transcript", "t": start, "t_label": _stamp(start),
                                  "place": "", "topic": "", "lang": tlang or _lang_of(spoken)},
                        entities=[("Person", ontology.PERSON), ("Video", title[:80])]
                                 + ontology.detect(spoken, DETECT_KINDS))
                    window = []
                    if s is not None:
                        start = s["t"]
                if s is not None:
                    window.append(s)

    def fetch(self) -> Iterator[KnowledgeRecord]:
        yield from self._channel()
        for v in self.videos:
            if not v.get("id"):
                continue
            yield from self._video_depth(v)
        yield from self._videos()
