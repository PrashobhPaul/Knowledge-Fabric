"""Older YouTube uploads (youtube.extra_channels / extra_videos): the Factory reads
them without an API key and never fails when YouTube refuses; the connector indexes
them as channel and video records. Offline: every HTTP call is faked."""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest
import requests

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from knowledge_factory.sources import youtube as yt  # noqa: E402

SEED = ROOT / "knowledge_sources" / "youtube" / "extra_videos.json"
CFG = {"extra_channels": ["@Phoenix007Super"], "extra_videos": ["VomUVZ0IKeM"]}
CID = "UC" + "a" * 22

RSS = f"""<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015"
      xmlns:media="http://search.yahoo.com/mrss/">
  <title>Phoenix007Super</title>
  <link rel="alternate" href="https://www.youtube.com/channel/{CID}"/>
  <published>2012-08-01T00:00:00+00:00</published>
  <entry>
    <yt:videoId>abcdefghijk</yt:videoId>
    <title>Voice controlled plane test</title>
    <published>2012-09-10T10:00:00+00:00</published>
    <media:group><media:description>Ground test.</media:description>
      <media:community><media:statistics views="42"/></media:community></media:group>
  </entry>
</feed>"""


class Resp:
    def __init__(self, text: str = "", data: dict | None = None):
        self.text, self.content, self._data = text, text.encode("utf-8"), data

    def json(self):
        return self._data


def fake_youtube(url, **kw):
    if url == "https://www.youtube.com/@Phoenix007Super":
        return Resp(f'<html><meta itemprop="identifier" content="{CID}"></html>')
    if url.startswith("https://www.youtube.com/feeds/videos.xml"):
        return Resp(RSS)
    if url == "https://www.youtube.com/oembed":
        assert kw["params"]["url"].endswith("VomUVZ0IKeM")
        return Resp(data={"title": "CJITS smart plane flight", "author_name": "A College Uploader",
                          "author_url": "https://www.youtube.com/@uploader", "thumbnail_url": ""})
    if url == "https://www.youtube.com/watch?v=VomUVZ0IKeM":
        return Resp('<meta itemprop="uploadDate" content="2012-09-16T01:02:03-07:00">')
    raise AssertionError(f"unexpected URL {url}")


def refuse(url, **kw):
    raise requests.HTTPError("429 Too Many Requests")


def test_channel_id_and_upload_date_are_read_from_the_page():
    assert yt.channel_id_from_html(f'<meta itemprop="identifier" content="{CID}">') == CID
    assert yt.channel_id_from_html(f'x "channelId":"{CID}" y') == CID
    assert yt.channel_id_from_html("<html>nothing</html>") is None
    assert yt.upload_date_from_html('"uploadDate":"2012-09-16"') == "2012-09-16"
    assert yt._handle("https://www.youtube.com/@Phoenix007Super/") == "@Phoenix007Super"


def test_extras_sync_fills_youtube_fields_and_keeps_the_owners_words(tmp_path, monkeypatch):
    shutil.copy(SEED, tmp_path / "extra_videos.json")
    monkeypatch.setattr(yt, "http_get", fake_youtube)
    notes = yt.sync_extras(CFG, tmp_path)
    data = json.loads((tmp_path / "extra_videos.json").read_text(encoding="utf-8"))
    assert data["source"] == "factory" and data["notes"] == notes
    ch = data["channels"][0]
    assert ch["channelId"] == CID and ch["title"] == "Phoenix007Super" and ch["pending_sync"] is False
    assert ch["url"] == "https://www.youtube.com/@Phoenix007Super"       # evidence links keep resolving
    assert ch["about"].startswith("It is Prashobh Paul's old YouTube channel")
    vids = {v["id"]: v for v in data["videos"]}
    demo = vids["VomUVZ0IKeM"]
    assert demo["title"] == "CJITS smart plane flight" and demo["channel"] == "A College Uploader"
    assert demo["publishedAt"].startswith("2012-09-16") and demo["pending_sync"] is False
    assert demo["topic"] == "smart plane" and "uploaded by someone at the college" in demo["about"]
    assert vids["abcdefghijk"]["channelHandle"] == "@Phoenix007Super"   # the old channel's uploads come too


def test_extras_sync_never_fails_when_youtube_refuses(tmp_path, monkeypatch):
    shutil.copy(SEED, tmp_path / "extra_videos.json")
    monkeypatch.setattr(yt, "http_get", refuse)
    notes = yt.sync_extras(CFG, tmp_path)
    assert any("not synced" in n for n in notes) and any("not reached" in n for n in notes)
    data = json.loads((tmp_path / "extra_videos.json").read_text(encoding="utf-8"))
    assert {v["id"] for v in data["videos"]} == {"VomUVZ0IKeM"}
    assert all(v["pending_sync"] for v in data["videos"] + data["channels"])
    assert data["videos"][0]["title"] == "Smart plane demonstration (college upload)"


def test_youtube_sync_tries_the_extras_before_the_main_feed(tmp_path, monkeypatch):
    out = tmp_path / "ks"
    monkeypatch.setattr(yt, "http_get", refuse)
    config = {"youtube": {"channel_id": "UCmain", **CFG, "transcripts": False}}
    with pytest.raises(requests.HTTPError):        # the main feed failing is still a source error
        yt.sync(config, out, tmp_path)
    data = json.loads((out / "youtube" / "extra_videos.json").read_text(encoding="utf-8"))
    assert data["notes"] and {v["id"] for v in data["videos"]} == {"VomUVZ0IKeM"}


def test_connector_indexes_the_older_uploads():
    from pipeline.connectors.youtube import YouTubeConnector
    recs = list(YouTubeConnector(ROOT / "knowledge_sources" / "youtube").fetch())
    demo = next(r for r in recs if r.source_id == "video:VomUVZ0IKeM")
    assert demo.metadata["record_type"] == "video" and demo.metadata["topic"] == "smart plane"
    assert demo.url == "https://www.youtube.com/watch?v=VomUVZ0IKeM"
    assert demo.metadata["catalogue_where"].startswith("on YouTube, uploaded by someone at my college")
    assert "The Canvas of Earth" not in demo.text                  # not attributed to the main channel
    ch = next(r for r in recs if r.source_id == "channel:@Phoenix007Super")
    assert ch.metadata["record_type"] == "channel" and ch.url == "https://www.youtube.com/@Phoenix007Super"
    assert ch.metadata["pending_sync"] is True and ("Channel", "Phoenix007Super channel") in ch.entities
