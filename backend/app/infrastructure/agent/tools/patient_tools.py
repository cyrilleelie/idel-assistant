"""Outils de consultation des patients."""

import logging
import time

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


async def search_patients(ctx: RunContext[AgentDeps], query: str) -> dict:
    """Recherche des patients par nom ou prénom dans le cabinet.

    Args:
        query: Texte de recherche (nom ou prénom du patient).
    """
    start = time.monotonic()
    tool_input = {"query": query}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        patients, total = await ctx.deps.patient_repo.list_by_cabinet(
            cabinet_id=cabinet_id,
            status="active",
            search=query,
            sector_id=None,
            skip=0,
            limit=10,
        )
        result = {
            "total": total,
            "patients": [
                {
                    "id": str(p.id),
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "phone": p.phone or "",
                    "address": p.address or "",
                    "active": p.status == "active",
                }
                for p in patients
            ],
        }
    except Exception as exc:
        logger.warning("Erreur search_patients", exc_info=True)
        result = {"error": f"Erreur lors de la recherche patients : {type(exc).__name__}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "search_patients",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result


async def get_patient_details(ctx: RunContext[AgentDeps], patient_id: str) -> dict:
    """Récupère les détails d'un patient par son identifiant.

    Args:
        patient_id: UUID du patient.
    """
    start = time.monotonic()
    tool_input = {"patient_id": patient_id}
    cabinet_id = ctx.deps.context.cabinet_id
    try:
        from uuid import UUID
        pid = UUID(patient_id)
        patient = await ctx.deps.patient_repo.get_by_id(pid)
        if patient is None or patient.cabinet_id != cabinet_id:
            result = {"found": False, "message": "Patient introuvable."}
        else:
            result = {
                "found": True,
                "id": str(patient.id),
                "first_name": patient.first_name,
                "last_name": patient.last_name,
                "phone": patient.phone or "",
                "address": patient.address or "",
                "notes": patient.notes or "",
                "active": patient.status == "active",
                "doctor_name": patient.doctor_name or "",
                # Ne jamais exposer SSN/NIR
            }
    except ValueError:
        result = {"error": "Identifiant patient invalide (UUID attendu)."}
    except Exception as exc:
        logger.warning("Erreur get_patient_details", exc_info=True)
        result = {"error": f"Erreur : {type(exc).__name__}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_patient_details",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result
