"""Interfaces abstraites STTProvider et TTSProvider.

Ces interfaces sont la clé de la migration GPU en itération D :
- Itération C  : WhisperCloudSTT + ElevenLabsTTS (providers cloud)
- Itération D  : FasterWhisperSTT + KokoroTTS (self-hosted, sans GPU cloud)

Le reste du code (orchestrateur, endpoints, frontend) ne change pas lors
de la migration — seule l'implémentation concrète change.
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field


@dataclass
class TranscriptionResult:
    """Résultat d'une transcription audio."""

    text: str
    language: str                     # "fr"
    confidence: float                 # 0.0 à 1.0
    duration_seconds: float           # Durée de l'audio transcrit
    provider: str                     # "whisper_cloud" | "faster_whisper_local"


@dataclass
class TTSConfig:
    """Configuration pour la synthèse vocale."""

    voice_id: str = "default_french"
    speed: float = 1.0                # 0.5 à 2.0
    stream: bool = True


class STTProvider(ABC):
    """Interface abstraite pour Speech-to-Text."""

    @abstractmethod
    async def transcribe(
        self,
        audio_data: bytes,
        language: str = "fr",
        hotwords: list[str] | None = None,
    ) -> TranscriptionResult:
        """Transcrit des données audio en texte."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Vérifie que le provider est accessible."""
        ...

    @property
    @abstractmethod
    def is_local(self) -> bool:
        """True si self-hosted (données qui ne quittent pas l'infra HDS)."""
        ...

    @property
    def provider_name(self) -> str:
        """Nom du provider pour les logs et l'audit."""
        return self.__class__.__name__


class TTSProvider(ABC):
    """Interface abstraite pour Text-to-Speech."""

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        config: TTSConfig | None = None,
    ) -> AsyncIterator[bytes]:
        """Retourne un générateur asynchrone de chunks audio MP3."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Vérifie que le provider est accessible."""
        ...

    @property
    @abstractmethod
    def is_local(self) -> bool:
        """True si self-hosted."""
        ...

    @property
    def provider_name(self) -> str:
        return self.__class__.__name__
