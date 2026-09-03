"""Pydantic request/response models."""
from pydantic import BaseModel, Field
from typing import Optional, List, Any


class SignalCreate(BaseModel):
    source: str
    type: Optional[str] = None
    location: Optional[str] = None
    description: str
    severity: Optional[str] = None
    metadata: Optional[dict] = None


class SignalOut(BaseModel):
    id: str
    timestamp: str
    source: str
    type: Optional[str] = None
    location: Optional[str] = None
    description: str
    severity: Optional[str] = None
    metadata: Optional[dict] = None
    status: str


class IncidentOut(BaseModel):
    id: str
    title: str
    location: Optional[str] = None
    severity: Optional[str] = None
    confidence: Optional[float] = None
    status: str
    signal_ids: List[str] = Field(default_factory=list)
    evidence: List[dict] = Field(default_factory=list)
    assessment: Optional[str] = None
    recommended_actions: List[dict] = Field(default_factory=list)
    approval_required: bool = True
    created_at: str
    updated_at: str


class AgentEventOut(BaseModel):
    id: str
    timestamp: str
    agent: str
    event_type: str
    incident_id: Optional[str] = None
    status: str
    output_summary: Optional[str] = None


class TimelineEventOut(BaseModel):
    id: str
    incident_id: str
    timestamp: str
    event: str
    actor: Optional[str] = None
    details: Optional[str] = None


class ApprovalRequest(BaseModel):
    approved_by: str = "operator"
