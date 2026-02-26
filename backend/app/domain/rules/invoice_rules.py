"""Regles metier pures pour la facturation IDEL."""

from decimal import Decimal
from uuid import UUID

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.entities.invoice import Invoice, InvoiceLine


def validate_invoice_for_validation(invoice: Invoice) -> list[str]:
    """Retourne une liste d'erreurs si la facture n'est pas validable. Liste vide = OK."""
    errors: list[str] = []

    if invoice.status != "draft":
        errors.append(f"La facture est en statut '{invoice.status}', seul 'draft' est validable")

    if not invoice.lines:
        errors.append("La facture ne contient aucune ligne")

    if invoice.care_date > invoice.invoice_date:
        errors.append("La date de soin ne peut pas etre posterieure a la date de facture")

    return errors


def can_modify_invoice(invoice: Invoice) -> bool:
    return invoice.status == "draft"


def can_delete_invoice(invoice: Invoice) -> bool:
    return invoice.status == "draft"


def can_cancel_invoice(invoice: Invoice) -> bool:
    return invoice.status in ("draft", "validated")


def calculate_amo_amc_split(
    total: Decimal,
    is_ald: bool,
    is_maternity: bool,
) -> tuple[Decimal, Decimal, Decimal]:
    """Retourne (amo, amc, patient).

    ALD/maternite -> (total, 0, 0).
    Sinon -> (total * 0.6, total * 0.4, 0) en MVP simplifie.
    """
    if is_ald or is_maternity:
        return (total, Decimal("0.00"), Decimal("0.00"))

    amo = (total * Decimal("0.6")).quantize(Decimal("0.01"))
    amc = (total * Decimal("0.4")).quantize(Decimal("0.01"))
    return (amo, amc, Decimal("0.00"))


def snapshot_line_from_catalog(
    catalog_entry: CareTypeCatalog,
    invoice_id: UUID,
    quantity: Decimal = Decimal("1"),
    supplements: dict | None = None,
    appointment_id: UUID | None = None,
    line_order: int = 1,
) -> InvoiceLine:
    """Cree une InvoiceLine avec les tarifs figes depuis le catalogue."""
    coefficient = catalog_entry.coefficient or Decimal("1")
    base_rate = catalog_entry.base_rate or Decimal("0.00")

    # Si l'acte a un fixed_amount, on l'utilise comme base_rate avec coefficient 1
    if catalog_entry.fixed_amount is not None:
        base_rate = catalog_entry.fixed_amount
        coefficient = Decimal("1")

    line = InvoiceLine(
        invoice_id=invoice_id,
        act_code=catalog_entry.code,
        act_label=catalog_entry.label,
        coefficient=coefficient,
        base_rate=base_rate,
        quantity=quantity,
        supplements=supplements,
        appointment_id=appointment_id,
        line_order=line_order,
    )
    line.recalculate()
    return line
