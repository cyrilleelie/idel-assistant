"""Provider Mistral Cloud via OpenAI-compatible API."""

import logging

import httpx
from pydantic_ai.models.openai import OpenAIModel

from app.infrastructure.agent.providers.base import LLMConfig, LLMProvider

logger = logging.getLogger(__name__)


class MistralCloudProvider(LLMProvider):
    """Provider utilisant l'API Mistral Cloud (compatible OpenAI)."""

    def __init__(self, api_key: str, config: LLMConfig):
        self._api_key = api_key
        self._config = config

    async def health_check(self) -> bool:
        """Vérifie l'accessibilité de l'API Mistral."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self._config.base_url}/models",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                )
                return resp.status_code == 200
        except Exception:
            logger.warning("Mistral health check failed", exc_info=True)
            return False

    def get_pydantic_ai_model(self) -> OpenAIModel:
        """Retourne un OpenAIModel pydantic-ai pointant sur Mistral."""
        return OpenAIModel(
            self._config.model_name,
            base_url=self._config.base_url,
            api_key=self._api_key,
        )

    def get_model_name(self) -> str:
        return self._config.model_name
