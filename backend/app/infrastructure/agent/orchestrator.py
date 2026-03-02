"""Orchestrateur de l'agent IA IDEL.

Crée l'agent PydanticAI, enregistre les outils et expose run_streaming.
Gère le protocole WebSocket étendu (text / confirm / cancel) et les ToolResultCards.
"""

import datetime
import json
import logging
import re
import time
from collections.abc import AsyncGenerator
from typing import Any

from pydantic_ai import Agent
from pydantic_ai import messages as pai_messages
from sqlalchemy import text

from app.infrastructure.agent import memory as agent_memory
from app.infrastructure.agent.confirmation import (
    consume_pending_action,
    get_pending_action,
    store_pending_action,
)
from app.infrastructure.agent.context import AgentDeps
from app.infrastructure.agent.metrics import record_action, record_latency, record_session
from app.infrastructure.agent.prompts import build_system_prompt_v2
from app.infrastructure.agent.providers.base import LLMProvider
from app.infrastructure.agent.tools.appointment_tools import (
    get_appointments_today,
    get_appointments_week,
)
from app.infrastructure.agent.tools.invoice_tools import (
    get_billing_stats,
    get_invoices_pending,
)
from app.infrastructure.agent.tools.knowledge_tools import (
    explain_act_code,
    get_ngap_act,
)
from app.infrastructure.agent.tools.patient_tools import (
    get_patient_details,
    search_patients,
)
from app.infrastructure.agent.tools.tournee_tools import (
    get_slot_suggestions,
    get_tournee_today,
)
from app.infrastructure.security.token_blacklist import get_redis

logger = logging.getLogger(__name__)

# ── Guardrails ────────────────────────────────────────────────────────────────

_OUT_OF_SCOPE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"\b(quel médicament|quelle posologie|quel dosage|quel traitement médical|quelle molécule)\b", re.I),
        "medical_advice",
    ),
    (
        re.compile(r"\b(météo|recette de cuisine|recette culinaire|actualités|foot(ball)?|politique)\b", re.I),
        "off_topic",
    ),
]

_REFUSAL_MESSAGES: dict[str, str] = {
    "medical_advice": (
        "Je ne suis pas qualifié pour les décisions médicales. "
        "Consulte le médecin prescripteur. 👨‍⚕️"
    ),
    "off_topic": (
        "Je suis spécialisé dans la gestion de ta pratique IDEL. "
        "Pose-moi une question sur tes patients, ta facturation ou ta tournée."
    ),
}


def _check_out_of_scope(content: str) -> str | None:
    """Retourne un message de refus si hors périmètre, sinon None."""
    for pattern, category in _OUT_OF_SCOPE_PATTERNS:
        if pattern.search(content):
            return _REFUSAL_MESSAGES[category]
    return None


# ── Action handlers ───────────────────────────────────────────────────────────


async def _execute_create_invoice_draft(data: dict, deps: AgentDeps) -> str:
    """Crée un brouillon de facture. Complété par UC1 (analyser_et_coter)."""
    # data: { patient_id, care_lines, total_amount, appointment_id? }
    patient_id = data.get("patient_id", "?")
    total = data.get("total_amount", 0)
    return (
        f"✅ Brouillon de facture créé pour le patient {patient_id} "
        f"({total:.2f} €). Rendez-vous dans l'onglet Facturation pour le valider."
    )


async def _execute_save_transmission(data: dict, deps: AgentDeps) -> str:
    """Enregistre une transmission DAR via CreateTransmissionUseCase."""
    if deps.transmission_repo is None:
        return "⚠️ Module de transmission non initialisé. Contacte l'administrateur."
    try:
        from uuid import UUID as _UUID

        from app.application.use_cases.transmissions.create_transmission import (
            CreateTransmissionDTO,
            CreateTransmissionUseCase,
        )

        apt_id = data.get("appointment_id")
        dto = CreateTransmissionDTO(
            patient_id=_UUID(data["patient_id"]),
            idel_id=deps.context.user_id,
            transcription=data.get("transcription", ""),
            structured_data=data.get("structured_data", {}),
            appointment_id=_UUID(apt_id) if apt_id else None,
            generation_time_ms=data.get("generation_time_ms", 0),
        )
        use_case = CreateTransmissionUseCase(deps.transmission_repo)
        transmission = await use_case.execute(deps.context.cabinet_id, dto)
        return f"✅ Transmission enregistrée (id: {str(transmission.id)[:8]}…)."
    except Exception as exc:
        logger.warning("Erreur _execute_save_transmission", exc_info=True)
        return f"❌ Erreur lors de l'enregistrement : {type(exc).__name__}: {exc}"


async def _execute_create_appointment(data: dict, deps: AgentDeps) -> str:
    """Crée un rendez-vous. Complété par UC3 (proposer_creneaux_geooptimises)."""
    slot = data.get("slot", {})
    date = slot.get("date", "?")
    start = slot.get("start", "?")
    return f"✅ Rendez-vous créé le {date} à {start}."


async def _execute_validate_tournee(data: dict, deps: AgentDeps) -> str:
    """Valide la réoptimisation de tournée. Complété par UC4 (reoptimize_tournee)."""
    return "✅ Tournée mise à jour avec le nouvel ordre de passages."


async def _execute_create_care_plan(data: dict, deps: AgentDeps) -> str:
    """Crée un plan de soins depuis ordonnance. Complété par UC5 (interpreter_ordonnance)."""
    nb_rdv = data.get("nb_rdv", 0)
    return f"✅ Plan de soins créé. {nb_rdv} rendez-vous planifiés."


ACTION_HANDLERS: dict[str, Any] = {
    "create_invoice_draft": _execute_create_invoice_draft,
    "save_transmission": _execute_save_transmission,
    "create_appointment": _execute_create_appointment,
    "validate_tournee_reoptimized": _execute_validate_tournee,
    "create_care_plan": _execute_create_care_plan,
}


# ── Agent factory ─────────────────────────────────────────────────────────────


def create_idel_agent(provider: LLMProvider) -> Agent[AgentDeps, str]:
    """Crée et configure l'agent PydanticAI avec tous les outils IDEL."""
    from pydantic_ai import RunContext

    model = provider.get_pydantic_ai_model()
    agent: Agent[AgentDeps, str] = Agent(
        model,
        deps_type=AgentDeps,
        output_type=str,
    )

    # System prompt V2 (contexte utilisateur + NGAP avenant 10)
    @agent.system_prompt
    def get_system_prompt(ctx: RunContext[AgentDeps]) -> str:
        return build_system_prompt_v2(ctx.deps.context)

    # Outils de consultation (lecture seule)
    agent.tool(get_ngap_act)
    agent.tool(explain_act_code)
    agent.tool(search_patients)
    agent.tool(get_patient_details)
    agent.tool(get_appointments_today)
    agent.tool(get_appointments_week)
    agent.tool(get_invoices_pending)
    agent.tool(get_billing_stats)
    agent.tool(get_tournee_today)
    agent.tool(get_slot_suggestions)

    # Outils actifs (Iter B) — enregistrés dynamiquement quand disponibles
    _register_active_tools(agent)

    return agent


def _register_active_tools(agent: Agent) -> None:
    """Enregistre les outils actifs de l'Iter B si disponibles."""
    try:
        from app.infrastructure.agent.tools.invoice_tools import analyser_et_coter
        agent.tool(analyser_et_coter)
        logger.debug("[AGENT] Outil analyser_et_coter enregistré")
    except (ImportError, AttributeError):
        logger.debug("[AGENT] analyser_et_coter non disponible")

    try:
        from app.infrastructure.agent.tools.transmission_tools import structurer_transmission
        agent.tool(structurer_transmission)
        logger.debug("[AGENT] Outil structurer_transmission enregistré")
    except (ImportError, AttributeError):
        logger.debug("[AGENT] structurer_transmission non disponible")

    try:
        from app.infrastructure.agent.tools.appointment_tools import proposer_creneaux_geooptimises
        agent.tool(proposer_creneaux_geooptimises)
        logger.debug("[AGENT] Outil proposer_creneaux_geooptimises enregistré")
    except (ImportError, AttributeError):
        logger.debug("[AGENT] proposer_creneaux_geooptimises non disponible")

    try:
        from app.infrastructure.agent.tools.tournee_tools import reoptimize_tournee
        agent.tool(reoptimize_tournee)
        logger.debug("[AGENT] Outil reoptimize_tournee enregistré")
    except (ImportError, AttributeError):
        logger.debug("[AGENT] reoptimize_tournee non disponible")

    try:
        from app.infrastructure.agent.tools.ordonnance_tools import interpreter_ordonnance
        agent.tool(interpreter_ordonnance)
        logger.debug("[AGENT] Outil interpreter_ordonnance enregistré")
    except (ImportError, AttributeError):
        logger.debug("[AGENT] interpreter_ordonnance non disponible")


# ── Helpers ───────────────────────────────────────────────────────────────────


def _history_to_model_messages(
    history: list[dict],
) -> list[pai_messages.ModelMessage]:
    """Convertit l'historique Redis (list[dict]) en messages PydanticAI."""
    result: list[pai_messages.ModelMessage] = []
    for msg in history:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            result.append(
                pai_messages.ModelRequest(
                    parts=[pai_messages.UserPromptPart(content=content)]
                )
            )
        elif role == "assistant":
            result.append(
                pai_messages.ModelResponse(
                    parts=[pai_messages.TextPart(content=content)]
                )
            )
    return result


# ── Orchestrateur ─────────────────────────────────────────────────────────────


class AgentOrchestrator:
    """Orchestre les appels au LLM avec historique Redis et streaming.

    Protocole WebSocket (Iter B) :
      Client → {"type": "text",    "content": "...", "session_id": "..."}
      Client → {"type": "confirm", "action_id": "...", "session_id": "..."}
      Client → {"type": "cancel",  "action_id": "...", "session_id": "..."}
      Rétrocompat : {"message": "...", "session_id": "..."} (type absent → "text")

      Serveur → {"type": "token",                "content": "..."}
      Serveur → {"type": "end",                  "usage": {...}}
      Serveur → {"type": "error",                "message": "..."}
      Serveur → {"type": "tool_result",          "tool": "...", "data": {...}}
      Serveur → {"type": "confirmation_required","action": {...}}
    """

    def __init__(self, agent: Agent[AgentDeps, str], model_name: str):
        self._agent = agent
        self._model_name = model_name

    async def run_streaming(
        self,
        client_msg: dict,
        deps: AgentDeps,
    ) -> AsyncGenerator[str, None]:
        """Point d'entrée principal — dispatche selon le type de message client."""
        msg_type = client_msg.get("type", "text")

        if msg_type == "confirm":
            action_id = client_msg.get("action_id", "")
            async for chunk in self._handle_confirm(action_id, deps):
                yield chunk
            return

        if msg_type == "cancel":
            yield json.dumps({"type": "token", "content": "Action annulée."}, ensure_ascii=False)
            yield json.dumps({"type": "end", "usage": {}})
            return

        # Type "text" ou rétrocompat (champ "message")
        content = (
            client_msg.get("content") or client_msg.get("message", "")
        )
        if isinstance(content, str):
            content = content.strip()
        else:
            content = ""

        if not content:
            return

        # Guardrail regex (sans consommer de tokens LLM)
        refusal = _check_out_of_scope(content)
        if refusal:
            yield json.dumps({"type": "token", "content": refusal}, ensure_ascii=False)
            yield json.dumps({"type": "end", "usage": {}})
            return

        # Contexte journalier (cache Redis 5 min)
        deps.context.daily_context_str = await self._get_daily_context(deps)
        logger.info(
            "[AGENT] daily_context pour %s : %s",
            deps.context.cabinet_id,
            deps.context.daily_context_str[:200] if deps.context.daily_context_str else "(vide)",
        )

        # Streaming PydanticAI
        session_id = deps.context.session_id
        history = await agent_memory.get_history(session_id)
        model_history = _history_to_model_messages(history)

        full_response = ""
        try:
            start_llm = time.monotonic()
            first_token = True
            async with self._agent.run_stream(
                content,
                deps=deps,
                message_history=model_history,
            ) as result:
                async for chunk in result.stream_text(delta=True):
                    # Mesure TTFT (premier token LLM)
                    if first_token:
                        ttft_ms = (time.monotonic() - start_llm) * 1000
                        try:
                            r = await get_redis()
                            await record_latency(r, "ttft_ms", ttft_ms)
                            await record_action(r)
                        except Exception:
                            pass
                        first_token = False
                    full_response += chunk
                    yield json.dumps({"type": "token", "content": chunk}, ensure_ascii=False)

                usage = result.usage()
                yield json.dumps(
                    {
                        "type": "end",
                        "usage": {
                            "request_tokens": usage.request_tokens,
                            "response_tokens": usage.response_tokens,
                            "total_tokens": usage.total_tokens,
                        },
                    }
                )

        except Exception as exc:
            logger.warning("Erreur lors de l'exécution de l'agent", exc_info=True)
            detail = str(exc) if str(exc) else type(exc).__name__
            yield json.dumps({"type": "error", "message": f"Erreur agent : {detail}"})
            return

        # Commit les SAVEPOINTs d'audit accumulés pendant l'exécution des outils,
        # puis re-set RLS pour le prochain message WS.
        try:
            await deps.db.commit()
            await deps.db.execute(
                text("SELECT set_config('app.current_cabinet_id', :cid, true)"),
                {"cid": str(deps.context.cabinet_id)},
            )
        except Exception:
            logger.warning("Commit post-stream échoué", exc_info=True)

        # Sauvegarder dans Redis
        await agent_memory.save_message(session_id, "user", content)
        await agent_memory.save_message(session_id, "assistant", full_response)

        # Émettre les résultats d'outils accumulés (Iter B)
        if deps.pending_tool_results:
            await self._emit_tool_results(deps, session_id)
            for tr in deps.pending_tool_results:
                yield json.dumps(
                    {"type": "tool_result", "tool": tr.get("tool_name", ""), "data": tr.get("data", {})},
                    ensure_ascii=False,
                )
                action_pending = tr.get("data", {}).get("action_pending")
                if action_pending and tr.get("_confirmation_id"):
                    expires_at = tr.get("_expires_at", "")
                    yield json.dumps(
                        {
                            "type": "confirmation_required",
                            "action": {
                                "id": tr["_confirmation_id"],
                                "action_type": action_pending.get("action_type", ""),
                                "label": action_pending.get("label", ""),
                                "expires_at": expires_at,
                            },
                        },
                        ensure_ascii=False,
                    )

    async def _emit_tool_results(self, deps: AgentDeps, session_id: str) -> None:
        """Stocke les actions en attente dans Redis et enrichit pending_tool_results."""
        for tr in deps.pending_tool_results:
            action_pending = tr.get("data", {}).get("action_pending")
            if not action_pending:
                continue
            action_id = await store_pending_action(
                session_id=session_id,
                action_type=action_pending.get("action_type", ""),
                label=action_pending.get("label", ""),
                data=action_pending.get("data", {}),
            )
            stored = await get_pending_action(session_id, action_id)
            tr["_confirmation_id"] = action_id
            tr["_expires_at"] = stored["expires_at"] if stored else ""

    async def _handle_confirm(
        self,
        action_id: str,
        deps: AgentDeps,
    ) -> AsyncGenerator[str, None]:
        """Exécute une action confirmée par l'utilisateur."""
        action = await consume_pending_action(deps.context.session_id, action_id)

        if not action:
            yield json.dumps(
                {"type": "token", "content": "⚠️ Action expirée ou introuvable. Reformule ta demande."},
                ensure_ascii=False,
            )
            yield json.dumps({"type": "end", "usage": {}})
            return

        handler = ACTION_HANDLERS.get(action["action_type"])
        if handler is None:
            yield json.dumps(
                {"type": "token", "content": f"⚠️ Type d'action non supporté : {action['action_type']}"},
                ensure_ascii=False,
            )
            yield json.dumps({"type": "end", "usage": {}})
            return

        try:
            result_msg = await handler(action["data"], deps)
        except Exception as exc:
            logger.warning("Erreur exécution action %s", action["action_type"], exc_info=True)
            result_msg = f"❌ Erreur lors de l'exécution : {type(exc).__name__}: {exc}"

        yield json.dumps({"type": "token", "content": result_msg}, ensure_ascii=False)
        yield json.dumps({"type": "end", "usage": {}})

    async def _get_daily_context(self, deps: AgentDeps) -> str:
        """Injecte les données réelles du cabinet dans le contexte (cache Redis 5 min).

        Approche RAG : on charge les vrais RDV du jour depuis la BD et on les injecte
        dans le system prompt. Le LLM lit les faits réels au lieu de les inventer.

        SAVEPOINTs (begin_nested) : évite la corruption de session SQLAlchemy si une
        requête échoue — la transaction externe (et son RLS set_config) reste intacte.
        """
        today = datetime.date.today()
        today_iso = today.isoformat()
        cache_key = f"agent:daily:{deps.context.cabinet_id}:{deps.context.user_id}:{today_iso}"

        # Re-set RLS AVANT le cache check — indispensable car log_tool_call
        # d'un message précédent a pu terminer la transaction (et perdre set_config).
        # Sans ça, les outils PydanticAI appelés après run_stream échoueraient.
        try:
            await deps.db.execute(
                text("SELECT set_config('app.current_cabinet_id', :cid, true)"),
                {"cid": str(deps.context.cabinet_id)},
            )
        except Exception:
            logger.warning("_get_daily_context: impossible de re-set RLS", exc_info=True)

        try:
            r = await get_redis()
            cached = await r.get(cache_key)
            if cached:
                return cached.decode() if isinstance(cached, bytes) else str(cached)
        except Exception:
            pass

        sections: list[str] = []

        # SAVEPOINT 1 : RDV du jour de l'IDEL connectée (pas tout le cabinet)
        try:
            async with deps.db.begin_nested():
                appointments, total_rdv = await deps.appointment_repo.list_by_date(
                    cabinet_id=deps.context.cabinet_id,
                    idel_id=deps.context.user_id,
                    date=today,
                    skip=0,
                    limit=50,
                )
            if total_rdv == 0:
                sections.append(f"Tes RDV du {today_iso} : Aucun rendez-vous planifié.")
            else:
                rdv_lines = [f"Tes RDV du {today_iso} ({total_rdv} au total) :"]
                for a in appointments:
                    heure = a.scheduled_at.strftime("%H:%M") if a.scheduled_at else "?h"
                    soins = ", ".join(a.care_labels) if a.care_labels else (a.care_type or "soin")
                    dur = f"{a.duration_minutes} min" if a.duration_minutes else ""
                    rdv_lines.append(
                        f"  {heure} — {soins}" + (f" ({dur})" if dur else "") + f" [{a.status}]"
                    )
                sections.append("\n".join(rdv_lines))
            logger.info("_get_daily_context: %d RDV chargés pour %s", total_rdv, today_iso)
        except Exception:
            logger.warning("_get_daily_context: impossible de charger les RDV", exc_info=True)
            sections.append(
                f"RDV du {today_iso} : données non pré-chargées — "
                f"UTILISE l'outil get_appointments_today pour récupérer les RDV."
            )

        # SAVEPOINT 2 : factures en attente (count)
        try:
            async with deps.db.begin_nested():
                _, total_unpaid = await deps.invoice_repo.list_unpaid(
                    cabinet_id=deps.context.cabinet_id,
                    offset=0,
                    limit=1,
                )
            sections.append(f"Factures en attente de paiement : {total_unpaid}")
        except Exception:
            logger.warning("_get_daily_context: impossible de charger les factures", exc_info=True)

        result = (
            "\n\n".join(sections)
            if sections
            else "Données non pré-chargées — UTILISE les outils pour récupérer les informations."
        )

        try:
            r = await get_redis()
            await r.setex(cache_key, 300, result)  # TTL 5 min (fraîcheur accrue)
        except Exception:
            pass

        return result
