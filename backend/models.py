from pydantic import BaseModel, Field
from typing import Optional


class ParticipantInput(BaseModel):
    name: str
    min_budget: int
    max_budget: int
    preferences: Optional[str] = None


class AnalyzeEventRequest(BaseModel):
    event_name: str
    description: Optional[str] = None
    zipcode: str
    activity_type: Optional[str] = None
    participants: list[ParticipantInput] = Field(..., min_length=1)


class Suggestion(BaseModel):
    name: str
    type: str
    cost_per_person: float
    why_it_fits: str
    fit_score: float = Field(..., ge=0, le=1)
    location: Optional[str] = None
    booking_link: Optional[str] = None


class ConsensusBudget(BaseModel):
    min: float
    max: float
    has_overlap: bool


class AnalyzeEventResponse(BaseModel):
    consensus_budget: ConsensusBudget
    suggestions: list[Suggestion]
    model_usage: dict[str, str]


class HealthResponse(BaseModel):
    status: str = "healthy"
