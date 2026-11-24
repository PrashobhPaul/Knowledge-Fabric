"""Knowledge Factory — the acquisition side of the system.

The Fabric (pipeline/) indexes, links and retrieves. It is deliberately
deterministic: given the same files it emits the same index. That means
something else has to go and *get* the files — crawl the website, read the
YouTube feed, list the GitHub repositories, download the current resume — and
write them to disk in a stable shape.

That something is the Factory.

    knowledge_factory/sync.py        orchestrator (python -m knowledge_factory.sync)
    knowledge_factory/sources/*.py   one module per live source
    knowledge_sources/manifest.json  what was synced, when, and how many records

The two halves meet at knowledge_sources/: the Factory writes it, the Fabric
reads it. Because the Factory output is committed, every Fabric build is
reproducible and the site keeps working even when a live source is down.
"""
