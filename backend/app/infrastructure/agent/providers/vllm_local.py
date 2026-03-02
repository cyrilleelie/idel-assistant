"""Provider LLM utilisant vLLM self-hosted sur l'instance GPU OVH.

API 100% compatible OpenAI — aucun changement dans la logique métier.
MistralCloudProvider et VLLMLocalProvider exposent la même interface.
L'orchestrateur ne sait pas lequel est actif.

Démarré avec --tool-call-parser hermes et --enable-auto-tool-choice
pour supporter les tool calls PydanticAI.
"""

import logging

import httpx

from app.infrastructure.agent.providers.base import LLMConfig, LLMProvider

logger = logging.getLogger(__name__)


class VLLMLocalProvider(LLMProvider):
    """Provider LLM self-hosted via vLLM sur GPU OVH (réseau privé vRack)."""

    def __init__(self, config: LLMConfig):
        self._config = config

    @property
    def is_local(self) -> bool:
        return True

    async def health_check(self) -> bool:
        """Vérifie que vLLM est accessible via son endpoint /v1/models."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._config.base_url}/models")
                if resp.status_code == 200:
                    data = resp.json()
                    return len(data.get("data", [])) > 0
                return False
        except Exception:
            logger.warning("vLLM health check failed", exc_info=True)
            return False

    def get_pydantic_ai_model(self):
        """Retourne un modèle PydanticAI pointant sur vLLM (API OpenAI-compatible)."""
        from openai import AsyncOpenAI
        from pydantic_ai.models.openai import OpenAIModel
        from pydantic_ai.providers.openai import OpenAIProvider

        openai_client = AsyncOpenAI(
            base_url=self._config.base_url,
            api_key="not-needed",
            timeout=self._config.max_tokens / 10,  # Timeout proportionnel
        )
        provider = OpenAIProvider(openai_client=openai_client)
        return OpenAIModel(
            self._config.model_name,
            provider=provider,
        )

    def get_model_name(self) -> str:
        return self._config.model_name
