"""Factory de providers pour l'agent IA.

Instancie le bon provider (cloud ou self-hosted) selon la configuration.
Ajouter un nouveau provider = ajouter un case dans la factory, rien d'autre.
"""

import logging

from app.config import Settings
from app.infrastructure.agent.providers.base import LLMConfig, LLMProvider
from app.infrastructure.agent.providers.mistral_cloud import MistralCloudProvider
from app.infrastructure.agent.providers.vllm_local import VLLMLocalProvider
from app.infrastructure.agent.voice.base import STTProvider, TTSProvider
from app.infrastructure.agent.voice.stt_whisper_cloud import WhisperCloudSTT
from app.infrastructure.agent.voice.stt_local import FasterWhisperLocalSTT
from app.infrastructure.agent.voice.tts_elevenlabs import ElevenLabsTTS
from app.infrastructure.agent.voice.tts_local import KokoroLocalTTS

logger = logging.getLogger(__name__)


def create_llm_provider(s: Settings) -> LLMProvider:
    """Instancie le provider LLM selon LLM_PROVIDER dans les settings."""
    llm_config = LLMConfig(
        model_name=s.llm_model_name,
        base_url=s.llm_base_url,
        temperature=s.llm_temperature,
        max_tokens=s.llm_max_tokens,
    )

    if s.llm_provider == "vllm_local":
        vllm_url = s.vllm_base_url or f"{s.gpu_base_url}/v1"
        config = LLMConfig(
            model_name=s.llm_model_name,
            base_url=vllm_url,
            temperature=s.llm_temperature,
            max_tokens=s.llm_max_tokens,
        )
        logger.info("LLM provider: vLLM local (%s @ %s)", s.llm_model_name, vllm_url)
        return VLLMLocalProvider(config=config)

    if s.llm_provider == "mistral_cloud":
        logger.info("LLM provider: Mistral Cloud (%s)", s.llm_model_name)
        return MistralCloudProvider(api_key=s.mistral_api_key, config=llm_config)

    raise ValueError(f"Provider LLM inconnu : {s.llm_provider}")


def create_stt_provider(s: Settings) -> STTProvider | None:
    """Instancie le provider STT selon STT_PROVIDER dans les settings."""
    if s.stt_provider == "faster_whisper_local":
        whisper_url = s.whisper_local_url or s.gpu_base_url
        if not whisper_url:
            logger.warning("STT faster_whisper_local : aucune URL GPU configurée")
            return None
        logger.info("STT provider: faster-whisper local (%s)", whisper_url)
        return FasterWhisperLocalSTT(base_url=whisper_url)

    if s.stt_provider == "whisper_cloud":
        if not s.openai_api_key:
            logger.warning("STT whisper_cloud : OPENAI_API_KEY manquant")
            return None
        logger.info("STT provider: Whisper Cloud (OpenAI)")
        return WhisperCloudSTT(api_key=s.openai_api_key)

    logger.warning("Provider STT inconnu : %s", s.stt_provider)
    return None


def create_tts_provider(s: Settings) -> TTSProvider | None:
    """Instancie le provider TTS selon TTS_PROVIDER dans les settings."""
    if not s.tts_enabled:
        logger.info("TTS désactivé (tts_enabled=false)")
        return None

    if s.tts_provider == "kokoro_local":
        kokoro_url = s.kokoro_local_url or s.gpu_base_url
        if not kokoro_url:
            logger.warning("TTS kokoro_local : aucune URL GPU configurée")
            return None
        logger.info("TTS provider: Kokoro local (%s)", kokoro_url)
        return KokoroLocalTTS(base_url=kokoro_url)

    if s.tts_provider == "elevenlabs":
        if not s.elevenlabs_api_key:
            logger.warning("TTS elevenlabs : ELEVENLABS_API_KEY manquant")
            return None
        logger.info("TTS provider: ElevenLabs Cloud")
        return ElevenLabsTTS(
            api_key=s.elevenlabs_api_key,
            voice_id=s.elevenlabs_voice_id,
        )

    logger.warning("Provider TTS inconnu : %s", s.tts_provider)
    return None
