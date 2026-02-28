"""Schemas Pydantic pour les rendez-vous."""

import datetime
from decimal import Decimal
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
    act_codes: list[str] = Field(default_factory=list)
    care_labels: list[str] = Field(default_factory=list)
    distance_km: Decimal | None = None
    idel_id: UUID | None = None


class AppointmentUpdate(BaseModel):
    scheduled_at: datetime.datetime | None = None
    duration_minutes: int | None = Field(default=None, ge=5, le=240)
    care_type: str | None = Field(default=None, min_length=1, max_length=50)
    care_protocol_id: UUID | None = None
    location_type: str | None = Field(default=None, pattern=r"^(home|office|hospital)$")
    act_codes: list[str] | None = None
    care_labels: list[str] | None = None
    distance_km: Decimal | None = None
    status: str | None = Field(default=None, pattern=r"^(scheduled|completed|canceled)$")


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
    act_codes: list[str] = []
    care_labels: list[str] = []
    distance_km: Decimal | None = None
    created_by: str = "manual"
    created_at: datetime.datetime
    updated_at: datetime.datetime


class AppointmentListResponse(BaseModel):
    items: list[AppointmentResponse]
    total: int


class AutoBillingInfo(BaseModel):
    """Résultat de la tentative de facturation automatique lors de la complétion d'un RDV."""

    status: str  # "created" | "skipped" | "error"
    invoice_id: str | None = None
    invoice_number: str | None = None
    invoice_total: float | None = None
    skip_reason: str | None = None


class AppointmentCompleteResponse(AppointmentResponse):
    """Réponse enrichie du endpoint /complete, avec infos de facturation auto."""

    auto_billing: AutoBillingInfo | None = None
