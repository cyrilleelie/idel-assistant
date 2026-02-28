"""Tests unitaires : ComparePeriodsUseCase."""

from decimal import Decimal
from uuid import uuid4

import pytest

from app.application.dtos.invoice_dto import MonthlyStatsDTO
from app.application.use_cases.billing.compare_periods import ComparePeriodsUseCase, _pct_change


# --- Tests de la fonction utilitaire ---


def test_pct_change_positive():
    result = _pct_change(Decimal("100"), Decimal("120"))
    assert result == Decimal("20.00")


def test_pct_change_negative():
    result = _pct_change(Decimal("100"), Decimal("80"))
    assert result == Decimal("-20.00")


def test_pct_change_zero_old():
    """Si l'ancienne valeur est 0, retourner None (division par zéro impossible)."""
    result = _pct_change(Decimal("0"), Decimal("50"))
    assert result is None


def test_pct_change_zero_to_zero():
    result = _pct_change(Decimal("0"), Decimal("0"))
    assert result is None


# --- Tests du use case avec mock ---


def _make_stats(
    period: str,
    total_invoiced: float = 0,
    total_paid: float = 0,
    total_rejected: float = 0,
) -> MonthlyStatsDTO:
    return MonthlyStatsDTO(
        period=period,
        total_invoiced=Decimal(str(total_invoiced)),
        total_pending=Decimal("0"),
        total_paid=Decimal(str(total_paid)),
        total_rejected=Decimal(str(total_rejected)),
        num_invoices=0,
        num_working_days=0,
        avg_daily_revenue=Decimal("0"),
        daily_breakdown=[],
        top_acts=[],
    )


@pytest.mark.asyncio
async def test_compare_periods_positive_evolution(monkeypatch):
    """Deux mois avec données → évolutions calculées correctement."""
    from app.application.use_cases.billing import get_monthly_stats as stats_module

    calls = []

    async def fake_execute(self, cabinet_id, period):
        calls.append(period)
        if period == "2026-01":
            return _make_stats("2026-01", total_invoiced=1000, total_paid=800, total_rejected=50)
        return _make_stats("2026-02", total_invoiced=1200, total_paid=900, total_rejected=25)

    monkeypatch.setattr(stats_module.GetMonthlyStatsUseCase, "execute", fake_execute)

    from unittest.mock import MagicMock
    session = MagicMock()
    use_case = ComparePeriodsUseCase(session)
    result = await use_case.execute(uuid4(), "2026-01", "2026-02")

    assert result.evolution_invoiced == Decimal("20.00")  # +20%
    assert result.evolution_paid == Decimal("12.50")      # +12.5%
    assert result.evolution_rejected == Decimal("-50.00")  # -50%


@pytest.mark.asyncio
async def test_compare_period2_empty_gives_minus_100(monkeypatch):
    """Si période 2 est vide → -100% pour toutes les métriques non nulles."""
    from app.application.use_cases.billing import get_monthly_stats as stats_module

    async def fake_execute(self, cabinet_id, period):
        if period == "2026-01":
            return _make_stats("2026-01", total_invoiced=500, total_paid=400, total_rejected=20)
        return _make_stats("2026-02", total_invoiced=0, total_paid=0, total_rejected=0)

    monkeypatch.setattr(stats_module.GetMonthlyStatsUseCase, "execute", fake_execute)

    from unittest.mock import MagicMock
    session = MagicMock()
    use_case = ComparePeriodsUseCase(session)
    result = await use_case.execute(uuid4(), "2026-01", "2026-02")

    assert result.evolution_invoiced == Decimal("-100.00")
    assert result.evolution_paid == Decimal("-100.00")
    assert result.evolution_rejected == Decimal("-100.00")
