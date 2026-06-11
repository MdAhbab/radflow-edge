"""Clinical RAG engine: hybrid retrieval with citations, fully offline.

Pipeline: semantic chunking of the guideline corpus -> dense (ChromaDB +
sentence-transformers) and sparse (BM25) retrieval -> reciprocal-rank
fusion -> cross-encoder rerank -> cited passages. An optional HyDE step
expands short queries with a hypothetical answer before retrieval.

Every returned passage carries its source id and document title so the
narrative model can ground each statement in a traceable citation. The
index persists to ``models/chroma_db`` and is rebuilt only when the
corpus changes (content hash), so startup stays fast on the edge box.
"""

import hashlib
import os
import re
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

KB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "knowledge_base")
PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "chroma_db"
)
EMBED_MODEL = "all-MiniLM-L6-v2"
RERANK_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
COLLECTION = "clinical_guidelines"


@dataclass
class Passage:
    text: str
    source_id: str
    title: str
    score: float = 0.0

    def citation(self) -> str:
        return f"[{self.source_id}] {self.title}"


def _semantic_chunks(text: str, source_id: str, title: str) -> List[Dict[str, str]]:
    """Split a markdown guideline on its section headers, keeping each
    section whole so a retrieved chunk reads as a coherent passage."""
    chunks: List[Dict[str, str]] = []
    sections = re.split(r"\n(?=## )", text)
    for section in sections:
        body = section.strip()
        if len(body) < 40:
            continue
        chunks.append({"text": body, "source_id": source_id, "title": title})
    return chunks


def _parse_corpus() -> List[Dict[str, str]]:
    chunks: List[Dict[str, str]] = []
    if not os.path.isdir(KB_DIR):
        return chunks
    for fname in sorted(os.listdir(KB_DIR)):
        if not fname.endswith(".md"):
            continue
        with open(os.path.join(KB_DIR, fname), "r", encoding="utf-8") as fp:
            content = fp.read()
        title_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        sid_match = re.search(r"^Source-ID:\s*(.+)$", content, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else fname
        source_id = sid_match.group(1).strip() if sid_match else fname.replace(".md", "")
        chunks.extend(_semantic_chunks(content, source_id, title))
    return chunks


def _corpus_hash(chunks: List[Dict[str, str]]) -> str:
    h = hashlib.sha256()
    for c in chunks:
        h.update(c["text"].encode("utf-8"))
    return h.hexdigest()[:16]


class ClinicalRAG:
    """Lazy-loaded singleton-style RAG engine. Heavy models load on first
    query so importing this module stays cheap."""

    def __init__(self) -> None:
        self._chunks: List[Dict[str, str]] = []
        self._embedder = None
        self._reranker = None
        self._collection = None
        self._bm25 = None
        self._bm25_corpus_tokens: List[List[str]] = []
        self._ready = False

    # -- index lifecycle ---------------------------------------------------
    def _ensure_ready(self) -> None:
        if self._ready:
            return
        import chromadb
        from sentence_transformers import SentenceTransformer

        self._chunks = _parse_corpus()
        if not self._chunks:
            self._ready = True
            return

        self._embedder = SentenceTransformer(EMBED_MODEL)
        client = chromadb.PersistentClient(path=PERSIST_DIR)
        corpus_hash = _corpus_hash(self._chunks)
        name = f"{COLLECTION}_{corpus_hash}"

        existing = {c.name for c in client.list_collections()}
        self._collection = client.get_or_create_collection(name=name)
        if name not in existing or self._collection.count() != len(self._chunks):
            # Drop stale hashed collections, then (re)build this one.
            for c in client.list_collections():
                if c.name.startswith(COLLECTION) and c.name != name:
                    client.delete_collection(c.name)
            self._collection = client.get_or_create_collection(name=name)
            embeddings = self._embedder.encode(
                [c["text"] for c in self._chunks], show_progress_bar=False
            ).tolist()
            self._collection.add(
                ids=[f"chunk_{i}" for i in range(len(self._chunks))],
                documents=[c["text"] for c in self._chunks],
                embeddings=embeddings,
                metadatas=[{"source_id": c["source_id"], "title": c["title"]} for c in self._chunks],
            )

        from rank_bm25 import BM25Okapi

        self._bm25_corpus_tokens = [self._tokenize(c["text"]) for c in self._chunks]
        self._bm25 = BM25Okapi(self._bm25_corpus_tokens)
        self._ready = True

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        return re.findall(r"[a-z0-9]+", text.lower())

    # -- retrieval ---------------------------------------------------------
    def _dense(self, query: str, k: int) -> List[tuple]:
        assert self._embedder is not None and self._collection is not None
        q_emb = self._embedder.encode([query]).tolist()
        res = self._collection.query(query_embeddings=q_emb, n_results=min(k, len(self._chunks)))
        out = []
        for idx, doc in enumerate(res["documents"][0]):
            meta = res["metadatas"][0][idx]
            out.append((doc, meta, idx + 1))
        return out

    def _sparse(self, query: str, k: int) -> List[tuple]:
        assert self._bm25 is not None
        scores = self._bm25.get_scores(self._tokenize(query))
        ranked = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
        out = []
        for rank, i in enumerate(ranked):
            c = self._chunks[i]
            out.append((c["text"], {"source_id": c["source_id"], "title": c["title"]}, rank + 1))
        return out

    def retrieve(
        self,
        query: str,
        top_k: int = 3,
        hyde_fn: Optional[Callable[[str], str]] = None,
    ) -> List[Passage]:
        """Hybrid retrieve + rerank. ``hyde_fn`` (optional) turns a short
        query into a hypothetical answer to improve dense recall."""
        self._ensure_ready()
        if not self._chunks:
            return []

        search_query = query
        if hyde_fn is not None:
            try:
                hypothetical = hyde_fn(query)
                if hypothetical:
                    search_query = f"{query}\n{hypothetical}"
            except Exception:
                pass

        pool = 8
        dense = self._dense(search_query, pool)
        sparse = self._sparse(search_query, pool)

        # Reciprocal-rank fusion of the two retrievers.
        fused: Dict[str, Dict] = {}
        for text, meta, rank in dense + sparse:
            key = meta["source_id"] + "|" + text[:60]
            entry = fused.setdefault(key, {"text": text, "meta": meta, "rrf": 0.0})
            entry["rrf"] += 1.0 / (60 + rank)

        candidates = sorted(fused.values(), key=lambda e: e["rrf"], reverse=True)[:pool]
        return self._rerank(query, candidates, top_k)

    def _rerank(self, query: str, candidates: List[Dict], top_k: int) -> List[Passage]:
        if not candidates:
            return []
        if self._reranker is None:
            from sentence_transformers import CrossEncoder

            self._reranker = CrossEncoder(RERANK_MODEL)
        pairs = [(query, c["text"]) for c in candidates]
        scores = self._reranker.predict(pairs)
        for c, s in zip(candidates, scores):
            c["score"] = float(s)
        ranked = sorted(candidates, key=lambda c: c["score"], reverse=True)[:top_k]
        return [
            Passage(
                text=c["text"],
                source_id=c["meta"]["source_id"],
                title=c["meta"]["title"],
                score=c["score"],
            )
            for c in ranked
        ]

    def context_block(self, passages: List[Passage]) -> str:
        """Format retrieved passages as a citable context block."""
        if not passages:
            return ""
        lines = []
        for p in passages:
            lines.append(f"SOURCE {p.citation()}:\n{p.text}")
        return "\n\n".join(lines)


_ENGINE: Optional[ClinicalRAG] = None


def get_rag_engine() -> ClinicalRAG:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = ClinicalRAG()
    return _ENGINE
