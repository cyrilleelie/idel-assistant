"""Schemas Pydantic pour les patients."""

import datetime
from uuid import UUID

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
    ssn: str = Field(default="", max_length=15)
    doctor_name: str = Field(default="", max_length=200)
    doctor_contact: str = Field(default="", max_length=200)
    sector_id: UUID | None = None
    postal_code: str = Field(default="", max_length=10)
    city: str = Field(default="", max_length=100)


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
    ssn: str | None = Field(default=None, max_length=15)
    doctor_name: str | None = Field(default=None, max_length=200)
    doctor_contact: str | None = Field(default=None, max_length=200)
    sector_id: UUID | None = None
    postal_code: str | None = Field(default=None, max_length=10)
    city: str | None = Field(default=None, max_length=100)
    status: str | None = Field(default=None, pattern=r"^(active|archived)$")


class PatientResponse(BaseModel):
    id: str
    first_name: str
    last_name: str
    birth_date: datetime.date | None = None
    address: str = ""
    lat: float | None = None
    lon: float | None = None
    sector_id: str | None = None
    postal_code: str = ""
    city: str = ""
    phone: str = ""
    email: str = ""
    pathologies: list[str] = Field(default_factory=list)
    preferred_time_slot: str = ""
    care_duration_default: int = 30
    notes: str = ""
    ssn: str = ""
    doctor_name: str = ""
    doctor_contact: str = ""
    status: str = "active"
    created_at: datetime.datetime
    updated_at: datetime.datetime


class PatientListResponse(BaseModel):
    items: list[PatientResponse]
    total: int
