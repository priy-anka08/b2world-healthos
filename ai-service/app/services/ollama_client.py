"""
Shared Ollama client. All AI routers call through this rather than hitting
Ollama's HTTP API directly, so retry/timeout/error handling lives in one
place. Requires a model to already be pulled — see README for:
  docker exec -it <ollama-container> ollama pull llama3.1:8b
"""
import os
import httpx

OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")


async def generate(prompt: str, system: str | None = None, json_mode: bool = False) -> str:
    """
    Calls Ollama's /api/generate with streaming disabled (simplest to
    integrate; swap to streaming later if response latency becomes an
    issue for longer generations).
    """
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system
    if json_mode:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(f"{OLLAMA_HOST}/api/generate", json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise RuntimeError(
                f"Could not reach Ollama at {OLLAMA_HOST} with model '{OLLAMA_MODEL}'. "
                f"Has the model been pulled? (docker exec -it <ollama-container> ollama pull {OLLAMA_MODEL}). "
                f"Underlying error: {e}"
            )
        data = resp.json()
        return data.get("response", "")