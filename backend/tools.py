"""Custom tool implementations for the Dedalus agent pipeline."""

import logging
import re

logger = logging.getLogger("what-dough.tools")


def parse_preferences_tool(raw_text: str) -> dict:
    """Extract structured preference data from free-form text."""
    logger.info(f"parse_preferences_tool: {raw_text[:80]}...")

    text_lower = raw_text.lower()

    activity_keywords = {
        "dining": ["restaurant", "food", "eat", "dinner", "lunch", "brunch", "sushi", "pizza", "bbq", "cuisine", "dining"],
        "entertainment": ["movie", "concert", "show", "theater", "theatre", "music", "live", "comedy", "karaoke"],
        "outdoors": ["hike", "hiking", "park", "outdoor", "nature", "beach", "trail", "camping", "bike", "biking"],
        "sports": ["bowling", "golf", "tennis", "basketball", "gym", "climbing", "skating", "swimming"],
        "nightlife": ["bar", "club", "drinks", "cocktail", "pub", "brewery", "wine", "nightlife"],
        "arts": ["museum", "gallery", "art", "exhibit", "craft", "pottery", "painting"],
        "shopping": ["shopping", "mall", "market", "thrift", "vintage", "boutique"],
        "wellness": ["spa", "yoga", "meditation", "massage", "sauna"],
    }

    activity_types = []
    for category, keywords in activity_keywords.items():
        if any(kw in text_lower for kw in keywords):
            activity_types.append(category)

    if not activity_types:
        activity_types = ["dining", "entertainment"]

    diet_keywords = {
        "vegetarian": ["vegetarian", "veggie"],
        "vegan": ["vegan", "plant-based", "plant based"],
        "gluten-free": ["gluten-free", "gluten free", "celiac"],
        "halal": ["halal"],
        "kosher": ["kosher"],
    }

    dietary_restrictions = []
    for restriction, keywords in diet_keywords.items():
        if any(kw in text_lower for kw in keywords):
            dietary_restrictions.append(restriction)

    vibe_keywords = {
        "chill": ["chill", "relax", "casual", "laid-back", "low-key", "quiet"],
        "energetic": ["exciting", "energetic", "active", "adventure", "wild", "fun", "party"],
        "romantic": ["romantic", "date", "intimate", "cozy"],
        "social": ["group", "social", "friends", "team", "everyone"],
    }

    vibes = []
    for vibe, keywords in vibe_keywords.items():
        if any(kw in text_lower for kw in keywords):
            vibes.append(vibe)
    if not vibes:
        vibes = ["social"]

    return {
        "activity_types": activity_types,
        "dietary_restrictions": dietary_restrictions,
        "vibe": vibes,
        "raw_text": raw_text,
    }


def calculate_consensus_budget_tool(member_budgets: list[list[float]]) -> dict:
    """Find the overlapping budget range that works for all group members.

    member_budgets: list of [min, max] pairs.
    """
    logger.info(f"calculate_consensus_budget: {len(member_budgets)} members")

    if not member_budgets:
        return {"min": 0, "max": 0, "has_overlap": False}

    consensus_min = max(b[0] for b in member_budgets)
    consensus_max = min(b[1] for b in member_budgets)

    if consensus_min <= consensus_max:
        return {
            "min": round(consensus_min, 2),
            "max": round(consensus_max, 2),
            "has_overlap": True,
        }
    else:
        avg_min = sum(b[0] for b in member_budgets) / len(member_budgets)
        avg_max = sum(b[1] for b in member_budgets) / len(member_budgets)
        return {
            "min": round(avg_min, 2),
            "max": round(avg_max, 2),
            "has_overlap": False,
        }


def score_venues_tool(venues: list[dict], preferences: dict, budgets: dict) -> list[dict]:
    """Score and rank venues against group preferences and budget."""
    logger.info(f"score_venues_tool: {len(venues)} venues")

    preferred_types = preferences.get("activity_types", [])
    dietary = preferences.get("dietary_restrictions", [])
    budget_min = budgets.get("min", 0)
    budget_max = budgets.get("max", 100)

    scored = []
    for venue in venues:
        score = 0.5

        venue_type = venue.get("type", "").lower()
        if any(t in venue_type for t in preferred_types):
            score += 0.25

        cost = venue.get("cost_per_person", 0)
        if budget_min <= cost <= budget_max:
            score += 0.25
        elif cost < budget_min:
            # Free/cheap activities ($0-5) that match preferences shouldn't be penalized much
            score += 0.20 if cost <= 5 else 0.15
        else:
            overage_pct = (cost - budget_max) / budget_max if budget_max > 0 else 1
            score -= min(0.3, overage_pct * 0.5)

        venue_dietary = venue.get("dietary_options", [])
        if not dietary or any(d in venue_dietary for d in dietary):
            score += 0.1

        rating = venue.get("rating", 0)
        if rating >= 4.5:
            score += 0.05
        elif rating >= 4.0:
            score += 0.03

        venue["fit_score"] = round(max(0, min(1, score)), 2)
        scored.append(venue)

    scored.sort(key=lambda v: v["fit_score"], reverse=True)
    return scored


# ----- Nessie / transaction tools (commented out for now, will add later) -----
#
# def analyze_transactions_tool(transactions: list) -> dict:
#     """Categorize transactions and calculate spending averages/patterns."""
#     ...
