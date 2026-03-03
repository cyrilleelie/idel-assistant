"""Schemas Pydantic pour les ordonnances (prescriptions)."""

import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PrescriptionCreate(BaseModel):
    patient_id: UUID

    # Lien au plan de soins
    care_protocol_id: UUID | None = None

    # Libellé (référentiel CareLabel)
    label: str = Field(default="", max_length=255)
    care_label_code: str | None = Field(default=None, max_length=100)

    # Champs scheduling
    duration_minutes: int = Field(default=30, ge=1, le=480)
    frequency_display: str = Field(
        default="daily",
        pattern=r"^(daily|2xday|3xday|weekly|2xweek|3xweek|custom)$",
    )
    custom_frequency: str = Field(default="", max_length=255)
    preferred_time: datetime.time | None = None
    preferred_slot: str = Field(
        default="",
        pattern=r"^(morning|afternoon|evening|)?$",
    )
    recurrence_rule: str = Field(default="", max_length=500)
    care_location: str = Field(default="domicile", pattern=r"^(domicile|cabinet)$")

    # Prescripteur (optionnel)
    prescriber_name: str | None = Field(default=None, min_length=2, max_length=255)
    prescriber_rpps: str | None = Field(default=None, pattern=r"^\d{11}$")
    prescription_date: datetime.date | None = None

    # Dates de validité
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    duration_days: int | None = Field(default=None, ge=1, le=730)

    # Contenu médical
    care_description: str | None = Field(default=None, max_length=2000)
    act_codes: list[str] = Field(default_factory=list)
    frequency: str | None = Field(
        default=None,
        pattern=r"^(quotidien|2x_jour|3x_semaine|hebdomadaire|selon_protocole|autre)?$",
    )
    max_renewals: int = Field(default=0, ge=0, le=12)

    # Document
    document_url: str | None = None
    document_type: str | None = Field(default=None, pattern=r"^(photo|pdf|scan)?$")
    notes: str | None = Field(default=None, max_length=2000)


class PrescriptionUpdate(BaseModel):
    care_protocol_id: UUID | None = None
    label: str | None = Field(default=None, max_length=255)
    care_label_code: str | None = Field(default=None, max_length=100)
    duration_minutes: int | None = Field(default=None, ge=1, le=480)
    frequency_display: str | None = Field(
        default=None,
        pattern=r"^(daily|2xday|3xday|weekly|2xweek|3xweek|custom)?$",
    )
    custom_frequency: str | None = None
    preferred_time: datetime.time | None = None
    preferred_slot: str | None = None
    recurrence_rule: str | None = None
    care_location: str | None = Field(default=None, pattern=r"^(domicile|cabinet)?$")
    prescriber_name: str | None = Field(default=None, min_length=2, max_length=255)
    prescriber_rpps: str | None = Field(default=None, pattern=r"^\d{11}$")
    prescription_date: datetime.date | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    duration_days: int | None = Field(default=None, ge=1, le=730)
    care_description: str | None = Field(default=None, max_length=2000)
    act_codes: list[str] | None = None
    frequency: str | None = None
    max_renewals: int | None = Field(default=None, ge=0, le=12)
    status: str | None = Field(
        default=None,
        pattern=r"^(active|expiring|expired|completed|canceled)?$",
    )
    document_url: str | None = None
    document_type: str | None = None
    notes: str | None = None


class RenewPrescriptionRequest(BaseModel):
    new_start_date: datetime.date | None = None
    new_duration_days: int | None = Field(default=None, ge=1, le=730)
    new_end_date: datetime.date | None = None
    notes: str | None = Field(default=None, max_length=2000)


class LinkPrescriptionToInvoiceRequest(BaseModel):
    prescription_id: UUID


class PrescriptionResponse(BaseModel):
    id: str
    cabinet_id: str
    patient_id: str
    status: str

    care_protocol_id: str | None = None
    label: str = ""
    care_label_code: str | None = None
    duration_minutes: int = 30
    frequency_display: str = "daily"
    custom_frequency: str = ""
    preferred_time: str | None = None  # "HH:MM" string pour JSON
    preferred_slot: str = ""
    recurrence_rule: str = ""
    care_location: str = "domicile"

    prescriber_name: str | None = None
    prescriber_rpps: str | None = None
    prescription_date: datetime.date | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    duration_days: int | None = None
    care_description: str | None = None
    act_codes: list[str] = Field(default_factory=list)
    frequency: str | None = None
    max_renewals: int = 0
    current_renewal: int = 0
    parent_prescription_id: str | None = None
    document_url: str | None = None
    document_filename: str | None = None
    document_type: str | None = None
    notes: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Champs enrichis
    days_remaining: int | None = None
    invoices_count: int = 0
    patient_name: str | None = None


class PrescriptionListResponse(BaseModel):
    items: list[PrescriptionResponse]
    total: int


class ExpiringPrescriptionResponse(BaseModel):
    prescription: PrescriptionResponse
    patient_name: str
    days_remaining: int | None
    invoices_count: int
    care_protocol_id: str | None


class PrescriptionInvoiceItem(BaseModel):
    """Résumé d'une facture dans le détail d'une ordonnance."""
    id: str
    invoice_number: str
    care_date: datetime.date
    total_amount: float
    status: str
