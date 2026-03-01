"""Routes FastAPI pour l'agent IA : WebSocket streaming, voix et health check.

Itération C — ajout de la modalité vocale :
  POST /agent/transcribe  — STT (audio → texte), pipeline REST push-to-talk
  WS   /agent/voice       — pipeline voix complet (audio ↔ agent ↔ audio)
"""

import json
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.agent.audit import log_tool_call
from app.infrastructure.agent.context import AgentContext, AgentDeps
from app.infrastructure.agent.orchestrator import AgentOrchestrator, create_idel_agent
from app.infrastructure.agent.providers import LLMConfig, MistralCloudProvider
from app.infrastructure.agent.voice.base import STTProvider, TTSProvider
from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript
from app.infrastructure.agent.voice.tts_elevenlabs import ElevenLabsTTS, split_into_sentences
from app.infrastructure.agent.voice.stt_whisper_cloud import WhisperCloudSTT
from app.infrastructure.agent.voice.vad import trim_silence
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

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["Agent IA"])

# ── Singletons (initialisés au premier appel) ─────────────────────────────────

_orchestrator: AgentOrchestrator | None = None
_stt_provider: STTProvider | None = None
_tts_provider: TTSProvider | None = None


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


def get_stt_provider() -> STTProvider | None:
    """Retourne le provider STT configuré, ou None si non configuré."""
    global _stt_provider
    if _stt_provider is None and settings.openai_api_key:
        _stt_provider = WhisperCloudSTT(api_key=settings.openai_api_key)
    return _stt_provider


def get_tts_provider() -> TTSProvider | None:
    """Retourne le provider TTS configuré, ou None si non configuré."""
    global _tts_provider
    if _tts_provider is None and settings.elevenlabs_api_key and settings.tts_enabled:
        _tts_provider = ElevenLabsTTS(
            api_key=settings.elevenlabs_api_key,
            voice_id=settings.elevenlabs_voice_id,
        )
    return _tts_provider


# ── Health check ─────────────────────────────────────────────────────────────


@router.get("/health")
async def agent_health(current_user: AuthContext = Depends(get_current_user)):
    """Vérifie que les providers LLM, STT, TTS et Redis sont accessibles."""
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

    stt = get_stt_provider()
    tts = get_tts_provider()
    stt_is_local = stt.is_local if stt else None
    tts_is_local = tts.is_local if tts else None

    voice_warning = None
    if stt and not stt.is_local:
        voice_warning = "Audio traité par services tiers — migration GPU prévue (itération D)"

    return {
        "status": "ok" if redis_ok else "degraded",
        "provider_llm": settings.llm_provider,
        "model": settings.llm_model_name,
        "llm_reachable": llm_ok,
        "redis_ok": redis_ok,
        "api_key_configured": bool(settings.mistral_api_key),
        "provider_stt": settings.stt_provider,
        "provider_tts": settings.tts_provider if settings.tts_enabled else "disabled",
        "stt_configured": bool(settings.openai_api_key),
        "tts_configured": bool(settings.elevenlabs_api_key) and settings.tts_enabled,
        "stt_is_local": stt_is_local,
        "tts_is_local": tts_is_local,
        "warning": voice_warning,
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


# ── WebSocket chat (itérations A/B — inchangé) ───────────────────────────────


@router.websocket("/chat")
async def agent_chat(
    websocket: WebSocket,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """WebSocket pour le chat agent IA (texte).

    Authentification via query param ?token=<JWT> (headers non disponibles
    lors du handshake WebSocket).

    Protocol :
      client → {"type": "text", "content": "...", "session_id": "..."}
      client → {"type": "confirm", "action_id": "...", "session_id": "..."}
      client → {"type": "cancel", "action_id": "...", "session_id": "..."}
      client → {"message": "...", "session_id": "..."}  (rétrocompat)
      server → {"type": "token", "content": "..."}      (streaming)
      server → {"type": "tool_result", "tool": "...", "data": {...}}
      server → {"type": "confirmation_required", "action": {...}}
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

            session_id = data.get("session_id", "default")

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

                # STT — transcription Whisper
                try:
                    transcript = await stt.transcribe(audio_data, language="fr")
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
    Synthétise un fragment de texte et envoie les chunks audio au client.

    Protocole : message JSON {"type": "audio_chunk"} suivi immédiatement
    des données binaires du chunk MP3. Répété pour chaque chunk.
    Termine par {"type": "audio_end"}.

    Ne bloque pas le pipeline si TTS échoue.
    """
    try:
        async for audio_chunk in tts.synthesize(text):
            # Signal JSON + données binaires
            await websocket.send_text(json.dumps({"type": "audio_chunk"}))
            await websocket.send_bytes(audio_chunk)
        await websocket.send_text(json.dumps({"type": "audio_end"}))
    except Exception as exc:
        logger.error("[TTS] Synthèse échouée pour '%s...' : %s", text[:30], exc)
        # Ne pas propager — le texte a déjà été envoyé, l'audio est optionnel
