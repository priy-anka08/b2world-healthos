"""
B2World HealthOS — AI Service (Python / FastAPI)

Owns everything in spec sections 10-16, 18-19, 21-22, 24-25, 27, 29, 31-34:
documentation assistant, clinical summarization, RAG assistant, OCR
pipeline, voice transcription, and every predictive-analytics feature.

Design constraints (spec section 39 — do not violate):
  * No mandatory paid LLM API. Default to Ollama running a local open-weight
    model. Swappable providers are fine, but the MVP must work with zero
    external API keys.
  * Every call MUST be traceable back to a Node backend AIRequest row — this
    service does not authenticate end users directly; it trusts a
    service-to-service call from the backend, which has already done auth +
    RBAC + tenant scoping. Do not expose this service's port publicly.
"""

from fastapi import FastAPI
from app.routers import documentation, summarization, rag, ocr, predictions, copilot, voice

app = FastAPI(
    title="B2World HealthOS AI Service",
    description="Self-hosted AI intelligence layer (Ollama + pgvector + PaddleOCR + faster-whisper).",
    version="0.1.0",
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "healthos-ai-service"}


app.include_router(documentation.router, prefix="/documentation", tags=["AI Documentation Assistant"])
app.include_router(summarization.router, prefix="/summarization", tags=["AI Clinical Summary"])
app.include_router(rag.router, prefix="/rag", tags=["Hospital RAG Assistant"])
app.include_router(ocr.router, prefix="/ocr", tags=["Document OCR Pipeline"])
app.include_router(predictions.router, prefix="/predictions", tags=["Predictive Analytics"])
app.include_router(copilot.router, prefix="/copilot", tags=["HealthOS AI Copilot"])
app.include_router(voice.router, prefix="/voice", tags=["AI Voice Assistant"])