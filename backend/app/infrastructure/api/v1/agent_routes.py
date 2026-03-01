"""Routes FastAPI pour l'agent IA : WebSocket streaming + health check."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.agent.context import AgentContext, AgentDeps
from app.infrastructure.agent.orchestrator import AgentOrchestrator, create_idel_agent
from app.infrastructure.agent.providers import LLMConfig, MistralCloudProvider
from app.infrastructure.api.dependencies import AuthContext, get_current_user
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models.user_model import CabinetMemberModel
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemyTransmissionRepo,
    SQLAlchemyTourneeRepo,
)
from app.infrastructure.security.jwt_handler import TokenError, verify_token
from app.infrastructure.security.key_manager import KeyManager
from app.infrastructure.security.token_blacklist import get_redis, is_token_blacklisted

from sqlalchemy import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Agent IA"])

# ── Singleton orchestrateur (initialisé au premier appel) ────────────────────

_orchestrator: AgentOrchestrator | None = None


def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        llm_config = LLMConfig(
            model_name=settings.llm_model_name,
            base_url=settings.llm_base_url,
            temperature=settings.llm_temperature,
            max_tokens=settings.llm_max_tokens,
        )
        provider = MistralCloudProvider(
            api_key=settings.mistral_api_key,
            config=llm_config,
        )
        agent = create_idel_agent(provider)
        _orchestrator = AgentOrchestrator(agent, model_name=settings.llm_model_name)
    return _orchestrator


# ── Health check ─────────────────────────────────────────────────────────────


@router.get("/health")
async def agent_health(current_user: AuthContext = Depends(get_current_user)):
    """Vérifie que le provider LLM et Redis sont accessibles."""
    llm_config = LLMConfig(
        model_name=settings.llm_model_name,
        base_url=settings.llm_base_url,
        temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
    )
    provider = MistralCloudProvider(
        api_key=settings.mistral_api_key,
        config=llm_config,
    )

    llm_ok = await provider.health_check() if settings.mistral_api_key else False

    redis_ok = False
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        pass

    return {
        "status": "ok" if (redis_ok) else "degraded",
        "provider": settings.llm_provider,
        "model": settings.llm_model_name,
        "llm_reachable": llm_ok,
        "redis_ok": redis_ok,
        "api_key_configured": bool(settings.mistral_api_key),
    }


# ── WebSocket chat ────────────────────────────────────────────────────────────


@router.websocket("/chat")
async def agent_chat(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """WebSocket pour le chat agent IA.

    Authentification via query param ?token=<JWT> (headers non disponibles
    lors du handshake WebSocket).

    Protocol :
      client → {"message": "...", "session_id": "..."}
      server → {"type": "token", "content": "..."}  (streaming)
      server → {"type": "end", "usage": {...}}
      server → {"type": "error", "message": "..."}

    IMPORTANT : websocket.accept() DOIT être appelé avant tout websocket.close()
    avec un code personnalisé. Sinon Starlette envoie un TCP RST → ECONNRESET.
    """
    logger.info("[WS] Nouvelle tentative de connexion WebSocket")

    # --- Accepter d'abord, authentifier ensuite ---
    # Le handshake doit être complété avant tout envoi de close code.
    await websocket.accept()
    logger.info("[WS] Connexion acceptée au niveau TCP, authentification en cours")

    # --- Vérifier le JWT ---
    try:
        payload = verify_token(token)
    except TokenError as exc:
        logger.warning("[WS] JWT invalide : %s", exc)
        await websocket.close(code=4001)
        return
    except Exception:
        logger.exception("[WS] Erreur inattendue lors de verify_token")
        await websocket.close(code=4001)
        return

    if payload.get("type") != "access":
        logger.warning("[WS] Token n'est pas un access token")
        await websocket.close(code=4001)
        return

    jti = payload.get("jti")
    if jti:
        try:
            if await is_token_blacklisted(jti):
                logger.warning("[WS] Token révoqué (jti=%s)", jti)
                await websocket.close(code=4001)
                return
        except Exception:
            pass  # fail-open sur Redis indisponible

    user_id_str = payload.get("sub")
    cabinet_id_str = payload.get("cabinet_id")
    if not user_id_str or not cabinet_id_str:
        logger.warning("[WS] sub ou cabinet_id manquant dans le token")
        await websocket.close(code=4001)
        return

    try:
        user_id = UUID(user_id_str)
        cabinet_id = UUID(cabinet_id_str)
    except ValueError:
        logger.warning("[WS] UUID invalide dans le token")
        await websocket.close(code=4001)
        return

    # Vérifier membership cabinet
    try:
        result = await db.execute(
            select(CabinetMemberModel).where(
                CabinetMemberModel.cabinet_id == cabinet_id,
                CabinetMemberModel.user_id == user_id,
                CabinetMemberModel.is_active.is_(True),
            )
        )
        member = result.scalar_one_or_none()
    except Exception:
        logger.exception("[WS] Erreur DB lors de la vérification membership")
        await websocket.close(code=1011)
        return

    if member is None:
        logger.warning("[WS] Membership cabinet introuvable (user=%s, cabinet=%s)", user_id_str, cabinet_id_str)
        await websocket.close(code=4003)
        return

    # Activer RLS
    try:
        await db.execute(
            text("SELECT set_config('app.current_cabinet_id', :cid, true)"),
            {"cid": str(cabinet_id)},
        )
    except Exception:
        logger.exception("[WS] Erreur DB lors de set_config RLS")
        await websocket.close(code=1011)
        return

    logger.info("[WS] Authentification OK (user=%s, cabinet=%s, role=%s)", user_id, cabinet_id, member.role)

    km = KeyManager(settings.encryption_master_key)
    orchestrator = get_orchestrator()

    try:
        while True:
            data = await websocket.receive_json()

            # Rétrocompatibilité : {"message": "..."} → {"type": "text", "content": "..."}
            if "type" not in data and "message" in data:
                data = {"type": "text", "content": data["message"], "session_id": data.get("session_id", "default")}

            session_id = data.get("session_id", "default")

            # Pour les types "text" : vérifier que le contenu n'est pas vide
            if data.get("type", "text") == "text":
                content = (data.get("content") or data.get("message", "")).strip()
                if not content:
                    continue

            context = AgentContext(
                user_id=user_id,
                cabinet_id=cabinet_id,
                role=member.role,
                session_id=session_id,
            )
            deps = AgentDeps(
                db=db,
                context=context,
                patient_repo=SQLAlchemyPatientRepo(db, km),
                appointment_repo=SQLAlchemyAppointmentRepo(db),
                invoice_repo=SQLAlchemyInvoiceRepo(db),
                tournee_repo=SQLAlchemyTourneeRepo(db),
                care_catalog_repo=SQLAlchemyCareCatalogRepo(db),
                key_manager=km,
                transmission_repo=SQLAlchemyTransmissionRepo(db, km),
            )

            async for chunk in orchestrator.run_streaming(data, deps):
                await websocket.send_text(chunk)

    except WebSocketDisconnect:
        logger.info("Client WebSocket déconnecté (session=%s)", session_id if 'session_id' in dir() else "?")
    except Exception:
        logger.exception("Erreur inattendue dans le WebSocket agent")
        try:
            import json
            await websocket.send_text(json.dumps({"type": "error", "message": "Erreur interne du serveur"}))
        except Exception:
            pass
