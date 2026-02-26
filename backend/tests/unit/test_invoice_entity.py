"""Tests unitaires pour les entites Invoice et InvoiceLine."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.invoice import Invoice, InvoiceLine


def _make_line(**overrides) -> InvoiceLine:
    defaults = {
        "invoice_id": uuid4(),
        "act_code": "AMI_4",
        "act_label": "Acte medical infirmier coefficient 4",
        "coefficient": Decimal("4"),
        "base_rate": Decimal("3.15"),
        "quantity": Decimal("1"),
        "line_subtotal": Decimal("12.60"),
        "line_total": Decimal("12.60"),
        "line_order": 1,
    }
    defaults.update(overrides)
    return InvoiceLine(**defaults)


def _make_invoice(**overrides) -> Invoice:
    defaults = {
        "cabinet_id": uuid4(),
        "idel_id": uuid4(),
        "patient_id": uuid4(),
        "invoice_number": "2026-02-0001",
        "invoice_date": datetime.date(2026, 2, 26),
        "care_date": datetime.date(2026, 2, 26),
        "status": "draft",
    }
    defaults.update(overrides)
    return Invoice(**defaults)


class TestInvoiceLineRecalculate:
    def test_basic_recalculate(self):
        line = InvoiceLine(
            invoice_id=uuid4(),
            act_code="AMI_4",
            act_label="AMI 4",
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
            quantity=Decimal("1"),
        )
        line.recalculate()
        assert line.line_subtotal == Decimal("12.60")
        assert line.supplements_total == Decimal("0.00")
        assert line.line_total == Decimal("12.60")

    def test_recalculate_with_quantity(self):
        line = InvoiceLine(
            invoice_id=uuid4(),
            act_code="IK",
            act_label="Indemnite km",
            coefficient=Decimal("1"),
            base_rate=Decimal("0.50"),
            quantity=Decimal("20"),
        )
        line.recalculate()
        assert line.line_subtotal == Decimal("10.00")
        assert line.line_total == Decimal("10.00")

    def test_recalculate_with_supplements(self):
        line = InvoiceLine(
            invoice_id=uuid4(),
            act_code="AMI_4",
            act_label="AMI 4",
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
            quantity=Decimal("1"),
            supplements={"MAJ_DIM": 8.50, "MCI": 5.00},
        )
        line.recalculate()
        assert line.line_subtotal == Decimal("12.60")
        assert line.supplements_total == Decimal("13.50")
        assert line.line_total == Decimal("26.10")


class TestInvoiceRecalculateTotals:
    def test_recalculate_with_three_lines(self):
        inv_id = uuid4()
        lines = [
            _make_line(invoice_id=inv_id, line_total=Decimal("12.60"), line_order=1),
            _make_line(invoice_id=inv_id, line_total=Decimal("2.75"), line_order=2, act_code="IFD"),
            _make_line(invoice_id=inv_id, line_total=Decimal("7.50"), line_order=3, act_code="IK"),
        ]
        invoice = _make_invoice(lines=lines)
        invoice.recalculate_totals()
        assert invoice.total_amount == Decimal("22.85")
        # 60/40 split
        assert invoice.total_amo == Decimal("13.71")
        assert invoice.total_amc == Decimal("9.14")
        assert invoice.total_patient == Decimal("0.00")

    def test_recalculate_ald(self):
        lines = [_make_line(line_total=Decimal("100.00"))]
        invoice = _make_invoice(lines=lines)
        invoice.recalculate_totals(is_ald=True)
        assert invoice.total_amount == Decimal("100.00")
        assert invoice.total_amo == Decimal("100.00")
        assert invoice.total_amc == Decimal("0.00")
        assert invoice.total_patient == Decimal("0.00")

    def test_recalculate_maternity(self):
        lines = [_make_line(line_total=Decimal("50.00"))]
        invoice = _make_invoice(lines=lines)
        invoice.recalculate_totals(is_maternity=True)
        assert invoice.total_amo == Decimal("50.00")
        assert invoice.total_amc == Decimal("0.00")

    def test_recalculate_no_lines(self):
        invoice = _make_invoice(lines=[])
        invoice.recalculate_totals()
        assert invoice.total_amount == Decimal("0.00")


class TestInvoiceValidate:
    def test_validate_draft_with_lines(self):
        invoice = _make_invoice(status="draft", lines=[_make_line()])
        invoice.validate()
        assert invoice.status == "validated"
        assert invoice.validated_at is not None

    def test_validate_already_validated_raises(self):
        invoice = _make_invoice(status="validated", lines=[_make_line()])
        with pytest.raises(ValueError, match="brouillon"):
            invoice.validate()

    def test_validate_no_lines_raises(self):
        invoice = _make_invoice(status="draft", lines=[])
        with pytest.raises(ValueError, match="au moins une ligne"):
            invoice.validate()

    def test_validate_paid_raises(self):
        invoice = _make_invoice(status="paid", lines=[_make_line()])
        with pytest.raises(ValueError, match="brouillon"):
            invoice.validate()


class TestInvoiceCancel:
    def test_cancel_draft(self):
        invoice = _make_invoice(status="draft")
        invoice.cancel()
        assert invoice.status == "canceled"

    def test_cancel_validated(self):
        invoice = _make_invoice(status="validated")
        invoice.cancel()
        assert invoice.status == "canceled"

    def test_cancel_paid_raises(self):
        invoice = _make_invoice(status="paid")
        with pytest.raises(ValueError, match="paid"):
            invoice.cancel()

    def test_cancel_transmitted_raises(self):
        invoice = _make_invoice(status="transmitted")
        with pytest.raises(ValueError, match="transmitted"):
            invoice.cancel()


class TestIsModifiable:
    def test_draft_is_modifiable(self):
        assert _make_invoice(status="draft").is_modifiable is True

    def test_validated_not_modifiable(self):
        assert _make_invoice(status="validated").is_modifiable is False

    def test_canceled_not_modifiable(self):
        assert _make_invoice(status="canceled").is_modifiable is False
