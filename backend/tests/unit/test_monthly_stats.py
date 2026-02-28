"""Tests unitaires : GetMonthlyStatsUseCase via FakeSession."""

import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest

from app.application.use_cases.billing.get_monthly_stats import GetMonthlyStatsUseCase


def _make_fake_session(totals_row, daily_rows, acts_rows):
    """Construit un AsyncSession mock qui retourne les données fournies."""
    session = MagicMock()

    totals_result = MagicMock()
    totals_result.fetchone.return_value = totals_row

    daily_result = MagicMock()
    daily_result.fetchall.return_value = daily_rows

    acts_result = MagicMock()
    acts_result.fetchall.return_value = acts_rows

    # La session doit retourner les résultats dans l'ordre des appels execute()
    execute_returns = [totals_result, daily_result, acts_result]
    call_count = [0]

    async def _execute(query, params=None):
        result = execute_returns[call_count[0]]
        call_count[0] += 1
        return result

    session.execute = _execute
    return session


@pytest.mark.asyncio
async def test_monthly_stats_basic():
    """10 factures réparties sur 3 jours → totaux et breakdown corrects."""
    cabinet_id = uuid4()
    period = "2026-02"

    totals_row = (10, Decimal("315.00"), Decimal("100.00"), Decimal("200.00"), Decimal("15.00"))
    daily_rows = [
        (datetime.date(2026, 2, 1), Decimal("100.00"), 3),
        (datetime.date(2026, 2, 5), Decimal("115.00"), 4),
        (datetime.date(2026, 2, 10), Decimal("100.00"), 3),
    ]
    acts_rows = [
        ("AMI4", "Acte médico-infirmier 4", 8, Decimal("200.00")),
        ("BSI", "Bilan de soins infirmiers", 2, Decimal("115.00")),
    ]

    session = _make_fake_session(totals_row, daily_rows, acts_rows)
    use_case = GetMonthlyStatsUseCase(session)
    stats = await use_case.execute(cabinet_id, period)

    assert stats.period == "2026-02"
    assert stats.num_invoices == 10
    assert stats.total_invoiced == Decimal("315.00")
    assert stats.total_pending == Decimal("100.00")
    assert stats.total_paid == Decimal("200.00")
    assert stats.total_rejected == Decimal("15.00")
    assert stats.num_working_days == 3
    assert stats.avg_daily_revenue == Decimal("105.00")
    assert len(stats.daily_breakdown) == 3
    assert len(stats.top_acts) == 2
    # Top acte = AMI4 (plus grand total)
    assert stats.top_acts[0].act_code == "AMI4"


@pytest.mark.asyncio
async def test_monthly_stats_empty_month():
    """Mois vide → tout à 0, listes vides."""
    cabinet_id = uuid4()
    totals_row = (0, Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
    daily_rows = []
    acts_rows = []

    session = _make_fake_session(totals_row, daily_rows, acts_rows)
    use_case = GetMonthlyStatsUseCase(session)
    stats = await use_case.execute(cabinet_id, "2026-01")

    assert stats.total_invoiced == Decimal("0")
    assert stats.num_working_days == 0
    assert stats.avg_daily_revenue == Decimal("0.00")
    assert stats.daily_breakdown == []
    assert stats.top_acts == []


@pytest.mark.asyncio
async def test_monthly_stats_top_acts_percentage():
    """Vérifie que le % est calculé correctement."""
    cabinet_id = uuid4()
    totals_row = (4, Decimal("100.00"), Decimal("0"), Decimal("100.00"), Decimal("0"))
    daily_rows = [(datetime.date(2026, 2, 1), Decimal("100.00"), 4)]
    acts_rows = [
        ("AMI4", "AMI 4", 3, Decimal("75.00")),
        ("BSI", "BSI", 1, Decimal("25.00")),
    ]

    session = _make_fake_session(totals_row, daily_rows, acts_rows)
    use_case = GetMonthlyStatsUseCase(session)
    stats = await use_case.execute(cabinet_id, "2026-02")

    assert stats.top_acts[0].percentage == Decimal("75.00")
    assert stats.top_acts[1].percentage == Decimal("25.00")


@pytest.mark.asyncio
async def test_monthly_stats_avg_daily_correct():
    """Revenu journalier moyen = total / nb jours travaillés."""
    cabinet_id = uuid4()
    totals_row = (6, Decimal("300.00"), Decimal("0"), Decimal("300.00"), Decimal("0"))
    daily_rows = [
        (datetime.date(2026, 2, 1), Decimal("100.00"), 2),
        (datetime.date(2026, 2, 2), Decimal("100.00"), 2),
        (datetime.date(2026, 2, 3), Decimal("100.00"), 2),
    ]
    acts_rows = []

    session = _make_fake_session(totals_row, daily_rows, acts_rows)
    use_case = GetMonthlyStatsUseCase(session)
    stats = await use_case.execute(cabinet_id, "2026-02")

    assert stats.num_working_days == 3
    assert stats.avg_daily_revenue == Decimal("100.00")
