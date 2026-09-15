"""HealthOS AI Copilot (spec section 33)

Natural-language Q&A over a hospital's own operational data. The backend
gathers the real numbers (already scoped to the caller's hospital and
permissions) and passes them in as `contextData` — this service explains
that data, it never invents figures of its own.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any
from app.services.ollama_client import generate

router = APIRouter()

SYSTEM_PROMPT = """You are an operations assistant for hospital staff. You will be given a JSON snapshot of real data from the hospital's system and a question. Answer using ONLY the numbers and facts in the provided data — never invent or estimate a figure that isn't there. If the data doesn't contain what's needed to answer, say so plainly. Keep answers short (2-4 sentences) and factual."""


class CopilotRequest(BaseModel):
    question: str
    contextData: dict[str, Any]


@router.post("/query")
async def answer_question(body: CopilotRequest):
    answer = await generate(
        prompt=f"Hospital data snapshot:\n{body.contextData}\n\nQuestion: {body.question}",
        system=SYSTEM_PROMPT,
    )
    return {"status": "ok", "answer": answer, "dataUsed": body.contextData}