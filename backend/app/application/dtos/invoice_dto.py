import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID


@dataclass
class CreateInvoiceDTO:
    patient_id: UUID
    idel_id: UUID
    care_date: datetime.date
    tiers_payant_type: str = "total"
    metadata: dict | None = None


@dataclass
class UpdateInvoiceDTO:
    care_date: datetime.date | None = None
    tiers_payant_type: str | None = None
    metadata: dict | None = None


@dataclass
class AddInvoiceLineDTO:
    act_code: str
    quantity: Decimal = Decimal("1")
    supplements: dict | None = None
    appointment_id: UUID | None = None


@dataclass
class UpdateInvoiceLineDTO:
    quantity: Decimal | None = None
    supplements: dict | None = None


@dataclass
class InvoiceLineDTO:
    id: UUID
    invoice_id: UUID
    appointment_id: UUID | None
    line_order: int
    act_code: str
    act_label: str
    coefficient: Decimal
    base_rate: Decimal
    quantity: Decimal
    line_subtotal: Decimal
    supplements: dict | None
    supplements_total: Decimal
    line_total: Decimal
    created_at: datetime.datetime


@dataclass
class InvoiceDTO:
    id: UUID
    cabinet_id: UUID
    idel_id: UUID
    patient_id: UUID
    prescription_id: UUID | None
    invoice_number: str
    invoice_date: datetime.date
    care_date: datetime.date
    total_amo: Decimal
    total_amc: Decimal
    total_patient: Decimal
    total_amount: Decimal
    tiers_payant_type: str
    status: str
    rejection_reason: str | None
    validated_at: datetime.datetime | None
    transmitted_at: datetime.datetime | None
    paid_at: datetime.datetime | None
    metadata: dict | None
    lines: list[InvoiceLineDTO]
    created_at: datetime.datetime
    updated_at: datetime.datetime


@dataclass
class InvoiceListDTO:
    items: list[InvoiceDTO]
    total: int
    offset: int
    limit: int


@dataclass
class InvoiceValidationErrorDTO:
    errors: list[str]
