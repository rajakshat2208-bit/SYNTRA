"""Structured output contracts for each Strands agent."""
from pydantic import BaseModel, Field
from typing import List, Optional


class IntakeResult(BaseModel):
    normalized_type: str = Field(description="e.g. resident_report, sensor_reading, system_alert")
    normalized_location: str
    urgency: str = Field(description="low, medium, high")
    entities: List[str] = Field(default_factory=list, description="short extracted facts/entities")
    confidence: float = Field(description="0.0 to 1.0")
    summary: str = Field(description="one short plain-language summary")


class CorrelationResult(BaseModel):
    related_signal_ids: List[str] = Field(default_factory=list)
    related_incident_id: Optional[str] = None
    correlation_confidence: float = Field(description="0.0 to 1.0")
    rationale: str = Field(description="one short sentence, no chain-of-thought")
    should_create_incident: bool


class RiskResult(BaseModel):
    severity: str = Field(description="low, medium, high, or critical")
    risk_score: float = Field(description="0.0 to 1.0")
    affected_area: str
    affected_population_estimate: str = Field(
        description="a number as string, or 'unknown' if not determinable"
    )
    confidence: float = Field(description="0.0 to 1.0")
    risk_factors: List[str] = Field(default_factory=list)
    recommended_escalation_level: str = Field(description="none, local, facilities, emergency")
    approval_required: bool


class RecommendedAction(BaseModel):
    action: str
    priority: str = Field(description="low, medium, high")
    responsible_role: str
    requires_approval: bool


class ResponseResult(BaseModel):
    recommended_actions: List[RecommendedAction]
    communication_recommendation: str
    reason: str
    requires_human_approval: bool
