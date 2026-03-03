"""Routes FastAPI pour l'agent IA : WebSocket streaming, voix, health check et feedback.

Itération E — ajout feedback terrain (👍👎✏️) et export pour fine-tuning.
  POST /agent/transcribe         — STT (audio → texte), pipeline REST push-to-talk
  WS   /agent/voice              — pipeline voix complet (audio ↔ agent ↔ audio)
  GET  /agent/health             — statut complet des providers + métriques
  POST /agent/feedback           — enregistre un feedback sur une réponse
  GET  /agent/feedback/stats     — statistiques de satisfaction (30 jours)
  GET  /agent/feedback/export    — export corrections pour fine-tuning (admin)
"""

import asyncio
import datetime
import json
import logging
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentContext, AgentDeps
from app.infrastructure.agent.factory import create_llm_provider, create_stt_provider, create_tts_provider
from app.infrastructure.agent.metrics import get_latency_stats
from app.infrastructure.agent.orchestrator import AgentOrchestrator, create_idel_agent
from app.infrastructure.agent.voice.base import STTProvider, TTSProvider
from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript
from app.infrastructure.agent.voice.tts_elevenlabs import split_into_sentences
from app.infrastructure.agent.voice.vad import trim_silence
from app.infrastructure.api.dependencies import AuthContext, get_current_user
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models.agent_feedback_model import AgentFeedbackModel
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Agent IA"])

# ── Singletons (initialisés au premier appel) ─────────────────────────────────

_orchestrator: AgentOrchestrator | None = None
_stt_provider: STTProvider | None = None
_tts_provider: TTSProvider | None = None


def get_orchestrator() -> AgentOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        provider = create_llm_provider(settings)
        agent = create_idel_agent(provider)
        _orchestrator = AgentOrchestrator(agent, model_name=settings.llm_model_name)
    return _orchestrator


def get_stt_provider() -> STTProvider | None:
    """Retourne le provider STT configuré via la factory."""
    global _stt_provider
    if _stt_provider is None:
        _stt_provider = create_stt_provider(settings)
    return _stt_provider


def get_tts_provider() -> TTSProvider | None:
    """Retourne le provider TTS configuré via la factory."""
    global _tts_provider
    if _tts_provider is None:
        _tts_provider = create_tts_provider(settings)
    return _tts_provider


# ── Health check ─────────────────────────────────────────────────────────────


@router.get("/health")
async def agent_health(current_user: AuthContext = Depends(get_current_user)):
    """Health check complet de l'agent avec statuts des providers et métriques.

    Utilisé par le widget AgentMonitorWidget (itération D) et les alertes.
    """
    llm_provider = create_llm_provider(settings)
    stt = get_stt_provider()
    tts = get_tts_provider()

    # Health checks en parallèle (timeout 3s chacun)
    async def _safe_health(provider, name: str) -> bool:
        if provider is None:
            return False
        try:
            return await asyncio.wait_for(provider.health_check(), timeout=3.0)
        except Exception:
            logger.warning("Health check %s échoué", name)
            return False

    llm_ok, stt_ok, tts_ok = await asyncio.gather(
        _safe_health(llm_provider, "llm"),
        _safe_health(stt, "stt"),
        _safe_health(tts, "tts"),
    )

    redis_ok = False
    try:
        r = await get_redis()
        await r.ping()
        redis_ok = True
    except Exception:
        pass

    # Métriques de latence depuis Redis
    latency_stats = {}
    if redis_ok:
        try:
            r = await get_redis()
            latency_stats = await get_latency_stats(r)
        except Exception:
            logger.debug("Impossible de charger les métriques de latence")

    llm_is_local = getattr(llm_provider, "is_local", False)
    stt_is_local = stt.is_local if stt else False
    tts_is_local = tts.is_local if tts else False

    overall_status = "ok" if all([llm_ok, redis_ok]) else "degraded"

    return {
        "status": overall_status,
        "providers": {
            "llm": {
                "name": settings.llm_provider,
                "model": settings.llm_model_name,
                "is_local": llm_is_local,
                "healthy": llm_ok,
            },
            "stt": {
                "name": settings.stt_provider,
                "is_local": stt_is_local,
                "healthy": stt_ok,
            },
            "tts": {
                "name": settings.tts_provider if settings.tts_enabled else "disabled",
                "is_local": tts_is_local,
                "healthy": tts_ok,
            },
        },
        "metrics": latency_stats,
        "redis_ok": redis_ok,
        "hds_compliant": llm_is_local and stt_is_local,
        "model_version": settings.lora_model_name or settings.llm_model_name,
    }


# ── Endpoint REST transcription ───────────────────────────────────────────────


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    current_user: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Transcrit un fichier audio en texte via Whisper.

    Accepte : webm, mp4, wav, m4a, ogg, flac (formats MediaRecorder navigateur).
    Taille max : 25 Mo (limite Whisper API).
    Durée recommandée : ≤ 2 minutes.

    Retourne :
    {
        "text": "texte transcrit",
        "confidence": 0.92,
        "duration_seconds": 15.3,
        "provider": "whisper_cloud",
        "warning": null  // ou message si provider non-local
    }
    """
    stt = get_stt_provider()
    if stt is None:
        raise HTTPException(
            status_code=503,
            detail="Service de transcription non configuré (OPENAI_API_KEY manquant)",
        )

    audio_data = await audio.read()

    if len(audio_data) > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Fichier audio trop volumineux (max 25 Mo)",
        )

    if len(audio_data) < 200:
        return {
            "text": "",
            "confidence": 0.0,
            "duration_seconds": 0.0,
            "provider": stt.provider_name,
            "warning": None,
        }

    try:
        result = await stt.transcribe(audio_data=audio_data, language="fr")
    except ValueError as exc:
        raise HTTPException(status_code=413, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    warning = (
        "Audio traité par un service tiers (OpenAI Whisper). Migration GPU prévue."
        if not stt.is_local
        else None
    )

    # Audit : durée audio et métadonnées (pas le contenu transcrit — RGPD)
    context = AgentContext(
        user_id=current_user.user_id,
        cabinet_id=current_user.cabinet_id,
        role=current_user.role,
        session_id="transcribe",
    )
    try:
        await log_tool_call(
            db=db,
            context=context,
            tool_name="transcribe_audio",
            tool_input={
                "audio_size_bytes": len(audio_data),
                "provider": result.provider,
            },
            tool_output={
                "duration_seconds": result.duration_seconds,
                "chars": len(result.text),
                "confidence": round(result.confidence, 3),
                "is_empty": not result.text,
            },
            llm_model=result.provider,
            duration_ms=0,
        )
    except Exception:
        logger.warning("Audit transcription échoué (non bloquant)")

    return {
        "text": result.text,
        "confidence": result.confidence,
        "duration_seconds": result.duration_seconds,
        "provider": result.provider,
        "warning": warning,
    }


# ── WebSocket chat (itérations A/B + TTS itération D) ────────────────────────


@router.websocket("/chat")
async def agent_chat(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """WebSocket pour le chat agent IA (texte + TTS optionnel).

    Authentification via query param ?token=<JWT> (headers non disponibles
    lors du handshake WebSocket).

    Protocol :
      client → {"type": "text", "content": "...", "session_id": "..."}
      client → {"type": "confirm", "action_id": "...", "session_id": "..."}
      client → {"type": "cancel", "action_id": "...", "session_id": "..."}
      client → {"type": "toggle_tts", "enabled": true|false}
      client → {"message": "...", "session_id": "..."}  (rétrocompat)
      server → {"type": "token", "content": "..."}      (streaming texte)
      server → {"type": "tool_result", "tool": "...", "data": {...}}
      server → {"type": "confirmation_required", "action": {...}}
      server → {"type": "audio_chunk"} + message binaire (TTS audio)
      server → {"type": "audio_end"}                     (fin TTS)
      server → {"type": "end"}
      server → {"type": "error", "message": "..."}

    IMPORTANT : websocket.accept() DOIT être appelé avant tout websocket.close()
    avec un code personnalisé. Sinon Starlette envoie un TCP RST → ECONNRESET.
    """
    logger.info("[WS/chat] Nouvelle tentative de connexion")
    await websocket.accept()

    user_id, cabinet_id, member = await _authenticate_ws(websocket, token, db)
    if member is None:
        return

    km = KeyManager(settings.encryption_master_key)
    orchestrator = get_orchestrator()
    tts = get_tts_provider()
    tts_enabled = tts is not None  # Activé par défaut si Kokoro est configuré

    # Compteur de session chat
    try:
        from app.infrastructure.agent.metrics import record_session as _rec_sess
        _r = await get_redis()
        await _rec_sess(_r)
    except Exception:
        pass

    session_id = "default"
    try:
        while True:
            data = await websocket.receive_json()

            if "type" not in data and "message" in data:
                data = {
                    "type": "text",
                    "content": data["message"],
                    "session_id": data.get("session_id", "default"),
                }

            msg_type = data.get("type", "text")

            # Toggle TTS on/off depuis le client
            if msg_type == "toggle_tts":
                tts_enabled = bool(data.get("enabled", True))
                logger.debug("[WS/chat] TTS %s", "activé" if tts_enabled else "désactivé")
                continue

            session_id = data.get("session_id", "default")

            if msg_type == "text":
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

            # Accumule la réponse texte complète pour la synthèse TTS
            full_response = ""
            async for chunk in orchestrator.run_streaming(data, deps):
                await websocket.send_text(chunk)
                try:
                    parsed = json.loads(chunk)
                    if parsed.get("type") == "token":
                        full_response += parsed.get("content", "")
                except (json.JSONDecodeError, KeyError):
                    pass

            # Synthèse TTS sur la réponse complète (si activé et texte non vide)
            if tts_enabled and tts and full_response.strip():
                logger.info("[WS/chat] TTS: synthèse de %d chars via %s", len(full_response), tts.provider_name)
                await _stream_tts(websocket, tts, full_response.strip())
            elif not tts_enabled:
                logger.debug("[WS/chat] TTS désactivé par le client")
            elif not tts:
                logger.debug("[WS/chat] TTS: aucun provider configuré")
            elif not full_response.strip():
                logger.debug("[WS/chat] TTS: réponse vide, pas de synthèse")

    except WebSocketDisconnect:
        logger.info("[WS/chat] Client déconnecté (session=%s)", session_id)
    except Exception:
        logger.exception("[WS/chat] Erreur inattendue")
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "message": "Erreur interne du serveur"})
            )
        except Exception:
            pass


# ── WebSocket voix (itération C) ─────────────────────────────────────────────


@router.websocket("/voice")
async def agent_voice(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """WebSocket pour l'interaction vocale complète.

    Gère le flux : audio entrant → STT → pseudonymisation → agent LLM → TTS → audio sortant.

    Protocole client → serveur :
      Messages binaires : chunks audio PCM/webm pendant l'enregistrement push-to-talk
      {"type": "audio_end", "session_id": "..."}     — fin de l'enregistrement
      {"type": "toggle_tts", "enabled": true|false}  — activer/désactiver le TTS
      {"type": "confirm", "action_id": "...", ...}   — confirmation d'action
      {"type": "cancel", "action_id": "...", ...}    — annulation

    Protocole serveur → client :
      {"type": "transcript", "text": "...", "confidence": 0.92}  — après STT
      {"type": "token", "content": "..."}                        — streaming LLM
      {"type": "tool_result", "tool": "...", "data": {...}}       — résultats outils
      {"type": "confirmation_required", "action": {...}}
      {"type": "audio_chunk"}  + message binaire suivant          — chunks TTS
      {"type": "audio_end"}                                       — fin TTS
      {"type": "end"}                                             — fin message texte
      {"type": "error", "content": "..."}                        — erreur
    """
    logger.info("[WS/voice] Nouvelle tentative de connexion")
    await websocket.accept()

    user_id, cabinet_id, member = await _authenticate_ws(websocket, token, db)
    if member is None:
        return

    stt = get_stt_provider()
    tts = get_tts_provider()

    if stt is None:
        await websocket.send_text(
            json.dumps({
                "type": "error",
                "content": "Service vocal non configuré. Contacte l'administrateur.",
            })
        )
        await websocket.close(code=1011)
        return

    km = KeyManager(settings.encryption_master_key)
    orchestrator = get_orchestrator()
    audio_buffer = bytearray()
    tts_enabled = True
    session_id = str(uuid4())
    context: AgentContext | None = None

    # Compteur de session voix
    try:
        from app.infrastructure.agent.metrics import record_session as _rec_sess
        _r = await get_redis()
        await _rec_sess(_r)
    except Exception:
        pass

    try:
        while True:
            message = await websocket.receive()

            # Message binaire = chunk audio entrant (push-to-talk)
            if "bytes" in message and message["bytes"]:
                audio_buffer.extend(message["bytes"])
                continue

            if "text" not in message:
                continue

            data = json.loads(message["text"])
            msg_type = data.get("type", "")

            if msg_type == "audio_end":
                session_id = data.get("session_id", session_id)

                audio_data = bytes(audio_buffer)
                audio_buffer.clear()

                if len(audio_data) < 500:
                    # Audio trop court — probablement un bruit accidentel
                    await websocket.send_text(
                        json.dumps({"type": "transcript", "text": "", "confidence": 0.0})
                    )
                    continue

                # Supprime les silences en début/fin
                audio_data = trim_silence(audio_data)

                # STT — transcription (Whisper cloud ou faster-whisper local)
                import time as _time
                _stt_start = _time.monotonic()
                try:
                    transcript = await stt.transcribe(audio_data, language="fr")
                    _stt_ms = (_time.monotonic() - _stt_start) * 1000
                    try:
                        from app.infrastructure.agent.metrics import record_latency as _rec_lat
                        _r = await get_redis()
                        await _rec_lat(_r, "stt_latency_ms", _stt_ms)
                    except Exception:
                        pass
                except Exception as exc:
                    logger.error("[WS/voice] STT error: %s", exc)
                    await websocket.send_text(
                        json.dumps({"type": "error", "content": f"Transcription échouée : {exc}"})
                    )
                    continue

                if not transcript.text.strip():
                    await websocket.send_text(
                        json.dumps({"type": "transcript", "text": "", "confidence": 0.0})
                    )
                    continue

                # Envoi de la transcription au client (affichée dans le chat)
                await websocket.send_text(
                    json.dumps({
                        "type": "transcript",
                        "text": transcript.text,
                        "confidence": round(transcript.confidence, 3),
                    })
                )

                # Pseudonymisation avant passage au LLM
                try:
                    pseudonymized_text, _ = await pseudonymize_transcript(
                        text=transcript.text,
                        cabinet_id=cabinet_id,
                        db=db,
                        key_manager=km,
                    )
                except Exception as exc:
                    logger.warning("[WS/voice] Pseudonymisation échouée : %s", exc)
                    pseudonymized_text = transcript.text  # fail-open

                # Prépare le contexte agent
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

                # Streaming LLM + synthèse TTS phrase par phrase
                current_sentence = ""
                agent_msg = {"type": "text", "content": pseudonymized_text, "session_id": session_id}

                async for chunk_str in orchestrator.run_streaming(agent_msg, deps):
                    chunk = json.loads(chunk_str)
                    await websocket.send_text(chunk_str)

                    if chunk.get("type") == "token":
                        current_sentence += chunk["content"]
                        # Dès qu'une phrase est complète → synthétise sans attendre la fin
                        if tts_enabled and tts and current_sentence.rstrip().endswith((".", "?", "!")):
                            await _stream_tts(websocket, tts, current_sentence)
                            current_sentence = ""

                # Synthétise la dernière phrase (si incomplète / sans ponctuation finale)
                if tts_enabled and tts and current_sentence.strip():
                    await _stream_tts(websocket, tts, current_sentence)

            elif msg_type == "toggle_tts":
                tts_enabled = bool(data.get("enabled", True))
                logger.debug("[WS/voice] TTS %s", "activé" if tts_enabled else "désactivé")

            elif msg_type in ("confirm", "cancel"):
                # Confirmation/annulation d'une action pending — même pipeline que le WS texte
                if context is None:
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
                async for chunk_str in orchestrator.run_streaming(data, deps):
                    await websocket.send_text(chunk_str)

    except WebSocketDisconnect:
        logger.info("[WS/voice] Client déconnecté (session=%s)", session_id)
    except Exception:
        logger.exception("[WS/voice] Erreur inattendue")
        try:
            await websocket.send_text(
                json.dumps({"type": "error", "content": "Erreur pipeline voix"})
            )
        except Exception:
            pass


# ── Helpers WebSocket ─────────────────────────────────────────────────────────


async def _authenticate_ws(
    websocket: WebSocket,
    token: str,
    db: AsyncSession,
) -> tuple[UUID | None, UUID | None, CabinetMemberModel | None]:
    """
    Authentifie un WebSocket via JWT et vérifie le membership cabinet.

    Retourne (user_id, cabinet_id, member) ou (None, None, None) si échec.
    Dans le cas d'échec, ferme le WebSocket avec le bon code de fermeture.
    """
    try:
        payload = verify_token(token)
    except TokenError as exc:
        logger.warning("[WS] JWT invalide : %s", exc)
        await websocket.close(code=4001)
        return None, None, None
    except Exception:
        logger.exception("[WS] Erreur inattendue lors de verify_token")
        await websocket.close(code=4001)
        return None, None, None

    if payload.get("type") != "access":
        await websocket.close(code=4001)
        return None, None, None

    jti = payload.get("jti")
    if jti:
        try:
            if await is_token_blacklisted(jti):
                await websocket.close(code=4001)
                return None, None, None
        except Exception:
            pass

    user_id_str = payload.get("sub")
    cabinet_id_str = payload.get("cabinet_id")
    if not user_id_str or not cabinet_id_str:
        await websocket.close(code=4001)
        return None, None, None

    try:
        user_id = UUID(user_id_str)
        cabinet_id = UUID(cabinet_id_str)
    except ValueError:
        await websocket.close(code=4001)
        return None, None, None

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
        logger.exception("[WS] Erreur DB membership")
        await websocket.close(code=1011)
        return None, None, None

    if member is None:
        await websocket.close(code=4003)
        return None, None, None

    try:
        await db.execute(
            text("SELECT set_config('app.current_cabinet_id', :cid, true)"),
            {"cid": str(cabinet_id)},
        )
    except Exception:
        logger.exception("[WS] Erreur set_config RLS")
        await websocket.close(code=1011)
        return None, None, None

    logger.info("[WS] Auth OK (user=%s, cabinet=%s, role=%s)", user_id, cabinet_id, member.role)
    return user_id, cabinet_id, member


async def _stream_tts(
    websocket: WebSocket,
    tts: TTSProvider,
    text: str,
) -> None:
    """
    Synthétise un texte et envoie l'audio complet au client.

    Kokoro génère un WAV complet en mémoire. On bufferise tous les chunks
    HTTP et on envoie un seul message binaire au client, car
    AudioContext.decodeAudioData() nécessite un fichier audio complet.

    Protocole : {"type": "audio_chunk"} → données binaires → {"type": "audio_end"}.
    Ne bloque pas le pipeline si TTS échoue.
    """
    try:
        import time as _time
        from app.infrastructure.agent.metrics import record_latency as _rec_lat

        _tts_start = _time.monotonic()
        audio_buffer = bytearray()
        async for audio_chunk in tts.synthesize(text):
            audio_buffer.extend(audio_chunk)

        _tts_ms = (_time.monotonic() - _tts_start) * 1000

        if audio_buffer:
            logger.info("[TTS] Audio généré: %d octets en %.0fms", len(audio_buffer), _tts_ms)
            try:
                _r = await get_redis()
                await _rec_lat(_r, "tts_ttfb_ms", _tts_ms)
            except Exception:
                pass
            await websocket.send_text(json.dumps({"type": "audio_chunk"}))
            await websocket.send_bytes(bytes(audio_buffer))
        else:
            logger.warning("[TTS] Aucun audio produit pour: '%s...'", text[:60])

        await websocket.send_text(json.dumps({"type": "audio_end"}))
    except Exception as exc:
        logger.error("[TTS] Synthèse échouée pour '%s...' : %s", text[:30], exc, exc_info=True)
        # Ne pas propager — le texte a déjà été envoyé, l'audio est optionnel


# ── Feedback terrain (itération E) ────────────────────────────────────────────


class FeedbackRequest(BaseModel):
    session_id: str = Field(max_length=36)
    user_message: str = Field(max_length=5000)
    agent_response: str = Field(max_length=10000)
    tool_called: str | None = Field(default=None, max_length=100)
    tool_result: dict | None = None
    rating: Literal["positive", "negative"]
    correction: str | None = Field(default=None, max_length=10000)
    category: str | None = Field(default=None, max_length=50)


@router.post("/feedback", status_code=201)
async def submit_feedback(
    body: FeedbackRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enregistre un feedback sur une réponse de l'agent.

    Les corrections (👎 + texte) sont exploitables directement
    comme exemples d'entraînement pour le prochain cycle de fine-tuning.
    """
    if body.rating == "negative" and not body.correction:
        raise HTTPException(
            status_code=422,
            detail="Une correction est requise pour un feedback négatif",
        )

    # Version du modèle actif
    model_version = settings.lora_model_name or settings.llm_model_name

    feedback = AgentFeedbackModel(
        id=uuid4(),
        session_id=body.session_id,
        cabinet_id=auth.cabinet_id,
        user_id=auth.user_id,
        user_message=body.user_message,
        agent_response=body.agent_response,
        tool_called=body.tool_called,
        tool_result=body.tool_result,
        rating=body.rating,
        correction=body.correction,
        model_version=model_version,
        category=body.category,
    )

    db.add(feedback)
    await db.commit()

    return {"id": str(feedback.id), "recorded": True}


@router.get("/feedback/stats")
async def get_feedback_stats(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Statistiques de feedback pour le widget admin (30 derniers jours)."""
    thirty_days_ago = datetime.datetime.now(datetime.UTC) - datetime.timedelta(days=30)

    result = await db.execute(
        select(
            AgentFeedbackModel.rating,
            func.count(AgentFeedbackModel.id).label("count"),
        )
        .where(
            AgentFeedbackModel.cabinet_id == auth.cabinet_id,
            AgentFeedbackModel.created_at >= thirty_days_ago,
        )
        .group_by(AgentFeedbackModel.rating)
    )
    counts = {row.rating: row.count for row in result}

    positive = counts.get("positive", 0)
    negative = counts.get("negative", 0)
    total = positive + negative

    return {
        "period_days": 30,
        "total": total,
        "positive": positive,
        "negative": negative,
        "satisfaction_rate": positive / total if total > 0 else None,
        "corrections_available": negative,
    }


@router.get("/feedback/export")
async def export_training_data(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exporte les corrections terrain au format ChatML pour le prochain fine-tuning.

    Accessible aux membres du cabinet — ne contient pas de données patient
    identifiables (les messages sont déjà pseudonymisés côté agent).
    """
    # Vérifie que l'utilisateur est admin du cabinet
    member = await db.execute(
        select(CabinetMemberModel)
        .where(
            CabinetMemberModel.user_id == auth.user_id,
            CabinetMemberModel.cabinet_id == auth.cabinet_id,
        )
    )
    member_row = member.scalar_one_or_none()
    if not member_row or member_row.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Réservé aux administrateurs")

    corrections = await db.execute(
        select(AgentFeedbackModel)
        .where(
            AgentFeedbackModel.cabinet_id == auth.cabinet_id,
            AgentFeedbackModel.rating == "negative",
            AgentFeedbackModel.correction.isnot(None),
        )
        .order_by(AgentFeedbackModel.created_at.desc())
        .limit(1000)
    )

    training_examples = []
    for feedback in corrections.scalars():
        example = {
            "messages": [
                {"role": "user", "content": feedback.user_message},
                {"role": "assistant", "content": feedback.correction},
            ],
            "source": "terrain_correction",
            "model_version": feedback.model_version,
            "category": feedback.category,
        }
        training_examples.append(example)

    return {
        "count": len(training_examples),
        "examples": training_examples,
    }
