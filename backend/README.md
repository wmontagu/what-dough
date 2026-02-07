# What-Dough Backend

Group activity suggestion API. Takes an event's participants (with budget ranges and preferences) and a zipcode, then uses a multi-model AI pipeline to suggest real activities nearby.

## Multi-Model Pipeline (Dedalus Labs)

| Step | Model | Job |
|------|-------|-----|
| 1 | Gemini 2.0 Flash | Parse free-text preferences into structured data |
| 2 | Claude Opus | Compute consensus budget, pick activity direction |
| 3 | GPT-4o + Brave Search | Search for real venues near the zipcode |
| 4 | Gemini Flash | Format final ranked suggestions |

Without a Dedalus API key, steps run locally with mock venue data.

## Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn main:app --reload
```

## Endpoints

### GET /health

```bash
curl http://localhost:8000/health
```

### POST /api/analyze-event

```bash
curl -X POST http://localhost:8000/api/analyze-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "Birthday dinner for Alex",
    "zipcode": "15213",
    "activity_type": "dinner",
    "participants": [
      {"name": "Alice", "min_budget": 20, "max_budget": 50, "preferences": "loves sushi and live music"},
      {"name": "Bob", "min_budget": 15, "max_budget": 40, "preferences": "craft beer, bowling, vegetarian"}
    ]
  }'
```

## Nessie Integration (coming later)

Capital One Nessie API transaction history support is stubbed out in `nessie.py`. Will be wired in to enrich budget suggestions with real spending patterns.
