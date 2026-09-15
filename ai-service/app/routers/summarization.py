"""AI Clinical Summary (spec section 11)

Summarizes a patient's previous visit history for an authorized clinician.
The backend supplies the actual encounter/note text (already scoped and
permission-checked) — this service only summarizes what it's given, it
never fetches patient data on its own.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ollama_client import generate

router = APIRouter()

SYSTEM_PROMPT = """You are a clinical summarization assistant. Summarize the provided patient visit history for a doctor who is about to see this patient again. Be concise (under 200 words), factual, and only use information present in the input — never infer a diagnosis that wasn't stated. Highlight anything a doctor would want to know before the visit: ongoing conditions, recent medications, notable assessments. Plain text only, no markdown headers."""


class SummarizationRequest(BaseModel):
    patientHistoryText: str


@router.post("/query")
async def summarize_history(body: SummarizationRequest):
    if not body.patientHistoryText.strip():
        return {
            "status": "no_data",
            "summary": "No prior visit history is on record for this patient yet.",
        }
    summary = await generate(
        prompt=f"Patient visit history:\n{body.patientHistoryText}\n\nSummarize for the doctor.",
        system=SYSTEM_PROMPT,
    )
    return {"status": "ok", "summary": summary}