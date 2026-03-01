"""Gestion de l'historique de conversation en Redis.

Clé Redis : agent:session:{session_id}
Valeur : JSON list de messages {"role": "user"|"assistant", "content": "..."}
TTL : agent_session_ttl_seconds (défaut 4h)
Fenêtre glissante : agent_max_history_messages (défaut 20)
"""

import json
import logging

from app.config import settings
from app.infrastructure.security.token_blacklist import get_redis

logger = logging.getLogger(__name__)

_SESSION_KEY_PREFIX = "agent:session:"


def _session_key(session_id: str) -> str:
    return f"{_SESSION_KEY_PREFIX}{session_id}"


async def get_history(session_id: str) -> list[dict]:
    """Récupère l'historique de la session depuis Redis."""
    try:
        r = await get_redis()
        raw = await r.get(_session_key(session_id))
        if raw is None:
            return []
        return json.loads(raw)
    except Exception:
        logger.warning("Impossible de lire l'historique agent depuis Redis", exc_info=True)
        return []


async def save_message(session_id: str, role: str, content: str) -> None:
    """Ajoute un message à l'historique et renouvelle le TTL.

    Applique une fenêtre glissante de agent_max_history_messages messages.
    """
    try:
        r = await get_redis()
        key = _session_key(session_id)
        raw = await r.get(key)
        history: list[dict] = json.loads(raw) if raw else []

        history.append({"role": role, "content": content})

        # Fenêtre glissante
        max_msgs = settings.agent_max_history_messages
        if len(history) > max_msgs:
            history = history[-max_msgs:]

        await r.setex(key, settings.agent_session_ttl_seconds, json.dumps(history))
    except Exception:
        logger.warning("Impossible de sauvegarder le message agent dans Redis", exc_info=True)


async def clear_session(session_id: str) -> None:
    """Supprime l'historique de la session."""
    try:
        r = await get_redis()
        await r.delete(_session_key(session_id))
    except Exception:
        logger.warning("Impossible de supprimer la session agent depuis Redis", exc_info=True)
