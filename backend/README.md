# What-Dough Backend

Social budgeting API that uses multi-model AI orchestration (via Dedalus Labs) to suggest group activities based on preferences, spending history, and budget constraints.

## Architecture: Multi-Model Handoff Pipeline

Each API request flows through 4 specialized AI models, chosen for cost and capability:

| Step | Model | Why This Model |
|------|-------|----------------|
| 1. Parse preferences | Gemini 2.0 Flash | Fast, cheap — structured extraction doesn't need deep reasoning |
| 2. Analyze spending | Claude Opus | Best reasoning for pattern detection across transaction histories |
| 3. Research venues | GPT-4o + Brave Search | Strong tool-use for web research via Dedalus MCP |
| 4. Format output | Gemini 2.0 Flash | Fast formatting into clean JSON, no reasoning needed |

This approach saves ~90% on input costs and ~95% on output costs compared to using Claude Opus for every step.

## Setup

### 1. Install dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure environment variables

Copy the example and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```
DEDALUS_API_KEY=your_dedalus_key_here
CAPITAL_ONE_API_KEY=your_nessie_key_here
OPENROUTER_API_KEY=your_openrouter_key_here
```

### 3. Run the server

```bash
uvicorn main:app --reload
```

Or use the script:

```bash
chmod +x run.sh
./run.sh
```

The server starts at `http://localhost:8000`.

## API Endpoints

### GET /health

Health check.

```bash
curl http://localhost:8000/health
```

Response:

```json
{"status": "healthy"}
```

### POST /api/analyze-group

Analyze a group and get ranked activity suggestions.

```bash
curl -X POST http://localhost:8000/api/analyze-group \
  -H "Content-Type: application/json" \
  -d '{
    "members": [
      {
        "name": "Alice",
        "preferences": "loves sushi and live music",
        "budget_range": [20, 50],
        "nessie_account_id": "123abc"
      },
      {
        "name": "Bob",
        "preferences": "into craft beer and bowling, vegetarian",
        "budget_range": [15, 40]
      }
    ],
    "zipcode": "15213",
    "date": "2026-02-15"
  }'
```

Response:

```json
{
  "group_insights": {
    "consensus_budget": [20, 40],
    "spending_patterns": {
      "alice": {"avg_dining": 35, "avg_entertainment": 28, "avg_shopping": 0},
      "bob": {"avg_dining": 22, "avg_entertainment": 15, "avg_shopping": 0}
    }
  },
  "suggestions": [
    {
      "name": "Umami Sushi Bar",
      "type": "dining",
      "cost_per_person": 32,
      "why_it_fits": "Highly rated sushi spot within group budget",
      "fit_score": 0.92,
      "location": "Near 15213",
      "booking_link": null
    }
  ],
  "model_usage": {
    "parsing": "google/gemini-2.0-flash-exp",
    "analysis": "anthropic/claude-opus-4-20250514",
    "research": "openai/gpt-4o",
    "formatting": "google/gemini-2.0-flash-exp"
  }
}
```

## Fallback Behavior

- **No Dedalus API key**: The pipeline runs tools locally without LLM orchestration. All 4 tools execute directly with mock venue data.
- **No Capital One API key / Nessie fails**: Realistic mock transaction data is generated automatically so the demo always works.
- **No Nessie account ID for a member**: Mock transactions are generated for that member.

## Project Structure

```
backend/
├── main.py           # FastAPI app, CORS, endpoints
├── models.py         # Pydantic request/response models
├── dedalus_agent.py  # Dedalus SDK multi-model orchestration
├── tools.py          # Custom tool implementations (parse, analyze, score)
├── nessie.py         # Capital One Nessie API client + mock fallback
├── .env              # Your API keys (git-ignored)
├── .env.example      # Template for .env
├── requirements.txt  # Python dependencies
├── run.sh            # Server start script
└── README.md         # This file
```
