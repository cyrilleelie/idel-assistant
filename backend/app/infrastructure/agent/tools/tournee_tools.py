"""Outils de consultation de la tournée et des créneaux."""

import datetime
import logging
import time

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


async def get_tournee_today(ctx: RunContext[AgentDeps]) -> dict:
    """Récupère la tournée du jour pour l'utilisateur connecté."""
    start = time.monotonic()
    tool_input = {}
    cabinet_id = ctx.deps.context.cabinet_id
    user_id = ctx.deps.context.user_id
    today = datetime.date.today()
    try:
        tournee = await ctx.deps.tournee_repo.get_by_date(
            cabinet_id=cabinet_id,
            idel_id=user_id,
            date=today,
        )
        if tournee is None:
            # Pas de tournée générée — retourner les RDV du jour à la place
            appointments, total = await ctx.deps.appointment_repo.list_by_date(
                cabinet_id=cabinet_id,
                date=today,
                skip=0,
                limit=100,
            )
            result = {
                "date": today.isoformat(),
                "tournee_generated": False,
                "appointments_count": total,
                "message": "Aucune tournée générée pour aujourd'hui. Rendez-vous en attente.",
                "appointments": [
                    {
                        "id": str(a.id),
                        "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
                        "patient_id": str(a.patient_id),
                        "status": a.status,
                        "care_labels": a.care_labels,
                        "care_type": a.care_type,
                    }
                    for a in appointments
                ],
            }
        else:
            stops = await ctx.deps.tournee_repo.get_stops(tournee.id)
            result = {
                "date": today.isoformat(),
                "tournee_generated": True,
                "tournee_id": str(tournee.id),
                "total_stops": len(stops),
                "estimated_distance_km": float(tournee.total_distance_km or 0),
                "estimated_duration_min": tournee.total_duration_minutes or 0,
                "stops": [
                    {
                        "order": s.stop_order,
                        "appointment_id": str(s.appointment_id),
                        "estimated_arrival": s.estimated_arrival.isoformat() if s.estimated_arrival else None,
                        "status": s.status,
                        "distance_from_previous_km": s.distance_from_previous_km,
                    }
                    for s in stops
                ],
            }
    except Exception as exc:
        logger.warning("Erreur get_tournee_today", exc_info=True)
        result = {"error": f"Impossible de récupérer la tournée : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_tournee_today",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


async def get_slot_suggestions(
    ctx: RunContext[AgentDeps],
    duration_minutes: int = 30,
    preferred_date: str | None = None,
) -> dict:
    """Propose des créneaux disponibles pour un nouveau rendez-vous.

    Args:
        duration_minutes: Durée estimée du soin en minutes (défaut 30).
        preferred_date: Date préférée au format YYYY-MM-DD (défaut demain).
    """
    start = time.monotonic()
    tool_input = {"duration_minutes": duration_minutes, "preferred_date": preferred_date}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        if preferred_date:
            target_date = datetime.date.fromisoformat(preferred_date)
        else:
            target_date = datetime.date.today() + datetime.timedelta(days=1)

        # Récupérer les RDV existants pour éviter les conflits
        existing, _ = await ctx.deps.appointment_repo.list_by_date(
            cabinet_id=cabinet_id,
            date=target_date,
            skip=0,
            limit=100,
        )

        # Créneaux standard (8h-18h par tranches de 30 min)
        slots = []
        base_time = datetime.datetime.combine(target_date, datetime.time(8, 0))
        while base_time.hour < 18:
            end_time = base_time + datetime.timedelta(minutes=duration_minutes)
            # Vérifier conflit
            conflict = any(
                a.scheduled_at
                and a.scheduled_at.replace(tzinfo=None) < end_time
                and (a.scheduled_at + datetime.timedelta(minutes=a.duration_minutes or 30)).replace(tzinfo=None) > base_time
                for a in existing
            )
            if not conflict:
                slots.append({
                    "start": base_time.strftime("%H:%M"),
                    "end": end_time.strftime("%H:%M"),
                    "date": target_date.isoformat(),
                })
            base_time += datetime.timedelta(minutes=30)

        result = {
            "date": target_date.isoformat(),
            "duration_minutes": duration_minutes,
            "available_slots": slots[:5],  # retourner les 5 premiers
            "existing_appointments": len(existing),
        }
    except ValueError:
        result = {"error": "Format de date invalide (YYYY-MM-DD attendu)."}
    except Exception as exc:
        logger.warning("Erreur get_slot_suggestions", exc_info=True)
        result = {"error": f"Erreur suggestions créneaux : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_slot_suggestions",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result
