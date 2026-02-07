"""What-Dough Backend — Social budgeting API powered by Dedalus multi-model orchestration."""

import logging
import os
import sys
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from dedalus_agent import process_group_request
from models import (
    ErrorResponse,
    GroupAnalyzeRequest,
    GroupAnalyzeResponse,
    GroupInsights,
    HealthResponse,
    ModelUsage,
    SpendingPattern,
    Suggestion,
)
from nessie import fetch_transactions

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
load_dotenv()

# Logging with timestamps
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-25s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger("what-dough")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="What-Dough API",
    description="Social budgeting backend — multi-model AI suggestions for group activities",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Simple health check."""
    return {"status": "healthy"}


@app.post("/api/analyze-group", response_model=GroupAnalyzeResponse)
async def analyze_group(request: GroupAnalyzeRequest):
    """Analyze a group's preferences, spending history, and return ranked activity suggestions.

    Orchestrates a multi-model pipeline:
    1. Gemini Flash — parse preferences
    2. Claude Opus — analyze transactions
    3. GPT-4o — research venues (with Brave Search via Dedalus)
    4. Gemini Flash — format output
    """
    logger.info(f"POST /api/analyze-group — {len(request.members)} members, zipcode={request.zipcode}")

    try:
        # Fetch transaction history for each member
        transaction_data: dict[str, list] = {}
        for member in request.members:
            name_key = member.name.lower()
            if member.nessie_account_id:
                txns = await fetch_transactions(member.nessie_account_id)
            else:
                logger.info(f"No Nessie account for {member.name} — generating mock data")
                from nessie import _generate_mock_transactions
                txns = _generate_mock_transactions()
            transaction_data[name_key] = txns
            logger.info(f"Got {len(txns)} transactions for {member.name}")

        # Build group data dict for the pipeline
        group_data = {
            "members": [
                {
                    "name": m.name,
                    "preferences": m.preferences,
                    "budget_range": m.budget_range,
                    "dietary_restrictions": m.dietary_restrictions or "",
                }
                for m in request.members
            ],
            "zipcode": request.zipcode,
            "date": request.date,
        }

        # Run the multi-model pipeline
        result = await process_group_request(group_data, transaction_data, request.zipcode)

        # Build validated response
        group_insights = result.get("group_insights", {})
        raw_patterns = group_insights.get("spending_patterns", {})

        spending_patterns = {}
        for name, pattern in raw_patterns.items():
            spending_patterns[name] = SpendingPattern(
                avg_dining=pattern.get("avg_dining", 0),
                avg_entertainment=pattern.get("avg_entertainment", 0),
                avg_shopping=pattern.get("avg_shopping", 0),
            )

        suggestions = []
        for s in result.get("suggestions", []):
            suggestions.append(Suggestion(
                name=s.get("name", "Unknown"),
                type=s.get("type", "activity"),
                cost_per_person=s.get("cost_per_person", 0),
                why_it_fits=s.get("why_it_fits", ""),
                fit_score=max(0, min(1, s.get("fit_score", 0.5))),
                location=s.get("location"),
                booking_link=s.get("booking_link"),
            ))

        model_usage_raw = result.get("model_usage", {})

        response = GroupAnalyzeResponse(
            group_insights=GroupInsights(
                consensus_budget=group_insights.get("consensus_budget", [0, 0]),
                spending_patterns=spending_patterns,
            ),
            suggestions=suggestions,
            model_usage=ModelUsage(
                parsing=model_usage_raw.get("parsing", "google/gemini-2.0-flash-exp"),
                analysis=model_usage_raw.get("analysis", "anthropic/claude-opus-4-20250514"),
                research=model_usage_raw.get("research", "openai/gpt-4o"),
                formatting=model_usage_raw.get("formatting", "google/gemini-2.0-flash-exp"),
            ),
        )

        logger.info(f"Returning {len(suggestions)} suggestions with consensus budget {group_insights.get('consensus_budget')}")
        return response

    except Exception as e:
        logger.error(f"Error processing group analysis: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process group analysis: {str(e)}",
        )


# ---------------------------------------------------------------------------
# Run with: uvicorn main:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    logger.info(f"Starting What-Dough API on {host}:{port}")
    uvicorn.run("main:app", host=host, port=port, reload=True)
