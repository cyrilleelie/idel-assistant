"""Schemas Pydantic pour les rendez-vous."""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AppointmentCreate(BaseModel):
    patient_id: UUID
    scheduled_at: datetime.datetime
    duration_minutes: int = Field(ge=5, le=240)
    care_type: str = Field(min_length=1, max_length=50)
    location_type: str = Field(default="home", pattern=r"^(home|office|hospital)$")
    time_window_start: datetime.time | None = None
    time_window_end: datetime.time | None = None
    care_protocol_id: UUID | None = None
    idel_id: UUID | None = None


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime.datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=240)
    care_type: str | None = Field(default=None, min_length=1, max_length=50)


class CancelRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class AppointmentResponse(BaseModel):
    id: str
    cabinet_id: str
    idel_id: str
    patient_id: str
    scheduled_at: datetime.datetime
    duration_minutes: int
    care_type: str
    location_type: str = "home"
    time_window_start: datetime.time | None = None
    time_window_end: datetime.time | None = None
    care_protocol_id: str | None = None
    status: str
    cancellation_reason: str = ""
    canceled_at: datetime.datetime | None = None
    created_by: str = "manual"
    created_at: datetime.datetime
    updated_at: datetime.datetime


class AppointmentListResponse(BaseModel):
    items: list[AppointmentResponse]
    total: int
