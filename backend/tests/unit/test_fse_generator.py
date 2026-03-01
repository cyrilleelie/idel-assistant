"""Tests unitaires : GenerateFseUseCase et entité Fse."""

import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.domain.entities.fse import ActeFse, Fse
from app.application.use_cases.billing.generate_fse import (
    GenerateFseInput,
    GenerateFseUseCase,
    _map_exoneration,
    _build_raw_data,
)


# --- Tests entité Fse ---


def test_fse_mark_exported():
    fse = Fse(
        cabinet_id=uuid4(),
        nir_patient="199010175000012",
        date_soins=datetime.date(2026, 1, 15),
        rpps_idel="12345678901",
        montant_total=Decimal("45.00"),
        montant_amo=Decimal("40.50"),
        montant_amc=Decimal("4.50"),
        montant_patient=Decimal("0.00"),
    )
    fse.mark_exported("csv")
    assert fse.status == "exported"
    assert fse.exported_format == "csv"
    assert fse.exported_at is not None


def test_fse_mark_exported_invalid_status():
    fse = Fse(
        cabinet_id=uuid4(),
        nir_patient="199010175000012",
        date_soins=datetime.date(2026, 1, 15),
        rpps_idel="12345678901",
        montant_total=Decimal("45.00"),
        montant_amo=Decimal("40.50"),
        montant_amc=Decimal("4.50"),
        montant_patient=Decimal("0.00"),
        status="transmitted",
    )
    with pytest.raises(ValueError, match="Impossible d'exporter"):
        fse.mark_exported("csv")


def test_fse_mark_transmitted():
    fse = Fse(
        cabinet_id=uuid4(),
        nir_patient="199010175000012",
        date_soins=datetime.date(2026, 1, 15),
        rpps_idel="12345678901",
        montant_total=Decimal("45.00"),
        montant_amo=Decimal("40.50"),
        montant_amc=Decimal("4.50"),
        montant_patient=Decimal("0.00"),
        status="exported",
    )
    fse.mark_transmitted()
    assert fse.status == "transmitted"
    assert fse.transmitted_at is not None


def test_fse_mark_rejected():
    fse = Fse(
        cabinet_id=uuid4(),
        nir_patient="199010175000012",
        date_soins=datetime.date(2026, 1, 15),
        rpps_idel="12345678901",
        montant_total=Decimal("45.00"),
        montant_amo=Decimal("40.50"),
        montant_amc=Decimal("4.50"),
        montant_patient=Decimal("0.00"),
    )
    fse.mark_rejected("Acte non pris en charge")
    assert fse.status == "rejected"
    assert fse.rejection_reason == "Acte non pris en charge"


# --- Tests utilitaires ---


def test_map_exoneration_ald():
    assert _map_exoneration("ALD", "validated") == "ALD"


def test_map_exoneration_mat():
    assert _map_exoneration("MAT", "validated") == "MAT"


def test_map_exoneration_none():
    assert _map_exoneration(None, "validated") is None


def test_map_exoneration_unknown():
    assert _map_exoneration("UNKNOWN", "validated") is None


def test_build_raw_data_structure():
    class Row:
        rpps = "12345678901"
        adeli = "123456789"
        amo_code = "750100001"
        exoneration_type = "ALD"
        total_amount = Decimal("45.00")
        total_amo = Decimal("40.50")
        total_amc = Decimal("4.50")
        total_patient = Decimal("0.00")
        care_date = datetime.date(2026, 1, 15)

    actes = [
        ActeFse(code="AMI 4", label="Acte infirmier", coefficient=Decimal("4"), quantite=Decimal("1"), montant=Decimal("15.96"))
    ]
    raw = _build_raw_data(Row(), actes)
    assert raw["version"] == "1.0"
    assert raw["type"] == "FSE"
    assert raw["idel"]["rpps"] == "12345678901"
    assert raw["soins"]["montant_total"] == "45.00"
    assert len(raw["actes"]) == 1
    assert raw["actes"][0]["code"] == "AMI 4"


# --- Tests GenerateFseUseCase ---

def _make_session_for_generate(invoice_row, lines_rows, existing_fse=None, seq_count=0):
    """Mock AsyncSession pour GenerateFseUseCase."""
    session = MagicMock()
    call_count = [0]

    # Résultats dans l'ordre des appels execute():
    # 1. SELECT invoice + patient + user + prescription
    # 2. SELECT existing fse (None = pas de FSE existante)
    # 3. SELECT invoice_lines
    # 4. SELECT COUNT FSE pour numérotation

    invoice_result = MagicMock()
    invoice_result.fetchone.return_value = invoice_row

    existing_result = MagicMock()
    existing_result.fetchone.return_value = existing_fse

    lines_result = MagicMock()
    lines_result.fetchall.return_value = lines_rows

    seq_result = MagicMock()
    seq_result.scalar.return_value = seq_count

    results = [invoice_result, existing_result, lines_result, seq_result]

    async def _execute(query, params=None):
        idx = min(call_count[0], len(results) - 1)
        r = results[idx]
        call_count[0] += 1
        return r

    session.execute = _execute

    # Mock flush (non-bloquant)
    session.add = MagicMock()
    session.flush = AsyncMock()

    return session


@pytest.mark.asyncio
async def test_generate_fse_invoice_not_found():
    """Facture introuvable → skipped."""
    session = MagicMock()

    not_found_result = MagicMock()
    not_found_result.fetchone.return_value = None

    async def _execute(q, p=None):
        return not_found_result

    session.execute = _execute

    use_case = GenerateFseUseCase(session)
    inp = GenerateFseInput(cabinet_id=uuid4(), invoice_ids=[uuid4()])
    result = await use_case.execute(inp)

    assert len(result.generated) == 0
    assert len(result.skipped) == 1
    assert result.skipped[0]["reason"] == "not_found"


@pytest.mark.asyncio
async def test_generate_fse_invalid_status():
    """Facture en statut 'draft' → skipped."""
    class Row:
        status = "draft"
        care_date = datetime.date(2026, 1, 15)
        total_amount = Decimal("45.00")
        total_amo = Decimal("40.50")
        total_amc = Decimal("4.50")
        total_patient = Decimal("0.00")
        rpps = "12345678901"
        adeli = None
        amo_code = None
        amo_center = None
        amc_code = None
        exoneration_type = None
        birth_rank = None
        prescribed_at = None

    session = _make_session_for_generate(Row(), [])
    use_case = GenerateFseUseCase(session)
    inp = GenerateFseInput(cabinet_id=uuid4(), invoice_ids=[uuid4()])
    result = await use_case.execute(inp)

    assert len(result.skipped) == 1
    assert "invalid_status" in result.skipped[0]["reason"]


@pytest.mark.asyncio
async def test_generate_fse_already_exists():
    """FSE déjà générée pour cette facture → skipped."""
    class Row:
        status = "validated"
        care_date = datetime.date(2026, 1, 15)
        total_amount = Decimal("45.00")
        total_amo = Decimal("40.50")
        total_amc = Decimal("4.50")
        total_patient = Decimal("0.00")
        rpps = "12345678901"
        adeli = None
        amo_code = None
        amo_center = None
        amc_code = None
        exoneration_type = None
        birth_rank = None
        prescribed_at = None

    class ExistingFse:
        id = uuid4()

    session = _make_session_for_generate(Row(), [], existing_fse=ExistingFse())
    use_case = GenerateFseUseCase(session)
    inp = GenerateFseInput(cabinet_id=uuid4(), invoice_ids=[uuid4()])
    result = await use_case.execute(inp)

    assert len(result.skipped) == 1
    assert result.skipped[0]["reason"] == "already_generated"


@pytest.mark.asyncio
async def test_generate_fse_lot_number_auto():
    """Pas de lot fourni → lot auto généré."""
    session = _make_session_for_generate(None, [])

    async def _execute(q, p=None):
        r = MagicMock()
        r.fetchone.return_value = None
        return r

    session.execute = _execute
    use_case = GenerateFseUseCase(session)
    inp = GenerateFseInput(cabinet_id=uuid4(), invoice_ids=[])
    result = await use_case.execute(inp)

    assert result.lot_number.startswith("LOT-")
    assert len(result.generated) == 0


@pytest.mark.asyncio
async def test_generate_fse_custom_lot():
    """Lot personnalisé conservé dans le résultat."""
    session = MagicMock()

    async def _execute(q, p=None):
        r = MagicMock()
        r.fetchone.return_value = None
        return r

    session.execute = _execute
    use_case = GenerateFseUseCase(session)
    inp = GenerateFseInput(cabinet_id=uuid4(), invoice_ids=[], lot_number="2026-T1-01")
    result = await use_case.execute(inp)

    assert result.lot_number == "2026-T1-01"
