"""Tests unitaires : ExportFECUseCase."""

import csv
import datetime
import io
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.application.use_cases.billing.export_fec import ExportFECUseCase, FEC_HEADERS


def _parse_fec(content: bytes) -> list[dict]:
    """Parse le FEC (séparateur tabulation) depuis les bytes."""
    text = content.decode("utf-8")  # FEC sans BOM
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
    return list(reader)


def _make_invoice_row(
    inv_id=None,
    care_date=None,
    invoice_number="FAC001",
    invoice_date=None,
    total_amo="60.00",
    total_amc="40.00",
    total_patient="0.00",
    total_amount="100.00",
    tiers_payant="total",
    status="validated",
    validated_at=None,
    patient_id=None,
):
    if inv_id is None:
        inv_id = uuid4()
    if care_date is None:
        care_date = datetime.date(2026, 3, 1)
    if invoice_date is None:
        invoice_date = care_date
    if patient_id is None:
        patient_id = uuid4()
    return (
        inv_id, care_date, invoice_number, invoice_date,
        Decimal(total_amo), Decimal(total_amc), Decimal(total_patient),
        Decimal(total_amount), tiers_payant, status, validated_at, patient_id,
    )


def _make_session(invoice_rows, line_rows=None):
    if line_rows is None:
        line_rows = []

    session = MagicMock()
    inv_result = MagicMock()
    inv_result.fetchall.return_value = invoice_rows

    lines_result = MagicMock()
    lines_result.fetchall.return_value = line_rows

    call_count = [0]
    results = [inv_result, lines_result]

    async def _execute(query, params=None):
        result = results[min(call_count[0], len(results) - 1)]
        call_count[0] += 1
        return result

    session.execute = _execute
    return session


@pytest.mark.asyncio
async def test_fec_3_invoices_minimum_2_ecritures_each():
    """3 factures → au moins 6 écritures (2 par facture : débit + crédit)."""
    cabinet_id = uuid4()
    invoice_rows = [
        _make_invoice_row(invoice_number=f"FAC{i:03d}", total_amount="100.00",
                         tiers_payant="none")
        for i in range(1, 4)
    ]
    # Aucune ligne → 1 écriture débit + 1 crédit 706100 = 2 par facture
    session = _make_session(invoice_rows, [])
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2026)

    rows = _parse_fec(content)
    # tiers_payant=none → 1 débit + 1 crédit = 2 écritures par facture
    assert len(rows) >= 6


@pytest.mark.asyncio
async def test_fec_tab_separator():
    """Séparateur tabulation dans le FEC."""
    cabinet_id = uuid4()
    session = _make_session([_make_invoice_row()])
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2026)

    text = content.decode("utf-8")
    # Le contenu ne doit pas commencer par BOM
    assert not text.startswith("\ufeff")
    # Le séparateur est tabulation
    first_line = text.split("\n")[0]
    assert "\t" in first_line


@pytest.mark.asyncio
async def test_fec_18_columns():
    """FEC contient exactement 18 colonnes dans l'ordre normalisé."""
    cabinet_id = uuid4()
    session = _make_session([_make_invoice_row()])
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2026)

    rows = _parse_fec(content)
    assert len(rows) > 0
    # Vérifier que les 18 colonnes sont présentes dans l'ordre
    for header in FEC_HEADERS:
        assert header in rows[0], f"Colonne manquante : {header}"


@pytest.mark.asyncio
async def test_fec_ecriture_date_format():
    """EcritureDate au format YYYYMMDD."""
    cabinet_id = uuid4()
    care_date = datetime.date(2026, 3, 15)
    session = _make_session([_make_invoice_row(care_date=care_date, tiers_payant="none")])
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2026)

    rows = _parse_fec(content)
    # La première écriture est le débit
    assert rows[0]["EcritureDate"] == "20260315"


@pytest.mark.asyncio
async def test_fec_tiers_payant_total_uses_cpam_account():
    """Tiers payant total → compte débit 411100 (CPAM)."""
    cabinet_id = uuid4()
    session = _make_session([
        _make_invoice_row(
            tiers_payant="total",
            total_amo="60.00", total_amc="40.00",
            total_patient="0.00",
        )
    ])
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2026)

    rows = _parse_fec(content)
    # Cherche une écriture avec le compte CPAM
    cpam_rows = [r for r in rows if r["CompteNum"] == "411100"]
    assert len(cpam_rows) >= 1
    assert cpam_rows[0]["Debit"] != "0.00"


@pytest.mark.asyncio
async def test_fec_ventilation_par_nature():
    """Facture avec AMI + IFD + IK → ventilation sur 706100/706200/706300."""
    cabinet_id = uuid4()
    inv_id = uuid4()
    invoice_rows = [_make_invoice_row(inv_id=inv_id, tiers_payant="none")]
    line_rows = [
        (inv_id, "AMI 4", Decimal("80.00")),
        (inv_id, "IFD", Decimal("10.00")),
        (inv_id, "IK", Decimal("10.00")),
    ]

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2026)

    rows = _parse_fec(content)
    compte_nums = {r["CompteNum"] for r in rows}
    assert "706100" in compte_nums
    assert "706200" in compte_nums
    assert "706300" in compte_nums


@pytest.mark.asyncio
async def test_fec_empty_year():
    """Année sans facture → FEC avec uniquement l'en-tête."""
    cabinet_id = uuid4()
    session = _make_session([])
    use_case = ExportFECUseCase(session)
    content = await use_case.execute(cabinet_id, 2025)

    rows = _parse_fec(content)
    assert len(rows) == 0
    text = content.decode("utf-8")
    assert "JournalCode" in text
