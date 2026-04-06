import os
import chromadb
from sentence_transformers import SentenceTransformer

class RAGPipeline:
    def __init__(self, persist_directory="./chroma_db"):
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        self.collection = self.client.get_or_create_collection(name="medical_guidelines")

    def ingest_directory(self, docs_path):
        """Mock ingestion to showcase how to ingest documents"""
        print(f"Ingesting documents from {docs_path}...")
        # Note: In a real scenario, use PyPDF2 or similar to extract text from PDF
        # Here we mock ingestion for the hackathon template
        mock_docs = [
            "WHO Pneumonia Guidelines: Treat with amoxicillin if breathing is rapid.",
            "WHO TB Guidelines 2023: If cavitary lesion in upper lobe, isolate for active TB. Start GeneXpert."
        ]
        
        for i, text in enumerate(mock_docs):
            embeddings = self.embedder.encode(text).tolist()
            self.collection.add(
                documents=[text],
                embeddings=[embeddings],
                ids=[f"mock_doc_{i}"]
            )
        print("Ingestion complete.")

    def retrieve(self, query, top_k=1):
        query_embedding = self.embedder.encode(query).tolist()
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k
        )
        if results['documents'] and len(results['documents']) > 0:
            return " ".join(results['documents'][0])
        return ""

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--ingest", type=str, help="Path to knowledge base folder")
    args = parser.parse_args()
    
    if args.ingest:
        rag = RAGPipeline()
        rag.ingest_directory(args.ingest)
