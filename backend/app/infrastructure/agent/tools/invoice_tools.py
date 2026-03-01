"""Outils de consultation de la facturation."""

import datetime
import logging
import time

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


async def get_invoices_pending(ctx: RunContext[AgentDeps]) -> dict:
    """Retourne la liste des factures en attente de paiement (validées ou transmises)."""
    logger.info("[AGENT TOOL] get_invoices_pending appelé")
    start = time.monotonic()
    tool_input = {}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        invoices, _total = await ctx.deps.invoice_repo.list_unpaid(
            cabinet_id=cabinet_id, offset=0, limit=50
        )
        total_amount = sum(float(inv.total_amount or 0) for inv in invoices)
        result = {
            "count": len(invoices),
            "total_amount": round(total_amount, 2),
            "invoices": [
                {
                    "id": str(inv.id),
                    "invoice_number": inv.invoice_number,
                    "patient_id": str(inv.patient_id) if inv.patient_id else None,
                    "total_amount": float(inv.total_amount or 0),
                    "status": inv.status,
                    "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
                }
                for inv in invoices[:20]  # limite affichage
            ],
        }
    except Exception as exc:
        logger.warning("Erreur get_invoices_pending", exc_info=True)
        result = {"error": f"Impossible de récupérer les factures : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_invoices_pending",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


async def get_billing_stats(
    ctx: RunContext[AgentDeps],
    month: int | None = None,
    year: int | None = None,
) -> dict:
    """Retourne les statistiques de facturation pour un mois donné.

    Args:
        month: Mois (1-12). Défaut : mois courant.
        year: Année (ex: 2026). Défaut : année courante.
    """
    logger.info("[AGENT TOOL] get_billing_stats appelé (month=%s, year=%s)", month, year)
    start = time.monotonic()
    today = datetime.date.today()
    month = month or today.month
    year = year or today.year
    tool_input = {"month": month, "year": year}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        invoices, total = await ctx.deps.invoice_repo.list_invoices(
            cabinet_id=cabinet_id,
            offset=0,
            limit=500,
        )

        # Filtrer par mois/année
        month_invoices = [
            inv for inv in invoices
            if inv.invoice_date
            and inv.invoice_date.month == month
            and inv.invoice_date.year == year
        ]

        total_amount = sum(float(inv.total_amount or 0) for inv in month_invoices)
        paid_amount = sum(
            float(inv.payment_amount or inv.total_amount or 0)
            for inv in month_invoices
            if inv.status == "paid"
        )
        count_by_status: dict[str, int] = {}
        for inv in month_invoices:
            count_by_status[inv.status] = count_by_status.get(inv.status, 0) + 1

        result = {
            "month": month,
            "year": year,
            "total_invoices": len(month_invoices),
            "total_amount": round(total_amount, 2),
            "paid_amount": round(paid_amount, 2),
            "pending_amount": round(total_amount - paid_amount, 2),
            "by_status": count_by_status,
        }
    except Exception as exc:
        logger.warning("Erreur get_billing_stats", exc_info=True)
        result = {"error": f"Erreur statistiques facturation : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_billing_stats",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result
