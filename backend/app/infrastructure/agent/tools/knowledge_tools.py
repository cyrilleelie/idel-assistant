"""Outils de consultation du référentiel NGAP."""

import time
import logging

from pydantic_ai import RunContext

from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentDeps

logger = logging.getLogger(__name__)


async def get_ngap_act(ctx: RunContext[AgentDeps], code: str) -> dict:
    """Recherche un acte NGAP par son code (ex: AMI, AIS, BSI, IPA).

    Args:
        code: Code de l'acte NGAP à rechercher.
    """
    start = time.monotonic()
    tool_input = {"code": code}
    try:
        act = await ctx.deps.care_catalog_repo.get_by_code(code.upper())
        if act is None:
            result = {"found": False, "message": f"Code NGAP '{code}' introuvable dans le référentiel."}
        else:
            result = {
                "found": True,
                "code": act.code,
                "label": act.label,
                "base_price": float(act.base_price),
                "coefficient": float(act.coefficient) if act.coefficient else None,
                "category": act.category,
                "description": act.description or "",
            }
    except Exception as exc:
        logger.warning("Erreur get_ngap_act", exc_info=True)
        result = {"error": f"Impossible de récupérer l'acte NGAP : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "get_ngap_act",
            tool_input, result,
            ctx.deps.context.session_id,  # llm_model placeholder — remplacé dans l'orchestrateur
            duration_ms,
        )
    except Exception:
        logger.warning("Audit log échoué pour get_ngap_act", exc_info=True)

    return result


async def explain_act_code(ctx: RunContext[AgentDeps], code: str) -> dict:
    """Explique un code d'acte NGAP et indique son utilisation courante.

    Args:
        code: Code de l'acte à expliquer (ex: AIS3, AMI2, BSI).
    """
    start = time.monotonic()
    tool_input = {"code": code}
    try:
        # Recherche avec préfixe (ex: AIS3 → AIS)
        base_code = "".join(c for c in code.upper() if c.isalpha())
        acts = await ctx.deps.care_catalog_repo.list_active(
            search=base_code, skip=0, limit=10
        )
        if not acts:
            result = {"found": False, "message": f"Aucun acte trouvé pour '{code}'."}
        else:
            result = {
                "found": True,
                "acts": [
                    {
                        "code": a.code,
                        "label": a.label,
                        "base_price": float(a.base_price),
                        "category": a.category,
                    }
                    for a in acts[:5]
                ],
            }
    except Exception as exc:
        logger.warning("Erreur explain_act_code", exc_info=True)
        result = {"error": f"Erreur lors de la recherche : {type(exc).__name__}: {exc}"}

    duration_ms = int((time.monotonic() - start) * 1000)
    try:
        await log_tool_call(
            ctx.deps.db, ctx.deps.context, "explain_act_code",
            tool_input, result, ctx.deps.context.session_id, duration_ms,
        )
    except Exception:
        pass

    return result
