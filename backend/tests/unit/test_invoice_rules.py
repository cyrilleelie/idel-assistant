"""Tests unitaires pour les regles metier de facturation."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.rules.invoice_rules import (
    calculate_amo_amc_split,
    can_cancel_invoice,
    can_delete_invoice,
    can_modify_invoice,
    snapshot_line_from_catalog,
    validate_invoice_for_validation,
)


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


class TestValidateInvoiceForValidation:
    def test_no_lines_returns_error(self):
        invoice = _make_invoice(lines=[])
        errors = validate_invoice_for_validation(invoice)
        assert len(errors) == 1
        assert "aucune ligne" in errors[0]

    def test_not_draft_returns_error(self):
        invoice = _make_invoice(status="validated", lines=[_make_line()])
        errors = validate_invoice_for_validation(invoice)
        assert len(errors) == 1
        assert "draft" in errors[0]

    def test_care_date_after_invoice_date_returns_error(self):
        invoice = _make_invoice(
            care_date=datetime.date(2026, 3, 1),
            invoice_date=datetime.date(2026, 2, 26),
            lines=[_make_line()],
        )
        errors = validate_invoice_for_validation(invoice)
        assert len(errors) == 1
        assert "date de soin" in errors[0]

    def test_valid_invoice_returns_empty(self):
        invoice = _make_invoice(lines=[_make_line()])
        errors = validate_invoice_for_validation(invoice)
        assert errors == []

    def test_multiple_errors(self):
        invoice = _make_invoice(
            status="validated",
            lines=[],
            care_date=datetime.date(2026, 3, 1),
            invoice_date=datetime.date(2026, 2, 26),
        )
        errors = validate_invoice_for_validation(invoice)
        assert len(errors) == 3


class TestCanModifyDeleteCancel:
    def test_can_modify_draft(self):
        assert can_modify_invoice(_make_invoice(status="draft")) is True

    def test_cannot_modify_validated(self):
        assert can_modify_invoice(_make_invoice(status="validated")) is False

    def test_cannot_modify_paid(self):
        assert can_modify_invoice(_make_invoice(status="paid")) is False

    def test_can_delete_draft(self):
        assert can_delete_invoice(_make_invoice(status="draft")) is True

    def test_cannot_delete_validated(self):
        assert can_delete_invoice(_make_invoice(status="validated")) is False

    def test_cannot_delete_paid(self):
        assert can_delete_invoice(_make_invoice(status="paid")) is False

    def test_can_cancel_draft(self):
        assert can_cancel_invoice(_make_invoice(status="draft")) is True

    def test_can_cancel_validated(self):
        assert can_cancel_invoice(_make_invoice(status="validated")) is True

    def test_cannot_cancel_paid(self):
        assert can_cancel_invoice(_make_invoice(status="paid")) is False

    def test_cannot_cancel_transmitted(self):
        assert can_cancel_invoice(_make_invoice(status="transmitted")) is False


class TestCalculateAmoAmcSplit:
    def test_normal_split(self):
        total = Decimal("100.00")
        amo, amc, patient = calculate_amo_amc_split(total, is_ald=False, is_maternity=False)
        assert amo == Decimal("60.00")
        assert amc == Decimal("40.00")
        assert patient == Decimal("0.00")

    def test_ald_100_percent_amo(self):
        total = Decimal("100.00")
        amo, amc, patient = calculate_amo_amc_split(total, is_ald=True, is_maternity=False)
        assert amo == Decimal("100.00")
        assert amc == Decimal("0.00")
        assert patient == Decimal("0.00")

    def test_maternity_100_percent_amo(self):
        total = Decimal("100.00")
        amo, amc, patient = calculate_amo_amc_split(total, is_ald=False, is_maternity=True)
        assert amo == Decimal("100.00")
        assert amc == Decimal("0.00")
        assert patient == Decimal("0.00")

    def test_rounding(self):
        total = Decimal("12.60")
        amo, amc, patient = calculate_amo_amc_split(total, is_ald=False, is_maternity=False)
        assert amo == Decimal("7.56")
        assert amc == Decimal("5.04")
        assert patient == Decimal("0.00")
        assert amo + amc == total


class TestSnapshotLineFromCatalog:
    def test_coefficient_act(self):
        catalog = CareTypeCatalog(
            code="AMI_4",
            lettre_cle="AMI",
            label="Acte medical infirmier coefficient 4",
            category="technique",
            unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
        )
        invoice_id = uuid4()
        line = snapshot_line_from_catalog(catalog, invoice_id)
        assert line.act_code == "AMI_4"
        assert line.act_label == "Acte medical infirmier coefficient 4"
        assert line.coefficient == Decimal("4")
        assert line.base_rate == Decimal("3.15")
        assert line.quantity == Decimal("1")
        assert line.line_subtotal == Decimal("12.60")
        assert line.line_total == Decimal("12.60")
        assert line.invoice_id == invoice_id

    def test_fixed_amount_act(self):
        catalog = CareTypeCatalog(
            code="IFD",
            lettre_cle="IFD",
            label="Indemnite forfaitaire de deplacement",
            category="indemnite_deplacement",
            unit="passage",
            effective_from=datetime.date(2024, 1, 28),
            fixed_amount=Decimal("2.75"),
        )
        line = snapshot_line_from_catalog(catalog, uuid4())
        assert line.coefficient == Decimal("1")
        assert line.base_rate == Decimal("2.75")
        assert line.line_subtotal == Decimal("2.75")
        assert line.line_total == Decimal("2.75")

    def test_with_quantity(self):
        catalog = CareTypeCatalog(
            code="IK",
            lettre_cle="IK",
            label="Indemnite kilometrique",
            category="indemnite_km",
            unit="km",
            effective_from=datetime.date(2024, 1, 28),
            fixed_amount=Decimal("0.50"),
        )
        line = snapshot_line_from_catalog(catalog, uuid4(), quantity=Decimal("15"))
        assert line.quantity == Decimal("15")
        assert line.line_subtotal == Decimal("7.50")
        assert line.line_total == Decimal("7.50")

    def test_with_supplements(self):
        catalog = CareTypeCatalog(
            code="AMI_4",
            lettre_cle="AMI",
            label="AMI 4",
            category="technique",
            unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
        )
        supplements = {"MAJ_DIM": 8.50, "MCI": 5.00}
        line = snapshot_line_from_catalog(catalog, uuid4(), supplements=supplements)
        assert line.supplements == supplements
        assert line.supplements_total == Decimal("13.50")
        assert line.line_subtotal == Decimal("12.60")
        assert line.line_total == Decimal("26.10")
