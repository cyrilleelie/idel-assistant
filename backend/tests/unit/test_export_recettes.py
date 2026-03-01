"""Tests unitaires : ExportRecettesUseCase."""

import csv
import datetime
import io
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.application.use_cases.billing.export_recettes import ExportRecettesUseCase


def _parse_csv(content: bytes) -> list[dict]:
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    return list(reader)


def _make_row(
    payment_date=None,
    patient_id=None,
    tiers_payant="total",
    total_amo="60.00",
    total_amc="40.00",
    total_patient="0.00",
    total_amount="100.00",
    payment_reference="VIR001",
    invoice_number="FAC001",
):
    if payment_date is None:
        payment_date = datetime.date(2026, 3, 15)
    if patient_id is None:
        patient_id = uuid4()
    return (
        payment_date, patient_id, tiers_payant,
        Decimal(total_amo), Decimal(total_amc), Decimal(total_patient),
        Decimal(total_amount), payment_reference, invoice_number,
    )


def _make_session(rows):
    session = MagicMock()
    result = MagicMock()
    result.fetchall.return_value = rows

    async def _execute(query, params=None):
        return result

    session.execute = _execute
    return session


@pytest.mark.asyncio
async def test_recettes_only_paid_invoices():
    """Seules les factures payées sont dans le livre des recettes (filtre SQL)."""
    cabinet_id = uuid4()
    # On passe 2 lignes payées (le filtre status='paid' est dans le SQL)
    rows = [_make_row(), _make_row(invoice_number="FAC002")]
    session = _make_session(rows)
    use_case = ExportRecettesUseCase(session)
    content = await use_case.execute(
        cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
    )

    result = _parse_csv(content)
    assert len(result) == 2


@pytest.mark.asyncio
async def test_recettes_empty_returns_header_only():
    """Période sans facture payée → CSV avec uniquement l'en-tête."""
    cabinet_id = uuid4()
    session = _make_session([])
    use_case = ExportRecettesUseCase(session)
    content = await use_case.execute(
        cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
    )

    result = _parse_csv(content)
    assert len(result) == 0
    text = content.decode("utf-8-sig")
    assert "date_encaissement" in text


@pytest.mark.asyncio
async def test_recettes_tiers_payant_total_identite_cpam():
    """Tiers payant total avec AMO seulement → identité = 'CPAM'."""
    cabinet_id = uuid4()
    rows = [_make_row(tiers_payant="total", total_amo="100.00", total_amc="0.00")]
    session = _make_session(rows)
    use_case = ExportRecettesUseCase(session)
    content = await use_case.execute(
        cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
    )

    result = _parse_csv(content)
    assert result[0]["identite_client"] == "CPAM"
    assert "Virement CPAM" in result[0]["mode_reglement"]


@pytest.mark.asyncio
async def test_recettes_bom_and_separator():
    """CSV avec BOM UTF-8 et séparateur ;."""
    cabinet_id = uuid4()
    session = _make_session([_make_row()])
    use_case = ExportRecettesUseCase(session)
    content = await use_case.execute(
        cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
    )

    assert content[:3] == b"\xef\xbb\xbf"
    text = content.decode("utf-8-sig")
    assert ";" in text


@pytest.mark.asyncio
async def test_recettes_payment_reference_included():
    """La référence de paiement est incluse dans le CSV."""
    cabinet_id = uuid4()
    rows = [_make_row(payment_reference="VIR-CPAM-2026-03")]
    session = _make_session(rows)
    use_case = ExportRecettesUseCase(session)
    content = await use_case.execute(
        cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
    )

    result = _parse_csv(content)
    assert result[0]["reference"] == "VIR-CPAM-2026-03"


@pytest.mark.asyncio
async def test_recettes_nature_recette():
    """La nature de recette est 'Honoraires infirmiers'."""
    cabinet_id = uuid4()
    session = _make_session([_make_row()])
    use_case = ExportRecettesUseCase(session)
    content = await use_case.execute(
        cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
    )

    result = _parse_csv(content)
    assert result[0]["nature_recette"] == "Honoraires infirmiers"
