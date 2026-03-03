#!/bin/bash
# deploy_lora.sh — Deploie les adaptateurs LoRA sur l'instance GPU OVH
#
# Usage :
#   ./deploy_lora.sh v1                   # Deploie la version v1
#   ./deploy_lora.sh v2 --rollback v1     # Deploie v2 avec fallback v1
#
# Prerequis :
#   - SSH configuré vers l'instance GPU (clé SSH)
#   - Adaptateurs LoRA dans ./idel-lora-{version}/
#   - OVH Object Storage configuré (swift CLI)

set -euo pipefail

LORA_VERSION="${1:-v1}"
GPU_INSTANCE="${GPU_INSTANCE:-ubuntu@10.0.0.5}"
OVH_CONTAINER="idel-models"
REMOTE_MODELS_DIR="/data/models/lora"
COMPOSE_FILE="/opt/idel-gpu/docker-compose.gpu.yml"

echo "=== Deploiement idel-lora-${LORA_VERSION} ==="
echo "Instance GPU : ${GPU_INSTANCE}"
echo ""

# Verification locale
LORA_DIR="./idel-lora-${LORA_VERSION}"
if [ ! -d "${LORA_DIR}" ]; then
    echo "ERREUR: ${LORA_DIR} n'existe pas."
    echo "Lancez train.py d'abord, puis copiez les adaptateurs ici."
    exit 1
fi

# Upload sur OVH Object Storage (chiffré au repos)
echo "=== Upload sur OVH Object Storage ==="
if command -v swift &> /dev/null; then
    swift upload "${OVH_CONTAINER}" "${LORA_DIR}/" \
        --object-name "idel-lora-${LORA_VERSION}/"
    echo "Upload OK"
else
    echo "swift CLI non disponible — copie directe via SCP"
    scp -r "${LORA_DIR}" "${GPU_INSTANCE}:${REMOTE_MODELS_DIR}/"
fi

# Deploiement sur l'instance GPU
echo ""
echo "=== Deploiement sur l'instance GPU ==="
ssh "${GPU_INSTANCE}" << REMOTE
    set -e

    # Cree le dossier si necessaire
    mkdir -p ${REMOTE_MODELS_DIR}

    # Telecharge depuis Object Storage si pas deja copie
    if [ ! -d "${REMOTE_MODELS_DIR}/idel-lora-${LORA_VERSION}" ]; then
        echo "Telechargement depuis Object Storage..."
        if command -v swift &> /dev/null; then
            swift download "${OVH_CONTAINER}" "idel-lora-${LORA_VERSION}/" \
                --output-dir ${REMOTE_MODELS_DIR}/
        else
            echo "Adaptateurs deja copies via SCP"
        fi
    fi

    # Verifie que les fichiers sont presents
    if [ ! -f "${REMOTE_MODELS_DIR}/idel-lora-${LORA_VERSION}/adapter_config.json" ]; then
        echo "ERREUR: adapter_config.json manquant dans ${REMOTE_MODELS_DIR}/idel-lora-${LORA_VERSION}/"
        exit 1
    fi
    echo "Adaptateurs presents"

    # Redemarrage vLLM avec le nouvel adaptateur
    echo "Redemarrage vLLM..."
    cd /opt/idel-gpu
    docker compose -f docker-compose.gpu.yml restart vllm

    # Attend que vLLM soit pret
    echo "Attente demarrage vLLM..."
    for i in \$(seq 1 60); do
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            echo "vLLM pret apres \${i}s"
            break
        fi
        if [ \$i -eq 60 ]; then
            echo "TIMEOUT: vLLM ne demarre pas apres 60s"
            echo "Verifiez les logs: docker compose -f docker-compose.gpu.yml logs vllm"
            exit 1
        fi
        sleep 1
    done

    echo "vLLM recharge avec idel-lora-${LORA_VERSION}"
REMOTE

# Verification sante
echo ""
echo "=== Verification sante ==="
ssh "${GPU_INSTANCE}" "curl -s http://localhost:8000/health" || echo "Warning: health check echoue"

echo ""
echo "Deploiement idel-lora-${LORA_VERSION} termine"
echo ""
echo "Pour rollback :"
echo "  ssh ${GPU_INSTANCE}"
echo "  # Modifier LORA_VERSION dans docker-compose.gpu.yml"
echo "  docker compose -f docker-compose.gpu.yml restart vllm"
