"""Micro-service HTTP pour Kokoro-82M TTS.

Expose POST /synthesize et GET /health.
Tourne sur CPU — ne consomme pas de VRAM.
"""

import io
import re

import soundfile as sf
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from kokoro import KPipeline
from pydantic import BaseModel

app = FastAPI()

# Chargement pipeline au démarrage (~0.3 Go RAM)
# Code langue Kokoro : "f" = fr-fr (pas "fr")
# Codes valides : a=en-us, b=en-gb, e=es, f=fr-fr, h=hi, i=it, p=pt-br, j=ja, z=zh
pipeline = KPipeline(lang_code="f")

FRENCH_VOICE = "ff_siwis"


class SynthesizeRequest(BaseModel):
    text: str
    voice: str = FRENCH_VOICE
    speed: float = 1.0


@app.post("/synthesize")
async def synthesize(request: SynthesizeRequest):
    """Synthétise le texte et retourne de l'audio WAV en streaming.

    Latence TTFB : ~50ms pour une phrase courte.
    """
    clean = _clean_for_tts(request.text)
    if not clean.strip():
        return StreamingResponse(io.BytesIO(b""), media_type="audio/wav")

    # Collecte les segments audio générés par Kokoro
    import numpy as np

    audio_arrays = []
    # Pipeline Kokoro retourne (graphemes, phonemes, audio) par segment
    for _graphemes, _phonemes, audio_segment in pipeline(
        clean, voice=request.voice, speed=request.speed
    ):
        # Convertir tensor PyTorch en numpy si nécessaire
        if hasattr(audio_segment, "numpy"):
            audio_segment = audio_segment.numpy()
        if not isinstance(audio_segment, np.ndarray):
            audio_segment = np.asarray(audio_segment)
        if audio_segment.ndim >= 1 and audio_segment.size > 0:
            audio_arrays.append(audio_segment)

    if not audio_arrays:
        return StreamingResponse(io.BytesIO(b""), media_type="audio/wav")

    # Concatène tous les segments et encode en WAV
    full_audio = np.concatenate(audio_arrays) if len(audio_arrays) > 1 else audio_arrays[0]
    wav_buffer = io.BytesIO()
    sf.write(wav_buffer, full_audio, samplerate=24000, format="WAV")
    wav_buffer.seek(0)

    return StreamingResponse(wav_buffer, media_type="audio/wav")


def _clean_for_tts(text: str) -> str:
    """Identique à ElevenLabsTTS._clean_for_tts — même logique de nettoyage."""
    text = re.sub(r"[✓✗⚠️❌📋📝🗺️📄🎤•]", "", text)
    text = re.sub(r"\bAMI\s*(\d)\b", r"A M I \1", text)
    text = re.sub(r"\bAIS\s*(\d)\b", r"A I S \1", text)
    text = re.sub(r"\bBSI\b", "B S I", text)
    text = re.sub(r"[*_`#]", "", text)
    return re.sub(r"\s+", " ", text).strip()


@app.get("/health")
async def health():
    return {"status": "ok", "model": "kokoro-82m", "device": "cpu", "voice": FRENCH_VOICE}
