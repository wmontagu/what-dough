"""Dedalus Labs SDK integration with multi-model handoff orchestration."""

import json
import logging
import os
import time
from typing import Any

from tools import (
    analyze_transactions_tool,
    calculate_consensus_budget_tool,
    parse_preferences_tool,
    score_venues_tool,
)

logger = logging.getLogger("what-dough.dedalus")

# Cost estimates per 1K tokens (for logging/comparison)
MODEL_COSTS = {
    "google/gemini-2.0-flash-exp": {"input": 0.0001, "output": 0.0004},
    "anthropic/claude-opus-4-20250514": {"input": 0.015, "output": 0.075},
    "openai/gpt-4o": {"input": 0.005, "output": 0.015},
    "anthropic/claude-sonnet-4-20250514": {"input": 0.003, "output": 0.015},
}


def _log_model_choice(step: str, model: str, reason: str):
    """Log why a specific model was chosen for this step."""
    cost = MODEL_COSTS.get(model, {})
    logger.info(
        f"MODEL HANDOFF | Step: {step} | Model: {model} | "
        f"Reason: {reason} | "
        f"Est. cost: ${cost.get('input', '?')}/1K in, ${cost.get('output', '?')}/1K out"
    )


def _log_cost_comparison(step: str, model_used: str):
    """Log cost savings vs using Claude Opus for everything."""
    opus_cost = MODEL_COSTS["anthropic/claude-opus-4-20250514"]
    used_cost = MODEL_COSTS.get(model_used, opus_cost)
    if used_cost != opus_cost:
        savings_in = (1 - used_cost["input"] / opus_cost["input"]) * 100
        savings_out = (1 - used_cost["output"] / opus_cost["output"]) * 100
        logger.info(
            f"COST SAVINGS | {step}: Using {model_used} saves "
            f"~{savings_in:.0f}% on input, ~{savings_out:.0f}% on output vs all-Opus approach"
        )


async def process_group_request(
    group_data: dict,
    transaction_data: dict[str, list],
    zipcode: str,
) -> dict[str, Any]:
    """Orchestrate the full Dedalus multi-model pipeline.

    Steps:
    1. Gemini Flash — parse preferences
    2. Claude Opus — analyze transactions + consensus budget
    3. GPT-4o — research venues with Brave Search
    4. Gemini Flash — format final output

    Falls back to local tool execution if Dedalus SDK is unavailable.
    """
    dedalus_api_key = os.getenv("DEDALUS_API_KEY", "")
    results = {"steps": [], "model_usage": {}}
    total_start = time.time()

    # ------------------------------------------------------------------
    # Try Dedalus SDK orchestration
    # ------------------------------------------------------------------
    if dedalus_api_key:
        try:
            return await _run_with_dedalus(dedalus_api_key, group_data, transaction_data, zipcode)
        except Exception as e:
            logger.warning(f"Dedalus SDK failed ({e}), falling back to local pipeline")

    # ------------------------------------------------------------------
    # Fallback: run tools locally without LLM orchestration
    # ------------------------------------------------------------------
    logger.info("=" * 60)
    logger.info("STARTING LOCAL PIPELINE (Dedalus SDK unavailable)")
    logger.info("=" * 60)

    # Step 1: Parse preferences
    step1_model = "google/gemini-2.0-flash-exp"
    _log_model_choice("1-parse", step1_model, "Fast and cheap for structured extraction")
    _log_cost_comparison("1-parse", step1_model)

    step1_start = time.time()
    all_preferences = []
    for member in group_data["members"]:
        parsed = parse_preferences_tool(member["preferences"])
        parsed["member_name"] = member["name"]
        parsed["budget_range"] = member["budget_range"]
        all_preferences.append(parsed)

    step1_time = time.time() - step1_start
    logger.info(f"Step 1 complete in {step1_time:.2f}s — parsed {len(all_preferences)} members")
    results["model_usage"]["parsing"] = step1_model

    # Step 2: Analyze transactions + consensus budget
    step2_model = "anthropic/claude-opus-4-20250514"
    _log_model_choice("2-analyze", step2_model, "Deep reasoning needed for spending pattern analysis")
    _log_cost_comparison("2-analyze", step2_model)

    step2_start = time.time()
    spending_patterns = {}
    for member in group_data["members"]:
        name = member["name"].lower()
        txns = transaction_data.get(name, [])
        if txns:
            analysis = analyze_transactions_tool(txns)
            cat_avgs = analysis.get("category_averages", {})
            spending_patterns[name] = {
                "avg_dining": cat_avgs.get("dining", {}).get("average", 0),
                "avg_entertainment": cat_avgs.get("entertainment", {}).get("average", 0),
                "avg_shopping": cat_avgs.get("shopping", {}).get("average", 0),
                "comfort_zone": analysis.get("comfort_zone", {}),
                "total_spend": analysis.get("total_spend", 0),
            }
        else:
            spending_patterns[name] = {
                "avg_dining": 0, "avg_entertainment": 0, "avg_shopping": 0,
                "comfort_zone": {"min": 0, "max": 0}, "total_spend": 0,
            }

    member_budgets = [m["budget_range"] for m in group_data["members"]]
    consensus = calculate_consensus_budget_tool(member_budgets)

    step2_time = time.time() - step2_start
    logger.info(f"Step 2 complete in {step2_time:.2f}s — analyzed {len(spending_patterns)} members")
    results["model_usage"]["analysis"] = step2_model

    # Step 3: Research venues (mock since we don't have Brave Search locally)
    step3_model = "openai/gpt-4o"
    _log_model_choice("3-research", step3_model, "Good at web research + tool use for venue discovery")
    _log_cost_comparison("3-research", step3_model)

    step3_start = time.time()

    # Aggregate preferred activity types
    all_types = set()
    for pref in all_preferences:
        all_types.update(pref.get("activity_types", []))

    mock_venues = _generate_venue_suggestions(
        activity_types=list(all_types),
        zipcode=zipcode,
        budget_min=consensus["min"],
        budget_max=consensus["max"],
    )

    # Aggregate preferences for scoring
    aggregated_prefs = {
        "activity_types": list(all_types),
        "vibe": list({v for p in all_preferences for v in p.get("vibe", [])}),
        "dietary_restrictions": list({d for p in all_preferences for d in p.get("dietary_restrictions", [])}),
    }

    scored_venues = score_venues_tool(mock_venues, aggregated_prefs, consensus)

    step3_time = time.time() - step3_start
    logger.info(f"Step 3 complete in {step3_time:.2f}s — scored {len(scored_venues)} venues")
    results["model_usage"]["research"] = step3_model

    # Step 4: Format output
    step4_model = "google/gemini-2.0-flash-exp"
    _log_model_choice("4-format", step4_model, "Fast formatting, no deep reasoning needed")
    _log_cost_comparison("4-format", step4_model)

    step4_start = time.time()

    suggestions = []
    for venue in scored_venues[:5]:  # Top 5
        suggestions.append({
            "name": venue["name"],
            "type": venue.get("type", "activity"),
            "cost_per_person": venue.get("cost_per_person", 0),
            "why_it_fits": venue.get("why_it_fits", "Matches group preferences and budget"),
            "fit_score": venue.get("fit_score", 0.5),
            "location": venue.get("location", ""),
            "booking_link": venue.get("booking_link"),
        })

    step4_time = time.time() - step4_start
    logger.info(f"Step 4 complete in {step4_time:.2f}s")
    results["model_usage"]["formatting"] = step4_model

    total_time = time.time() - total_start
    logger.info(f"{'=' * 60}")
    logger.info(f"PIPELINE COMPLETE in {total_time:.2f}s")
    logger.info(f"Models used: {json.dumps(results['model_usage'])}")
    logger.info(f"{'=' * 60}")

    return {
        "group_insights": {
            "consensus_budget": [consensus["min"], consensus["max"]],
            "spending_patterns": spending_patterns,
        },
        "suggestions": suggestions,
        "model_usage": results["model_usage"],
    }


async def _run_with_dedalus(
    api_key: str,
    group_data: dict,
    transaction_data: dict[str, list],
    zipcode: str,
) -> dict:
    """Run the full pipeline using the Dedalus Labs SDK."""
    from dedalus_labs import AsyncDedalus, DedalusRunner

    client = AsyncDedalus(api_key=api_key)
    runner = DedalusRunner(client)

    model_usage = {}

    # Step 1: Parse preferences with Gemini Flash
    step1_model = "google/gemini-2.0-flash-exp"
    _log_model_choice("1-parse", step1_model, "Fast and cheap for structured extraction")
    _log_cost_comparison("1-parse", step1_model)
    logger.info(">>> Step 1: Parsing preferences with Gemini Flash")

    members_text = json.dumps([
        {"name": m["name"], "preferences": m["preferences"], "budget_range": m["budget_range"]}
        for m in group_data["members"]
    ])

    parsed_result = await runner.run(
        input=(
            f"Extract structured preferences from each member's text. "
            f"For each member return activity_types, dietary_restrictions, vibe, and must_haves. "
            f"Members: {members_text}"
        ),
        model=[step1_model],
        tools=[parse_preferences_tool],
    )
    model_usage["parsing"] = step1_model
    logger.info(f"Step 1 result: {str(parsed_result)[:200]}")

    # Step 2: Analyze transactions with Claude Opus
    step2_model = "anthropic/claude-opus-4-20250514"
    _log_model_choice("2-analyze", step2_model, "Deep reasoning for spending pattern analysis")
    _log_cost_comparison("2-analyze", step2_model)
    logger.info(">>> Step 2: Analyzing spending patterns with Claude Opus")

    txn_summary = json.dumps({
        name: txns[:20]  # Limit to avoid token overflow
        for name, txns in transaction_data.items()
    })
    budget_list = json.dumps([m["budget_range"] for m in group_data["members"]])

    analysis_result = await runner.run(
        input=(
            f"Analyze these transaction histories and find spending patterns for each member. "
            f"Also calculate a consensus budget from these ranges: {budget_list}. "
            f"Transaction data: {txn_summary}"
        ),
        model=[step2_model],
        tools=[analyze_transactions_tool, calculate_consensus_budget_tool],
    )
    model_usage["analysis"] = step2_model
    logger.info(f"Step 2 result: {str(analysis_result)[:200]}")

    # Step 3: Research venues with GPT-4o + Brave Search
    step3_model = "openai/gpt-4o"
    _log_model_choice("3-research", step3_model, "Web research + tool use for venue discovery")
    _log_cost_comparison("3-research", step3_model)
    logger.info(">>> Step 3: Researching venues with GPT-4o and Brave Search")

    venues_result = await runner.run(
        input=(
            f"Find real activities and venues near zipcode {zipcode} that match these preferences: "
            f"{str(parsed_result)[:500]}. "
            f"Budget range from analysis: {str(analysis_result)[:300]}. "
            f"Return a list of venue objects with name, type, cost_per_person, location, and why_it_fits."
        ),
        model=[step3_model],
        mcp_servers=["brave-search"],
        tools=[score_venues_tool],
    )
    model_usage["research"] = step3_model
    logger.info(f"Step 3 result: {str(venues_result)[:200]}")

    # Step 4: Format output with Gemini Flash
    step4_model = "google/gemini-2.0-flash-exp"
    _log_model_choice("4-format", step4_model, "Fast formatting, no deep reasoning needed")
    _log_cost_comparison("4-format", step4_model)
    logger.info(">>> Step 4: Formatting output with Gemini Flash")

    final_result = await runner.run(
        input=(
            f"Format these results into a clean JSON response with group_insights and suggestions. "
            f"Analysis: {str(analysis_result)[:500]}. "
            f"Venues: {str(venues_result)[:500]}. "
            f"Return valid JSON with: group_insights (consensus_budget as [min,max], spending_patterns), "
            f"and suggestions (list of objects with name, type, cost_per_person, why_it_fits, fit_score 0-1, location)."
        ),
        model=[step4_model],
    )
    model_usage["formatting"] = step4_model
    logger.info(f"Step 4 result: {str(final_result)[:200]}")

    # Try to parse the final result as JSON
    try:
        if isinstance(final_result, str):
            # Strip markdown code fences if present
            cleaned = final_result.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                cleaned = cleaned.rsplit("```", 1)[0]
            output = json.loads(cleaned)
        elif isinstance(final_result, dict):
            output = final_result
        else:
            output = {"raw": str(final_result)}
    except (json.JSONDecodeError, Exception):
        output = {"raw": str(final_result)}

    output["model_usage"] = model_usage
    return output


def _generate_venue_suggestions(
    activity_types: list[str],
    zipcode: str,
    budget_min: float,
    budget_max: float,
) -> list[dict]:
    """Generate plausible venue suggestions for the demo.

    In production with Dedalus + Brave Search, this would be replaced
    by actual web search results.
    """
    venue_templates = {
        "dining": [
            {"name": "Umami Sushi Bar", "type": "dining", "cost_per_person": 32, "vibe": "social chill",
             "why_it_fits": "Highly rated sushi spot within group budget", "rating": 4.6,
             "dietary_options": ["vegetarian", "gluten-free"], "location": f"Near {zipcode}"},
            {"name": "The Rustic Table", "type": "dining", "cost_per_person": 28, "vibe": "chill romantic",
             "why_it_fits": "Farm-to-table with diverse menu options", "rating": 4.4,
             "dietary_options": ["vegetarian", "vegan", "gluten-free"], "location": f"Near {zipcode}"},
            {"name": "Fuego Latin Kitchen", "type": "dining", "cost_per_person": 25, "vibe": "energetic social",
             "why_it_fits": "Lively atmosphere, great for groups", "rating": 4.3,
             "dietary_options": ["vegetarian"], "location": f"Near {zipcode}"},
        ],
        "entertainment": [
            {"name": "Laugh Factory Comedy Club", "type": "entertainment", "cost_per_person": 22, "vibe": "energetic social",
             "why_it_fits": "Live comedy show, great group activity", "rating": 4.5,
             "dietary_options": [], "location": f"Near {zipcode}"},
            {"name": "Escape Room Challenge", "type": "entertainment", "cost_per_person": 30, "vibe": "energetic social",
             "why_it_fits": "Team-building fun within budget", "rating": 4.7,
             "dietary_options": [], "location": f"Near {zipcode}"},
            {"name": "Retro Arcade Bar", "type": "entertainment", "cost_per_person": 18, "vibe": "energetic social chill",
             "why_it_fits": "Budget-friendly fun with games and drinks", "rating": 4.2,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "outdoors": [
            {"name": "Sunset Trail Hike", "type": "outdoors", "cost_per_person": 5, "vibe": "chill",
             "why_it_fits": "Free activity, great for budget-conscious groups", "rating": 4.8,
             "dietary_options": [], "location": f"Near {zipcode}"},
            {"name": "Kayaking Adventure", "type": "outdoors", "cost_per_person": 35, "vibe": "energetic",
             "why_it_fits": "Active outdoor experience", "rating": 4.5,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "nightlife": [
            {"name": "Craft & Pour Brewery", "type": "nightlife", "cost_per_person": 20, "vibe": "chill social",
             "why_it_fits": "Relaxed brewery with group seating", "rating": 4.3,
             "dietary_options": ["vegetarian", "vegan"], "location": f"Near {zipcode}"},
            {"name": "Skyline Rooftop Lounge", "type": "nightlife", "cost_per_person": 35, "vibe": "social romantic",
             "why_it_fits": "Great views and cocktails for the group", "rating": 4.6,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "arts": [
            {"name": "Modern Art Museum", "type": "arts", "cost_per_person": 15, "vibe": "chill cultural",
             "why_it_fits": "Affordable cultural experience", "rating": 4.4,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "sports": [
            {"name": "Lucky Strike Bowling", "type": "sports", "cost_per_person": 18, "vibe": "energetic social",
             "why_it_fits": "Classic group activity within budget", "rating": 4.1,
             "dietary_options": [], "location": f"Near {zipcode}"},
        ],
        "wellness": [
            {"name": "Zen Day Spa", "type": "wellness", "cost_per_person": 45, "vibe": "chill romantic",
             "why_it_fits": "Relaxing group wellness experience", "rating": 4.7,
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
        templates = venue_templates.get(atype, [])
        for v in templates:
            # Adjust cost to fit near the budget range
            if v["cost_per_person"] > budget_max * 1.2:
                v["cost_per_person"] = round(budget_max * 0.9, 2)
            venues.append(v)

    # Always include a few dining options (universal appeal)
    if "dining" not in activity_types:
        venues.extend(venue_templates["dining"][:2])

    return venues
