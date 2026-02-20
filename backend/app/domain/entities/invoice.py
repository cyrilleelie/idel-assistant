import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID, uuid4


@dataclass
class Invoice:
    cabinet_id: UUID
    idel_id: UUID
    patient_id: UUID
    invoice_number: str = ""
    invoice_date: datetime.date = field(default_factory=datetime.date.today)
    total_amount: Decimal = Decimal("0.00")
    status: str = "draft"  # draft | validated | transmitted | paid | rejected
    rejection_reason: str = ""
    transmitted_at: datetime.datetime | None = None
    paid_at: datetime.datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))


@dataclass
class InvoiceLine:
    invoice_id: UUID
    appointment_id: UUID
    act_code: str  # AMI | AIS | BSI | ...
    coefficient: Decimal = Decimal("1.0")
    base_rate: Decimal = Decimal("0.00")
    supplements: dict = field(default_factory=dict)  # IK, majorations nuit/dimanche/ferie
    line_total: Decimal = Decimal("0.00")
    id: UUID = field(default_factory=uuid4)
