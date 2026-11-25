"""Personal-knowledge ontology — canonical names and detection for the graph.

The same thing is spelled many ways across sources: the website says
"Invest.IQ", the GitHub repository is "InvestIQ", the resume never mentions it.
"Tata Consultancy Services" on the resume is "TCS" in the chatbot FAQ. "Key
Monastery", "Kee Monastery" and "Ki Monastery" are one building in Spiti.

Collapsing those surface forms onto one canonical node is what lets a Project
observed on the website and a Repository observed on GitHub become a single
graph node with two sources — the join that makes this a fabric rather than
five separate indexes.

Everything here is data, not code: add an alias, rebuild, and the graph joins.
"""
from __future__ import annotations

import re

PERSON = "Prashobh Paul"

# kind -> [(regex, canonical)]. Order matters: longer / more specific first.
ALIASES: dict[str, list[tuple[str, str]]] = {
    "Organization": [
        (r"\bqualizeal\b", "Qualizeal"),
        (r"\btech\s*mahindra\b", "Tech Mahindra"),
        (r"\byash\s*technologies\b|\byash\b", "Yash Technologies"),
        (r"\bbrane\s*enterprises\b|\bbrane\b", "Brane Enterprises"),
        (r"\bprim\s*era\s*medical(\s*technologies)?\b|\bprimera\b", "Primera Medical Technologies"),
        (r"\btata\s*consultancy\s*services\b|\btcs\b", "Tata Consultancy Services"),
        (r"\bmicrosoft\b", "Microsoft"),
        (r"\banthropic\b", "Anthropic"),
        (r"\bopenai\b", "OpenAI"),
        (r"\bgoogle\b", "Google"),
    ],
    "Client": [],   # client names are confidential (knowledge_sources/profile/confidential.yaml)
    "Institution": [
        (r"\bsrm\s*university\b|\bsrm\b", "SRM University"),
        (r"\bjntu(\s*hyderabad)?\b", "JNTU Hyderabad"),
        (r"\bchristu\s*jyothi\b", "Christu Jyothi Institute of Technology & Science"),
    ],
    "Project": [
        (r"\brv\s*on\s*wheelz\b|\brvonwheelz\b", "RVonWheelz"),
        (r"\bsoccer\.?\s*ai\b|\bworldcup2026fifa\b|\bfifa2026\b", "Soccer.AI"),
        (r"\binvest\.?\s*iq\b|\binvestiq\b", "Invest.IQ"),
        (r"\bkoode\b|\btrippulse\b", "Koode"),
        (r"\bknowledge[\s-]*fabric\b", "Knowledge Fabric"),
        (r"\bpachaka[\s-]*lokam\b|\bpachakalokam\b", "Pachaka Lokam"),
        (r"\biplbuzz\b|\bipl\s*buzz\b", "IPLBuzz"),
        (r"\bcogniflow\b|\barch-animate\b", "CogniFlow"),
        (r"\bprofit\s*pilot(_v1)?\b|\bprofitnow\b", "ProfitPilot"),
        (r"\bdhinasuthra\b", "Dhinasuthra"),
        (r"\btripwise\b", "TripWise"),
        (r"\bcodefabric\b|\bcode\s*fabric\b", "CodeFabric"),
        (r"\bhockeyworldcup2026_women\b|\bworldcup2026hockey\b|\bhockey\s*world\s*cup\b", "Hockey World Cup 2026"),
        (r"\bstockanalysis_indianmarket\b", "Stock Analysis Indian Market"),
        (r"\brideanalyticsdashboard\b", "Ride Analytics Dashboard"),
        (r"\bsdlc_lifecycle__kiroautomation\b|\bkiro\s*sdlc\b", "SDLC Kiro Automation"),
        (r"\bfinance_10k_automation\b", "Finance 10-K Automation"),
        (r"\bagentbasedsystem\b", "Agent Based System"),
        (r"\bvalidaite\b", "ValidAIte"),
        (r"\bqmentisai\b|\bqmentis\b", "QMentisAI"),
        (r"\bdigital_card\b|\bpersonal_website\b|\bpersonal\s*website\b", "Personal Website"),
        (r"\bmedical\s*note\s*reader\b", "Medical Note Reader"),
        (r"\bquadrupedal\s*robot\b", "Quadrupedal Robot AI"),
        (r"\behr\s*parser\b", "EHR Parser"),
        (r"\bai\s*ticket\s*classifier\b", "AI Ticket Classifier"),
        (r"\benterprise\s*genai\s*assistant\b", "Enterprise GenAI Assistant"),
        (r"\bconversational\s*bot\s*framework\b", "Conversational Bot Framework"),
    ],
    "Technology": [
        (r"\blanggraph\b", "LangGraph"), (r"\bcrew\s*ai\b", "CrewAI"), (r"\bautogen\b", "AutoGen"),
        (r"\blangchain\b", "LangChain"), (r"\bmicrosoft\s*agent\s*framework\b", "Microsoft Agent Framework"),
        (r"\bkiro\b", "Kiro"), (r"\b\.net\b|\bdotnet\b", ".NET"),
        (r"\bpython\b", "Python"), (r"\btypescript\b", "TypeScript"), (r"\bjavascript\b", "JavaScript"),
        (r"\bkotlin\b", "Kotlin"), (r"\bjetpack\s*compose\b", "Jetpack Compose"), (r"\breact\b", "React"),
        (r"\bsupabase\b", "Supabase"), (r"\bcapacitor\b", "Capacitor"), (r"\bpwa\b|\bprogressive\s*web\s*app\b", "PWA"),
        (r"\bopenstreetmap\b", "OpenStreetMap"), (r"\bandroid\b", "Android"),
        (r"\baws\s*sagemaker\b|\bsagemaker\b", "AWS SageMaker"), (r"\bvertex\s*ai\b", "GCP Vertex AI"),
        (r"\baws\b", "AWS"), (r"\bgcp\b|\bgoogle\s*cloud\b", "GCP"),
        (r"\bdocker\b", "Docker"), (r"\bkubernetes\b", "Kubernetes"), (r"\bmlops\b", "MLOps"),
        (r"\bneo4j\b", "Neo4j"), (r"\bmongodb\b", "MongoDB"), (r"\bsql\b", "SQL"),
        (r"\bfastapi\b", "FastAPI"), (r"\bstreamlit\b", "Streamlit"), (r"\bflask\b", "Flask"),
        (r"\btensorflow\b", "TensorFlow"), (r"\bpytorch\b", "PyTorch"), (r"\bhugging\s*face\b", "Hugging Face"),
        (r"\bros\b", "ROS"), (r"\bpybullet\b", "PyBullet"), (r"\bhl7\b", "HL7"), (r"\bfhir\b", "FHIR"),
        (r"\bepic\b", "Epic EMR"), (r"\bmeditech\b", "Meditech"), (r"\brag\b|\bretrieval[- ]augmented\b", "RAG"),
        (r"\bjupyter\b", "Jupyter"), (r"\bocr\b", "OCR"), (r"\bopenai\b|\bgpt-?4o?\b|\bchatgpt\b", "OpenAI GPT"),
        (r"\bclaude\b", "Claude"), (r"\bgemini\b", "Gemini"), (r"\bmcp\b|\bmodel\s*context\s*protocol\b", "MCP"),
        (r"\ba2a\b", "A2A"), (r"\brasa\b", "Rasa"), (r"\bdialogflow\b", "Dialogflow"), (r"\bn8n\b", "n8n"),
        (r"\bcopilot\b", "GitHub Copilot"), (r"\bbm25\b", "BM25"), (r"\bknowledge\s*graphs?\b", "Knowledge Graph"),
        (r"\bllms?\b|\blarge\s*language\s*models?\b", "LLM"), (r"\btransformers?\b", "Transformers"),
        (r"\bgithub\s*pages\b", "GitHub Pages"), (r"\bvis-network\b", "vis-network"),
    ],
    "Domain": [
        (r"\bhealthcare\b|\bclinical\b|\bhospitals?\b|\bemr\b|\bmedical\b", "Healthcare"),
        (r"\bbfsi\b|\bbanking\b|\bfinancial\s*services\b|\bfraud\b|\bcredit\s*scoring\b", "BFSI"),
        (r"\btelecom\b", "Telecom"), (r"\bretail\b", "Retail"),
        (r"\brobotics?\b|\bautonomous\s*navigation\b|\bslam\b", "Robotics"),
        (r"\bagentic\s*ai\b|\bmulti[- ]agent\b|\bagent\s*orchestration\b", "Agentic AI"),
        (r"\bgenerative\s*ai\b|\bgenai\b", "Generative AI"),
        (r"\bnlp\b|\bnatural\s*language\s*processing\b|\btext\s*(mining|analytics|classification)\b", "NLP"),
        (r"\bcomputer\s*vision\b|\bobject\s*detection\b", "Computer Vision"),
        (r"\bpredictive\s*(analytics|modeling|modelling)\b", "Predictive Analytics"),
        (r"\bai\s*governance\b|\bgovernance\b", "AI Governance"),
        (r"\bai\s*testing\b|\btesting\s*platform\b|\bquality\s*engineering\b|\bstlc\b", "AI Testing"),
        (r"\baidlc\b|\bai[- ]?(driven|native|powered)\s*(software\s*)?(development|sdlc)\b|\bsdlc\b|\bsoftware\s*development\s*life\s*cycle\b|\bkiro\s*automation\b", "AI-driven SDLC"),
        (r"\bstock\s*prediction\b|\bprediction\s*system\b|\bforecast(ing)?\b|\bbacktest", "Prediction Systems"),
        (r"\bknowledge\s*fabric\b|\bknowledge\s*factory\b|\bontolog(y|ies)\b|\bknowledge\s*layer\b", "Knowledge Engineering"),
        (r"\bconversational\s*ai\b|\bchatbots?\b", "Conversational AI"),
        (r"\bexplainable\s*ai\b|\bexplainability\b|\bcitation[- ]grounded\b", "Explainable AI"),
        (r"\bcorporate\s*training\b|\bworkshops?\b|\binterview\s*prep(aration)?\b|\bcoaching\b|\bmentoring\b", "Training & Coaching"),
        (r"\bconsulting\b|\badvisory\b|\bfreelance\b", "Consulting"),
        (r"\bcricket\b|\bipl\b", "Cricket"), (r"\bfootball\b|\bsoccer\b|\bfifa\b|\bworld\s*cup\b", "Football"),
        (r"\bhockey\b", "Hockey"), (r"\bstock\b|\bequit(y|ies)\b|\binvest(ing|ment)?\b", "Investing"),
        (r"\bsocial\s*impact\b|\bnon[- ]profit\b|\bcommunity\b|\bcar\s*pool(ing)?\b", "Social Impact"),
    ],
    "Place": [
        (r"\bspiti(\s*valley)?\b", "Spiti Valley"), (r"\btabo\b|\btabu\s*monastery\b", "Tabo"),
        (r"\bkaza\b", "Kaza"), (r"\b(key|kee|ki)\s*monastery\b", "Key Monastery"),
        (r"\bchandrat[ah]al\b", "Chandratal Lake"), (r"\bchicham\b", "Chicham Bridge"),
        (r"\batal\s*tunnel\b", "Atal Tunnel"), (r"\blangza\b", "Langza"),
        (r"\bmanali\b", "Manali"), (r"\bhadimba\b", "Hadimba Devi Temple"),
        (r"\breckong\s*peo\b", "Reckong Peo"), (r"\brampur\b", "Rampur"), (r"\bpoo\s*village\b|\bpoo\b", "Poo Village"),
        (r"\bhimachal(\s*pradesh)?\b", "Himachal Pradesh"), (r"\bhimalaya[sn]?\b", "Himalayas"),
        (r"\bmumbai\b", "Mumbai"), (r"\bkala\s*ghoda\b", "Kala Ghoda"), (r"\bjio\s*world\s*cent(re|er)\b", "Jio World Centre"),
        (r"\bhyderabad\b", "Hyderabad"), (r"\bnacharam\b|\braheja\s*vistas\b", "Nacharam, Hyderabad"),
        (r"\bchennai\b", "Chennai"), (r"\bcochin\b|\bkochi\b", "Kochi"), (r"\bjangoan\b|\bjangaon\b", "Jangaon"),
        (r"\bantarctica\b", "Antarctica"), (r"\bindia\b", "India"),
    ],
    "Event": [
        (r"\bmicrosoft\s*ai\s*tour\b|\bai\s*tour\b", "Microsoft AI Tour Mumbai 2025"),
        (r"\bkala\s*ghoda\s*(arts?\s*)?festival\b|\bspirit\s*of\s*kala\s*ghoda\b", "Kala Ghoda Arts Festival 2026"),
        (r"\brepublic\s*day\b", "Republic Day 2026"),
        (r"\bipl\s*2026\b", "IPL 2026"), (r"\b(fifa\s*)?world\s*cup\s*2026\b", "FIFA World Cup 2026"),
        (r"\b1000\s*subscribers\b|\b1k\b", "1,000 Subscribers Milestone"),
        (r"\brecap\s*2025\b", "Recap 2025"), (r"\bnew\s*year\b", "New Year 2026"), (r"\bchristmas\b", "Christmas 2025"),
    ],
    "Person": [
        (r"\bsatya\s*nadella\b|\bsatya\b|\bmicrosoft\s*ceo\b|\bസിഇഒ\b", "Satya Nadella"),
        (r"\bherzog\b", "Werner Herzog"),
    ],
    "Topic": [
        (r"\btravel(l?ing|s)?\b|\btrip\b|\bvlog\b|\bbackpack|\bdestination", "Travel"),
        (r"\bmonaster(y|ies)\b|\bbuddh(a|ist|ism)\b|\bprayer\b|\bom\s*mani\b|\btemple\b", "Monasteries & Temples"),
        (r"\bmotivation(al)?\b|\binspiration(al)?\b|\bquotes?\b|\bmeaning\s*of\s*life\b|\bdeep\s*meaning\b|\bcraft\s*the\s*person\b", "Motivation"),
        (r"\bart\b|\bcanvas\b|\bpainting\b|\bfolk\s*art\b", "Art"),
        (r"\bfestival\b|\bcelebrat(e|ion)\b|\bgreetings?\b", "Festivals & Celebrations"),
        (r"\bengineering\b|\bbridge\b|\btunnel\b", "Engineering Marvels"),
        (r"\bhik(e|ing)\b|\btrek(king)?\b|\bwalk(ing|around)?\s+(through|around|to)\b|\bsummit\s*walk\b", "Hiking & Trekking"),
        (r"\bphoto\s*story\b|\bphotograph", "Photography"),
        (r"\bai\s*tour\b|\bartificial\s*intelligence\b|\bdata\s*science\b|\btech\s*(talk|event|tour)\b|\bmicrosoft\b|\bsatya\b", "AI & Technology"),
        (r"\bmuseum\b|\bculture\b|\bfolk\s*art\b|\bhistory\b|\bancient\b", "Culture & History"),
        (r"\bpenguin\b|\bwildlife\b", "Nature & Wildlife"),
    ],
}

_COMPILED = {kind: [(re.compile(p, re.I), c) for p, c in pairs] for kind, pairs in ALIASES.items()}


def canonical(kind: str, raw: str) -> str | None:
    """Map a surface form to its canonical name for one kind, or None."""
    if not raw:
        return None
    for rx, canon in _COMPILED.get(kind, []):
        if rx.search(raw):
            return canon
    return None


def detect(text: str, kinds: tuple[str, ...] | None = None) -> list[tuple[str, str]]:
    """All (kind, canonical) entities mentioned in a text, de-duplicated."""
    if not text:
        return []
    found: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for kind, pairs in _COMPILED.items():
        if kinds and kind not in kinds:
            continue
        for rx, canon in pairs:
            if rx.search(text):
                key = (kind, canon)
                if key not in seen:
                    seen.add(key)
                    found.append(key)
    return found


# Human-readable canonical for the UI's focus/subject phrasing (lower -> display).
DISPLAY = {c.lower(): c for pairs in ALIASES.values() for _, c in pairs}
DISPLAY[PERSON.lower()] = PERSON
