"""Dedalus Labs SDK integration — multi-model pipeline for activity suggestions."""

import json
import logging
import os
import time
from typing import Any

from tools import (
    calculate_consensus_budget_tool,
    parse_preferences_tool,
    score_venues_tool,
)

logger = logging.getLogger("what-dough.dedalus")


async def process_event(
    event_name: str,
    activity_type: str | None,
    zipcode: str,
    participants: list[dict],
) -> dict[str, Any]:
    """Run the Dedalus multi-model pipeline to suggest activities.

    With Dedalus key: uses model handoffs + Brave Search MCP for real venue data.
    Without: falls back to local tool execution with mock venues.
    """
    dedalus_api_key = os.getenv("DEDALUS_API_KEY", "")
    total_start = time.time()

    if dedalus_api_key:
        try:
            return await _run_with_dedalus(
                dedalus_api_key, event_name, activity_type, zipcode, participants
            )
        except Exception as e:
            logger.warning(f"Dedalus SDK error ({e}), falling back to local pipeline")

    # ------------------------------------------------------------------
    # Local fallback
    # ------------------------------------------------------------------
    return _run_local(event_name, activity_type, zipcode, participants, total_start)


def _run_local(
    event_name: str,
    activity_type: str | None,
    zipcode: str,
    participants: list[dict],
    total_start: float,
) -> dict[str, Any]:
    """Run tools locally without LLM orchestration."""
    logger.info("LOCAL PIPELINE (no Dedalus key)")

    # Parse preferences
    all_prefs = []
    for p in participants:
        text = p.get("preferences") or ""
        if activity_type:
            text = f"{activity_type}, {text}" if text else activity_type
        parsed = parse_preferences_tool(text)
        parsed["member_name"] = p["name"]
        all_prefs.append(parsed)

    # Consensus budget
    budgets = [[p["min_budget"], p["max_budget"]] for p in participants]
    consensus = calculate_consensus_budget_tool(budgets)

    # Mock venues
    all_types = set()
    for pref in all_prefs:
        all_types.update(pref.get("activity_types", []))

    venues = _generate_mock_venues(list(all_types), zipcode, consensus["min"], consensus["max"])
    aggregated = {
        "activity_types": list(all_types),
        "vibe": list({v for p in all_prefs for v in p.get("vibe", [])}),
        "dietary_restrictions": list({d for p in all_prefs for d in p.get("dietary_restrictions", [])}),
    }
    scored = score_venues_tool(venues, aggregated, consensus)

    suggestions = [
        {
            "name": v["name"],
            "type": v.get("type", "activity"),
            "cost_per_person": v.get("cost_per_person", 0),
            "why_it_fits": v.get("why_it_fits", ""),
            "fit_score": v.get("fit_score", 0.5),
            "location": v.get("location", ""),
            "booking_link": v.get("booking_link"),
        }
        for v in scored[:6]
    ]

    logger.info(f"Local pipeline done in {time.time() - total_start:.2f}s — {len(suggestions)} suggestions")

    return {
        "consensus_budget": consensus,
        "suggestions": suggestions,
        "model_usage": {"pipeline": "local-fallback"},
    }


# ------------------------------------------------------------------
# Dedalus SDK path
# ------------------------------------------------------------------

async def _run_with_dedalus(
    api_key: str,
    event_name: str,
    activity_type: str | None,
    zipcode: str,
    participants: list[dict],
) -> dict:
    """Use Dedalus SDK with multi-model handoffs and Brave Search MCP."""
    from dedalus_labs import AsyncDedalus, DedalusRunner

    client = AsyncDedalus(api_key=api_key)
    runner = DedalusRunner(client)

    # Build the prompt with all context
    members_summary = "\n".join(
        f"- {p['name']}: budget ${p['min_budget']}-${p['max_budget']}, "
        f"preferences: {p.get('preferences') or 'none'}"
        for p in participants
    )

    budget_list = [[p["min_budget"], p["max_budget"]] for p in participants
    ]
    consensus = calculate_consensus_budget_tool(budget_list)

    prompt = (
        f"I'm planning a group activity called '{event_name}' near zipcode {zipcode}.\n\n"
        f"Participants:\n{members_summary}\n\n"
        f"Consensus budget: ${consensus['min']}-${consensus['max']} per person "
        f"({'exact overlap' if consensus['has_overlap'] else 'compromise average'}).\n\n"
        f"Search for real activities, restaurants, and venues near zipcode {zipcode} "
        f"that fit within the ${consensus['min']}-${consensus['max']} per person budget. "
        f"Consider each participant's preferences.\n\n"
        f"Return a JSON object with exactly this structure:\n"
        f'{{"suggestions": [{{"name": "...", "type": "dining|entertainment|outdoors|nightlife|sports|arts", '
        f'"cost_per_person": 25, "why_it_fits": "...", "fit_score": 0.85, "location": "..."}}]}}\n\n'
        f"Return 5-6 suggestions sorted by fit_score (0 to 1). Only return the JSON, no other text."
    )

    logger.info(f"Calling Dedalus with multi-model handoff for zipcode {zipcode}")

    result = await runner.run(
        input=prompt,
        model=[
            "google/gemini-2.0-flash",
            "anthropic/claude-sonnet-4-5-20250929",
            "openai/gpt-4o",
        ],
        mcp_servers=["dedalus-labs/brave-search-mcp"],
        tools=[parse_preferences_tool, score_venues_tool],
    )

    logger.info(f"Dedalus result type: {type(result)}")

    # Parse the result
    output = _parse_dedalus_result(result)

    # Attach consensus budget
    output["consensus_budget"] = consensus
    output["model_usage"] = {
        "pipeline": "dedalus-multi-model",
        "models": "gemini-flash + claude-sonnet + gpt-4o",
        "mcp": "brave-search",
    }

    return output


def _parse_dedalus_result(result: Any) -> dict:
    """Extract structured data from a Dedalus runner result."""
    # The result object has a .final_output attribute
    raw = getattr(result, "final_output", None) or str(result)

    if isinstance(raw, dict):
        return raw

    if isinstance(raw, str):
        cleaned = raw.strip()
        # Strip markdown code fences
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            cleaned = cleaned.rsplit("```", 1)[0]
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning(f"Could not parse Dedalus output as JSON: {cleaned[:200]}")

    return {"suggestions": [], "raw": str(raw)[:500]}


# ------------------------------------------------------------------
# Mock venues for local fallback
# ------------------------------------------------------------------

def _generate_mock_venues(
    activity_types: list[str],
    zipcode: str,
    budget_min: float,
    budget_max: float,
) -> list[dict]:
    templates = {
        "dining": [
            {"name": "Umami Sushi Bar", "type": "dining", "cost_per_person": 32, "vibe": "social chill",
             "why_it_fits": "Highly rated sushi within group budget", "rating": 4.6,
             "dietary_options": ["vegetarian", "gluten-free"], "location": f"Near {zipcode}"},
            {"name": "The Rustic Table", "type": "dining", "cost_per_person": 28, "vibe": "chill",
             "why_it_fits": "Farm-to-table, diverse menu options", "rating": 4.4,
             "dietary_options": ["vegetarian", "vegan", "gluten-free"], "location": f"Near {zipcode}"},
            {"name": "Fuego Latin Kitchen", "type": "dining", "cost_per_person": 25, "vibe": "energetic social",
             "why_it_fits": "Great group atmosphere, lively vibe", "rating": 4.3,
             "dietary_options": ["vegetarian"], "location": f"Near {zipcode}"},
        ],
        "entertainment": [
            {"name": "Laugh Factory Comedy Club", "type": "entertainment", "cost_per_person": 22, "vibe": "energetic social",
             "why_it_fits": "Live comedy, great for groups", "rating": 4.5,
             "dietary_options": [], "location": f"Near {zipcode}"},
            {"name": "Escape Room Challenge", "type": "entertainment", "cost_per_person": 30, "vibe": "energetic social",
             "why_it_fits": "Team-building fun within budget", "rating": 4.7,
             "dietary_options": [], "location": f"Near {zipcode}"},
            {"name": "Retro Arcade Bar", "type": "entertainment", "cost_per_person": 18, "vibe": "energetic chill",
             "why_it_fits": "Budget-friendly with games and drinks", "rating": 4.2,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "outdoors": [
            {"name": "Sunset Trail Hike", "type": "outdoors", "cost_per_person": 5, "vibe": "chill",
             "why_it_fits": "Free activity, great for any budget", "rating": 4.8,
             "dietary_options": [], "location": f"Near {zipcode}"},
            {"name": "Kayaking Adventure", "type": "outdoors", "cost_per_person": 35, "vibe": "energetic",
             "why_it_fits": "Active outdoor group experience", "rating": 4.5,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "nightlife": [
            {"name": "Craft & Pour Brewery", "type": "nightlife", "cost_per_person": 20, "vibe": "chill social",
             "why_it_fits": "Relaxed brewery with group seating", "rating": 4.3,
             "dietary_options": ["vegetarian", "vegan"], "location": f"Near {zipcode}"},
            {"name": "Skyline Rooftop Lounge", "type": "nightlife", "cost_per_person": 35, "vibe": "social",
             "why_it_fits": "Great views and cocktails", "rating": 4.6,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "sports": [
            {"name": "Lucky Strike Bowling", "type": "sports", "cost_per_person": 18, "vibe": "energetic social",
             "why_it_fits": "Classic group activity, always fun", "rating": 4.1,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "arts": [
            {"name": "Modern Art Museum", "type": "arts", "cost_per_person": 15, "vibe": "chill",
             "why_it_fits": "Affordable cultural experience", "rating": 4.4,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "wellness": [
            {"name": "Zen Day Spa", "type": "wellness", "cost_per_person": 45, "vibe": "chill",
             "why_it_fits": "Relaxing group wellness day", "rating": 4.7,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "shopping": [
            {"name": "Artisan Market", "type": "shopping", "cost_per_person": 10, "vibe": "chill social",
             "why_it_fits": "Browse local vendors, budget-friendly", "rating": 4.2,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
    }

    venues = []
    for atype in activity_types:
        for v in templates.get(atype, []):
            if v["cost_per_person"] > budget_max * 1.2:
                v["cost_per_person"] = round(budget_max * 0.9, 2)
            venues.append(v)

    if "dining" not in activity_types:
        venues.extend(templates["dining"][:2])

    return venues


# ----- Nessie / transaction-based enrichment (for later) -----
#
# async def _enrich_with_spending_history(participants, transaction_data):
#     """Use Capital One Nessie transaction data to refine budget comfort zones."""
#     pass
