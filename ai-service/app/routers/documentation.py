"""AI Medical Documentation Assistant (spec section 10)

Doctor dictation/free text -> structured draft (Chief Complaint, History,
Observations, Assessment, Plan, Follow-up). This ONLY returns a draft — it
never writes to the official clinical_notes table itself. The backend
never auto-saves this output; a clinician must review it and use the
existing (unmodified) clinical-notes save flow to make it official.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ollama_client import generate

router = APIRouter()

SYSTEM_PROMPT = """You are a clinical documentation assistant helping a doctor structure their rough consultation notes into a standard format. You do not diagnose or add any clinical information that was not stated or clearly implied by the input. If a section has no information, leave it as an empty string. Respond with ONLY a JSON object with these exact keys: chiefComplaint, history, observations, assessment, plan. No markdown, no preamble, no explanation."""


class DocumentationRequest(BaseModel):
    rawNotes: str


@router.post("/query")
async def draft_documentation(body: DocumentationRequest):
    raw = await generate(
        prompt=f"Doctor's rough notes:\n{body.rawNotes}\n\nStructure this into the JSON format described.",
        system=SYSTEM_PROMPT,
        json_mode=True,
    )
    return {
        "status": "draft",
        "draft": raw,
        "requiresApproval": True,
        "disclaimer": "This is an AI-generated draft. Review and edit before saving as an official note.",
    }