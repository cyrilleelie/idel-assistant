"""Micro-service HTTP pour faster-whisper.

Expose POST /transcribe et GET /health.

Variables d'environnement :
  WHISPER_MODEL  — chemin local ou identifiant du modèle (défaut: auto-détecté)
  MODELS_DIR     — répertoire des modèles pré-téléchargés (défaut: /models)
  WHISPER_DEVICE — "cuda" (GPU, défaut) ou "cpu"
  COMPUTE_TYPE   — "int8" (défaut GPU), "float32" (recommandé CPU), "float16"
  NUM_WORKERS    — nombre de workers (défaut: 2 GPU, 1 CPU)

Résolution du modèle (par ordre de priorité) :
  1. WHISPER_MODEL si défini explicitement
  2. {MODELS_DIR}/whisper-french si le répertoire existe (modèle pré-téléchargé)
  3. "large-v3" — faster-whisper le télécharge automatiquement depuis HuggingFace
"""

import io
import os
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from faster_whisper import WhisperModel
from pydantic import BaseModel

app = FastAPI()

MODELS_DIR = os.environ.get("MODELS_DIR", "/models")
WHISPER_DEVICE = os.environ.get("WHISPER_DEVICE", "cuda")
COMPUTE_TYPE = os.environ.get("COMPUTE_TYPE", "int8" if WHISPER_DEVICE == "cuda" else "float32")
NUM_WORKERS = int(os.environ.get("NUM_WORKERS", "2" if WHISPER_DEVICE == "cuda" else "1"))
# beam_size=5 est ~5x plus lent que beam_size=1 sur CPU, pour un gain de qualité marginal
BEAM_SIZE = int(os.environ.get("BEAM_SIZE", "5" if WHISPER_DEVICE == "cuda" else "1"))


def _resolve_model_path() -> str:
    """Détermine le modèle à charger."""
    # 1. Variable d'environnement explicite
    explicit = os.environ.get("WHISPER_MODEL")
    if explicit:
        print(f"[whisper] Modèle explicite : {explicit}")
        return explicit

    # 2. Modèle pré-téléchargé dans MODELS_DIR
    local_path = Path(MODELS_DIR) / "whisper-french"
    if local_path.is_dir() and any(local_path.iterdir()):
        print(f"[whisper] Modèle local trouvé : {local_path}")
        return str(local_path)

    # 3. Fallback : identifiant de taille que faster-whisper télécharge seul
    print("[whisper] Pas de modèle local — téléchargement automatique de 'large-v3'")
    return "large-v3"


MODEL_ID = _resolve_model_path()

model = WhisperModel(
    MODEL_ID,
    device=WHISPER_DEVICE,
    compute_type=COMPUTE_TYPE,
    num_workers=NUM_WORKERS,
)

# Prompt médical NGAP (identique à WhisperCloudSTT en iter C)
MEDICAL_PROMPT = """
Transcription d'une infirmière libérale française. Vocabulaire :
AMI, AIS, BSI, MAU, MCI, pansement, injection, insuline, glycémie, INR.
"""


class TranscribeResponse(BaseModel):
    text: str
    language: str
    confidence: float
    duration_seconds: float


@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(audio: UploadFile = File(...)):
    audio_data = await audio.read()
    audio_buffer = io.BytesIO(audio_data)

    segments, info = model.transcribe(
        audio_buffer,
        language="fr",
        initial_prompt=MEDICAL_PROMPT,
        vad_filter=True,
        vad_parameters={
            "min_silence_duration_ms": 500,
            "threshold": 0.5,
        },
        beam_size=BEAM_SIZE,
        word_timestamps=False,
    )

    segments_list = list(segments)
    text = " ".join(s.text.strip() for s in segments_list)
    duration = sum(s.end - s.start for s in segments_list)

    return TranscribeResponse(
        text=text,
        language=info.language,
        confidence=info.language_probability,
        duration_seconds=duration,
    )


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "device": WHISPER_DEVICE,
        "compute_type": COMPUTE_TYPE,
        "beam_size": BEAM_SIZE,
    }
