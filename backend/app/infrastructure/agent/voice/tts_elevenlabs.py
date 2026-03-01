"""Implémentation TTS via ElevenLabs API avec streaming.

Voix française naturelle, latence TTFB ~200ms.
Remplacé par Kokoro self-hosted en itération D.

Notes :
- Les chunks retournés sont des fragments MP3
- Le navigateur peut les décoder via AudioContext.decodeAudioData()
- Safari peut nécessiter du buffering (2-3 chunks) avant décodage
- ElevenLabs supporte eleven_multilingual_v2 pour le français
"""

import logging
import re
from collections.abc import AsyncIterator

import httpx

from app.infrastructure.agent.voice.base import TTSProvider, TTSConfig

logger = logging.getLogger(__name__)

_ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# Abréviations françaises qui ne sont PAS des fins de phrase
_FR_ABBREVIATIONS = frozenset([
    "M", "Mme", "Mme.", "Dr", "Dr.", "Pr", "Pr.", "Mr",
    "cf", "etc", "ex", "fig", "no", "n°", "p",
    "vs", "vol", "env",
])


def split_into_sentences(text: str) -> list[str]:
    """
    Découpe un texte en phrases pour le streaming TTS phrase par phrase.

    Respecte les abréviations françaises courantes (M., Mme., Dr., etc.)
    qui ne sont pas des fins de phrase.

    Args:
        text: Texte à découper.

    Returns:
        Liste de phrases non-vides.
    """
    if not text.strip():
        return []

    # Remplace temporairement les abréviations pour éviter le split dessus
    protected = text
    for abbr in _FR_ABBREVIATIONS:
        # Remplace "M." par "M<DOT>" pour ne pas le confondre avec une fin de phrase
        protected = re.sub(
            r"\b" + re.escape(abbr) + r"\.",
            abbr.rstrip(".") + "<DOT>",
            protected,
        )

    # Découpe sur . ? ! (suivi d'espace + majuscule, ou fin de chaîne)
    raw_sentences = re.split(r"(?<=[.?!])\s+(?=[A-ZÀÂÉÈÊËÎÏÔÙÛÜÇ\"«(])|(?<=[.?!])$", protected)

    # Restaure les abréviations protégées
    result = []
    for s in raw_sentences:
        s = s.replace("<DOT>", ".").strip()
        if s:
            result.append(s)

    return result if result else [text.strip()]


class ElevenLabsTTS(TTSProvider):
    """
    TTS via ElevenLabs API avec streaming audio MP3.

    Filtre automatiquement les caractères non-parlables (emojis, markdown,
    URLs) et développe les abréviations NGAP en forme parlée.
    """

    def __init__(self, api_key: str, voice_id: str = "charlotte") -> None:
        if not api_key:
            raise ValueError("ELEVENLABS_API_KEY est requis pour ElevenLabsTTS")
        self._api_key = api_key
        self._voice_id = voice_id

    @property
    def is_local(self) -> bool:
        return False

    @property
    def provider_name(self) -> str:
        return "elevenlabs"

    async def synthesize(
        self,
        text: str,
        config: TTSConfig | None = None,
    ) -> AsyncIterator[bytes]:
        """
        Synthétise le texte et retourne un générateur asynchrone de chunks MP3.

        ElevenLabs supporte le streaming natif via /stream — les chunks sont
        des fragments MP3 lisibles via AudioContext.decodeAudioData() côté client.

        Args:
            text: Texte à synthétiser (sera nettoyé automatiquement).
            config: Configuration TTS optionnelle.

        Yields:
            Chunks bytes MP3.
        """
        cfg = config or TTSConfig()
        clean_text = self._clean_for_tts(text)

        if not clean_text.strip():
            return  # Texte vide après nettoyage

        payload = {
            "text": clean_text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "speed": cfg.speed,
            },
        }

        url = f"{_ELEVENLABS_BASE_URL}/text-to-speech/{self._voice_id}/stream"
        headers = {
            "xi-api-key": self._api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_bytes(chunk_size=4096):
                        if chunk:
                            yield chunk
        except httpx.HTTPStatusError as exc:
            logger.error("ElevenLabs HTTP %d: %s", exc.response.status_code, exc)
            raise RuntimeError(f"Erreur TTS ElevenLabs : code {exc.response.status_code}")
        except httpx.TimeoutException:
            raise RuntimeError("ElevenLabs timeout — réessaie dans un instant")
        except Exception as exc:
            logger.error("ElevenLabs error: %s", exc)
            raise RuntimeError("Synthèse vocale indisponible pour le moment")

    def _clean_for_tts(self, text: str) -> str:
        """
        Nettoie le texte avant synthèse vocale :
        - Supprime les emojis et symboles non-parlables
        - Développe les abréviations NGAP en forme parlée
        - Supprime le markdown (* _ ` # [link](url))
        - Normalise les espaces multiples
        """
        # Supprime les emojis et symboles courants dans les réponses de l'agent
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map
            "\U0001F1E0-\U0001F1FF"  # flags
            "\U00002702-\U000027B0"  # dingbats
            "\U000024C2-\U0001F251"  # misc symbols
            "✓✗⚠✅❌📋📝🗺📄🎤🟢🟡🔴⭐✦•·—"
            "]+",
            flags=re.UNICODE,
        )
        text = emoji_pattern.sub(" ", text)

        # Abréviations NGAP → forme parlée (pour une lecture naturelle)
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
        text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)   # **gras** → gras
        text = re.sub(r"\*(.+?)\*", r"\1", text)         # *italique* → italique
        text = re.sub(r"_(.+?)_", r"\1", text)           # _souligné_ → souligné
        text = re.sub(r"`(.+?)`", r"\1", text)           # `code` → code
        text = re.sub(r"#+\s*", "", text)                 # Titres # → rien
        text = re.sub(r"\[(.+?)\]\(.+?\)", r"\1", text)  # [texte](url) → texte

        # Supprime les tirets de liste en début de ligne
        text = re.sub(r"^\s*[-•]\s*", "", text, flags=re.MULTILINE)

        # Normalise les espaces multiples et les sauts de ligne
        text = re.sub(r"\n+", ". ", text)
        text = re.sub(r"\s+", " ", text).strip()

        return text

    async def health_check(self) -> bool:
        """Vérifie que l'API ElevenLabs est accessible."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{_ELEVENLABS_BASE_URL}/user",
                    headers={"xi-api-key": self._api_key},
                )
                return response.status_code == 200
        except Exception:
            return False
