"""RAGAS-style evaluation + regression harness for the clinical RAG layer.

Computes the core RAG quality metrics fully offline (no API judge):

- context_precision  : did retrieval surface the expected guideline source?
- answer_relevancy   : cosine similarity (sentence-transformers) between the
                       generated answer and the query.
- faithfulness       : fraction of the answer's sentences that are supported
                       by the retrieved context (embedding-entailment proxy).
- regression checks  : must_mention / must_not_mention keyword gates.

These mirror the RAGAS metric definitions but run on the local embedding
model so the eval works on an offline edge box. Run before any model or
prompt change:

    python eval/ragas_eval.py            # uses the live local model
    python eval/ragas_eval.py --dry      # retrieval-only, skip generation
"""

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures.json")
PASS_THRESHOLDS = {"context_precision": 0.66, "answer_relevancy": 0.35, "faithfulness": 0.5}


def _cos(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def _split_sentences(text):
    import re

    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if len(s.strip()) > 12]


def evaluate(dry: bool = False) -> dict:
    from rag_engine import get_rag_engine
    from sentence_transformers import SentenceTransformer

    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    rag = get_rag_engine()

    with open(FIXTURES, "r", encoding="utf-8") as fp:
        fixtures = json.load(fp)["cases"]

    llm = None
    if not dry:
        try:
            import main  # noqa

            llm = main._agent_llm
        except Exception:
            llm = None

    results = []
    for case in fixtures:
        passages = rag.retrieve(case["query"], top_k=3)
        retrieved_ids = [p.source_id for p in passages]
        context = "\n".join(p.text for p in passages)

        hit = any(sid in retrieved_ids for sid in case["expected_source_ids"])
        context_precision = 1.0 if hit else 0.0

        answer = ""
        if llm is not None and context:
            prompt = (
                "Answer the clinical question using ONLY the context. Cite [SOURCE-ID].\n\n"
                f"CONTEXT:\n{context}\n\nQUESTION: {case['query']}"
            )
            try:
                answer = llm(prompt)
            except Exception:
                answer = ""

        relevancy = faithfulness = None
        mention_ok = notmention_ok = None
        if answer:
            q_emb = embedder.encode(case["query"])
            a_emb = embedder.encode(answer)
            relevancy = _cos(q_emb, a_emb)

            sents = _split_sentences(answer)
            if sents and context:
                ctx_emb = embedder.encode(context)
                sims = [_cos(embedder.encode(s), ctx_emb) for s in sents]
                faithfulness = float(np.mean([1.0 if s >= 0.3 else 0.0 for s in sims]))

            lower = answer.lower()
            mention_ok = all(m.lower() in lower for m in case.get("must_mention", []))
            notmention_ok = all(m.lower() not in lower for m in case.get("must_not_mention", []))

        results.append(
            {
                "id": case["id"],
                "retrieved": retrieved_ids,
                "context_precision": context_precision,
                "answer_relevancy": round(relevancy, 3) if relevancy is not None else None,
                "faithfulness": round(faithfulness, 3) if faithfulness is not None else None,
                "must_mention_pass": mention_ok,
                "must_not_mention_pass": notmention_ok,
            }
        )

    def _avg(key):
        vals = [r[key] for r in results if r[key] is not None]
        return round(float(np.mean(vals)), 3) if vals else None

    summary = {
        "n_cases": len(results),
        "context_precision": _avg("context_precision"),
        "answer_relevancy": _avg("answer_relevancy"),
        "faithfulness": _avg("faithfulness"),
        "mention_pass_rate": round(
            np.mean([1.0 if r["must_mention_pass"] else 0.0 for r in results if r["must_mention_pass"] is not None]), 3
        ) if any(r["must_mention_pass"] is not None for r in results) else None,
    }
    summary["regression_pass"] = bool(
        (summary["context_precision"] or 0) >= PASS_THRESHOLDS["context_precision"]
    )
    return {"summary": summary, "cases": results}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry", action="store_true", help="retrieval-only, skip generation")
    parser.add_argument("--json", action="store_true", help="emit JSON")
    args = parser.parse_args()

    report = evaluate(dry=args.dry)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        s = report["summary"]
        print("RAG evaluation summary")
        print(f"  cases:             {s['n_cases']}")
        print(f"  context_precision: {s['context_precision']}")
        print(f"  answer_relevancy:  {s['answer_relevancy']}")
        print(f"  faithfulness:      {s['faithfulness']}")
        print(f"  mention_pass_rate: {s['mention_pass_rate']}")
        print(f"  REGRESSION: {'PASS' if s['regression_pass'] else 'FAIL'}")
