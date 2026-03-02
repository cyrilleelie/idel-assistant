"""Collecte et agrégation des métriques de latence de l'agent IA.

Stocke les mesures dans Redis (TTL 24h) et calcule mean/p95/p99
pour l'affichage dans le widget AgentMonitorWidget.
"""

import json
import logging
import time
from datetime import datetime, UTC

logger = logging.getLogger(__name__)

METRICS_TTL = 86400  # 24h
_MAX_ENTRIES = 100   # Garde les 100 dernières mesures par métrique


async def record_latency(redis_client, metric_name: str, value_ms: float) -> None:
    """Enregistre une mesure de latence dans Redis.

    Garde les 100 dernières mesures pour chaque métrique.
    """
    key = f"agent:metrics:{metric_name}"
    entry = json.dumps({"ts": time.time(), "value": round(value_ms, 2)})
    try:
        await redis_client.lpush(key, entry)
        await redis_client.ltrim(key, 0, _MAX_ENTRIES - 1)
        await redis_client.expire(key, METRICS_TTL)
    except Exception:
        logger.debug("Impossible d'enregistrer la métrique %s", metric_name)


async def record_session(redis_client) -> None:
    """Incrémente le compteur de sessions du jour."""
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    key = f"agent:stats:sessions:{today}"
    try:
        await redis_client.incr(key)
        await redis_client.expire(key, METRICS_TTL)
    except Exception:
        pass


async def record_action(redis_client) -> None:
    """Incrémente le compteur d'actions du jour."""
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    key = f"agent:stats:actions:{today}"
    try:
        await redis_client.incr(key)
        await redis_client.expire(key, METRICS_TTL)
    except Exception:
        pass


async def get_latency_stats(redis_client) -> dict:
    """Calcule les statistiques de latence depuis Redis.

    Retourne : mean, p95, p99, count pour chaque métrique.
    """
    metrics_to_collect = [
        "ttft_ms",
        "stt_latency_ms",
        "tts_ttfb_ms",
        "voice_to_voice_ms",
    ]

    stats: dict = {}
    for metric in metrics_to_collect:
        key = f"agent:metrics:{metric}"
        try:
            raw_entries = await redis_client.lrange(key, 0, _MAX_ENTRIES - 1)
        except Exception:
            raw_entries = []

        if not raw_entries:
            stats[metric] = {"mean": None, "p95": None, "p99": None, "count": 0}
            continue

        values = sorted(
            json.loads(e if isinstance(e, str) else e.decode())["value"]
            for e in raw_entries
        )
        count = len(values)
        mean = sum(values) / count
        p95_idx = int(count * 0.95)
        p99_idx = int(count * 0.99)

        stats[metric] = {
            "mean": round(mean, 1),
            "p95": round(values[min(p95_idx, count - 1)], 1),
            "p99": round(values[min(p99_idx, count - 1)], 1),
            "count": count,
        }

    # Statistiques des sessions du jour
    today = datetime.now(UTC).strftime("%Y-%m-%d")
    try:
        sessions_raw = await redis_client.get(f"agent:stats:sessions:{today}")
        actions_raw = await redis_client.get(f"agent:stats:actions:{today}")
        sessions_today = int(sessions_raw) if sessions_raw else 0
        actions_today = int(actions_raw) if actions_raw else 0
    except Exception:
        sessions_today = 0
        actions_today = 0

    stats["sessions_today"] = sessions_today
    stats["actions_today"] = actions_today

    return stats
