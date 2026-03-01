"""Outils de consultation et de planification des rendez-vous."""

import datetime
import logging
import time
from uuid import UUID

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


def _proximite_score(zip1: str | None, zip2: str | None) -> float:
    """Score de proximité géographique (0.0 → loin, 1.0 → même code postal).

    Heuristique simple sur code postal : préfixe commun.
    - Même code postal → 1.0
    - Même département (2 premiers chiffres) → 0.6
    - Même région approximative (1er chiffre) → 0.3
    - Sinon → 0.0
    """
    if not zip1 or not zip2:
        return 0.0
    z1 = zip1.strip().replace(" ", "")
    z2 = zip2.strip().replace(" ", "")
    if z1 == z2:
        return 1.0
    if len(z1) >= 2 and len(z2) >= 2 and z1[:2] == z2[:2]:
        return 0.6
    if z1[:1] == z2[:1]:
        return 0.3
    return 0.0


def _label_proximite(score: float) -> str:
    if score >= 1.0:
        return "Même secteur"
    if score >= 0.6:
        return "Même département"
    if score >= 0.3:
        return "Région proche"
    return "Secteur éloigné"


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
                    "care_labels": a.care_labels,
                    "care_type": a.care_type,
                    "location_type": a.location_type,
                }
                for a in appointments
            ],
        }
    except Exception as exc:
        logger.warning("Erreur get_appointments_today", exc_info=True)
        result = {"error": f"Impossible de récupérer les RDV : {type(exc).__name__}: {exc}"}

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
                    "care_labels": a.care_labels,
                    "care_type": a.care_type,
                }
                for a in all_appointments
            ],
        }
    except ValueError:
        result = {"error": "Format de date invalide (YYYY-MM-DD attendu)."}
    except Exception as exc:
        logger.warning("Erreur get_appointments_week", exc_info=True)
        result = {"error": f"Erreur : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_appointments_week",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


# ── Outil actif : créneaux géo-optimisés (Iter B) ────────────────────────────


async def proposer_creneaux_geooptimises(
    ctx: RunContext[AgentDeps],
    patient_id: str | None = None,
    care_type: str = "",
    duree_minutes: int = 30,
    contrainte_horaire: str | None = None,
) -> dict:
    """Propose les meilleurs créneaux disponibles avec scoring géographique.

    Analyse les 7 prochains jours pour trouver les créneaux libres, puis
    les score selon la proximité géographique du patient par rapport aux
    autres patients déjà planifiés.

    Args:
        patient_id: UUID du nouveau patient (pour calcul proximité). Optionnel.
        care_type: Type de soin (pour info, ex: "pansement", "injection").
        duree_minutes: Durée estimée du soin en minutes (défaut 30).
        contrainte_horaire: Contrainte horaire libre (ex: "matin", "avant 12h"). Optionnel.
    """
    logger.info("[AGENT TOOL] proposer_creneaux_geooptimises appelé (patient=%s)", patient_id)
    start = time.monotonic()
    tool_input = {
        "patient_id": patient_id,
        "care_type": care_type,
        "duree_minutes": duree_minutes,
        "contrainte_horaire": contrainte_horaire,
    }
    cabinet_id = ctx.deps.context.cabinet_id

    # Récupérer le code postal du nouveau patient (pour proximité)
    patient_zip: str | None = None
    if patient_id:
        try:
            patient_uuid = UUID(patient_id)
            patient = await ctx.deps.patient_repo.get_by_id(patient_uuid)
            if patient and hasattr(patient, "zip_code"):
                patient_zip = patient.zip_code
            elif patient and hasattr(patient, "address") and patient.address:
                # Tenter d'extraire le code postal de l'adresse (5 derniers chiffres)
                import re
                m = re.search(r"\b(\d{5})\b", patient.address or "")
                if m:
                    patient_zip = m.group(1)
        except Exception:
            pass

    try:
        today = datetime.date.today()
        scored_slots: list[dict] = []

        for delta in range(7):
            target_date = today + datetime.timedelta(days=delta + 1)  # commence demain

            existing, _ = await ctx.deps.appointment_repo.list_by_date(
                cabinet_id=cabinet_id,
                date=target_date,
                skip=0,
                limit=100,
            )

            # Calculer codes postaux des patients déjà planifiés ce jour
            day_zips: list[str] = []
            for a in existing:
                try:
                    p = await ctx.deps.patient_repo.get_by_id(a.patient_id)
                    if p:
                        z: str | None = getattr(p, "zip_code", None)
                        if not z and getattr(p, "address", None):
                            import re
                            m = re.search(r"\b(\d{5})\b", p.address)
                            if m:
                                z = m.group(1)
                        if z:
                            day_zips.append(z)
                except Exception:
                    pass

            # Score de proximité moyen du jour
            day_proximity = 0.0
            if day_zips and patient_zip:
                day_proximity = sum(_proximite_score(patient_zip, z) for z in day_zips) / len(day_zips)

            # Générer les créneaux libres
            base_time = datetime.datetime.combine(target_date, datetime.time(8, 0))
            end_limit_hour = 18

            while base_time.hour < end_limit_hour:
                end_time = base_time + datetime.timedelta(minutes=duree_minutes)
                conflict = any(
                    a.scheduled_at
                    and a.scheduled_at.replace(tzinfo=None) < end_time
                    and (
                        a.scheduled_at + datetime.timedelta(minutes=a.duration_minutes or 30)
                    ).replace(tzinfo=None) > base_time
                    for a in existing
                )
                if not conflict:
                    # Score composite : proximité (60%) + préférence horaire (40%)
                    hour_score = 1.0 if 8 <= base_time.hour <= 12 else 0.7  # matin préféré
                    total_score = 0.6 * day_proximity + 0.4 * hour_score

                    scored_slots.append({
                        "date": target_date.isoformat(),
                        "start": base_time.strftime("%H:%M"),
                        "end": end_time.strftime("%H:%M"),
                        "proximity_score": round(day_proximity, 2),
                        "proximity_label": _label_proximite(day_proximity),
                        "total_score": round(total_score, 2),
                        "existing_appointments_day": len(existing),
                    })
                base_time += datetime.timedelta(minutes=30)

        # Trier par score total décroissant, garder les 3 meilleurs
        scored_slots.sort(key=lambda s: s["total_score"], reverse=True)
        best_slots = scored_slots[:3]

        # Marquer le premier comme recommandé
        if best_slots:
            best_slots[0]["recommended"] = True

        result = {
            "patient_id": patient_id,
            "care_type": care_type,
            "duree_minutes": duree_minutes,
            "best_slots": best_slots,
            "action_pending": {
                "action_type": "create_appointment",
                "label": f"Créer le RDV — {care_type or 'soin'} ({duree_minutes} min)",
                "data": {
                    "patient_id": patient_id,
                    "care_type": care_type,
                    "duree_minutes": duree_minutes,
                    "slot": best_slots[0] if best_slots else {},
                },
            } if best_slots else None,
        }

    except Exception as exc:
        logger.warning("Erreur proposer_creneaux_geooptimises", exc_info=True)
        result = {"error": f"Erreur suggestions créneaux : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "proposer_creneaux_geooptimises",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    if "best_slots" in result and result.get("best_slots"):
        ctx.deps.pending_tool_results.append({
            "tool_name": "proposer_creneaux_geooptimises",
            "data": result,
        })

    return result
