"""Outil de structuration des transmissions infirmières (DAR) par l'agent IA.

Appel direct au SDK Mistral pour produire un JSON structuré D/A/R.
"""

import json
import logging
import time
from uuid import UUID

from pydantic_ai import RunContext

from app.config import settings
from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)

_STRUCTURATION_PROMPT = """Tu es un assistant infirmier spécialisé dans les transmissions soignantes.
Analyse la dictée ci-dessous et structure-la au format DAR (Données / Actions / Résultats).

Retourne UNIQUEMENT un objet JSON valide avec cette structure exacte :
{
  "D": "Données objectives : signes observés, constantes, état du patient",
  "A": "Actions réalisées : soins effectués, actes techniques",
  "R": "Résultats : évolution, réponse du patient, suite à donner",
  "constantes": {"PA": "...", "FC": "...", "T": "...", "SpO2": "...", "glycemie": "..."},
  "alertes": ["alerte 1", "alerte 2"],
  "resume_court": "Résumé en 1 phrase"
}

Règles :
- Ne garde que les constantes mentionnées dans la dictée (laisse vide les autres)
- Les alertes sont des signes d'alarme cliniques qui nécessitent une attention particulière
- Si aucune alerte : liste vide []
- Réponds UNIQUEMENT en JSON, sans texte avant ni après
"""


async def structurer_transmission(
    ctx: RunContext[AgentDeps],
    dictee_libre: str,
    patient_id: str,
    appointment_id: str | None = None,
) -> dict:
    """Structure une dictée libre en transmission DAR structurée.

    Appelle Mistral pour analyser la dictée et produire un JSON D/A/R.
    Si la structuration réussit, propose une action d'enregistrement de la transmission.

    Args:
        dictee_libre: Dictée vocale ou texte libre décrivant le passage infirmier.
        patient_id: UUID du patient (str).
        appointment_id: UUID du RDV associé (optionnel, str).
    """
    logger.info("[AGENT TOOL] structurer_transmission appelé (patient=%s)", patient_id)
    start = time.monotonic()
    tool_input = {
        "patient_id": patient_id,
        "appointment_id": appointment_id,
        "dictee_length": len(dictee_libre),
    }

    # Validation UUID
    try:
        patient_uuid = UUID(patient_id)
    except ValueError:
        result = {"error": f"UUID patient invalide : {patient_id}"}
        return await _log_return(ctx, tool_input, result, start)

    apt_uuid: UUID | None = None
    if appointment_id:
        try:
            apt_uuid = UUID(appointment_id)
        except ValueError:
            pass

    # Appel Mistral pour structuration DAR
    gen_start = time.monotonic()
    dar: dict = {}
    error_msg: str | None = None

    try:
        from mistralai import Mistral  # type: ignore[import-untyped]

        client = Mistral(api_key=settings.mistral_api_key)
        response = await client.chat.complete_async(
            model="mistral-small-latest",
            messages=[
                {
                    "role": "user",
                    "content": f"{_STRUCTURATION_PROMPT}\n\n## DICTÉE\n{dictee_libre}",
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=800,
        )
        raw_json = response.choices[0].message.content
        dar = json.loads(raw_json)
    except ImportError:
        error_msg = "SDK Mistral non disponible."
    except json.JSONDecodeError as exc:
        error_msg = f"Réponse Mistral non parseable : {exc}"
    except Exception as exc:
        logger.warning("Erreur lors de l'appel Mistral pour DAR", exc_info=True)
        error_msg = f"Erreur structuration : {type(exc).__name__}: {exc}"

    gen_ms = int((time.monotonic() - gen_start) * 1000)

    if error_msg:
        result = {"error": error_msg}
        return await _log_return(ctx, tool_input, result, start)

    # Normalisation du DAR
    dar_normalized = {
        "D": dar.get("D", ""),
        "A": dar.get("A", ""),
        "R": dar.get("R", ""),
        "constantes": dar.get("constantes", {}),
        "alertes": dar.get("alertes", []),
        "resume_court": dar.get("resume_court", ""),
    }

    alertes = [a for a in dar_normalized["alertes"] if a]
    has_alerts = len(alertes) > 0

    result = {
        "patient_id": str(patient_uuid),
        "appointment_id": str(apt_uuid) if apt_uuid else None,
        "dar": dar_normalized,
        "resume_court": dar_normalized["resume_court"],
        "alertes": alertes,
        "has_alerts": has_alerts,
        "generation_time_ms": gen_ms,
        "action_pending": {
            "action_type": "save_transmission",
            "label": f"Enregistrer la transmission : {dar_normalized['resume_court'][:60]}",
            "data": {
                "patient_id": str(patient_uuid),
                "appointment_id": str(apt_uuid) if apt_uuid else None,
                "transcription": dictee_libre,
                "structured_data": dar_normalized,
                "generation_time_ms": gen_ms,
            },
        },
    }

    # Ajouter aux pending_tool_results
    ctx.deps.pending_tool_results.append({
        "tool_name": "structurer_transmission",
        "data": result,
    })

    return await _log_return(ctx, tool_input, result, start)


async def _log_return(
    ctx: RunContext[AgentDeps],
    tool_input: dict,
    result: dict,
    start: float,
) -> dict:
    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "structurer_transmission",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass
    return result
