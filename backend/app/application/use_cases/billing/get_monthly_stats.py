"""Use case : statistiques mensuelles de facturation."""

import calendar
import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.invoice_dto import (
    ActStatsDTO,
    DailyBreakdownDTO,
    MonthlyStatsDTO,
)


class GetMonthlyStatsUseCase:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def execute(self, cabinet_id: UUID, period: str) -> MonthlyStatsDTO:
        """Calcule les statistiques mensuelles pour un cabinet.

        period : YYYY-MM (ex: '2026-02')
        """
        year, month = int(period[:4]), int(period[5:7])
        first_day = datetime.date(year, month, 1)
        last_day = datetime.date(year, month, calendar.monthrange(year, month)[1])

        # --- 1. Totaux par statut en une seule passe ---
        totals_sql = text("""
            SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('canceled', 'draft')) AS num_invoices,
                COALESCE(SUM(total_amount) FILTER (WHERE status NOT IN ('canceled', 'draft')), 0) AS total_invoiced,
                COALESCE(SUM(total_amount) FILTER (WHERE status IN ('validated', 'transmitted')), 0) AS total_pending,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS total_paid,
                COALESCE(SUM(total_amount) FILTER (WHERE status = 'rejected'), 0) AS total_rejected
            FROM invoices
            WHERE cabinet_id = :cabinet_id
              AND care_date BETWEEN :date_from AND :date_to
        """)
        totals_result = await self._session.execute(
            totals_sql,
            {"cabinet_id": str(cabinet_id), "date_from": first_day, "date_to": last_day},
        )
        row = totals_result.fetchone()
        num_invoices = int(row[0]) if row[0] else 0
        total_invoiced = Decimal(str(row[1]))
        total_pending = Decimal(str(row[2]))
        total_paid = Decimal(str(row[3]))
        total_rejected = Decimal(str(row[4]))

        # --- 2. Répartition journalière ---
        daily_sql = text("""
            SELECT
                care_date,
                COALESCE(SUM(total_amount), 0) AS total,
                COUNT(*) AS count
            FROM invoices
            WHERE cabinet_id = :cabinet_id
              AND care_date BETWEEN :date_from AND :date_to
              AND status NOT IN ('canceled', 'draft')
            GROUP BY care_date
            ORDER BY care_date ASC
        """)
        daily_result = await self._session.execute(
            daily_sql,
            {"cabinet_id": str(cabinet_id), "date_from": first_day, "date_to": last_day},
        )
        daily_breakdown = [
            DailyBreakdownDTO(
                date=row[0],
                total=Decimal(str(row[1])),
                count=int(row[2]),
            )
            for row in daily_result.fetchall()
        ]

        # --- 3. Top actes ---
        acts_sql = text("""
            SELECT
                il.act_code,
                il.act_label,
                COUNT(*) AS count,
                COALESCE(SUM(il.line_total), 0) AS total
            FROM invoice_lines il
            JOIN invoices i ON i.id = il.invoice_id
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status NOT IN ('canceled', 'draft')
            GROUP BY il.act_code, il.act_label
            ORDER BY total DESC
            LIMIT 10
        """)
        acts_result = await self._session.execute(
            acts_sql,
            {"cabinet_id": str(cabinet_id), "date_from": first_day, "date_to": last_day},
        )
        acts_rows = acts_result.fetchall()

        top_acts: list[ActStatsDTO] = []
        for r in acts_rows:
            act_total = Decimal(str(r[3]))
            percentage = (
                (act_total / total_invoiced * Decimal("100")).quantize(Decimal("0.01"))
                if total_invoiced > 0
                else Decimal("0.00")
            )
            top_acts.append(ActStatsDTO(
                act_code=r[0],
                act_label=r[1] or r[0],
                count=int(r[2]),
                total=act_total,
                percentage=percentage,
            ))

        # --- 4. Nombre de jours travaillés (jours avec au moins une facture non-annulée) ---
        num_working_days = len(daily_breakdown)

        # --- 5. Revenu journalier moyen ---
        avg_daily_revenue = (
            (total_invoiced / Decimal(str(num_working_days))).quantize(Decimal("0.01"))
            if num_working_days > 0
            else Decimal("0.00")
        )

        return MonthlyStatsDTO(
            period=period,
            total_invoiced=total_invoiced,
            total_pending=total_pending,
            total_paid=total_paid,
            total_rejected=total_rejected,
            num_invoices=num_invoices,
            num_working_days=num_working_days,
            avg_daily_revenue=avg_daily_revenue,
            daily_breakdown=daily_breakdown,
            top_acts=top_acts,
        )
