"""Use case : comparaison de deux périodes de facturation."""

from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.invoice_dto import MonthlyStatsDTO, PeriodComparisonDTO
from app.application.use_cases.billing.get_monthly_stats import GetMonthlyStatsUseCase


def _pct_change(old: Decimal, new: Decimal) -> Decimal | None:
    """Calcule l'évolution en % entre old et new. Retourne None si old == 0."""
    if old == Decimal("0"):
        return None
    return ((new - old) / old * Decimal("100")).quantize(Decimal("0.01"))


class ComparePeriodsUseCase:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def execute(
        self, cabinet_id: UUID, period1: str, period2: str
    ) -> PeriodComparisonDTO:
        stats_uc = GetMonthlyStatsUseCase(self._session)
        stats1: MonthlyStatsDTO = await stats_uc.execute(cabinet_id, period1)
        stats2: MonthlyStatsDTO = await stats_uc.execute(cabinet_id, period2)

        return PeriodComparisonDTO(
            period1=stats1,
            period2=stats2,
            evolution_invoiced=_pct_change(stats1.total_invoiced, stats2.total_invoiced),
            evolution_paid=_pct_change(stats1.total_paid, stats2.total_paid),
            evolution_rejected=_pct_change(stats1.total_rejected, stats2.total_rejected),
        )
