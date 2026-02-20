"""Middleware FastAPI : audit logging."""

import datetime
import logging
from uuid import UUID, uuid4

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.infrastructure.persistence.database import async_session_factory
from app.infrastructure.persistence.models.audit_log_model import AuditLogModel

logger = logging.getLogger(__name__)

# Mapping path → entity_type
_ENTITY_MAP = {
    "patients": "patient",
    "appointments": "appointment",
    "care-protocols": "care_protocol",
    "tournees": "tournee",
    "sectors": "sector",
    "invoices": "invoice",
    "transmissions": "transmission",
}

# Mapping method → action
_ACTION_MAP = {
    "POST": "create",
    "PATCH": "update",
    "PUT": "update",
    "DELETE": "delete",
}


def _extract_entity_type(path: str) -> str | None:
    """Déduit l'entity_type à partir du chemin de la requête."""
    parts = path.strip("/").split("/")
    # /api/v1/<entity>/...
    for part in parts:
        if part in _ENTITY_MAP:
            return _ENTITY_MAP[part]
    return None


def _extract_entity_id(path: str) -> str | None:
    """Tente d'extraire un UUID d'ID d'entité du chemin."""
    parts = path.strip("/").split("/")
    for part in parts:
        try:
            UUID(part)
            return part
        except ValueError:
            continue
    return None


class AuditMiddleware(BaseHTTPMiddleware):
    """Log les opérations d'écriture (POST, PATCH, DELETE) dans audit_logs."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Ne log que les opérations d'écriture réussies
        if request.method not in _ACTION_MAP:
            return response
        if response.status_code >= 400:
            return response

        # Exclut les routes non-API et auth
        path = request.url.path
        if not path.startswith("/api/"):
            return response
        if "/auth/" in path:
            return response

        entity_type = _extract_entity_type(path)
        if not entity_type:
            return response

        action = _ACTION_MAP[request.method]
        entity_id = _extract_entity_id(path)

        # Extraire user_id et cabinet_id depuis request.state (posé par les deps)
        user_id = getattr(request.state, "user_id", None)
        cabinet_id = getattr(request.state, "cabinet_id", None)

        if not user_id or not cabinet_id:
            return response

        # entity_id est optionnel (pas d'ID pour les POST de création)
        entity_uuid = None
        if entity_id:
            try:
                entity_uuid = UUID(entity_id)
            except ValueError:
                entity_uuid = None

        try:
            async with async_session_factory() as session:
                audit = AuditLogModel(
                    id=uuid4(),
                    cabinet_id=cabinet_id,
                    user_id=user_id,
                    entity_type=entity_type,
                    entity_id=entity_uuid,
                    action=action,
                    changes={},
                    ip_address=request.client.host if request.client else "",
                    created_at=datetime.datetime.now(datetime.UTC),
                )
                session.add(audit)
                await session.commit()
        except Exception:
            # Ne bloque pas la réponse si le logging échoue
            logger.exception("Erreur lors de l'écriture de l'audit log")

        return response
