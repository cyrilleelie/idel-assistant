"""Gestion des actions en attente de confirmation utilisateur.

Clé Redis : agent:confirm:{session_id}:{action_id}
TTL : 60 secondes (CONFIRMATION_TTL)

La suppression atomique lors de consume_pending_action empêche la double confirmation.
"""

import datetime
import json
import logging
import uuid

from app.infrastructure.security.token_blacklist import get_redis

logger = logging.getLogger(__name__)

CONFIRMATION_TTL = 60  # secondes

_CONFIRM_KEY_PREFIX = "agent:confirm:"


def _confirm_key(session_id: str, action_id: str) -> str:
    return f"{_CONFIRM_KEY_PREFIX}{session_id}:{action_id}"


async def store_pending_action(
    session_id: str,
    action_type: str,
    label: str,
    data: dict,
) -> str:
    """Stocke une action en attente dans Redis et retourne l'action_id.

    Args:
        session_id: Identifiant de session WebSocket.
        action_type: Type de l'action (ex: 'create_invoice_draft').
        label: Description lisible pour l'utilisateur (ex: 'Créer la facture AMI 4 — 14,26 €').
        data: Données nécessaires à l'exécution de l'action.

    Returns:
        action_id (UUID str) à transmettre au client pour la confirmation.
    """
    action_id = str(uuid.uuid4())
    expires_at = (
        datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=CONFIRMATION_TTL)
    ).isoformat()

    payload = {
        "action_id": action_id,
        "action_type": action_type,
        "label": label,
        "data": data,
        "expires_at": expires_at,
    }

    try:
        r = await get_redis()
        key = _confirm_key(session_id, action_id)
        await r.setex(key, CONFIRMATION_TTL, json.dumps(payload))
        logger.debug("[CONFIRM] Action stockée (session=%s, type=%s, id=%s)", session_id, action_type, action_id)
    except Exception:
        logger.warning("Impossible de stocker l'action en attente dans Redis", exc_info=True)

    return action_id


async def get_pending_action(session_id: str, action_id: str) -> dict | None:
    """Récupère une action en attente sans la consommer (lecture seule).

    Returns:
        dict avec action_id, action_type, label, data, expires_at — ou None si expiré/inexistant.
    """
    try:
        r = await get_redis()
        raw = await r.get(_confirm_key(session_id, action_id))
        if raw is None:
            return None
        return json.loads(raw)
    except Exception:
        logger.warning("Impossible de récupérer l'action en attente depuis Redis", exc_info=True)
        return None


async def consume_pending_action(session_id: str, action_id: str) -> dict | None:
    """Récupère et SUPPRIME une action en attente (opération atomique).

    La suppression empêche la double confirmation : un deuxième appel retourne None.

    Returns:
        dict avec action_id, action_type, label, data, expires_at — ou None si expiré/inexistant.
    """
    try:
        r = await get_redis()
        key = _confirm_key(session_id, action_id)
        raw = await r.get(key)
        if raw is None:
            logger.debug("[CONFIRM] Action introuvable ou expirée (session=%s, id=%s)", session_id, action_id)
            return None
        # Suppression atomique pour éviter la double confirmation
        await r.delete(key)
        action = json.loads(raw)
        logger.debug("[CONFIRM] Action consommée (session=%s, type=%s)", session_id, action.get("action_type"))
        return action
    except Exception:
        logger.warning("Impossible de consommer l'action en attente depuis Redis", exc_info=True)
        return None
