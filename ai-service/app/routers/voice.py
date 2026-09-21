"""AI Voice Assistant — speech-to-text stage (spec section 32)

Patient Voice -> Speech-to-Text -> Intent Detection -> Hospital System ->
Response. This module only owns transcription. "Intent detection + present
options, require confirmation before booking" is delegated to the Node
backend's ai-voice module, which reuses the existing read-only ai-copilot
Q&A path — it can never book, cancel, or modify anything on its own.
"""
import base64
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_whisper_model = None


def get_whisper_model():
    """Lazily load faster-whisper on first use, same reasoning as OCR's
    lazy PaddleOCR load."""
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
    return _whisper_model


class TranscribeRequest(BaseModel):
    audio_base64: str
    language: Optional[str] = None  # e.g. "en" — omit to auto-detect


@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    raw = req.audio_base64.split(",")[-1]
    try:
        audio_bytes = base64.b64decode(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio: {e}")

    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        model = get_whisper_model()
        segments, info = model.transcribe(tmp.name, language=req.language, beam_size=1)
        text = " ".join(seg.text.strip() for seg in segments)

    return {
        "text": text.strip(),
        "language": info.language,
        "languageConfidence": round(info.language_probability, 3),
    }