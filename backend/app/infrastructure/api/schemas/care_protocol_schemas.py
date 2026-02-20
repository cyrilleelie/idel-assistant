"""Schemas Pydantic pour les protocoles de soins."""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CareProtocolCreate(BaseModel):
    patient_id: UUID
    care_type: str = Field(min_length=1, max_length=50)
    duration_minutes: int = Field(ge=5, le=240)
    recurrence_rule: str = Field(min_length=1, max_length=255)
    start_date: datetime.date
    end_date: datetime.date | None = None
    preferred_time: datetime.time | None = None
    preferred_slot: str = Field(default="", pattern=r"^(morning|afternoon|evening|)$")
    notes: str = Field(default="", max_length=5000)
    idel_id: UUID | None = None


class CareProtocolResponse(BaseModel):
    id: str
    patient_id: str
    cabinet_id: str
    care_type: str
    duration_minutes: int
    recurrence_rule: str
    start_date: datetime.date
    end_date: datetime.date | None = None
    preferred_time: datetime.time | None = None
    preferred_slot: str = ""
    status: str
    notes: str = ""
    created_at: datetime.datetime
    updated_at: datetime.datetime


class CareProtocolListResponse(BaseModel):
    items: list[CareProtocolResponse]
    total: int
