"""Sous-module voix de l'agent IA — STT + TTS cloud et self-hosted.

Providers cloud (itération C) :
  - STT : OpenAI Whisper API (WhisperCloudSTT)
  - TTS : ElevenLabs API (ElevenLabsTTS)

Providers self-hosted GPU (itération D) :
  - STT : faster-whisper via micro-service (FasterWhisperLocalSTT)
  - TTS : Kokoro-82M via micro-service (KokoroLocalTTS)

Interfaces abstraites :
  - STTProvider, TTSProvider dans base.py

Fonctionnalités :
  - Pseudonymisation post-transcription (pseudonymizer.py)
  - Terminologie médicale NGAP pour Whisper (hotwords.py)
  - Détection de silence / trim (vad.py)
"""

from app.infrastructure.agent.voice.base import (
    STTProvider,
    TTSProvider,
    TTSConfig,
    TranscriptionResult,
)

__all__ = [
    "STTProvider",
    "TTSProvider",
    "TTSConfig",
    "TranscriptionResult",
]
