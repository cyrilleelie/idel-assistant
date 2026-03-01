"""Abstraction LLM provider."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class LLMConfig:
    model_name: str
    base_url: str
    temperature: float
    max_tokens: int


class LLMProvider(ABC):
    """Interface abstraite pour les providers LLM."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Vérifie que le provider est accessible."""
        ...

    @abstractmethod
    def get_pydantic_ai_model(self):
        """Retourne un modèle compatible pydantic-ai."""
        ...

    @abstractmethod
    def get_model_name(self) -> str:
        """Retourne le nom du modèle utilisé."""
        ...
