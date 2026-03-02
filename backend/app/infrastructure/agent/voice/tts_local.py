"""TTS self-hosted via Kokoro-82M sur CPU (micro-service sur instance GPU OVH).

Kokoro tourne sur CPU pour libérer le GPU pour vLLM + faster-whisper.
Latence TTFB : ~50ms pour une phrase courte (vs ~200ms ElevenLabs cloud).
Audio retourné en WAV (AudioContext.decodeAudioData() gère WAV et MP3).
"""

import logging
import re
from collections.abc import AsyncIterator

import httpx

from app.infrastructure.agent.voice.base import TTSConfig, TTSProvider

logger = logging.getLogger(__name__)


class KokoroLocalTTS(TTSProvider):
    """TTS via Kokoro-82M self-hosted sur CPU."""

    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=30.0)

    @property
    def is_local(self) -> bool:
        return True

    @property
    def provider_name(self) -> str:
        return "kokoro_local"

    async def synthesize(
        self,
        text: str,
        config: TTSConfig | None = None,
    ) -> AsyncIterator[bytes]:
        """Synthétise le texte via Kokoro et retourne des chunks WAV.

        Kokoro retourne du WAV, pas du MP3. Le frontend useVoicePlayback
        gère les deux formats via AudioContext.decodeAudioData().
        """
        cfg = config or TTSConfig()
        clean_text = self._clean_for_tts(text)

        if not clean_text.strip():
            return

        payload = {
            "text": clean_text,
            "speed": cfg.speed,
        }

        try:
            async with self._client.stream(
                "POST",
                f"{self._base_url}/synthesize",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for chunk in response.aiter_bytes(chunk_size=4096):
                    if chunk:
                        yield chunk
        except httpx.HTTPStatusError as exc:
            logger.error("Kokoro HTTP %d: %s", exc.response.status_code, exc)
            raise RuntimeError(
                f"Erreur TTS Kokoro : code {exc.response.status_code}"
            )
        except httpx.TimeoutException:
            raise RuntimeError("Kokoro timeout — réessaie dans un instant")
        except Exception as exc:
            logger.error("Kokoro error: %s", exc)
            raise RuntimeError("Synthèse vocale indisponible pour le moment")

    def _clean_for_tts(self, text: str) -> str:
        """Nettoie le texte avant synthèse — même logique que ElevenLabsTTS."""
        # Supprime les emojis et symboles non-parlables
        emoji_pattern = re.compile(
            "["
            "\U0001f600-\U0001f64f"
            "\U0001f300-\U0001f5ff"
            "\U0001f680-\U0001f6ff"
            "\U0001f1e0-\U0001f1ff"
            "\U00002702-\U000027b0"
            "\U000024c2-\U0001f251"
            "✓✗⚠✅❌📋📝🗺📄🎤🟢🟡🔴⭐✦•·—"
            "]+",
            flags=re.UNICODE,
        )
        text = emoji_pattern.sub(" ", text)

        # Abréviations NGAP → forme parlée
        ngap_expansions = [
            (r"\bAMI\s*(\d)\b", r"A M I \1"),
            (r"\bAMX\s*(\d)\b", r"A M X \1"),
            (r"\bAIS\s*(\d)\b", r"A I S \1"),
            (r"\bBSI\b", "B S I"),
            (r"\bBSA\b", "B S A"),
            (r"\bBSB\b", "B S B"),
            (r"\bBSC\b", "B S C"),
            (r"\bIFD\b", "I F D"),
            (r"\bIFI\b", "I F I"),
            (r"\bMAU\b", "majoration urgence"),
            (r"\bMCI\b", "majoration nuit profonde"),
            (r"\bMN\b", "majoration nuit"),
            (r"\bMD\b", "majoration dimanche"),
            (r"\bNGAP\b", "N G A P"),
            (r"\bIK\b", "indemnité kilométrique"),
        ]
        for pattern, replacement in ngap_expansions:
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        # Supprime les marqueurs markdown
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
        text = re.sub(r"\*(.+?)\*", r"\1", text)
        text = re.sub(r"_(.+?)_", r"\1", text)
        text = re.sub(r"`(.+?)`", r"\1", text)
        text = re.sub(r"#+\s*", "", text)
        text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)

        # Supprime les tirets de liste
        text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.MULTILINE)

        # Normalise les espaces
        text = re.sub(r"\n+", ". ", text)
        text = re.sub(r"\s+", " ", text).strip()

        return text

    async def health_check(self) -> bool:
        """Vérifie que le micro-service Kokoro est accessible."""
        try:
            response = await self._client.get(
                f"{self._base_url}/health/kokoro",
                timeout=5.0,
            )
            return response.status_code == 200
        except Exception:
            return False
