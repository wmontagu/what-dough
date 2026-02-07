"""Custom tool implementations for the Dedalus agent pipeline."""

import logging
import re
from datetime import datetime

logger = logging.getLogger("what-dough.tools")


def parse_preferences_tool(raw_text: str) -> dict:
    """Extract structured preference data from free-form text.

    Returns activity_types, dietary_restrictions, vibe, and must_haves.
    This provides a baseline extraction; the LLM enriches it further.
    """
    logger.info(f"parse_preferences_tool called with: {raw_text[:100]}...")

    text_lower = raw_text.lower()

    # Activity type keywords
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

    # Dietary restrictions
    diet_keywords = {
        "vegetarian": ["vegetarian", "veggie"],
        "vegan": ["vegan", "plant-based", "plant based"],
        "gluten-free": ["gluten-free", "gluten free", "celiac"],
        "halal": ["halal"],
        "kosher": ["kosher"],
        "dairy-free": ["dairy-free", "dairy free", "lactose"],
        "nut-free": ["nut-free", "nut free", "nut allergy"],
    }

    dietary_restrictions = []
    for restriction, keywords in diet_keywords.items():
        if any(kw in text_lower for kw in keywords):
            dietary_restrictions.append(restriction)

    # Vibe detection
    vibe_keywords = {
        "chill": ["chill", "relax", "casual", "laid-back", "laid back", "low-key", "low key", "quiet"],
        "energetic": ["exciting", "energetic", "active", "adventure", "wild", "fun", "party"],
        "romantic": ["romantic", "date", "intimate", "cozy"],
        "social": ["group", "social", "friends", "team", "everyone"],
        "cultural": ["cultural", "educational", "learn", "history", "authentic"],
    }

    vibes = []
    for vibe, keywords in vibe_keywords.items():
        if any(kw in text_lower for kw in keywords):
            vibes.append(vibe)

    if not vibes:
        vibes = ["social"]

    # Must-haves: look for explicit requirements
    must_haves = []
    must_patterns = [
        r"must (?:have|be|include)\s+(.+?)(?:\.|,|$)",
        r"need[s]?\s+(.+?)(?:\.|,|$)",
        r"require[s]?\s+(.+?)(?:\.|,|$)",
    ]
    for pattern in must_patterns:
        matches = re.findall(pattern, text_lower)
        must_haves.extend([m.strip() for m in matches])

    result = {
        "activity_types": activity_types,
        "dietary_restrictions": dietary_restrictions,
        "vibe": vibes,
        "must_haves": must_haves,
        "raw_text": raw_text,
    }

    logger.info(f"Parsed preferences: types={activity_types}, vibe={vibes}, diet={dietary_restrictions}")
    return result


def analyze_transactions_tool(transactions: list) -> dict:
    """Categorize transactions and calculate spending averages/patterns.

    Takes a list of transaction dicts (from Nessie API or mock data).
    Returns category averages, trends, and overall insights.
    """
    logger.info(f"analyze_transactions_tool called with {len(transactions)} transactions")

    # Category mapping based on merchant descriptions
    category_keywords = {
        "dining": ["restaurant", "cafe", "coffee", "pizza", "sushi", "burger", "food", "eat", "diner", "grill", "bistro", "bakery", "bar & grill"],
        "entertainment": ["movie", "cinema", "theater", "concert", "ticket", "bowling", "arcade", "museum", "amusement", "comedy"],
        "shopping": ["store", "shop", "mart", "amazon", "target", "walmart", "mall", "boutique", "outlet"],
        "groceries": ["grocery", "supermarket", "whole foods", "trader joe", "kroger", "safeway", "aldi"],
        "transport": ["uber", "lyft", "gas", "fuel", "parking", "transit", "bus", "metro"],
        "nightlife": ["bar", "pub", "brewery", "lounge", "club", "wine", "cocktail", "taproom"],
        "wellness": ["gym", "spa", "yoga", "fitness", "salon", "health"],
    }

    categorized: dict[str, list[float]] = {cat: [] for cat in category_keywords}
    categorized["other"] = []

    for txn in transactions:
        amount = abs(float(txn.get("amount", txn.get("purchase_price", 0))))
        description = txn.get("description", txn.get("merchant_name", "")).lower()

        matched = False
        for category, keywords in category_keywords.items():
            if any(kw in description for kw in keywords):
                categorized[category].append(amount)
                matched = True
                break

        if not matched:
            categorized["other"].append(amount)

    # Calculate averages
    averages = {}
    for category, amounts in categorized.items():
        if amounts:
            averages[category] = {
                "average": round(sum(amounts) / len(amounts), 2),
                "total": round(sum(amounts), 2),
                "count": len(amounts),
                "min": round(min(amounts), 2),
                "max": round(max(amounts), 2),
            }

    # Overall stats
    all_amounts = [abs(float(t.get("amount", t.get("purchase_price", 0)))) for t in transactions]
    total_spend = sum(all_amounts) if all_amounts else 0
    avg_transaction = total_spend / len(all_amounts) if all_amounts else 0

    # Spending "comfort zone" — middle 50% of transactions
    if all_amounts:
        sorted_amounts = sorted(all_amounts)
        q1_idx = len(sorted_amounts) // 4
        q3_idx = (3 * len(sorted_amounts)) // 4
        comfort_min = sorted_amounts[q1_idx]
        comfort_max = sorted_amounts[q3_idx]
    else:
        comfort_min = 0
        comfort_max = 0

    result = {
        "category_averages": averages,
        "total_spend": round(total_spend, 2),
        "avg_transaction": round(avg_transaction, 2),
        "transaction_count": len(transactions),
        "comfort_zone": {
            "min": round(comfort_min, 2),
            "max": round(comfort_max, 2),
        },
    }

    logger.info(f"Transaction analysis: {len(averages)} categories, total_spend=${total_spend:.2f}")
    return result


def calculate_consensus_budget_tool(member_budgets: list) -> dict:
    """Find the overlapping budget range that works for all group members.

    member_budgets: list of [min, max] pairs, one per member.
    Returns the intersection range, or a reasonable compromise if no overlap.
    """
    logger.info(f"calculate_consensus_budget called with {len(member_budgets)} members")

    if not member_budgets:
        return {"min": 0, "max": 0, "has_overlap": False}

    # Find intersection
    consensus_min = max(b[0] for b in member_budgets)
    consensus_max = min(b[1] for b in member_budgets)

    if consensus_min <= consensus_max:
        result = {
            "min": round(consensus_min, 2),
            "max": round(consensus_max, 2),
            "has_overlap": True,
            "note": "All members' budgets overlap in this range.",
        }
    else:
        # No perfect overlap — find a compromise (average of all ranges)
        avg_min = sum(b[0] for b in member_budgets) / len(member_budgets)
        avg_max = sum(b[1] for b in member_budgets) / len(member_budgets)
        result = {
            "min": round(avg_min, 2),
            "max": round(avg_max, 2),
            "has_overlap": False,
            "note": "No perfect overlap — this is a compromise average of all members' ranges.",
        }

    logger.info(f"Consensus budget: ${result['min']}-${result['max']} (overlap={result['has_overlap']})")
    return result


def score_venues_tool(venues: list, preferences: dict, budgets: dict) -> list:
    """Score and rank venues against group preferences and budget.

    venues: list of venue dicts with name, type, cost_per_person, etc.
    preferences: parsed group preferences (activity_types, vibe, dietary).
    budgets: consensus budget dict with min/max.

    Returns sorted list with fit_score (0-1) for each venue.
    """
    logger.info(f"score_venues_tool called with {len(venues)} venues")

    preferred_types = preferences.get("activity_types", [])
    vibes = preferences.get("vibe", [])
    dietary = preferences.get("dietary_restrictions", [])
    budget_min = budgets.get("min", 0)
    budget_max = budgets.get("max", 100)

    scored = []
    for venue in venues:
        score = 0.5  # base score

        # Type match (up to +0.25)
        venue_type = venue.get("type", "").lower()
        if any(t in venue_type for t in preferred_types):
            score += 0.25

        # Budget fit (up to +0.25)
        cost = venue.get("cost_per_person", 0)
        if budget_min <= cost <= budget_max:
            score += 0.25
        elif cost < budget_min:
            score += 0.15  # under budget is ok
        else:
            # Over budget — penalize proportionally
            overage_pct = (cost - budget_max) / budget_max if budget_max > 0 else 1
            score -= min(0.3, overage_pct * 0.5)

        # Dietary compatibility (+0.1)
        venue_dietary = venue.get("dietary_options", [])
        if not dietary or any(d in venue_dietary for d in dietary):
            score += 0.1

        # Vibe match (+0.1)
        venue_vibe = venue.get("vibe", "").lower()
        if any(v in venue_vibe for v in vibes):
            score += 0.1

        # Rating bonus (up to +0.05)
        rating = venue.get("rating", 0)
        if rating >= 4.5:
            score += 0.05
        elif rating >= 4.0:
            score += 0.03

        venue["fit_score"] = round(max(0, min(1, score)), 2)
        scored.append(venue)

    scored.sort(key=lambda v: v["fit_score"], reverse=True)
    logger.info(f"Scored {len(scored)} venues. Top score: {scored[0]['fit_score'] if scored else 'N/A'}")
    return scored
