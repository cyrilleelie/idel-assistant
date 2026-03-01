"""Sous-module voix de l'agent IA — STT + TTS cloud (itération C).

Providers cloud (itération C) :
  - STT : OpenAI Whisper API (WhisperCloudSTT)
  - TTS : ElevenLabs API (ElevenLabsTTS)

Interfaces abstraites (itération D : migration GPU self-hosted) :
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
