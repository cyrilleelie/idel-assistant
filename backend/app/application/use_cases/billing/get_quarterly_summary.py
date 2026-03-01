"""Use case : récapitulatif trimestriel d'activité (URSSAF / CARPIMKO)."""

import calendar
import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.invoice_dto import MonthlyBreakdownDTO, QuarterlySummaryDTO
from app.application.use_cases.billing.export_csv import classify_act_code


def _quarter_dates(year: int, quarter: int) -> tuple[datetime.date, datetime.date]:
    """Retourne (premier_jour, dernier_jour) du trimestre."""
    start_month = (quarter - 1) * 3 + 1
    end_month = start_month + 2
    first_day = datetime.date(year, start_month, 1)
    last_day = datetime.date(year, end_month, calendar.monthrange(year, end_month)[1])
    return first_day, last_day


class GetQuarterlySummaryUseCase:
    """Calcule le récapitulatif trimestriel pour une déclaration URSSAF/CARPIMKO."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def execute(self, cabinet_id: UUID, year: int, quarter: int) -> QuarterlySummaryDTO:
        if quarter not in (1, 2, 3, 4):
            raise ValueError(f"Trimestre invalide : {quarter} (attendu 1–4)")

        period_start, period_end = _quarter_dates(year, quarter)

        # --- 1. Compteurs globaux ---
        totals_sql = text("""
            SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('canceled', 'draft')) AS num_invoices,
                COUNT(*) FILTER (WHERE status = 'paid') AS num_invoices_paid,
                COUNT(DISTINCT patient_id) FILTER (WHERE status NOT IN ('canceled', 'draft')) AS num_patients,
                COUNT(DISTINCT care_date) FILTER (WHERE status NOT IN ('canceled', 'draft')) AS num_working_days
            FROM invoices
            WHERE cabinet_id = :cabinet_id
              AND care_date BETWEEN :date_from AND :date_to
        """)
        totals_result = await self._session.execute(totals_sql, {
            "cabinet_id": str(cabinet_id),
            "date_from": period_start,
            "date_to": period_end,
        })
        totals_row = totals_result.fetchone()
        num_invoices = int(totals_row[0]) if totals_row[0] else 0
        num_invoices_paid = int(totals_row[1]) if totals_row[1] else 0
        num_patients = int(totals_row[2]) if totals_row[2] else 0
        num_working_days = int(totals_row[3]) if totals_row[3] else 0

        # --- 2. Ventilation par acte (honoraires / indemnités / IK) ---
        lines_sql = text("""
            SELECT il.act_code, il.line_total
            FROM invoice_lines il
            JOIN invoices i ON i.id = il.invoice_id
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status NOT IN ('canceled', 'draft')
        """)
        lines_result = await self._session.execute(lines_sql, {
            "cabinet_id": str(cabinet_id),
            "date_from": period_start,
            "date_to": period_end,
        })
        lines_rows = lines_result.fetchall()

        total_honoraires = Decimal("0")
        total_indem = Decimal("0")
        total_ik = Decimal("0")

        for row in lines_rows:
            lt = Decimal(str(row[1])) if row[1] else Decimal("0")
            cat = classify_act_code(row[0] or "")
            if cat == "ik":
                total_ik += lt
            elif cat == "indem":
                total_indem += lt
            else:
                total_honoraires += lt

        total_brut = total_honoraires + total_indem + total_ik

        # --- 3. Détail par mois ---
        monthly_sql = text("""
            SELECT
                DATE_TRUNC('month', i.care_date)::date AS month_start,
                COUNT(*) AS num_invoices,
                il.act_code,
                COALESCE(SUM(il.line_total), 0) AS line_total
            FROM invoices i
            LEFT JOIN invoice_lines il ON il.invoice_id = i.id
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status NOT IN ('canceled', 'draft')
            GROUP BY month_start, il.act_code
            ORDER BY month_start
        """)
        monthly_result = await self._session.execute(monthly_sql, {
            "cabinet_id": str(cabinet_id),
            "date_from": period_start,
            "date_to": period_end,
        })
        monthly_rows = monthly_result.fetchall()

        # Agréger par mois
        monthly_data: dict[str, dict] = {}
        for row in monthly_rows:
            month_start = row[0]
            month_key = month_start.strftime("%Y-%m") if month_start else ""
            if not month_key:
                continue
            act_code = row[2] or ""
            lt = Decimal(str(row[3])) if row[3] else Decimal("0")
            num_inv = int(row[1]) if row[1] else 0

            if month_key not in monthly_data:
                monthly_data[month_key] = {
                    "honoraires": Decimal("0"),
                    "indem": Decimal("0"),
                    "ik": Decimal("0"),
                    "num_invoices": 0,
                }

            cat = classify_act_code(act_code)
            if cat == "ik":
                monthly_data[month_key]["ik"] += lt
            elif cat == "indem":
                monthly_data[month_key]["indem"] += lt
            else:
                monthly_data[month_key]["honoraires"] += lt

        # Compter les factures par mois séparément (une seule fois par facture)
        inv_per_month_sql = text("""
            SELECT
                DATE_TRUNC('month', care_date)::date AS month_start,
                COUNT(*) AS num_invoices
            FROM invoices
            WHERE cabinet_id = :cabinet_id
              AND care_date BETWEEN :date_from AND :date_to
              AND status NOT IN ('canceled', 'draft')
            GROUP BY month_start
            ORDER BY month_start
        """)
        inv_per_month_result = await self._session.execute(inv_per_month_sql, {
            "cabinet_id": str(cabinet_id),
            "date_from": period_start,
            "date_to": period_end,
        })
        for row in inv_per_month_result.fetchall():
            month_key = row[0].strftime("%Y-%m") if row[0] else ""
            if month_key in monthly_data:
                monthly_data[month_key]["num_invoices"] = int(row[1])

        monthly_breakdown = [
            MonthlyBreakdownDTO(
                month=mk,
                honoraires=d["honoraires"].quantize(Decimal("0.01")),
                indemnites=d["indem"].quantize(Decimal("0.01")),
                ik=d["ik"].quantize(Decimal("0.01")),
                total=(d["honoraires"] + d["indem"] + d["ik"]).quantize(Decimal("0.01")),
                num_invoices=d["num_invoices"],
            )
            for mk, d in sorted(monthly_data.items())
        ]

        # --- 4. Estimation cotisations URSSAF (~45%) ---
        taux = Decimal("0.45")
        cotisations_estimees = (total_brut * taux).quantize(Decimal("0.01")) if total_brut > 0 else None

        return QuarterlySummaryDTO(
            year=year,
            quarter=quarter,
            period_start=period_start,
            period_end=period_end,
            total_honoraires=total_honoraires.quantize(Decimal("0.01")),
            total_indemnites_deplacement=total_indem.quantize(Decimal("0.01")),
            total_ik=total_ik.quantize(Decimal("0.01")),
            total_brut=total_brut.quantize(Decimal("0.01")),
            monthly_breakdown=monthly_breakdown,
            num_invoices=num_invoices,
            num_invoices_paid=num_invoices_paid,
            num_patients=num_patients,
            num_working_days=num_working_days,
            cotisations_estimees=cotisations_estimees,
        )
