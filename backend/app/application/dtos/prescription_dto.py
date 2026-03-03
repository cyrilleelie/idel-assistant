"""DTOs pour les ordonnances (prescriptions)."""

import datetime
from dataclasses import dataclass, field
from uuid import UUID


@dataclass
class CreatePrescriptionDTO:
    cabinet_id: UUID
    patient_id: UUID

    # Lien au plan de soins (si ordonnance issue d'un plan)
    care_protocol_id: UUID | None = None

    # Libellé (référentiel CareLabel)
    label: str = ""
    care_label_code: str | None = None

    # Champs scheduling
    duration_minutes: int = 30
    frequency_display: str = "daily"
    custom_frequency: str = ""
    preferred_time: datetime.time | None = None
    preferred_slot: str = ""
    recurrence_rule: str = ""
    care_location: str = "domicile"

    # Prescripteur (optionnel)
    prescriber_name: str | None = None
    prescriber_rpps: str | None = None
    prescription_date: datetime.date | None = None

    # Dates de validité
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    duration_days: int | None = None

    # Contenu médical
    care_description: str | None = None
    act_codes: list[str] = field(default_factory=list)
    frequency: str | None = None
    max_renewals: int = 0

    # Document
    document_url: str | None = None
    document_type: str | None = None
    notes: str | None = None


@dataclass
class UpdatePrescriptionDTO:
    care_protocol_id: UUID | None = None
    label: str | None = None
    care_label_code: str | None = None
    duration_minutes: int | None = None
    frequency_display: str | None = None
    custom_frequency: str | None = None
    preferred_time: datetime.time | None = None
    preferred_slot: str | None = None
    recurrence_rule: str | None = None
    care_location: str | None = None
    prescriber_name: str | None = None
    prescriber_rpps: str | None = None
    prescription_date: datetime.date | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    duration_days: int | None = None
    care_description: str | None = None
    act_codes: list[str] | None = None
    frequency: str | None = None
    max_renewals: int | None = None
    status: str | None = None
    document_url: str | None = None
    document_filename: str | None = None
    document_type: str | None = None
    notes: str | None = None


@dataclass
class RenewPrescriptionDTO:
    new_start_date: datetime.date | None = None
    new_duration_days: int | None = None
    new_end_date: datetime.date | None = None
    notes: str | None = None


@dataclass
class PrescriptionDTO:
    id: UUID
    cabinet_id: UUID
    patient_id: UUID
    status: str

    care_protocol_id: UUID | None = None
    label: str = ""
    care_label_code: str | None = None
    duration_minutes: int = 30
    frequency_display: str = "daily"
    custom_frequency: str = ""
    preferred_time: datetime.time | None = None
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
    act_codes: list[str] = field(default_factory=list)
    frequency: str | None = None
    max_renewals: int = 0
    current_renewal: int = 0
    parent_prescription_id: UUID | None = None
    document_url: str | None = None
    document_filename: str | None = None
    document_type: str | None = None
    notes: str | None = None
    created_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    updated_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )

    # Champs enrichis (calculés)
    days_remaining: int | None = None
    invoices_count: int = 0
    patient_name: str | None = None


@dataclass
class ExpiringPrescriptionDTO:
    prescription: PrescriptionDTO
    patient_name: str
    days_remaining: int | None
    invoices_count: int
    care_protocol_id: UUID | None
