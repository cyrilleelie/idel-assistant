import datetime
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID


@dataclass
class CareTypeCatalogDTO:
    id: UUID
    cabinet_id: UUID | None
    code: str
    lettre_cle: str
    label: str
    category: str
    coefficient: Decimal | None
    base_rate: Decimal | None
    fixed_amount: Decimal | None
    unit: str
    default_duration_minutes: int | None
    is_cumulative: bool
    cumul_rules: dict | None
    context_rules: dict | None
    effective_from: datetime.date
    effective_to: datetime.date | None
    avenant_source: str | None
    is_system: bool
    is_active: bool
    display_order: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


@dataclass
class CreateCustomActDTO:
    code: str
    lettre_cle: str
    label: str
    category: str
    unit: str = "acte"
    coefficient: Decimal | None = None
    base_rate: Decimal | None = None
    fixed_amount: Decimal | None = None
    default_duration_minutes: int | None = None
    is_cumulative: bool = False
    cumul_rules: dict | None = None
    context_rules: dict | None = None
    effective_from: datetime.date | None = None
    display_order: int = 0


@dataclass
class TariffUpdateDTO:
    id: UUID
    version: str
    avenant_reference: str | None
    published_at: datetime.date | None
    effective_at: datetime.date
    description: str
    changes: dict
    status: str
    applied_at: datetime.datetime | None
    created_at: datetime.datetime
