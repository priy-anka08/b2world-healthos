"""Hospital AI RAG Assistant (spec sections 13-14)

Chunk + embed uploaded hospital SOPs/policies/manuals (Document/DocumentChunk), store vectors in pgvector, retrieve relevant chunks for a staff question, generate an answer via the local LLM, and return source references.
"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/query")
async def not_implemented():
    return {
        "status": "not_implemented",
        "module": "rag",
        "note": "See this file's module docstring and docs/ROADMAP.md for what to build.",
    }
