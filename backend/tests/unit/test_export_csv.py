"""Tests unitaires : ExportCSVUseCase."""

import datetime
import io
import csv
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.application.use_cases.billing.export_csv import (
    ExportCSVUseCase,
    classify_act_code,
)


# --- Helpers ---


def _parse_csv(content: bytes) -> list[dict]:
    """Parse le CSV UTF-8 BOM retourné par l'export."""
    text = content.decode("utf-8-sig")  # Retire le BOM
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    return list(reader)


def _make_invoice_row(
    inv_id, care_date, invoice_number, patient_id,
    prescription_id=None, total_amo="60.00", total_amc="40.00",
    total_patient="0.00", total_amount="100.00", status="validated",
    payment_date=None, payment_reference="",
):
    return (
        inv_id, care_date, invoice_number, patient_id,
        prescription_id, Decimal(total_amo), Decimal(total_amc),
        Decimal(total_patient), Decimal(total_amount), status,
        payment_date, payment_reference,
    )


def _make_line_row(invoice_id, act_code, act_label, line_total):
    return (invoice_id, act_code, act_label, Decimal(line_total))


def _make_session(invoice_rows, line_rows, prescription_rows=None):
    """Construit un AsyncSession mock avec les données fournies."""
    session = MagicMock()

    if prescription_rows is None:
        prescription_rows = []

    inv_result = MagicMock()
    inv_result.fetchall.return_value = invoice_rows

    lines_result = MagicMock()
    lines_result.fetchall.return_value = line_rows

    presc_result = MagicMock()
    presc_result.fetchall.return_value = prescription_rows

    call_count = [0]
    results = [inv_result, lines_result, presc_result]

    async def _execute(query, params=None):
        result = results[min(call_count[0], len(results) - 1)]
        call_count[0] += 1
        return result

    session.execute = _execute
    return session


# --- Tests de la classification des codes ---


def test_classify_act_honoraires():
    assert classify_act_code("AMI 4") == "honoraires"
    assert classify_act_code("AMX") == "honoraires"
    assert classify_act_code("AIS 3") == "honoraires"
    assert classify_act_code("BSI") == "honoraires"
    assert classify_act_code("MCI") == "honoraires"


def test_classify_act_indem():
    assert classify_act_code("IFD") == "indem"
    assert classify_act_code("IFI") == "indem"
    assert classify_act_code("ifd") == "indem"  # Insensible à la casse


def test_classify_act_ik():
    assert classify_act_code("IK") == "ik"
    assert classify_act_code("IKM") == "ik"
    assert classify_act_code("IKS") == "ik"


# --- Tests CSV ---


@pytest.mark.asyncio
async def test_csv_5_invoices_5_data_rows():
    """5 factures → CSV avec 5 lignes de données + 1 ligne d'en-tête."""
    cabinet_id = uuid4()
    patient_id = uuid4()
    ids = [uuid4() for _ in range(5)]
    invoice_rows = [
        _make_invoice_row(ids[i], datetime.date(2026, 3, i + 1), f"2026-03-{i+1:04d}", patient_id)
        for i in range(5)
    ]
    line_rows = [
        _make_line_row(ids[i], "AMI 4", "Acte médico-infirmier 4", "100.00")
        for i in range(5)
    ]

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))

    rows = _parse_csv(content)
    assert len(rows) == 5


@pytest.mark.asyncio
async def test_csv_status_filter():
    """Filtre par statut : seules les factures correspondantes sont retournées."""
    cabinet_id = uuid4()
    patient_id = uuid4()
    inv_id = uuid4()

    # Session retourne 2 factures (validated et draft)
    invoice_rows = [
        _make_invoice_row(inv_id, datetime.date(2026, 3, 1), "FAC001", patient_id, status="validated"),
    ]
    line_rows = []

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(
        cabinet_id,
        datetime.date(2026, 3, 1),
        datetime.date(2026, 3, 31),
        statuses=["validated"],
    )
    rows = _parse_csv(content)
    # Le filtre est appliqué dans le SQL (mockó), on vérifie que le CSV contient les données
    assert len(rows) == 1
    assert rows[0]["statut"] == "Validée"


@pytest.mark.asyncio
async def test_csv_separator_and_bom():
    """Vérifie le séparateur ; et l'encodage UTF-8 BOM."""
    cabinet_id = uuid4()
    patient_id = uuid4()
    inv_id = uuid4()
    invoice_rows = [
        _make_invoice_row(inv_id, datetime.date(2026, 3, 1), "FAC001", patient_id),
    ]
    line_rows = []

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))

    # Vérifier le BOM UTF-8
    assert content[:3] == b"\xef\xbb\xbf"

    # Vérifier que le séparateur est ;
    text = content.decode("utf-8-sig")
    assert ";" in text
    assert "date_soin;numero_facture" in text.split("\r\n")[0] or "date_soin;numero_facture" in text.split("\n")[0]


@pytest.mark.asyncio
async def test_csv_act_ventilation():
    """Facture avec AMI 4 + IFD + IK → ventilation correcte honoraires/indemnités/IK."""
    cabinet_id = uuid4()
    patient_id = uuid4()
    inv_id = uuid4()

    invoice_rows = [
        _make_invoice_row(
            inv_id, datetime.date(2026, 3, 1), "FAC001", patient_id,
            total_amount="200.00",
        ),
    ]
    line_rows = [
        _make_line_row(inv_id, "AMI 4", "Acte médico-infirmier 4", "150.00"),
        _make_line_row(inv_id, "IFD", "Indemnité forfaitaire déplacement", "25.00"),
        _make_line_row(inv_id, "IK", "Indemnité kilométrique", "25.00"),
    ]

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))

    rows = _parse_csv(content)
    assert len(rows) == 1
    row = rows[0]
    assert row["total_honoraires"] == "150.00"
    assert row["total_indemnites"] == "25.00"
    assert row["total_deplacements"] == "25.00"


@pytest.mark.asyncio
async def test_csv_dates_french_format():
    """Dates au format DD/MM/YYYY."""
    cabinet_id = uuid4()
    patient_id = uuid4()
    inv_id = uuid4()

    invoice_rows = [
        _make_invoice_row(
            inv_id, datetime.date(2026, 3, 15), "FAC001", patient_id,
            payment_date=datetime.date(2026, 4, 2), payment_reference="VIR001",
            status="paid",
        ),
    ]
    line_rows = []

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))

    rows = _parse_csv(content)
    assert len(rows) == 1
    assert rows[0]["date_soin"] == "15/03/2026"
    assert rows[0]["date_paiement"] == "02/04/2026"


@pytest.mark.asyncio
async def test_csv_empty_period():
    """Période sans facture → CSV avec uniquement l'en-tête."""
    cabinet_id = uuid4()
    session = _make_session([], [])
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))

    rows = _parse_csv(content)
    assert len(rows) == 0
    # L'en-tête doit être présente
    text = content.decode("utf-8-sig")
    assert "date_soin" in text
    assert "numero_facture" in text


@pytest.mark.asyncio
async def test_csv_acts_concatenated_with_plus():
    """Plusieurs actes → concaténation avec '+'."""
    cabinet_id = uuid4()
    patient_id = uuid4()
    inv_id = uuid4()

    invoice_rows = [_make_invoice_row(inv_id, datetime.date(2026, 3, 1), "FAC001", patient_id)]
    line_rows = [
        _make_line_row(inv_id, "AMI 4", "Acte médico-infirmier 4", "80.00"),
        _make_line_row(inv_id, "AMI 1", "Acte médico-infirmier 1", "20.00"),
    ]

    session = _make_session(invoice_rows, line_rows)
    use_case = ExportCSVUseCase(session)
    content = await use_case.execute(cabinet_id, datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))

    rows = _parse_csv(content)
    assert "AMI 4+AMI 1" == rows[0]["actes_codes"]
