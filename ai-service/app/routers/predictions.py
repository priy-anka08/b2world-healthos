"""Predictive analytics (spec sections 14-16, 18-19, 24-25, 27, 29)

No-show risk, bed occupancy forecast, ED volume forecast, pharmacy reorder/expiry prediction, inventory anomaly detection, revenue anomaly detection, staff scheduling suggestions, equipment maintenance risk. All outputs are advisory scores/estimates, never authoritative decisions.
"""
from fastapi import APIRouter

router = APIRouter()


@router.post("/query")
async def not_implemented():
    return {
        "status": "not_implemented",
        "module": "predictions",
        "note": "See this file's module docstring and docs/ROADMAP.md for what to build.",
    }
