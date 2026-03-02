#!/bin/bash
# À exécuter sur l'instance OVH A10 24 Go
# Télécharge les modèles nécessaires dans /data/models/

set -e

MODELS_DIR="/data/models"
mkdir -p "$MODELS_DIR"

echo "=== Téléchargement Mistral Small 3.1 (AWQ INT4) ==="
# ~15 Go VRAM en inférence INT4
pip install huggingface_hub
huggingface-cli download \
  casperhansen/mistral-small-3.1-24b-instruct-awq \
  --local-dir "$MODELS_DIR/mistral-small-3.1-awq" \
  --include "*.safetensors" "*.json" "*.tiktoken"

echo "=== Téléchargement faster-whisper French ==="
# ~3 Go VRAM en INT8
huggingface-cli download \
  bofenghuang/whisper-large-v3-french \
  --local-dir "$MODELS_DIR/whisper-french" \
  --include "*.bin" "*.json"

echo "=== Téléchargement Kokoro-82M (TTS) ==="
# ~0.3 Go RAM (CPU)
pip install kokoro
python -c "
from kokoro import KPipeline
pipe = KPipeline(lang_code='fr')  # Déclenche le téléchargement
print('Kokoro téléchargé.')
"

echo "=== Vérification espace disque ==="
df -h /data
du -sh "$MODELS_DIR/"*

echo "=== Modèles prêts. ==="
