"""Website source — crawl the personal site into structured, citable sections.

Output (knowledge_sources/website/):
    pages.json      one entry per crawled page, with heading-scoped sections
    projects.json   the portfolio cards from the works page, as structured records
    faq.json        the site chatbot's hand-written Q&A knowledge base
    + docs_source/resume/*.pdf   any resume PDF linked from the site

Why the chatbot KB is harvested: the site ships a deterministic assistant whose
answers were written by the site owner. That is first-party, curated knowledge
about the person — the single highest-quality text on the site — and it would
be wasteful to leave it inside a <script> tag where no search engine reads it.
Only professional entries are kept; guardrail and personal-boundary responses
are dropped because they answer nothing about the person.
"""
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from ..common import SyncResult, http_get, write_json

HEADING_TAGS = ["h1", "h2", "h3", "h4"]
SKIP_TAGS = ["script", "style", "noscript", "svg", "nav", "footer", "form", "button"]

# Answers in the assistant's own voice, greetings and banter answer nothing about
# the person. Drop them; keep two kinds of entry:
#   about      — a statement about the person ("he", "his", the name)
#   explainer  — the owner's own explanation of an AI concept (their viewpoint)
KB_DROP_RE = re.compile(
    r"filtered|blocked|flagged|guardrail|not something I|outside what I|I'm (designed|built|good at|"
    r"an AI|quite|here to|probably|strictly|running|always on|not really)|I'd say I'm|I was built by|"
    r"personal (information|details|territory)|kept private|Not quite|happy to improve|Glad I could|"
    r"trade secrets|calendar|this assistant|AI assistant|first point of contact|come back anytime|"
    r"what brings you here|I'll do my best|I can help you with|beyond my scope|geopolitical|"
    r"I appreciate|Happy to help|Got it|You're welcome|I'll make sure|Noted —|Understood —|"
    r"Totally fair|Ha —|Technically — yes|As an AI|I'm not really here|humanity's deepest",
    re.I)
KB_DROP_Q_RE = re.compile(r"\b(you|bot|chatbot|yourself|urgent|asap|please|okay|thank|hello|hi|hey|yo)\b", re.I)
KB_ABOUT_RE = re.compile(r"\bprashobh|\bhe\b|\bhis\b|\bhim\b|\bhe's\b", re.I)
KB_EXPLAINER_Q_RE = re.compile(
    r"^(what|explain|difference|full form|is .* better|.* vs |how do i learn|where do i start|"
    r"best resources|how long|why python|how can i use|i am a)", re.I)
KB_EXPLAINER_RE = re.compile(
    r"\bAI\b|LLM|GPT|agent|RAG\b|NLP|NLU|knowledge graph|ontology|python|data science|prompt|"
    r"\bMCP\b|A2A|transformer|conversational|rasa|genai|no-code|vibe coding|ethics|claude|gemini|langchain",
    re.I)


def _same_host(url: str, base: str) -> bool:
    return urlparse(url).netloc.replace("www.", "") == urlparse(base).netloc.replace("www.", "")


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


# --------------------------------------------------------------------------- pages
def _extract_sections(soup: BeautifulSoup, url: str) -> list[dict]:
    """Walk the body in document order; every heading opens a new section and
    the text under it (until the next heading of equal/higher level) is the body."""
    for t in soup(SKIP_TAGS):
        t.decompose()
    body = soup.body or soup

    sections: list[dict] = []
    stack: list[tuple[int, str]] = []
    cur: dict | None = None

    def start(level: int, title: str):
        nonlocal cur, stack
        while stack and stack[-1][0] >= level:
            stack.pop()
        stack.append((level, title))
        cur = {"heading_path": [h for _, h in stack], "paragraphs": [], "anchor": ""}
        sections.append(cur)

    for el in body.find_all(HEADING_TAGS + ["p", "li", "blockquote", "dd"]):
        text = _clean(el.get_text(" ", strip=True))
        if not text:
            continue
        if el.name in HEADING_TAGS:
            start(int(el.name[1]), text)
            anchor = el.get("id") or (el.find_parent(id=True) or {}).get("id") if el.find_parent(id=True) else el.get("id")
            if cur is not None and anchor:
                cur["anchor"] = anchor
            continue
        if cur is None:
            start(1, "Page")
        if len(text) >= 20 and text not in cur["paragraphs"]:
            cur["paragraphs"].append(text)

    out = []
    for s in sections:
        if not s["paragraphs"]:
            continue
        out.append({
            "heading_path": s["heading_path"],
            "anchor": s["anchor"],
            "url": f"{url}#{s['anchor']}" if s["anchor"] else url,
            "paragraphs": s["paragraphs"],
        })
    return out


# --------------------------------------------------------------------------- projects
def _extract_projects(soup: BeautifulSoup, page_url: str) -> list[dict]:
    """Portfolio cards on the works page (article.work-card). Falls back to any
    <article> so a redesigned page still yields something."""
    cards = soup.select("article.work-card") or soup.select("article")
    projects = []
    for card in cards:
        title_el = card.find(["h2", "h3"])
        if not title_el:
            continue
        name = _clean(title_el.get_text(" ", strip=True))
        sub_el = title_el.find_next(["p", "span", "div"])
        tagline = _clean(sub_el.get_text(" ", strip=True)) if sub_el else ""
        paras = [_clean(p.get_text(" ", strip=True)) for p in card.find_all("p")]
        paras = [p for p in paras if len(p) > 30 and p != tagline]
        tags = sorted({_clean(t.get_text()) for t in card.select(".tag, .tech, .chip, .pill, li")
                       if 1 < len(_clean(t.get_text())) <= 24})
        links = []
        for a in card.find_all("a", href=True):
            href = urljoin(page_url, a["href"])
            label = _clean(a.get_text(" ", strip=True))
            kind = ("source" if "github.com" in href and "releases" not in href
                    else "download" if href.endswith(".apk") or "releases" in href
                    else "live")
            links.append({"label": label, "url": href, "kind": kind})
        if not paras:
            continue
        projects.append({
            "name": name,
            "tagline": tagline,
            "description": " ".join(paras),
            "technologies": tags,
            "links": links,
            "source_url": page_url,
        })
    return projects


# --------------------------------------------------------------------------- chatbot KB
KB_ENTRY_RE = re.compile(
    r"\{\s*p:\s*/(.*?)/[a-z]*,\s*(?:q:\s*\[(.*?)\],\s*)?a:\s*\(_\)\s*=>\s*`(.*?)`\s*\}", re.S)


def _extract_chatbot_kb(html: str, page_url: str) -> list[dict]:
    m = re.search(r"const\s+KB\s*=\s*\[", html)
    if not m:
        return []
    script = html[m.start():]
    faqs = []
    for pat, qs, ans in KB_ENTRY_RE.findall(script):
        questions = re.findall(r"'([^']*)'", qs or "")
        answer = re.sub(r"\$\{cta\(\[(.*?)\]\)\}", "", ans)
        answer = re.sub(r"\$\{[^}]*\}", "", answer)
        answer = answer.replace("\\n", "\n").strip()
        # Strip emoji-led link lines; the structured links live in profile.yaml.
        answer = "\n".join(l for l in answer.splitlines()
                           if not re.match(r"^\s*[📧💼📄📅💬🐙▶️🌐]", l)).strip()
        answer = re.sub(r"\n{3,}", "\n\n", answer)
        if not questions or not answer or KB_DROP_RE.search(answer):
            continue
        if all(KB_DROP_Q_RE.search(q) for q in questions):
            continue
        qtext = " ".join(questions)
        if KB_ABOUT_RE.search(qtext) or re.search(r"\bprashobh|\bhe\b|\bhis\b|\bhim\b", qtext, re.I):
            kind = "about"
        elif KB_EXPLAINER_Q_RE.search(qtext) and KB_EXPLAINER_RE.search(answer):
            kind = "explainer"
        elif KB_ABOUT_RE.search(answer):
            kind = "about"
        else:
            continue
        # Drop trailing conversational hooks ("What would you like to know?")
        lines = [l for l in answer.split("\n") if l.strip()]
        while lines and re.search(r"\?\s*$", lines[-1]) and len(lines) > 1:
            lines.pop()
        answer = "\n".join(lines).strip()
        if len(answer) < 40:
            continue
        faqs.append({"kind": kind, "questions": questions[:6], "answer": answer, "source_url": page_url})
    return faqs


# --------------------------------------------------------------------------- sync
def sync(config: dict, out_dir: Path, repo_root: Path) -> SyncResult:
    res = SyncResult("website")
    cfg = config["website"]
    base = cfg["base_url"]
    queue = [urljoin(base, s) for s in cfg.get("seeds", ["index.html"])]
    seen: set[str] = set()
    pages, projects, faqs, pdfs = [], [], [], []

    while queue and len(seen) < int(cfg.get("max_pages", 20)):
        url = queue.pop(0)
        norm = url.split("#")[0]
        if norm in seen:
            continue
        seen.add(norm)
        try:
            html = http_get(norm).text
        except Exception as exc:  # one dead page must not kill the sync
            res.notes.append(f"skip {norm}: {exc}")
            continue
        soup = BeautifulSoup(html, "html.parser")
        title = _clean(soup.title.get_text()) if soup.title else norm
        desc_el = soup.find("meta", attrs={"name": "description"})

        # Discover links before sections are extracted (nav gets dropped there).
        for a in soup.find_all("a", href=True):
            href = urljoin(norm, a["href"].split("#")[0])
            if not href or href in seen:
                continue
            if href.lower().endswith(".pdf") and cfg.get("resume_pattern", "resume") in href.lower():
                pdfs.append(href)
            elif _same_host(href, base) and (href.endswith("/") or href.endswith(".html")):
                queue.append(href)

        if "works" in norm.lower() or soup.select("article.work-card"):
            projects.extend(_extract_projects(BeautifulSoup(html, "html.parser"), norm))
        faqs.extend(_extract_chatbot_kb(html, norm))

        sections = _extract_sections(soup, norm)
        pages.append({
            "url": norm,
            "title": title,
            "description": _clean(desc_el["content"]) if desc_el and desc_el.get("content") else "",
            "sections": sections,
        })

    # Resume PDFs — the live, downloadable copy is the one to index.
    resume_dir = repo_root / cfg.get("resume_dir", "docs_source/resume")
    resume_dir.mkdir(parents=True, exist_ok=True)
    for pdf in sorted(set(pdfs)):
        try:
            data = http_get(pdf).content
            name = Path(urlparse(pdf).path).name
            (resume_dir / name).write_bytes(data)
            res.notes.append(f"downloaded {name} ({len(data)//1024} KB)")
            res.files.append(str((resume_dir / name).relative_to(repo_root)))
        except Exception as exc:
            res.notes.append(f"resume download failed {pdf}: {exc}")

    site_dir = out_dir / "website"
    write_json(site_dir / "pages.json", {"base_url": base, "pages": pages})
    write_json(site_dir / "projects.json", {"projects": projects})
    write_json(site_dir / "faq.json", {"faq": faqs})
    res.files += [f"{site_dir.relative_to(repo_root)}/{n}" for n in ("pages.json", "projects.json", "faq.json")]
    res.records = sum(len(p["sections"]) for p in pages) + len(projects) + len(faqs)
    res.notes.append(f"{len(pages)} pages · {len(projects)} projects · {len(faqs)} FAQ entries")
    return res
