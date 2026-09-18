"""AI Document OCR pipeline (spec section 12, 21)

Document -> OCR (PaddleOCR) -> classification -> field extraction ->
structured data -> human verification -> patient record. This module never
writes to a patient's official record — it only returns a structured draft.
The Node backend's ai-ocr module is the only thing that can mark a draft
"verified", and only after a human calls that endpoint.
"""
import base64
from io import BytesIO
from typing import Optional
import re

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from PIL import Image

router = APIRouter()

DOCUMENT_TYPES = ["prescription", "lab_report", "discharge_summary", "referral"]

_ocr_engine = None


def get_ocr_engine():
    """Lazily construct the PaddleOCR engine on first use — loading the model
    at import time would slow down every ai-service startup, even requests
    that never touch OCR."""
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR
        _ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    return _ocr_engine


class ExtractRequest(BaseModel):
    image_base64: str
    document_type_hint: Optional[str] = None


def decode_image(image_base64: str) -> np.ndarray:
    raw = image_base64.split(",")[-1]  # strip a data: URI prefix if present
    try:
        img_bytes = base64.b64decode(raw)
        image = Image.open(BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode image: {e}")
    return np.array(image)


def run_ocr(image_array: np.ndarray) -> tuple[str, float]:
    engine = get_ocr_engine()
    result = engine.ocr(image_array, cls=True)
    lines: list[str] = []
    confidences: list[float] = []
    for page in result or []:
        for line in page or []:
            text, conf = line[1][0], line[1][1]
            lines.append(text)
            confidences.append(conf)
    raw_text = "\n".join(lines)
    avg_confidence = round(sum(confidences) / len(confidences), 3) if confidences else 0.0
    return raw_text, avg_confidence


CLASSIFICATION_KEYWORDS = {
    "lab_report": ["specimen", "reference range", "test name", "result", "laboratory", "pathology"],
    "discharge_summary": ["discharge summary", "admitted on", "discharged on", "diagnosis at discharge"],
    "referral": ["referred to", "referral", "kindly evaluate", "please review"],
    "prescription": ["rx", "dosage", "tablet", "sig:", "prescribed"],
}


def classify_document(raw_text: str, hint: Optional[str]) -> str:
    if hint in DOCUMENT_TYPES:
        return hint
    lowered = raw_text.lower()
    scores = {
        doc_type: sum(1 for kw in keywords if kw in lowered)
        for doc_type, keywords in CLASSIFICATION_KEYWORDS.items()
    }
    best_type = max(scores, key=scores.get)
    return best_type if scores[best_type] > 0 else "prescription"


# Deliberately small, conservative regex heuristics — good enough to save a
# human re-typing obvious fields, never good enough to skip human
# verification. Every extracted field is a *suggestion*, not a fact.
LAB_RESULT_LINE = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z \-/]{2,40})\s+(?P<value>[\d.]+)\s*(?P<unit>[A-Za-z/%]+)?\s*"
    r"(?:\(?(?P<range>[\d.]+\s*-\s*[\d.]+)\)?)?"
)
MEDICINE_LINE = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z \-]{2,40}\s?\d*\s?(?:mg|ml|mcg)?)\s+"
    r"(?P<frequency>once daily|twice daily|thrice daily|\d+\s*x\s*day|od|bd|tds)",
    re.IGNORECASE,
)
DATE_LINE = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b")


def extract_fields(raw_text: str, document_type: str) -> dict:
    fields: dict = {}

    date_match = DATE_LINE.search(raw_text)
    if date_match:
        fields["date"] = date_match.group(1)

    if document_type == "lab_report":
        results = []
        for m in LAB_RESULT_LINE.finditer(raw_text):
            results.append({
                "testName": m.group("name").strip(),
                "value": m.group("value"),
                "unit": m.group("unit") or "",
                "referenceRange": m.group("range") or "",
            })
        fields["labResults"] = results[:30]  # cap — this is a draft aid, not a full parser

    elif document_type == "prescription":
        medicines = []
        for m in MEDICINE_LINE.finditer(raw_text):
            medicines.append({"medicine": m.group("name").strip(), "frequency": m.group("frequency")})
        fields["medicines"] = medicines[:30]

    else:
        # discharge_summary / referral — no reliable line-level pattern here;
        # hand back the raw text for the reviewer to read and re-key.
        fields["notes"] = raw_text[:2000]

    return fields


@router.post("/extract")
async def extract(req: ExtractRequest):
    image_array = decode_image(req.image_base64)
    raw_text, confidence = run_ocr(image_array)

    if not raw_text.strip():
        return {
            "documentType": req.document_type_hint or "prescription",
            "rawText": "",
            "confidence": 0.0,
            "extractedFields": {},
            "warning": "OCR found no readable text — try a clearer scan/photo.",
        }

    document_type = classify_document(raw_text, req.document_type_hint)
    extracted_fields = extract_fields(raw_text, document_type)

    return {
        "documentType": document_type,
        "rawText": raw_text,
        "confidence": confidence,
        "extractedFields": extracted_fields,
    }