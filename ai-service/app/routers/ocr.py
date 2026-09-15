"""AI Document OCR pipeline (spec section 12, 21)

Document -> OCR (PaddleOCR) -> classification -> field extraction -> structured data -> human verification -> patient record. Never write directly into a patient's official record without human verification.
"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/query")
async def not_implemented():
    return {
        "status": "not_implemented",
        "module": "ocr",
        "note": "See this file's module docstring and docs/ROADMAP.md for what to build.",
    }
