# Runbook — Déploiement GPU OVH

## Prérequis

- Instance OVH T1-45 (A10 24 Go) accessible en SSH
- Réseau vRack actif : `ping 10.0.0.5` depuis l'instance CPU → OK
- Docker + Docker Compose installés sur l'instance GPU
- Disque /data monté (minimum 100 Go pour les modèles)
- Port 9000 ouvert entre CPU et GPU sur le réseau privé (pas sur internet public)
- Contrat HDS OVH signé

## Démarrage initial

```bash
# 1. Connexion à l'instance GPU
ssh ubuntu@{IP_PUBLIQUE_OVH}

# 2. Téléchargement des modèles (première fois seulement, ~1h)
cd /opt/idel-gpu
bash scripts/download_models.sh

# 3. Copier les fichiers d'infrastructure
# Les fichiers sont dans le répertoire gpu/ du dépôt
scp -r gpu/* ubuntu@{IP_PUBLIQUE_OVH}:/opt/idel-gpu/

# 4. Démarrage des services GPU
cd /opt/idel-gpu
docker compose -f docker-compose.gpu.yml up -d

# 5. Vérification santé des services
curl http://localhost:9000/health/vllm     # {"status": "ok"}
curl http://localhost:9000/health/whisper   # {"status": "ok"}
curl http://localhost:9000/health/kokoro    # {"status": "ok"}

# 6. Vérification VRAM
nvidia-smi
# vLLM ~20 Go + whisper ~3 Go = ~23 Go sur 24 Go
```

## Migration cloud → GPU (côté applicatif)

```bash
# Sur le serveur applicatif FastAPI

# 1. Modifier .env
cp .env .env.cloud.backup

# Ajouter / modifier ces variables :
# LLM_PROVIDER=vllm_local
# LLM_MODEL_NAME=mistral-small-3.1-awq
# STT_PROVIDER=faster_whisper_local
# TTS_PROVIDER=kokoro_local
# GPU_BASE_URL=http://10.0.0.5:9000

# 2. Redémarrer FastAPI
docker compose restart api

# 3. Vérifier le health check
curl https://api.idel-assistant.fr/api/v1/agent/health
# → providers.llm.is_local=true, hds_compliant=true

# 4. Test rapide
# → Ouvrir le dashboard, envoyer un message, vérifier la latence dans le widget admin
```

## Rollback vers cloud (si problème)

```bash
# Sur le serveur applicatif
cp .env.cloud.backup .env
docker compose restart api
# L'agent repasse en mode cloud en ~10 secondes
```

## Surveillance

### Commandes de diagnostic

```bash
# Sur l'instance GPU
nvidia-smi                                    # Charge GPU et VRAM
docker logs idel-vllm --tail 50               # Logs vLLM
docker logs idel-whisper --tail 50             # Logs faster-whisper
docker logs idel-kokoro --tail 50              # Logs Kokoro
docker compose -f docker-compose.gpu.yml ps   # Santé des containers
```

### Alertes

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| TTFT > 500ms | Charge GPU élevée | Vérifier `nvidia-smi`, réduire `--max-num-seqs` |
| Erreur STT | whisper container down | `docker restart idel-whisper` |
| Erreur TTS | kokoro container down | `docker restart idel-kokoro` |
| vLLM OOM | VRAM saturée | Réduire `--gpu-memory-utilization` à 0.80 |
| Container restart loop | Modèle corrompu | Re-télécharger via `download_models.sh` |

### Métriques Redis

```bash
# Sur le serveur applicatif
redis-cli LRANGE agent:metrics:ttft_ms 0 9        # 10 derniers TTFT
redis-cli LRANGE agent:metrics:stt_latency_ms 0 9  # 10 dernières latences STT
redis-cli GET agent:stats:sessions:$(date +%Y-%m-%d)  # Sessions du jour
```

## Benchmark

```bash
# Avant migration (depuis le serveur applicatif)
cd backend
uv run python ../scripts/benchmark_latency.py --mode cloud

# Après migration
uv run python ../scripts/benchmark_latency.py --mode gpu

# Les rapports sont dans docs/benchmarks/
```
