"""Capital One Nessie API client with mock data fallback."""

import logging
import os
import random
from datetime import datetime, timedelta

import httpx

logger = logging.getLogger("what-dough.nessie")

NESSIE_BASE_URL = "http://api.nessieisreal.com"

# Realistic merchant names for mock data
MOCK_MERCHANTS = {
    "dining": [
        "Chipotle Mexican Grill", "Olive Garden", "Starbucks Coffee", "Panera Bread",
        "Sushi Palace", "Thai Orchid", "Pizza Hut", "Burger King", "Local Bistro Cafe",
        "Panda Express", "Five Guys Burgers", "Taco Bell", "Chick-fil-A",
    ],
    "entertainment": [
        "AMC Theaters", "Regal Cinemas", "TopGolf", "Escape Room Adventures",
        "Bowling Alley", "Dave & Busters", "Comedy Club", "Concert Tickets Live",
        "Museum of Art", "Laser Tag Arena",
    ],
    "shopping": [
        "Target", "Amazon", "Walmart", "Best Buy", "TJ Maxx", "Nordstrom Rack",
        "Home Depot", "Barnes & Noble", "Nike Store", "Trader Joe's",
    ],
    "nightlife": [
        "The Tipsy Crow Bar", "Craft Brewery Taproom", "Wine & Cocktail Lounge",
        "Pub on Main Street", "Rooftop Bar Downtown",
    ],
}


def _generate_mock_transactions(num_transactions: int = 30) -> list[dict]:
    """Generate realistic mock transaction data for demo purposes."""
    logger.info(f"Generating {num_transactions} mock transactions (Nessie fallback)")

    transactions = []
    now = datetime.now()

    for i in range(num_transactions):
        # Random date within last 30 days
        days_ago = random.randint(0, 30)
        txn_date = now - timedelta(days=days_ago)

        # Pick a category weighted toward dining/entertainment
        category = random.choices(
            list(MOCK_MERCHANTS.keys()),
            weights=[0.4, 0.25, 0.25, 0.1],
            k=1,
        )[0]

        merchant = random.choice(MOCK_MERCHANTS[category])

        # Amount ranges by category
        amount_ranges = {
            "dining": (8, 65),
            "entertainment": (12, 80),
            "shopping": (5, 120),
            "nightlife": (10, 55),
        }
        low, high = amount_ranges[category]
        amount = round(random.uniform(low, high), 2)

        transactions.append({
            "id": f"mock_{i:04d}",
            "merchant_name": merchant,
            "description": merchant,
            "amount": amount,
            "purchase_date": txn_date.strftime("%Y-%m-%d"),
            "category": category,
            "type": "purchase",
        })

    transactions.sort(key=lambda t: t["purchase_date"], reverse=True)
    return transactions


async def fetch_transactions(account_id: str) -> list[dict]:
    """Fetch transaction history from the Nessie API.

    Falls back to mock data if the API is unavailable or returns empty results.
    """
    api_key = os.getenv("CAPITAL_ONE_API_KEY", "")

    if not api_key:
        logger.warning("No CAPITAL_ONE_API_KEY set — using mock transaction data")
        return _generate_mock_transactions()

    url = f"{NESSIE_BASE_URL}/accounts/{account_id}/purchases"
    params = {"key": api_key}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            logger.info(f"Fetching transactions from Nessie API for account {account_id}")
            response = await client.get(url, params=params)

            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    logger.info(f"Got {len(data)} transactions from Nessie API")
                    # Normalize field names
                    normalized = []
                    for txn in data:
                        normalized.append({
                            "id": txn.get("_id", ""),
                            "merchant_name": txn.get("merchant_id", "Unknown"),
                            "description": txn.get("description", txn.get("merchant_id", "")),
                            "amount": txn.get("amount", 0),
                            "purchase_date": txn.get("purchase_date", ""),
                            "category": txn.get("medium", "other"),
                            "type": "purchase",
                        })
                    return normalized
                else:
                    logger.warning("Nessie API returned empty data — using mock transactions")
                    return _generate_mock_transactions()
            else:
                logger.warning(f"Nessie API returned status {response.status_code} — using mock transactions")
                return _generate_mock_transactions()

    except httpx.HTTPError as e:
        logger.warning(f"Nessie API request failed: {e} — using mock transactions")
        return _generate_mock_transactions()
    except Exception as e:
        logger.error(f"Unexpected error fetching transactions: {e} — using mock transactions")
        return _generate_mock_transactions()
