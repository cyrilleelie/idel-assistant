from dataclasses import dataclass, field
from decimal import Decimal


@dataclass
class CotationLigne:
    code: str
    label: str
    montant: Decimal
    quantity: Decimal = Decimal("1")
    coefficient: Decimal | None = None
    base_rate: Decimal | None = None
    category: str = "acte"  # acte | indemnite | majoration | forfait


@dataclass
class CotationResult:
    lignes: list[CotationLigne] = field(default_factory=list)
    total: Decimal = Decimal("0.00")
    repartition_amo: Decimal = Decimal("0.00")
    repartition_amc: Decimal = Decimal("0.00")
    repartition_patient: Decimal = Decimal("0.00")
    auto_corrections: list[str] = field(default_factory=list)
    explications: list[str] = field(default_factory=list)
