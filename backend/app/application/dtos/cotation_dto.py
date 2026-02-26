"""DTOs pour le moteur de cotation automatique NGAP."""

import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID


@dataclass
class SimulateCotationDTO:
    patient_id: UUID
    idel_id: UUID
    actes: list[str]
    date_heure_soin: str  # ISO 8601
    distance_km: Decimal
    lieu: str  # "domicile" | "cabinet"
    zone_ik: str  # "plaine" | "montagne"
    est_premier_soin_journee: bool


@dataclass
class CotationLigneDTO:
    code: str
    label: str
    montant: Decimal
    quantity: Decimal
    coefficient: Decimal | None
    base_rate: Decimal | None
    category: str


@dataclass
class CotationResultDTO:
    lignes: list[CotationLigneDTO]
    total: Decimal
    repartition_amo: Decimal
    repartition_amc: Decimal
    repartition_patient: Decimal
    auto_corrections: list[str]
    explications: list[str]


@dataclass
class DailyBillingItemDTO:
    appointment_id: UUID
    patient_id: UUID
    patient_name: str
    idel_id: UUID
    scheduled_at: datetime.datetime
    care_type: str
    act_codes: list[str]
    status: str
    invoice_id: UUID | None
    invoice_status: str | None


@dataclass
class DailyBillingResponseDTO:
    date: datetime.date
    items: list[DailyBillingItemDTO]
    total_facture: int
    total_non_facture: int
