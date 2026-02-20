"""Schemas Pydantic pour les suggestions de creneaux."""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class SlotSuggestRequest(BaseModel):
    patient_id: UUID
    date: datetime.date
    duration_minutes: int = Field(ge=5, le=240)
    idel_id: UUID | None = None


class SlotSuggestionItem(BaseModel):
    rank: int
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    previous_appointment_id: str | None = None
    next_appointment_id: str | None = None
    detour_km: float
    detour_minutes: float
    same_sector: bool
    sector_name: str
    score: float
    explanation: str


class DaySummary(BaseModel):
    date: str
    num_appointments: int
    first_appointment: str | None = None  # HH:MM
    last_appointment: str | None = None  # HH:MM


class SlotSuggestResponse(BaseModel):
    suggestions: list[SlotSuggestionItem]
    day_summary: DaySummary


class SlotBookRequest(BaseModel):
    care_type: str = Field(min_length=1, max_length=50)
    care_protocol_id: UUID | None = None
