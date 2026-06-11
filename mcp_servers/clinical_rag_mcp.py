"""radflow-clinical-rag-mcp — exposes RadFlow-Edge's offline clinical
guideline RAG layer to MCP-aware agents and dev tools.

Lets a coding/eval agent (Claude Desktop, Cursor, the CLI test harness)
query the WHO/NTP guideline corpus, fetch cited passages, and inspect the
indexed sources — without hand-copying PDFs. Read-only over the corpus;
not exposed in production PHC deployments (no inbound surface on the edge
device).

Run:  python mcp_servers/clinical_rag_mcp.py        (stdio transport)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from mcp.server.fastmcp import FastMCP  # noqa: E402

from rag_engine import KB_DIR, get_rag_engine  # noqa: E402

mcp = FastMCP("radflow-clinical-rag")


@mcp.tool()
def search_guidelines(query: str, top_k: int = 3) -> list:
    """Hybrid semantic + keyword search over the Bangla/English clinical
    guideline corpus. Returns reranked passages with their source ids."""
    passages = get_rag_engine().retrieve(query, top_k=top_k)
    return [
        {"source_id": p.source_id, "title": p.title, "score": round(p.score, 3), "text": p.text}
        for p in passages
    ]


@mcp.tool()
def get_guideline_passage(source_id: str) -> dict:
    """Return the full guideline document for a given source id, for exact
    citation."""
    for fname in os.listdir(KB_DIR):
        path = os.path.join(KB_DIR, fname)
        with open(path, "r", encoding="utf-8") as fp:
            content = fp.read()
        if f"Source-ID: {source_id}" in content or source_id in fname:
            return {"source_id": source_id, "file": fname, "content": content}
    return {"error": f"No guideline found for source_id={source_id}"}


@mcp.tool()
def list_corpus_sources() -> list:
    """List the guideline documents currently indexed (source, title)."""
    sources = []
    for fname in sorted(os.listdir(KB_DIR)):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(KB_DIR, fname), "r", encoding="utf-8") as fp:
            head = fp.read(600)
        title = head.splitlines()[0].lstrip("# ").strip() if head else fname
        sources.append({"file": fname, "title": title})
    return sources


if __name__ == "__main__":
    mcp.run()
