"""Tests unitaires : domain Invoice.reject() et Invoice.mark_paid()."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.invoice import Invoice, InvoiceLine


def _make_invoice(status: str = "draft") -> Invoice:
    inv = Invoice(
        cabinet_id=uuid4(),
        idel_id=uuid4(),
        patient_id=uuid4(),
        invoice_number="2026-02-0001",
        status=status,
    )
    if status in ("validated", "transmitted", "paid", "rejected"):
        line = InvoiceLine(
            invoice_id=inv.id,
            act_code="AMI4",
            act_label="AMI 4",
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
            quantity=Decimal("1"),
        )
        line.recalculate()
        inv.lines.append(line)
        inv.recalculate_totals()
    return inv


# --- reject() ---


def test_reject_from_validated():
    inv = _make_invoice("validated")
    inv.reject("Acte non remboursable", "R12")
    assert inv.status == "rejected"
    assert inv.rejection_reason == "Acte non remboursable"
    assert inv.rejection_code == "R12"
    assert inv.rejected_at is not None


def test_reject_from_transmitted():
    inv = _make_invoice("transmitted")
    inv.reject("Ordonnance manquante")
    assert inv.status == "rejected"
    assert inv.rejection_code is None


def test_reject_from_draft_raises():
    inv = _make_invoice("draft")
    with pytest.raises(ValueError, match="statut"):
        inv.reject("Erreur")


def test_reject_from_paid_raises():
    inv = _make_invoice("paid")
    with pytest.raises(ValueError, match="statut"):
        inv.reject("Erreur")


def test_reject_from_canceled_raises():
    inv = _make_invoice("canceled")
    with pytest.raises(ValueError, match="statut"):
        inv.reject("Erreur")


# --- mark_paid() ---


def test_mark_paid_from_validated():
    inv = _make_invoice("validated")
    pay_date = datetime.date(2026, 3, 1)
    inv.mark_paid(payment_date=pay_date, reference="VIREMENT-001", amount=Decimal("12.60"))
    assert inv.status == "paid"
    assert inv.payment_date == pay_date
    assert inv.payment_reference == "VIREMENT-001"
    assert inv.payment_amount == Decimal("12.60")
    assert inv.paid_at is not None


def test_mark_paid_from_transmitted():
    inv = _make_invoice("transmitted")
    inv.mark_paid(payment_date=datetime.date.today())
    assert inv.status == "paid"


def test_mark_paid_from_draft_raises():
    inv = _make_invoice("draft")
    with pytest.raises(ValueError, match="statut"):
        inv.mark_paid(payment_date=datetime.date.today())


def test_mark_paid_from_rejected_raises():
    inv = _make_invoice("rejected")
    with pytest.raises(ValueError, match="statut"):
        inv.mark_paid(payment_date=datetime.date.today())


def test_mark_paid_from_canceled_raises():
    inv = _make_invoice("canceled")
    with pytest.raises(ValueError, match="statut"):
        inv.mark_paid(payment_date=datetime.date.today())


# --- Champs optionnels ---


def test_mark_paid_without_reference_and_amount():
    inv = _make_invoice("validated")
    inv.mark_paid(payment_date=datetime.date.today())
    assert inv.payment_reference is None
    assert inv.payment_amount is None
