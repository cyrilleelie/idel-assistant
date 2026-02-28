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


@dataclass
class UpdateInvoiceLineDTO:
    quantity: Decimal | None = None
    supplements: dict | None = None


@dataclass
class InvoiceLineDTO:
    id: UUID
    invoice_id: UUID
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
    appointment_id: UUID | None
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
    payment_date: datetime.date | None = None
    payment_reference: str | None = None
    payment_amount: Decimal | None = None
    rejection_code: str | None = None
    rejected_at: datetime.datetime | None = None
    corrected_invoice_id: UUID | None = None


@dataclass
class InvoiceListDTO:
    items: list[InvoiceDTO]
    total: int
    offset: int
    limit: int


@dataclass
class InvoiceValidationErrorDTO:
    errors: list[str]


# --- Stats DTOs ---


@dataclass
class DailyBreakdownDTO:
    date: datetime.date
    total: Decimal
    count: int


@dataclass
class ActStatsDTO:
    act_code: str
    act_label: str
    count: int
    total: Decimal
    percentage: Decimal


@dataclass
class MonthlyStatsDTO:
    period: str  # YYYY-MM
    total_invoiced: Decimal
    total_pending: Decimal
    total_paid: Decimal
    total_rejected: Decimal
    num_invoices: int
    num_working_days: int
    avg_daily_revenue: Decimal
    daily_breakdown: list[DailyBreakdownDTO]
    top_acts: list[ActStatsDTO]


@dataclass
class PeriodComparisonDTO:
    period1: MonthlyStatsDTO
    period2: MonthlyStatsDTO
    evolution_invoiced: Decimal | None
    evolution_paid: Decimal | None
    evolution_rejected: Decimal | None


@dataclass
class IdelStatsDTO:
    idel_id: UUID
    idel_name: str
    total_invoiced: Decimal
    num_invoices: int
    percentage_of_cabinet: Decimal


@dataclass
class MarkPaidDTO:
    invoice_ids: list[UUID]
    payment_date: datetime.date
    payment_reference: str | None = None
    payment_amount: Decimal | None = None


@dataclass
class MarkPaidResultDTO:
    marked_paid: int
    errors: list[str]


@dataclass
class RejectInvoiceDTO:
    rejection_reason: str
    rejection_code: str | None = None


@dataclass
class InvoiceLineInputDTO:
    act_code: str
    act_label: str
    coefficient: Decimal = Decimal("1")
    base_rate: Decimal = Decimal("0.00")
    quantity: Decimal = Decimal("1")
    supplements: dict | None = None


@dataclass
class CorrectAndResubmitDTO:
    lines: list[InvoiceLineInputDTO]
    prescription_id: UUID | None = None
