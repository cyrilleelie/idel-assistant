"""STT self-hosted via le micro-service faster-whisper sur l'instance GPU OVH.

100% local — aucune donnée audio ne quitte l'infrastructure HDS.
WER français : ~3.98% (Multilingual LibriSpeech benchmark).

Communication : appel HTTP vers le service whisper sur le vRack privé.
La pseudonymisation post-transcription reste en place (bonne pratique),
mais n'est plus une obligation réglementaire puisque le STT est self-hosted.
"""

import logging

import httpx

from app.infrastructure.agent.voice.base import STTProvider, TranscriptionResult

logger = logging.getLogger(__name__)


class FasterWhisperLocalSTT(STTProvider):
    """STT via faster-whisper self-hosted sur GPU OVH."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=60.0)

    @property
    def is_local(self) -> bool:
        return True

    @property
    def provider_name(self) -> str:
        return "faster_whisper_local"

    async def transcribe(
        self,
        audio_data: bytes,
        language: str = "fr",
        hotwords: list[str] | None = None,
    ) -> TranscriptionResult:
        """Envoie l'audio au micro-service faster-whisper et retourne la transcription.

        Latence cible : < 200ms pour 30s d'audio (vs ~800ms cloud en iter C).
        """
        if not audio_data or len(audio_data) < 200:
            return TranscriptionResult(
                text="",
                language=language,
                confidence=0.0,
                duration_seconds=0.0,
                provider=self.provider_name,
            )

        files = {"audio": ("recording.webm", audio_data, "audio/webm")}

        try:
            response = await self._client.post(
                f"{self._base_url}/transcribe",
                files=files,
            )
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("faster-whisper HTTP %d: %s", exc.response.status_code, exc)
            raise RuntimeError(
                f"Transcription échouée : code {exc.response.status_code}"
            )
        except httpx.TimeoutException:
            raise RuntimeError(
                "Transcription trop longue. Réduis la durée de l'enregistrement."
            )
        except Exception as exc:
            logger.error("faster-whisper error: %s", exc)
            raise RuntimeError("Service de transcription indisponible")

        data = response.json()

        return TranscriptionResult(
            text=data.get("text", ""),
            language=data.get("language", language),
            confidence=data.get("confidence", 0.0),
            duration_seconds=data.get("duration_seconds", 0.0),
            provider=self.provider_name,
        )

    async def health_check(self) -> bool:
        """Vérifie que le micro-service faster-whisper est accessible."""
        try:
            response = await self._client.get(
                f"{self._base_url}/health/whisper",
                timeout=5.0,
            )
            return response.status_code == 200
        except Exception:
            return False
