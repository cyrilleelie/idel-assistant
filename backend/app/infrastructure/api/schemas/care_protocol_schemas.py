"""Schemas Pydantic pour les protocoles de soins."""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CareProtocolCreate(BaseModel):
    patient_id: UUID
    care_type: str = Field(min_length=1, max_length=50)
    label: str = Field(default="", max_length=255)
    frequency_display: str = Field(default="daily", pattern=r"^(daily|2xday|3xday|weekly|2xweek|3xweek|custom)$")
    custom_frequency: str = Field(default="", max_length=255)
    duration_minutes: int = Field(ge=5, le=240)
    recurrence_rule: str = Field(default="", max_length=255)
    start_date: datetime.date
    end_date: datetime.date | None = None
    preferred_time: datetime.time | None = None
    preferred_slot: str = Field(default="", pattern=r"^(morning|afternoon|evening|)$")
    notes: str = Field(default="", max_length=5000)
    idel_id: UUID | None = None


class CareProtocolUpdate(BaseModel):
    care_type: str | None = Field(default=None, min_length=1, max_length=50)
    label: str | None = Field(default=None, max_length=255)
    frequency_display: str | None = Field(default=None, pattern=r"^(daily|2xday|3xday|weekly|2xweek|3xweek|custom)$")
    custom_frequency: str | None = Field(default=None, max_length=255)
    duration_minutes: int | None = Field(default=None, ge=5, le=240)
    recurrence_rule: str | None = Field(default=None, min_length=1, max_length=255)
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    preferred_time: datetime.time | None = None
    preferred_slot: str | None = Field(default=None, pattern=r"^(morning|afternoon|evening|)$")
    notes: str | None = Field(default=None, max_length=5000)
    status: str | None = Field(default=None, pattern=r"^(active|paused|completed)$")


class CareProtocolResponse(BaseModel):
    id: str
    patient_id: str
    cabinet_id: str
    care_type: str
    label: str = ""
    frequency_display: str = "daily"
    custom_frequency: str = ""
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
