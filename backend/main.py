"""What-Dough Backend — group activity suggestions via multi-model AI pipeline."""

import logging
import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dedalus_agent import process_event
from models import (
    AnalyzeEventRequest,
    AnalyzeEventResponse,
    ConsensusBudget,
    HealthResponse,
    Suggestion,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-25s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("what-dough")

app = FastAPI(
    title="What-Dough API",
    description="Group activity suggestions powered by multi-model AI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    return {"status": "healthy"}


@app.post("/api/analyze-event", response_model=AnalyzeEventResponse)
async def analyze_event(request: AnalyzeEventRequest):
    """Take an event's participants, preferences, and zipcode, then return
    ranked activity suggestions using a multi-model Dedalus pipeline."""
    logger.info(
        f"POST /api/analyze-event — {len(request.participants)} participants, "
        f"zipcode={request.zipcode}, activity_type={request.activity_type}"
    )

    try:
        participants = [
            {
                "name": p.name,
                "min_budget": p.min_budget,
                "max_budget": p.max_budget,
                "preferences": p.preferences or "",
            }
            for p in request.participants
        ]

        result = await process_event(
            event_name=request.event_name,
            activity_type=request.activity_type,
            zipcode=request.zipcode,
            participants=participants,
        )

        consensus_raw = result.get("consensus_budget", {})
        suggestions_raw = result.get("suggestions", [])

        return AnalyzeEventResponse(
            consensus_budget=ConsensusBudget(
                min=consensus_raw.get("min", 0),
                max=consensus_raw.get("max", 0),
                has_overlap=consensus_raw.get("has_overlap", True),
            ),
            suggestions=[
                Suggestion(
                    name=s.get("name", "Unknown"),
                    type=s.get("type", "activity"),
                    cost_per_person=s.get("cost_per_person", 0),
                    why_it_fits=s.get("why_it_fits", ""),
                    fit_score=max(0, min(1, s.get("fit_score", 0.5))),
                    location=s.get("location"),
                    booking_link=s.get("booking_link") or s.get("booking_url"),
                )
                for s in suggestions_raw
            ],
            model_usage=result.get("model_usage", {}),
        )

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host=host, port=port, reload=True)
