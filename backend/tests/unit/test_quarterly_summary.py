"""Tests unitaires : GetQuarterlySummaryUseCase."""

import datetime
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from app.application.use_cases.billing.get_quarterly_summary import (
    GetQuarterlySummaryUseCase,
    _quarter_dates,
)


def _make_session(totals_row, lines_rows, monthly_rows, inv_per_month_rows):
    """Construit un AsyncSession mock qui retourne les données dans l'ordre des appels."""
    session = MagicMock()

    totals_result = MagicMock()
    totals_result.fetchone.return_value = totals_row

    lines_result = MagicMock()
    lines_result.fetchall.return_value = lines_rows

    monthly_result = MagicMock()
    monthly_result.fetchall.return_value = monthly_rows

    inv_per_month_result = MagicMock()
    inv_per_month_result.fetchall.return_value = inv_per_month_rows

    results = [totals_result, lines_result, monthly_result, inv_per_month_result]
    call_count = [0]

    async def _execute(query, params=None):
        result = results[min(call_count[0], len(results) - 1)]
        call_count[0] += 1
        return result

    session.execute = _execute
    return session


# --- Tests utilitaires ---


def test_quarter_dates_q1():
    start, end = _quarter_dates(2026, 1)
    assert start == datetime.date(2026, 1, 1)
    assert end == datetime.date(2026, 3, 31)


def test_quarter_dates_q2():
    start, end = _quarter_dates(2026, 2)
    assert start == datetime.date(2026, 4, 1)
    assert end == datetime.date(2026, 6, 30)


def test_quarter_dates_q4():
    start, end = _quarter_dates(2026, 4)
    assert start == datetime.date(2026, 10, 1)
    assert end == datetime.date(2026, 12, 31)


# --- Tests du use case ---


@pytest.mark.asyncio
async def test_quarterly_summary_basic():
    """Q1 2026 avec données → ventilation correcte."""
    cabinet_id = uuid4()

    totals_row = (150, 142, 32, 62)  # num_invoices, paid, patients, working_days
    lines_rows = [
        ("AMI 4", Decimal("10230.00")),
        ("IFD", Decimal("1845.00")),
        ("IK", Decimal("985.50")),
    ]
    monthly_rows = [
        (datetime.date(2026, 1, 1), 1, "AMI 4", Decimal("4120.00")),
        (datetime.date(2026, 2, 1), 1, "AMI 4", Decimal("4520.00")),
        (datetime.date(2026, 3, 1), 1, "AMI 4", Decimal("3590.50")),
        (datetime.date(2026, 1, 1), 1, "IFD", Decimal("615.00")),
        (datetime.date(2026, 2, 1), 1, "IFD", Decimal("615.00")),
        (datetime.date(2026, 3, 1), 1, "IFD", Decimal("615.00")),
        (datetime.date(2026, 1, 1), 1, "IK", Decimal("328.50")),
        (datetime.date(2026, 2, 1), 1, "IK", Decimal("328.50")),
        (datetime.date(2026, 3, 1), 1, "IK", Decimal("328.50")),
    ]
    inv_per_month_rows = [
        (datetime.date(2026, 1, 1), 48),
        (datetime.date(2026, 2, 1), 52),
        (datetime.date(2026, 3, 1), 50),
    ]

    session = _make_session(totals_row, lines_rows, monthly_rows, inv_per_month_rows)
    use_case = GetQuarterlySummaryUseCase(session)
    result = await use_case.execute(cabinet_id, 2026, 1)

    assert result.year == 2026
    assert result.quarter == 1
    assert result.period_start == datetime.date(2026, 1, 1)
    assert result.period_end == datetime.date(2026, 3, 31)

    assert result.total_honoraires == Decimal("10230.00")
    assert result.total_indemnites_deplacement == Decimal("1845.00")
    assert result.total_ik == Decimal("985.50")
    assert result.total_brut == Decimal("13060.50")

    assert result.num_invoices == 150
    assert result.num_invoices_paid == 142
    assert result.num_patients == 32
    assert result.num_working_days == 62


@pytest.mark.asyncio
async def test_quarterly_summary_monthly_breakdown():
    """Détail mensuel : 3 mois avec données différentes."""
    cabinet_id = uuid4()

    totals_row = (6, 6, 5, 3)
    lines_rows = [("AMI 4", Decimal("300.00"))]
    monthly_rows = [
        (datetime.date(2026, 1, 1), 1, "AMI 4", Decimal("100.00")),
        (datetime.date(2026, 2, 1), 1, "AMI 4", Decimal("100.00")),
        (datetime.date(2026, 3, 1), 1, "AMI 4", Decimal("100.00")),
    ]
    inv_per_month_rows = [
        (datetime.date(2026, 1, 1), 2),
        (datetime.date(2026, 2, 1), 2),
        (datetime.date(2026, 3, 1), 2),
    ]

    session = _make_session(totals_row, lines_rows, monthly_rows, inv_per_month_rows)
    use_case = GetQuarterlySummaryUseCase(session)
    result = await use_case.execute(cabinet_id, 2026, 1)

    assert len(result.monthly_breakdown) == 3
    assert result.monthly_breakdown[0].month == "2026-01"
    assert result.monthly_breakdown[1].month == "2026-02"
    assert result.monthly_breakdown[2].month == "2026-03"
    assert result.monthly_breakdown[0].num_invoices == 2


@pytest.mark.asyncio
async def test_quarterly_summary_empty_quarter():
    """Trimestre sans facture → tout à 0, pas d'erreur."""
    cabinet_id = uuid4()

    totals_row = (0, 0, 0, 0)
    lines_rows = []
    monthly_rows = []
    inv_per_month_rows = []

    session = _make_session(totals_row, lines_rows, monthly_rows, inv_per_month_rows)
    use_case = GetQuarterlySummaryUseCase(session)
    result = await use_case.execute(cabinet_id, 2026, 2)

    assert result.total_honoraires == Decimal("0.00")
    assert result.total_indemnites_deplacement == Decimal("0.00")
    assert result.total_ik == Decimal("0.00")
    assert result.total_brut == Decimal("0.00")
    assert result.num_invoices == 0
    assert result.monthly_breakdown == []
    assert result.cotisations_estimees is None


@pytest.mark.asyncio
async def test_quarterly_summary_cotisations_estimees():
    """Estimation des cotisations à ~45%."""
    cabinet_id = uuid4()

    totals_row = (10, 10, 5, 10)
    lines_rows = [("AMI 4", Decimal("1000.00"))]
    monthly_rows = [(datetime.date(2026, 1, 1), 1, "AMI 4", Decimal("1000.00"))]
    inv_per_month_rows = [(datetime.date(2026, 1, 1), 10)]

    session = _make_session(totals_row, lines_rows, monthly_rows, inv_per_month_rows)
    use_case = GetQuarterlySummaryUseCase(session)
    result = await use_case.execute(cabinet_id, 2026, 1)

    assert result.total_brut == Decimal("1000.00")
    assert result.cotisations_estimees == Decimal("450.00")  # 45% de 1000


@pytest.mark.asyncio
async def test_quarterly_summary_invalid_quarter():
    """Trimestre invalide → ValueError."""
    cabinet_id = uuid4()
    session = _make_session((0, 0, 0, 0), [], [], [])
    use_case = GetQuarterlySummaryUseCase(session)

    with pytest.raises(ValueError, match="Trimestre invalide"):
        await use_case.execute(cabinet_id, 2026, 5)


@pytest.mark.asyncio
async def test_quarterly_summary_ventilation_indem_ik():
    """Ventilation indemnités (IFD/IFI) et IK distincte des honoraires."""
    cabinet_id = uuid4()

    totals_row = (3, 3, 2, 3)
    lines_rows = [
        ("AMI 4", Decimal("100.00")),
        ("IFD", Decimal("25.00")),
        ("IFI", Decimal("15.00")),
        ("IK", Decimal("20.00")),
        ("IKM", Decimal("10.00")),
    ]
    monthly_rows = []
    inv_per_month_rows = []

    session = _make_session(totals_row, lines_rows, monthly_rows, inv_per_month_rows)
    use_case = GetQuarterlySummaryUseCase(session)
    result = await use_case.execute(cabinet_id, 2026, 1)

    assert result.total_honoraires == Decimal("100.00")
    assert result.total_indemnites_deplacement == Decimal("40.00")  # IFD + IFI
    assert result.total_ik == Decimal("30.00")  # IK + IKM
    assert result.total_brut == Decimal("170.00")
