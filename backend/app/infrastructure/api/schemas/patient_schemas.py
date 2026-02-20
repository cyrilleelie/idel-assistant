"""Schemas Pydantic pour les patients."""

import datetime

from pydantic import BaseModel, Field


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: datetime.date | None = None
    address: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=20)
    email: str = Field(default="", max_length=255)
    pathologies: list[str] = Field(default_factory=list)
    preferred_time_slot: str = Field(default="", pattern=r"^(morning|afternoon|evening|)$")
    care_duration_default: int = Field(default=30, ge=5, le=240)
    notes: str = Field(default="", max_length=5000)


class PatientUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    birth_date: datetime.date | None = None
    address: str | None = Field(default=None, max_length=500)
    phone: str | None = Field(default=None, max_length=20)
    email: str | None = Field(default=None, max_length=255)
    pathologies: list[str] | None = None
    preferred_time_slot: str | None = Field(default=None, pattern=r"^(morning|afternoon|evening|)$")
    care_duration_default: int | None = Field(default=None, ge=5, le=240)
    notes: str | None = Field(default=None, max_length=5000)


class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    birth_date: datetime.date | None = None
    address: str = ""
    lat: float | None = None
    lon: float | None = None
    phone: str = ""
    email: str = ""
    pathologies: list[str] = Field(default_factory=list)
    preferred_time_slot: str = ""
    care_duration_default: int = 30
    notes: str = ""
    status: str = "active"
    created_at: datetime.datetime
    updated_at: datetime.datetime


class PatientListResponse(BaseModel):
    items: list[PatientResponse]
    total: int
