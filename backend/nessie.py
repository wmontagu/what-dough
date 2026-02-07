"""Capital One Nessie API client — commented out for now, will integrate later.

This module will fetch real transaction history from the Nessie API
to enrich budget suggestions with actual spending patterns.

Endpoint: GET http://api.nessieisreal.com/accounts/{accountId}/purchases?key={API_KEY}
"""

# import logging
# import os
# import random
# from datetime import datetime, timedelta
#
# import httpx
#
# logger = logging.getLogger("what-dough.nessie")
#
# NESSIE_BASE_URL = "http://api.nessieisreal.com"
#
#
# async def fetch_transactions(account_id: str) -> list[dict]:
#     """Fetch transaction history from the Nessie API."""
#     api_key = os.getenv("CAPITAL_ONE_API_KEY", "")
#     if not api_key:
#         logger.warning("No CAPITAL_ONE_API_KEY — using mock data")
#         return _generate_mock_transactions()
#
#     url = f"{NESSIE_BASE_URL}/accounts/{account_id}/purchases"
#     async with httpx.AsyncClient(timeout=10.0) as client:
#         response = await client.get(url, params={"key": api_key})
#         if response.status_code == 200:
#             data = response.json()
#             if isinstance(data, list) and data:
#                 return data
#     return _generate_mock_transactions()
#
#
# def _generate_mock_transactions(num: int = 30) -> list[dict]:
#     """Generate realistic mock transaction data for demo."""
#     merchants = {
#         "dining": ["Chipotle", "Starbucks", "Olive Garden", "Sushi Palace", "Panera"],
#         "entertainment": ["AMC Theaters", "TopGolf", "Escape Room", "Comedy Club"],
#         "shopping": ["Target", "Amazon", "Best Buy", "TJ Maxx"],
#     }
#     transactions = []
#     now = datetime.now()
#     for i in range(num):
#         cat = random.choice(list(merchants.keys()))
#         merchant = random.choice(merchants[cat])
#         amount_ranges = {"dining": (8, 65), "entertainment": (12, 80), "shopping": (5, 120)}
#         lo, hi = amount_ranges[cat]
#         transactions.append({
#             "id": f"mock_{i:04d}",
#             "merchant_name": merchant,
#             "amount": round(random.uniform(lo, hi), 2),
#             "purchase_date": (now - timedelta(days=random.randint(0, 30))).strftime("%Y-%m-%d"),
#             "category": cat,
#         })
#     return transactions
