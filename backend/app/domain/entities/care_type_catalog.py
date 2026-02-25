import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID, uuid4


@dataclass
class CareTypeCatalog:
    code: str
    lettre_cle: str
    label: str
    category: str  # technique | technique_bsi | nursing | bsi_forfait | majoration | indemnite_deplacement | indemnite_km | teleconsultation | forfait
    unit: str  # acte | jour | km | passage
    effective_from: datetime.date
    is_system: bool = True
    is_active: bool = True
    cabinet_id: UUID | None = None
    coefficient: Decimal | None = None
    base_rate: Decimal | None = None
    fixed_amount: Decimal | None = None
    default_duration_minutes: int | None = None
    is_cumulative: bool = False
    cumul_rules: dict | None = None
    context_rules: dict | None = None
    effective_to: datetime.date | None = None
    avenant_source: str | None = None
    display_order: int = 0
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))

    def calculate_amount(
        self,
        coefficient_override: Decimal | None = None,
        quantity: Decimal = Decimal("1"),
    ) -> Decimal:
        """Calcule le montant de l'acte.

        Si fixed_amount est defini, retourne fixed_amount * quantity.
        Sinon, retourne coefficient * base_rate * quantity.
        """
        if self.fixed_amount is not None:
            return (self.fixed_amount * quantity).quantize(Decimal("0.01"))

        coeff = coefficient_override if coefficient_override is not None else self.coefficient
        if coeff is None or self.base_rate is None:
            return Decimal("0.00")

        return (coeff * self.base_rate * quantity).quantize(Decimal("0.01"))

    def is_currently_effective(self, at_date: datetime.date | None = None) -> bool:
        """Verifie que l'acte est en vigueur a la date donnee."""
        check_date = at_date or datetime.date.today()
        if self.effective_from > check_date:
            return False
        if self.effective_to is not None and self.effective_to < check_date:
            return False
        return True
