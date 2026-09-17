"""
Hospital AI RAG Assistant — Lite (spec sections 13-14)

Flow: Document → Parser → Chunking → Embeddings → pgvector → Retriever → LLM → Answer + Source References

Uses Ollama for LLM + embeddings. No paid API required (spec §39).
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

OLLAMA_BASE = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
EMBED_MODEL = os.getenv("EMBED_MODEL", "nomic-embed-text")
LLM_MODEL = os.getenv("LLM_MODEL", "mistral")


class RAGQueryRequest(BaseModel):
    question: str
    hospital_id: str
    user_id: str
    chunks: list[dict]  # pre-retrieved from backend: [{id, content, document_title}]
    top_k: int = 5


class RAGIngestRequest(BaseModel):
    chunks: list[str]  # text chunks to embed
    document_id: str
    hospital_id: str


class EmbedRequest(BaseModel):
    texts: list[str]


# ─── Embedding endpoint ───
@router.post("/embed")
async def generate_embeddings(req: EmbedRequest):
    """Generate embeddings via Ollama for a list of texts."""
    embeddings = []
    async with httpx.AsyncClient(timeout=120.0) as client:
        for text in req.texts:
            try:
                resp = await client.post(
                    f"{OLLAMA_BASE}/api/embeddings",
                    json={"model": EMBED_MODEL, "prompt": text},
                )
                resp.raise_for_status()
                embeddings.append(resp.json()["embedding"])
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"Ollama embedding failed: {str(e)}")
    return {"embeddings": embeddings}


# ─── RAG Query endpoint ───
@router.post("/query")
async def rag_query(req: RAGQueryRequest):
    """
    Receives pre-retrieved chunks from the backend (which already did
    tenant-scoped pgvector similarity search), builds a prompt, calls
    the local LLM, and returns the answer with source references.

    The backend is responsible for:
      1. Auth + RBAC + tenant scoping
      2. pgvector similarity search filtered by hospitalId
      3. Passing only authorized chunks here

    This service NEVER queries the database directly (spec §38).
    """
    if not req.chunks:
        return {
            "answer": "I couldn't find any relevant documents for your question. Please make sure hospital documents (SOPs, policies, guidelines) have been uploaded.",
            "sources": [],
        }

    # Build context from chunks
    context_parts = []
    for i, chunk in enumerate(req.chunks):
        context_parts.append(f"[Source {i + 1}: {chunk.get('document_title', 'Unknown')}]\n{chunk['content']}")

    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""You are a helpful hospital assistant. Answer the user's question based ONLY on the provided hospital documents. If the documents don't contain enough information to answer, say so clearly.

Always cite which source(s) you used in your answer.

Hospital Documents:
{context}

Question: {req.question}

Answer:"""

    # Call Ollama LLM
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{OLLAMA_BASE}/api/generate",
                json={
                    "model": LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_predict": 1024},
                },
            )
            resp.raise_for_status()
            answer = resp.json().get("response", "").strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ollama LLM call failed: {str(e)}")

    sources = [
        {"chunk_id": c.get("id"), "document_title": c.get("document_title", "Unknown")}
        for c in req.chunks
    ]

    return {
        "answer": answer,
        "sources": sources,
        "model_used": LLM_MODEL,
    }
