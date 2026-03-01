"""Outil d'interprétation d'ordonnance infirmière par l'agent IA.

Appel direct au SDK Mistral pour parser l'ordonnance et produire
un plan de soins structuré avec actes, fréquences et dates planifiées.
"""

import datetime
import json
import logging
import time
from uuid import UUID

from pydantic_ai import RunContext

from app.config import settings
from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)

_ORDONNANCE_PROMPT = """Tu es un assistant infirmier spécialisé dans la lecture d'ordonnances françaises.
Analyse l'ordonnance ci-dessous et extrais les soins infirmiers prescrits.

Retourne UNIQUEMENT un objet JSON valide avec cette structure :
{
  "actes": [
    {
      "description": "description de l'acte",
      "code_ngap": "AMI 1",
      "frequence": "1 fois par jour",
      "duree_jours": 30,
      "nb_visites": 30
    }
  ],
  "observations": "observations particulières ou contraintes de l'ordonnance",
  "date_debut_suggeree": "YYYY-MM-DD ou null"
}

Règles pour code_ngap :
- Pansement simple → AIS 1
- Pansement complexe/lourd/escarre → AMI 4
- Injection/prélèvement/glycémie → AMI 1
- Bilan/surveillance → AMI 2
- Stomie/gastrostomie → AMI 3
- Perfusion/cathéter → AIS 3
- Sonde urinaire → AIS 2
- Si incertain → AMI 1

Calcule nb_visites à partir de frequence × duree_jours.
Réponds UNIQUEMENT en JSON, sans texte avant ni après.
"""


async def interpreter_ordonnance(
    ctx: RunContext[AgentDeps],
    description_ordonnance: str,
    patient_id: str,
    date_debut: str | None = None,
    prescription_id: str | None = None,
) -> dict:
    """Interprète une ordonnance infirmière et génère un plan de soins.

    Parse l'ordonnance via Mistral pour extraire les actes, fréquences
    et durées prescrits, puis calcule les visites et montant total estimé.

    Args:
        description_ordonnance: Texte libre de l'ordonnance ou dictée.
        patient_id: UUID du patient (str).
        date_debut: Date de début des soins YYYY-MM-DD (défaut : demain).
        prescription_id: UUID de l'ordonnance liée dans le système (optionnel).
    """
    logger.info("[AGENT TOOL] interpreter_ordonnance appelé (patient=%s)", patient_id)
    start = time.monotonic()
    tool_input = {
        "patient_id": patient_id,
        "prescription_id": prescription_id,
        "ordonnance_length": len(description_ordonnance),
    }

    # Validation UUID patient
    try:
        patient_uuid = UUID(patient_id)
    except ValueError:
        result = {"error": f"UUID patient invalide : {patient_id}"}
        return await _log_return(ctx, tool_input, result, start)

    # Date de début
    if date_debut:
        try:
            date_debut_dt = datetime.date.fromisoformat(date_debut)
        except ValueError:
            date_debut_dt = datetime.date.today() + datetime.timedelta(days=1)
    else:
        date_debut_dt = datetime.date.today() + datetime.timedelta(days=1)

    # Appel Mistral pour interprétation
    gen_start = time.monotonic()
    plan_data: dict = {}
    error_msg: str | None = None

    try:
        from mistralai import Mistral  # type: ignore[import-untyped]

        client = Mistral(api_key=settings.mistral_api_key)
        response = await client.chat.complete_async(
            model="mistral-small-latest",
            messages=[
                {
                    "role": "user",
                    "content": f"{_ORDONNANCE_PROMPT}\n\n## ORDONNANCE\n{description_ordonnance}",
                }
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=1000,
        )
        raw_json = response.choices[0].message.content
        plan_data = json.loads(raw_json)
    except ImportError:
        error_msg = "SDK Mistral non disponible."
    except json.JSONDecodeError as exc:
        error_msg = f"Réponse Mistral non parseable : {exc}"
    except Exception as exc:
        logger.warning("Erreur lors de l'appel Mistral pour ordonnance", exc_info=True)
        error_msg = f"Erreur interprétation : {type(exc).__name__}: {exc}"

    gen_ms = int((time.monotonic() - gen_start) * 1000)

    if error_msg:
        result = {"error": error_msg}
        return await _log_return(ctx, tool_input, result, start)

    actes = plan_data.get("actes", [])
    if not actes:
        result = {"error": "Aucun acte infirmier détecté dans l'ordonnance."}
        return await _log_return(ctx, tool_input, result, start)

    # Enrichir avec tarifs depuis le catalogue
    total_visites = 0
    total_montant_estime = 0.0
    actes_enrichis: list[dict] = []

    for acte in actes:
        code = acte.get("code_ngap", "AMI 1")
        nb_visites = int(acte.get("nb_visites", 1))
        total_visites += nb_visites

        # Récupérer le tarif depuis le catalogue
        tarif_unitaire = 0.0
        try:
            entry = await ctx.deps.care_catalog_repo.get_by_code(code, ctx.deps.context.cabinet_id)
            if entry and hasattr(entry, "unit_price"):
                tarif_unitaire = float(entry.unit_price or 0)
        except Exception:
            pass

        montant_acte = tarif_unitaire * nb_visites
        total_montant_estime += montant_acte

        # Calculer les dates planifiées (exemple : 1 visite/jour)
        dates_planifiees: list[str] = []
        freq_str = acte.get("frequence", "1 fois par jour").lower()
        duree_jours = int(acte.get("duree_jours", nb_visites))
        freq_par_jour = 1
        if "2 fois" in freq_str or "deux fois" in freq_str:
            freq_par_jour = 2
        elif "3 fois" in freq_str or "trois fois" in freq_str:
            freq_par_jour = 3

        for day_offset in range(min(duree_jours, 30)):  # cap à 30 pour la liste
            day = date_debut_dt + datetime.timedelta(days=day_offset)
            dates_planifiees.extend([day.isoformat()] * freq_par_jour)

        actes_enrichis.append({
            "description": acte.get("description", ""),
            "code_ngap": code,
            "frequence": acte.get("frequence", ""),
            "duree_jours": duree_jours,
            "nb_visites": nb_visites,
            "tarif_unitaire": tarif_unitaire,
            "montant_estime": round(montant_acte, 2),
            "dates_planifiees_exemple": dates_planifiees[:5],  # 5 premières dates
        })

    result = {
        "patient_id": str(patient_uuid),
        "prescription_id": prescription_id,
        "date_debut": date_debut_dt.isoformat(),
        "actes": actes_enrichis,
        "observations": plan_data.get("observations", ""),
        "total_visites": total_visites,
        "montant_total_estime": round(total_montant_estime, 2),
        "generation_time_ms": gen_ms,
        "action_pending": {
            "action_type": "create_care_plan",
            "label": (
                f"Créer le plan de soins — {total_visites} RDV "
                f"({total_montant_estime:.2f} € estimés)"
            ),
            "data": {
                "patient_id": str(patient_uuid),
                "prescription_id": prescription_id,
                "date_debut": date_debut_dt.isoformat(),
                "actes": actes_enrichis,
                "nb_rdv": total_visites,
                "montant_total_estime": round(total_montant_estime, 2),
            },
        },
    }

    ctx.deps.pending_tool_results.append({
        "tool_name": "interpreter_ordonnance",
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
            ctx.deps.db, ctx.deps.context, "interpreter_ordonnance",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass
    return result
