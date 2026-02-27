"""Schemas Pydantic pour les protocoles de soins."""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class CareProtocolCreate(BaseModel):
    patient_id: UUID
    label: str = Field(default="", max_length=255)
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None


class CareProtocolUpdate(BaseModel):
    label: str | None = Field(default=None, max_length=255)
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    status: str | None = Field(default=None, pattern=r"^(active|paused|completed)$")


class CareProtocolResponse(BaseModel):
    id: str
    patient_id: str
    cabinet_id: str
    label: str = ""
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime


class CareProtocolListResponse(BaseModel):
    items: list[CareProtocolResponse]
    total: int
