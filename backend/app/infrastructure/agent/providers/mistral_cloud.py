"""Provider Mistral Cloud via OpenAI-compatible API."""

import logging

import httpx
from pydantic_ai.models.mistral import MistralModel
from pydantic_ai.providers.mistral import MistralProvider

from app.infrastructure.agent.providers.base import LLMConfig, LLMProvider

logger = logging.getLogger(__name__)


class MistralCloudProvider(LLMProvider):
    """Provider utilisant l'API Mistral Cloud (SDK natif pydantic-ai)."""

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

    def get_pydantic_ai_model(self) -> MistralModel:
        """Retourne un MistralModel pydantic-ai natif."""
        provider = MistralProvider(api_key=self._api_key)
        return MistralModel(self._config.model_name, provider=provider)

    def get_model_name(self) -> str:
        return self._config.model_name
