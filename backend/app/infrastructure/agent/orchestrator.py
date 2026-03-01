"""Orchestrateur de l'agent IA IDEL.

Crée l'agent PydanticAI, enregistre les outils et expose run_streaming.
"""

import json
import logging
from collections.abc import AsyncGenerator

from pydantic_ai import Agent
from pydantic_ai import messages as pai_messages

from app.infrastructure.agent import memory as agent_memory
from app.infrastructure.agent.context import AgentDeps
from app.infrastructure.agent.prompts import build_system_prompt
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

logger = logging.getLogger(__name__)


def create_idel_agent(provider: LLMProvider) -> Agent[AgentDeps, str]:
    """Crée et configure l'agent PydanticAI avec tous les outils IDEL."""
    from pydantic_ai import RunContext

    model = provider.get_pydantic_ai_model()
    agent: Agent[AgentDeps, str] = Agent(
        model,
        deps_type=AgentDeps,
        output_type=str,
    )

    # System prompt dynamique (contexte utilisateur injecté à l'exécution)
    @agent.system_prompt
    def get_system_prompt(ctx: RunContext[AgentDeps]) -> str:
        return build_system_prompt(ctx.deps.context)

    # Enregistrement des outils
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

    return agent


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


class AgentOrchestrator:
    """Orchestre les appels au LLM avec historique Redis et streaming."""

    def __init__(self, agent: Agent[AgentDeps, str], model_name: str):
        self._agent = agent
        self._model_name = model_name

    async def run_streaming(
        self,
        message: str,
        deps: AgentDeps,
    ) -> AsyncGenerator[str, None]:
        """Exécute l'agent en mode streaming.

        Yields:
            JSON strings de type :
              - {"type": "token", "content": "..."}  (token par token)
              - {"type": "end", "usage": {...}}       (fin de génération)
              - {"type": "error", "message": "..."}  (erreur)
        """
        session_id = deps.context.session_id

        # Charger l'historique
        history = await agent_memory.get_history(session_id)
        model_history = _history_to_model_messages(history)

        full_response = ""
        try:
            async with self._agent.run_stream(
                message,
                deps=deps,
                message_history=model_history,
            ) as result:
                async for chunk in result.stream_text(delta=True):
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
            logger.error("Erreur lors de l'exécution de l'agent", exc_info=True)
            yield json.dumps({"type": "error", "message": f"Erreur agent : {type(exc).__name__}"})
            return

        # Sauvegarder dans Redis
        await agent_memory.save_message(session_id, "user", message)
        await agent_memory.save_message(session_id, "assistant", full_response)
