from pydantic import BaseModel, Field
from typing import Optional


class MemberInput(BaseModel):
    name: str
    preferences: str = Field(..., description="Free-form text describing activity preferences")
    budget_range: list[float] = Field(..., min_length=2, max_length=2, description="[min, max] budget per person")
    nessie_account_id: Optional[str] = Field(None, description="Capital One Nessie account ID for transaction history")
    dietary_restrictions: Optional[str] = None


class GroupAnalyzeRequest(BaseModel):
    members: list[MemberInput] = Field(..., min_length=1)
    zipcode: str
    date: Optional[str] = None


class Suggestion(BaseModel):
    name: str
    type: str
    cost_per_person: float
    why_it_fits: str
    fit_score: float = Field(..., ge=0, le=1)
    location: Optional[str] = None
    booking_link: Optional[str] = None


class SpendingPattern(BaseModel):
    avg_dining: float = 0
    avg_entertainment: float = 0
    avg_shopping: float = 0


class GroupInsights(BaseModel):
    consensus_budget: list[float]
    spending_patterns: dict[str, SpendingPattern]


class ModelUsage(BaseModel):
    parsing: str = "google/gemini-2.0-flash-exp"
    analysis: str = "anthropic/claude-opus-4-20250514"
    research: str = "openai/gpt-4o"
    formatting: str = "google/gemini-2.0-flash-exp"


class GroupAnalyzeResponse(BaseModel):
    group_insights: GroupInsights
    suggestions: list[Suggestion]
    model_usage: ModelUsage


class HealthResponse(BaseModel):
    status: str = "healthy"


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
