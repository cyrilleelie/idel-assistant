import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID, uuid4


@dataclass
class InvoiceLine:
    invoice_id: UUID
    act_code: str
    act_label: str
    coefficient: Decimal = Decimal("1")
    base_rate: Decimal = Decimal("0.00")
    quantity: Decimal = Decimal("1")
    line_subtotal: Decimal = Decimal("0.00")
    supplements: dict | None = None
    supplements_total: Decimal = Decimal("0.00")
    line_total: Decimal = Decimal("0.00")
    line_order: int = 1
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))

    def recalculate(self) -> None:
        """Recalcule line_subtotal et line_total a partir des champs."""
        self.line_subtotal = (self.coefficient * self.base_rate * self.quantity).quantize(Decimal("0.01"))
        sup_total = Decimal("0.00")
        if self.supplements:
            for value in self.supplements.values():
                sup_total += Decimal(str(value))
        self.supplements_total = sup_total.quantize(Decimal("0.01"))
        self.line_total = (self.line_subtotal + self.supplements_total).quantize(Decimal("0.01"))


@dataclass
class Invoice:
    cabinet_id: UUID
    idel_id: UUID
    patient_id: UUID
    invoice_number: str = ""
    invoice_date: datetime.date = field(default_factory=datetime.date.today)
    care_date: datetime.date = field(default_factory=datetime.date.today)
    total_amo: Decimal = Decimal("0.00")
    total_amc: Decimal = Decimal("0.00")
    total_patient: Decimal = Decimal("0.00")
    total_amount: Decimal = Decimal("0.00")
    tiers_payant_type: str = "total"  # total | partiel | none
    status: str = "draft"  # draft | validated | canceled | transmitted | paid | rejected
    prescription_id: UUID | None = None
    rejection_reason: str | None = None
    validated_at: datetime.datetime | None = None
    transmitted_at: datetime.datetime | None = None
    paid_at: datetime.datetime | None = None
    appointment_id: UUID | None = None
    metadata: dict | None = None
    payment_date: datetime.date | None = None
    payment_reference: str | None = None
    payment_amount: Decimal | None = None
    rejection_code: str | None = None
    rejected_at: datetime.datetime | None = None
    corrected_invoice_id: UUID | None = None
    lines: list[InvoiceLine] = field(default_factory=list)
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))

    @property
    def is_modifiable(self) -> bool:
        return self.status == "draft"

    def recalculate_totals(self, is_ald: bool = False, is_maternity: bool = False) -> None:
        """Recalcule total_amount a partir des lignes, puis repartit AMO/AMC/patient."""
        self.total_amount = sum(
            (line.line_total for line in self.lines), Decimal("0.00")
        ).quantize(Decimal("0.01"))

        if is_ald or is_maternity:
            self.total_amo = self.total_amount
            self.total_amc = Decimal("0.00")
            self.total_patient = Decimal("0.00")
        else:
            self.total_amo = (self.total_amount * Decimal("0.6")).quantize(Decimal("0.01"))
            self.total_amc = (self.total_amount * Decimal("0.4")).quantize(Decimal("0.01"))
            self.total_patient = Decimal("0.00")

    def validate(self) -> None:
        """Passe la facture en status validated. Leve ValueError si conditions non remplies."""
        if self.status != "draft":
            raise ValueError("Seule une facture en brouillon peut etre validee")
        if not self.lines:
            raise ValueError("La facture doit contenir au moins une ligne")
        self.status = "validated"
        self.validated_at = datetime.datetime.now(datetime.UTC)

    def cancel(self) -> None:
        """Annule la facture. Leve ValueError si le statut ne le permet pas."""
        if self.status not in ("draft", "validated"):
            raise ValueError(f"Impossible d'annuler une facture en statut '{self.status}'")
        self.status = "canceled"

    def reject(self, reason: str, code: str | None = None) -> None:
        """Passe la facture en statut rejeté. Uniquement depuis validated ou transmitted."""
        if self.status not in ("validated", "transmitted"):
            raise ValueError(
                f"Impossible de rejeter une facture en statut '{self.status}' "
                "(statut attendu : validated ou transmitted)"
            )
        self.status = "rejected"
        self.rejection_reason = reason
        self.rejection_code = code
        self.rejected_at = datetime.datetime.now(datetime.UTC)

    def mark_paid(
        self,
        payment_date: datetime.date,
        reference: str | None = None,
        amount: Decimal | None = None,
    ) -> None:
        """Marque la facture comme payée. Uniquement depuis validated ou transmitted."""
        if self.status not in ("validated", "transmitted"):
            raise ValueError(
                f"Impossible de marquer payée une facture en statut '{self.status}' "
                "(statut attendu : validated ou transmitted)"
            )
        self.status = "paid"
        self.payment_date = payment_date
        self.payment_reference = reference
        self.payment_amount = amount
        self.paid_at = datetime.datetime.now(datetime.UTC)
