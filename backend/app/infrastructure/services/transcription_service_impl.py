"""Implémentation du service de transcription pour les transmissions.

Réutilise les providers STT existants (WhisperCloud ou FasterWhisperLocal)
via une interface simplifiée adaptée au pipeline de transmissions.
"""

import logging

from app.config import settings
from app.domain.services.transcription_service import TranscriptionService

logger = logging.getLogger(__name__)


class TranscriptionServiceImpl(TranscriptionService):
    """Adapte les STTProviders existants vers l'interface domaine TranscriptionService."""

    def __init__(self) -> None:
        self._provider = _build_provider()

    async def transcribe_audio(self, audio_data: bytes, format: str = "wav") -> str:
        if not audio_data or len(audio_data) < 200:
            return ""

        result = await self._provider.transcribe(audio_data, language="fr")
        return result.text


def _build_provider():
    """Construit le provider STT selon la configuration."""
    if settings.stt_provider == "faster_whisper_local":
        url = settings.whisper_local_url or settings.gpu_base_url
        if url:
            from app.infrastructure.agent.voice.stt_local import FasterWhisperLocalSTT

            logger.info("STT provider: faster_whisper_local @ %s", url)
            return FasterWhisperLocalSTT(url)
    if settings.openai_api_key:
        from app.infrastructure.agent.voice.stt_whisper_cloud import WhisperCloudSTT

        logger.info("STT provider: whisper_cloud")
        return WhisperCloudSTT(settings.openai_api_key)
    logger.warning("Aucun provider STT configuré — transcription stub")
    return _StubSTT()


class _StubSTT:
    """STT stub pour le développement sans clé API."""

    async def transcribe(self, audio_data: bytes, language: str = "fr"):
        from dataclasses import dataclass

        @dataclass
        class _Result:
            text: str = "[Transcription non disponible — STT non configuré]"
            language: str = "fr"
            confidence: float = 0.0
            duration_seconds: float = 0.0
            provider: str = "stub"

        return _Result()


def create_transcription_service() -> TranscriptionServiceImpl:
    """Factory pour le service de transcription."""
    return TranscriptionServiceImpl()
