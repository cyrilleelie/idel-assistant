"""Use case : statistiques de facturation par IDEL."""

import calendar
import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.invoice_dto import IdelStatsDTO


class GetStatsPerIdelUseCase:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def execute(self, cabinet_id: UUID, period: str) -> list[IdelStatsDTO]:
        """Calcule les stats par IDEL pour la période donnée (YYYY-MM)."""
        year, month = int(period[:4]), int(period[5:7])
        first_day = datetime.date(year, month, 1)
        last_day = datetime.date(year, month, calendar.monthrange(year, month)[1])

        sql = text("""
            SELECT
                i.idel_id::text,
                CONCAT(u.first_name, ' ', u.last_name) AS idel_name,
                COUNT(*) AS num_invoices,
                COALESCE(SUM(i.total_amount), 0) AS total_invoiced
            FROM invoices i
            LEFT JOIN users u ON u.id = i.idel_id
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status NOT IN ('canceled', 'draft')
            GROUP BY i.idel_id, u.first_name, u.last_name
            ORDER BY total_invoiced DESC
        """)
        result = await self._session.execute(
            sql,
            {"cabinet_id": str(cabinet_id), "date_from": first_day, "date_to": last_day},
        )
        rows = result.fetchall()

        cabinet_total = sum(Decimal(str(r[3])) for r in rows)

        stats: list[IdelStatsDTO] = []
        for r in rows:
            idel_total = Decimal(str(r[3]))
            percentage = (
                (idel_total / cabinet_total * Decimal("100")).quantize(Decimal("0.01"))
                if cabinet_total > 0
                else Decimal("0.00")
            )
            stats.append(IdelStatsDTO(
                idel_id=UUID(r[0]),
                idel_name=r[1] or r[0],
                num_invoices=int(r[2]),
                total_invoiced=idel_total,
                percentage_of_cabinet=percentage,
            ))

        return stats
