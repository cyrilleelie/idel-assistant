"""Orchestrateur du secrétaire médical IA (itération F).

Crée un agent PydanticAI distinct de l'agent IDEL, avec les 8 outils
de gestion d'appels téléphoniques et le prompt adapté aux patients.
"""

import datetime
import logging
import time
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from pydantic_ai import Agent, RunContext

from app.infrastructure.agent.context import AgentDeps
from app.infrastructure.agent.prompts.receptionist_prompt import (
    build_greeting,
    build_receptionist_prompt,
)
from app.infrastructure.agent.providers.base import LLMProvider
from app.infrastructure.agent.tools.receptionist_tools import RECEPTIONIST_TOOLS

logger = logging.getLogger(__name__)


@dataclass
class ReceptionistCallContext:
    """Contexte d'un appel téléphonique en cours."""

    cabinet_id: UUID
    cabinet_name: str
    caller_number: str
    started_at: float = field(default_factory=time.monotonic)
    conversation_history: list[dict[str, str]] = field(default_factory=list)
    urgency_score: int = 0
    propose_callback: bool = False
    patient_id: UUID | None = None
    appointment_id: UUID | None = None


@dataclass
class ReceptionistResponse:
    """Réponse d'un tour de parole du secrétaire."""

    text: str
    urgency_score: int = 0
    end_call: bool = False
    escalation_reason: str = ""


def create_receptionist_agent(provider: LLMProvider) -> Agent[AgentDeps, str]:
    """Crée l'agent PydanticAI pour le secrétaire médical."""
    model = provider.get_pydantic_ai_model()
    agent: Agent[AgentDeps, str] = Agent(
        model,
        deps_type=AgentDeps,
        output_type=str,
    )

    @agent.system_prompt
    def get_receptionist_prompt(ctx: RunContext[AgentDeps]) -> str:
        now = datetime.datetime.now(datetime.UTC).strftime("%A %d %B %Y, %H:%M")
        return build_receptionist_prompt(
            cabinet_name="Cabinet IDEL",  # Enrichi au runtime
            current_datetime=now,
            idel_disponibles="Information non disponible",
        )

    for tool_fn in RECEPTIONIST_TOOLS:
        agent.tool(tool_fn)

    return agent


async def run_receptionist_turn(
    agent: Agent[AgentDeps, str],
    call_ctx: ReceptionistCallContext,
    user_message: str,
    deps: AgentDeps,
) -> ReceptionistResponse:
    """Exécute un tour de parole du secrétaire médical.

    Args:
        agent: Agent PydanticAI configuré.
        call_ctx: Contexte de l'appel en cours.
        user_message: Transcription de ce que le patient vient de dire.
        deps: Dépendances (DB, repos, etc.).

    Returns:
        ReceptionistResponse avec le texte à synthétiser et le score d'urgence.
    """
    call_ctx.conversation_history.append({"role": "user", "content": user_message})

    try:
        from pydantic_ai import messages as pai_messages

        model_history = []
        for msg in call_ctx.conversation_history[:-1]:
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "user":
                model_history.append(
                    pai_messages.ModelRequest(
                        parts=[pai_messages.UserPromptPart(content=content)]
                    )
                )
            elif role == "assistant":
                model_history.append(
                    pai_messages.ModelResponse(
                        parts=[pai_messages.TextPart(content=content)]
                    )
                )

        result = await agent.run(
            user_message,
            deps=deps,
            message_history=model_history,
        )
        response_text = result.data

    except Exception as exc:
        logger.error("Erreur run_receptionist_turn: %s", exc, exc_info=True)
        response_text = (
            "Je suis désolé, je rencontre un problème technique. "
            "Pouvez-vous rappeler dans quelques minutes ?"
        )

    call_ctx.conversation_history.append({"role": "assistant", "content": response_text})

    # Détection du score d'urgence dans la réponse
    urgency = _detect_urgency(response_text, user_message)
    if urgency > call_ctx.urgency_score:
        call_ctx.urgency_score = urgency

    end_call = _detect_end_call(response_text)
    escalation_reason = ""
    if urgency >= 3:
        escalation_reason = f"Urgence vitale détectée : {user_message[:100]}"

    return ReceptionistResponse(
        text=response_text,
        urgency_score=urgency,
        end_call=end_call,
        escalation_reason=escalation_reason,
    )


def _detect_urgency(agent_response: str, patient_message: str) -> int:
    """Détecte le score d'urgence à partir du contexte de conversation."""
    combined = (agent_response + " " + patient_message).lower()

    # Score 3 : urgence vitale
    urgence_3_keywords = [
        "appel le 15", "appelez le 15", "samu", "urgence vitale",
        "chute", "inconscient", "hémorragie", "détresse respiratoire",
        "ne respire plus", "ne répond plus",
    ]
    if any(kw in combined for kw in urgence_3_keywords):
        return 3

    # Score 2 : urgent
    urgence_2_keywords = [
        "fièvre élevée", "glycémie anormale", "plaie qui saigne",
        "rappeler rapidement", "rappel urgent",
    ]
    if any(kw in combined for kw in urgence_2_keywords):
        return 2

    # Score 1 : prioritaire
    urgence_1_keywords = [
        "douleur", "mal", "inquiet", "inquiète",
    ]
    if any(kw in combined for kw in urgence_1_keywords):
        return 1

    return 0


def _detect_end_call(agent_response: str) -> bool:
    """Détecte si l'agent propose de mettre fin à l'appel."""
    lower = agent_response.lower()
    end_phrases = [
        "au revoir", "bonne journée", "bonne soirée",
        "n'hésitez pas à rappeler", "je vous souhaite",
    ]
    return any(phrase in lower for phrase in end_phrases)
