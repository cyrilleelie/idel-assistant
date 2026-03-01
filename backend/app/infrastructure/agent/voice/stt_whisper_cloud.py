"""Implémentation STT via OpenAI Whisper API.

Solution intermédiaire phase pilote (itération C).
L'audio transite par OpenAI — voir DPIA et avertissement UI obligatoire.
Remplacé par faster-whisper self-hosted en itération D (aucun audio hors HDS).

Notes HDS :
- OpenAI propose un DPA (Data Processing Agreement) — obligatoire avant prod
- L'audio ne contient pas de NIR ni de données médicales structurées
- La pseudonymisation est appliquée immédiatement après transcription
- Cette approche est documentée dans la DPIA du projet
"""

import asyncio
import io
import logging
import math
import time

from openai import AsyncOpenAI, RateLimitError, APITimeoutError, APIError

from app.infrastructure.agent.voice.base import STTProvider, TranscriptionResult
from app.infrastructure.agent.voice.hotwords import WHISPER_MEDICAL_PROMPT

logger = logging.getLogger(__name__)

_MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 Mo — limite Whisper API
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 1.0  # secondes


class WhisperCloudSTT(STTProvider):
    """
    STT via OpenAI Whisper API.

    Utilise le prompt médical NGAP pour orienter la reconnaissance vers
    le vocabulaire infirmier (AMI, AIS, BSI, etc.) — méthode plus efficace
    que les hotwords formels pour le modèle whisper-1.

    Format audio accepté : webm, mp4, wav, m4a, ogg, flac.
    Le frontend envoie du webm/opus (MediaRecorder natif navigateur).
    """

    def __init__(self, api_key: str) -> None:
        if not api_key:
            raise ValueError("OPENAI_API_KEY est requis pour WhisperCloudSTT")
        self._client = AsyncOpenAI(api_key=api_key)

    @property
    def is_local(self) -> bool:
        return False  # Données audio envoyées à OpenAI

    @property
    def provider_name(self) -> str:
        return "whisper_cloud"

    async def transcribe(
        self,
        audio_data: bytes,
        language: str = "fr",
        hotwords: list[str] | None = None,
    ) -> TranscriptionResult:
        """
        Transcrit l'audio via Whisper API avec retry exponentiel.

        Le paramètre `prompt` de Whisper est utilisé pour orienter la
        reconnaissance vers le vocabulaire médical NGAP.

        Args:
            audio_data: Données audio brutes (webm/opus recommandé).
            language: Code langue ISO 639-1 (défaut "fr").
            hotwords: Ignoré pour Whisper — utilise WHISPER_MEDICAL_PROMPT à la place.

        Returns:
            TranscriptionResult avec text, confiance, durée et provider.

        Raises:
            ValueError: Si l'audio dépasse 25 Mo.
            RuntimeError: Si la transcription échoue après tous les retries.
        """
        if not audio_data:
            return TranscriptionResult(
                text="",
                language=language,
                confidence=0.0,
                duration_seconds=0.0,
                provider=self.provider_name,
            )

        if len(audio_data) < 200:
            # Audio trop court — probablement du silence ou du bruit
            return TranscriptionResult(
                text="",
                language=language,
                confidence=0.0,
                duration_seconds=0.0,
                provider=self.provider_name,
            )

        if len(audio_data) > _MAX_AUDIO_SIZE:
            raise ValueError(
                f"Fichier audio trop volumineux ({len(audio_data) // (1024*1024)} Mo, max 25 Mo)"
            )

        for attempt in range(_MAX_RETRIES):
            try:
                return await self._do_transcribe(audio_data, language)
            except RateLimitError:
                if attempt >= _MAX_RETRIES - 1:
                    raise RuntimeError("Limite de débit Whisper atteinte. Réessaie dans quelques secondes.")
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning("Whisper rate limit — retry dans %.1fs (tentative %d)", delay, attempt + 1)
                await asyncio.sleep(delay)
            except APITimeoutError:
                raise RuntimeError("Transcription trop longue. Réduis la durée de l'enregistrement.")
            except APIError as exc:
                logger.error("Whisper API error: %s", exc)
                raise RuntimeError(f"Erreur du service de transcription : {exc}")

        raise RuntimeError("Transcription échouée après plusieurs tentatives.")

    async def _do_transcribe(self, audio_data: bytes, language: str) -> TranscriptionResult:
        """Appel effectif à Whisper API."""
        audio_file = io.BytesIO(audio_data)
        audio_file.name = "audio.webm"

        start = time.monotonic()

        response = await self._client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language=language,
            prompt=WHISPER_MEDICAL_PROMPT,  # Oriente vers vocab médical NGAP
            response_format="verbose_json",  # Récupère durée + segments
            temperature=0.0,                 # Déterminisme maximal
        )

        elapsed = time.monotonic() - start
        logger.debug("Whisper transcription en %.2fs, %d chars", elapsed, len(response.text or ""))

        text = (response.text or "").strip()
        confidence = self._estimate_confidence(response)
        duration = getattr(response, "duration", 0.0) or 0.0

        return TranscriptionResult(
            text=text,
            language=getattr(response, "language", language) or language,
            confidence=confidence,
            duration_seconds=float(duration),
            provider=self.provider_name,
        )

    def _estimate_confidence(self, response) -> float:
        """
        Estime la confiance depuis les segments verbose_json de Whisper.

        Utilise avg_logprob des segments si disponible.
        Conversion : exp(avg_logprob) → probabilité approximative.
        Retourne 0.85 par défaut si les segments ne sont pas disponibles.
        """
        try:
            segments = getattr(response, "segments", None)
            if segments:
                avg_logprob = sum(
                    getattr(s, "avg_logprob", -0.5) for s in segments
                ) / len(segments)
                return min(1.0, max(0.0, math.exp(avg_logprob)))
        except Exception:
            pass
        return 0.85

    async def health_check(self) -> bool:
        """Vérifie que l'API Whisper est accessible."""
        try:
            models = await self._client.models.list()
            return any("whisper" in m.id for m in models.data)
        except Exception:
            return False
