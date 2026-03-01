"""Outils de consultation des rendez-vous."""

import datetime
import logging
import time

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


async def get_appointments_today(ctx: RunContext[AgentDeps]) -> dict:
    """Récupère tous les rendez-vous du jour pour le cabinet."""
    start = time.monotonic()
    tool_input = {}
    cabinet_id = ctx.deps.context.cabinet_id
    today = datetime.date.today()
    try:
        appointments, total = await ctx.deps.appointment_repo.list_by_date(
            cabinet_id=cabinet_id,
            date=today,
            skip=0,
            limit=100,
        )
        result = {
            "date": today.isoformat(),
            "total": total,
            "appointments": [
                {
                    "id": str(a.id),
                    "patient_id": str(a.patient_id),
                    "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
                    "duration_minutes": a.duration_minutes,
                    "status": a.status,
                    "care_label": a.care_label or "",
                    "address": a.address or "",
                }
                for a in appointments
            ],
        }
    except Exception as exc:
        logger.warning("Erreur get_appointments_today", exc_info=True)
        result = {"error": f"Impossible de récupérer les RDV : {type(exc).__name__}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_appointments_today",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


async def get_appointments_week(ctx: RunContext[AgentDeps], start_date: str | None = None) -> dict:
    """Récupère les rendez-vous pour la semaine courante ou à partir d'une date donnée.

    Args:
        start_date: Date de début au format YYYY-MM-DD (optionnel, défaut = lundi de la semaine courante).
    """
    start = time.monotonic()
    tool_input = {"start_date": start_date}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        if start_date:
            week_start = datetime.date.fromisoformat(start_date)
        else:
            today = datetime.date.today()
            week_start = today - datetime.timedelta(days=today.weekday())

        week_end = week_start + datetime.timedelta(days=6)

        # Récupère les RDV sur 7 jours
        all_appointments = []
        total = 0
        for delta in range(7):
            day = week_start + datetime.timedelta(days=delta)
            apts, cnt = await ctx.deps.appointment_repo.list_by_date(
                cabinet_id=cabinet_id,
                date=day,
                skip=0,
                limit=50,
            )
            all_appointments.extend(apts)
            total += cnt

        result = {
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "total": total,
            "appointments": [
                {
                    "id": str(a.id),
                    "patient_id": str(a.patient_id),
                    "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
                    "duration_minutes": a.duration_minutes,
                    "status": a.status,
                    "care_label": a.care_label or "",
                }
                for a in all_appointments
            ],
        }
    except ValueError:
        result = {"error": "Format de date invalide (YYYY-MM-DD attendu)."}
    except Exception as exc:
        logger.warning("Erreur get_appointments_week", exc_info=True)
        result = {"error": f"Erreur : {type(exc).__name__}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_appointments_week",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result
