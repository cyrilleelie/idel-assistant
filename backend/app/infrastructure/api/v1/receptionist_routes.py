"""Routes FastAPI pour le secrétaire médical IA (itération F).

WS   /receptionist/call              — pipeline appel complet (Asterisk ↔ agent)
GET  /receptionist/calls/today       — liste des appels du jour (admin)
GET  /receptionist/calls/{id}/transcript — transcription pseudonymisée
"""

import asyncio
import datetime
import json
import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.agent.context import AgentContext, AgentDeps
from app.infrastructure.agent.factory import (
    create_llm_provider,
    create_stt_provider,
    create_tts_provider,
)
from app.infrastructure.agent.receptionist.receptionist_orchestrator import (
    ReceptionistCallContext,
    create_receptionist_agent,
    run_receptionist_turn,
)
from app.infrastructure.agent.receptionist.turn_manager import TurnManager, TurnState
from app.infrastructure.agent.voice.base import STTProvider, TTSProvider
from app.infrastructure.agent.voice.hotwords_receptionist import WHISPER_RECEPTIONIST_PROMPT
from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript
from app.infrastructure.agent.voice.vad import is_audio_too_short, trim_silence
from app.infrastructure.api.dependencies import AuthContext, get_current_user
from app.infrastructure.persistence.database import async_session_factory, get_db
from app.infrastructure.persistence.models.receptionist_call_log_model import (
    ReceptionistCallLogModel,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemyTourneeRepo,
)
from app.infrastructure.security.key_manager import KeyManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/receptionist", tags=["Secrétaire médical IA"])

# ── Singletons ────────────────────────────────────────────────────────────────

_receptionist_agent = None
_stt: STTProvider | None = None
_tts: TTSProvider | None = None


def _get_agent():
    global _receptionist_agent
    if _receptionist_agent is None:
        provider = create_llm_provider(settings)
        _receptionist_agent = create_receptionist_agent(provider)
    return _receptionist_agent


def _get_stt() -> STTProvider | None:
    global _stt
    if _stt is None:
        _stt = create_stt_provider(settings)
    return _stt


def _get_tts() -> TTSProvider | None:
    global _tts
    if _tts is None:
        _tts = create_tts_provider(settings)
    return _tts


# ── WebSocket /call ───────────────────────────────────────────────────────────


@router.websocket("/call")
async def receptionist_call(websocket: WebSocket):
    """Pipeline d'appel téléphonique complet.

    Auth via header Authorization Bearer (token service cabinet).
    X-Caller-Id header pour identifier l'appelant.

    Protocole :
    - Client → binaire (audio PCM 16-bit mono 16kHz)
    - Serveur → binaire (audio TTS) ou JSON (contrôle)
    """
    # Auth par token service
    auth_header = websocket.headers.get("authorization", "")
    caller_id = websocket.headers.get("x-caller-id", "unknown")

    if not settings.cabinet_service_token:
        await websocket.close(code=4003, reason="Receptionist not configured")
        return

    expected = f"Bearer {settings.cabinet_service_token}"
    if auth_header != expected:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    if not settings.receptionist_enabled:
        await websocket.close(code=4003, reason="Receptionist disabled")
        return

    await websocket.accept()
    logger.info("[RECEPTIONIST] Appel entrant de %s", caller_id[:6] + "****")

    # Récupérer le cabinet_id depuis le token (simple pour un token service)
    # Pour l'instant on utilise un UUID dummy — en prod, le token encode le cabinet
    cabinet_id = uuid.uuid5(uuid.NAMESPACE_DNS, settings.cabinet_service_token)

    async with async_session_factory() as db:
        await db.execute(
            text("SELECT set_config('app.current_cabinet_id', :cid, true)"),
            {"cid": str(cabinet_id)},
        )

        key_manager = KeyManager(settings.encryption_master_key)
        deps = AgentDeps(
            db=db,
            context=AgentContext(
                user_id=cabinet_id,
                cabinet_id=cabinet_id,
                role="service",
                session_id=f"call-{uuid.uuid4()}",
            ),
            patient_repo=SQLAlchemyPatientRepo(db),
            appointment_repo=SQLAlchemyAppointmentRepo(db),
            invoice_repo=SQLAlchemyInvoiceRepo(db),
            tournee_repo=SQLAlchemyTourneeRepo(db),
            care_catalog_repo=SQLAlchemyCareCatalogRepo(db),
            key_manager=key_manager,
        )

        agent = _get_agent()
        stt = _get_stt()
        tts = _get_tts()
        turn_mgr = TurnManager()
        call_ctx = ReceptionistCallContext(
            cabinet_id=cabinet_id,
            cabinet_name="Cabinet IDEL",
            caller_number=caller_id,
        )

        latencies: list[float] = []

        try:
            # Greeting TTS
            await _send_greeting(websocket, tts, call_ctx)

            # Boucle d'appel
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive(), timeout=35.0)
                except asyncio.TimeoutError:
                    if turn_mgr.is_inactive():
                        await _send_json(websocket, {
                            "type": "message",
                            "text": "Il semble que vous n'êtes plus en ligne. Au revoir.",
                        })
                        break
                    continue

                if "bytes" in data and data["bytes"]:
                    chunk = data["bytes"]
                    has_voice = len(chunk) > 100 and _simple_vad(chunk)

                    if turn_mgr.state == TurnState.AGENT_SPEAKING:
                        if turn_mgr.check_interrupt(has_voice):
                            turn_mgr.reset_for_next_turn()
                            continue

                    turn_complete = turn_mgr.add_audio_chunk(chunk, has_voice)

                    if turn_complete:
                        turn_start = time.monotonic()
                        audio_buf = turn_mgr.get_audio_buffer()
                        turn_mgr.reset_for_next_turn()

                        if is_audio_too_short(audio_buf):
                            continue

                        trimmed = trim_silence(audio_buf)

                        # STT
                        if stt:
                            try:
                                stt_result = await stt.transcribe(trimmed, language="fr")
                                transcript = stt_result.text
                            except Exception as exc:
                                logger.error("STT error: %s", exc)
                                transcript = ""
                        else:
                            transcript = "[STT non configuré]"

                        if not transcript.strip():
                            continue

                        # Pseudonymise
                        pseudo_text = pseudonymize_transcript(
                            transcript, [], key_manager
                        )

                        # LLM
                        response = await run_receptionist_turn(
                            agent, call_ctx, pseudo_text, deps,
                        )

                        turn_latency = (time.monotonic() - turn_start) * 1000
                        latencies.append(turn_latency)

                        # Envoi texte + TTS
                        await _send_json(websocket, {
                            "type": "message",
                            "text": response.text,
                            "urgency_score": response.urgency_score,
                        })

                        if tts and response.text:
                            try:
                                turn_mgr.set_agent_speaking()
                                async for audio_chunk in tts.synthesize(response.text):
                                    await websocket.send_bytes(audio_chunk)
                                turn_mgr.state = TurnState.SILENCE
                            except Exception as exc:
                                logger.error("TTS error: %s", exc)

                        # Urgence 3 → SMS + hangup
                        if response.urgency_score >= 3:
                            await _send_json(websocket, {"type": "hangup", "reason": "urgency_escalation"})
                            break

                        # Fin d'appel détectée
                        if response.end_call:
                            await _send_json(websocket, {"type": "hangup", "reason": "end_of_call"})
                            break

                elif "text" in data and data["text"]:
                    # JSON control message
                    try:
                        msg = json.loads(data["text"])
                        if msg.get("type") == "hangup":
                            break
                    except json.JSONDecodeError:
                        pass

        except WebSocketDisconnect:
            logger.info("[RECEPTIONIST] Appel déconnecté: %s", caller_id[:6] + "****")
        except Exception as exc:
            logger.error("[RECEPTIONIST] Erreur appel: %s", exc, exc_info=True)
        finally:
            # Save call log
            await _save_call_log(
                db=db,
                call_ctx=call_ctx,
                caller_number=caller_id,
                latencies=latencies,
                key_manager=key_manager,
            )


async def _send_greeting(websocket: WebSocket, tts: TTSProvider | None, call_ctx: ReceptionistCallContext):
    """Envoie le greeting TTS au patient."""
    from app.infrastructure.agent.prompts.receptionist_prompt import build_greeting

    greeting = build_greeting(call_ctx.cabinet_name)
    call_ctx.conversation_history.append({"role": "assistant", "content": greeting})

    await _send_json(websocket, {"type": "message", "text": greeting})

    if tts:
        try:
            if settings.receptionist_greeting_delay_ms > 0:
                await asyncio.sleep(settings.receptionist_greeting_delay_ms / 1000)
            async for chunk in tts.synthesize(greeting):
                await websocket.send_bytes(chunk)
        except Exception as exc:
            logger.error("Greeting TTS error: %s", exc)


async def _send_json(websocket: WebSocket, data: dict):
    await websocket.send_text(json.dumps(data, ensure_ascii=False))


def _simple_vad(chunk: bytes, threshold: float = 0.02) -> bool:
    """VAD simplifiée : RMS au-dessus du seuil."""
    import struct
    import math

    n = len(chunk) // 2
    if n == 0:
        return False
    samples = struct.unpack(f"<{n}h", chunk[:n * 2])
    mean_sq = sum(s * s for s in samples) / n
    rms = math.sqrt(mean_sq) / 32768.0
    return rms > threshold


async def _save_call_log(
    db: AsyncSession,
    call_ctx: ReceptionistCallContext,
    caller_number: str,
    latencies: list[float],
    key_manager: KeyManager,
):
    """Persiste le log d'appel en base."""
    try:
        duration_s = int(time.monotonic() - call_ctx.started_at)
        avg_latency = int(sum(latencies) / len(latencies)) if latencies else None

        # Chiffre le numéro d'appelant
        encrypted_number = key_manager.encrypt(caller_number)

        outcome = "answered"
        if call_ctx.urgency_score >= 3:
            outcome = "escalated"

        log = ReceptionistCallLogModel(
            id=uuid.uuid4(),
            cabinet_id=call_ctx.cabinet_id,
            caller_number=encrypted_number,
            call_duration_seconds=duration_s,
            outcome=outcome,
            urgency_score=call_ctx.urgency_score,
            escalation_reason=call_ctx.conversation_history[-1].get("content", "")[:500] if call_ctx.urgency_score >= 3 else None,
            patient_id=call_ctx.patient_id,
            appointment_id=call_ctx.appointment_id,
            transcript_pseudonymized=call_ctx.conversation_history,
            avg_turn_latency_ms=avg_latency,
            model_version=settings.llm_model_name,
        )
        db.add(log)
        await db.commit()
        logger.info("[RECEPTIONIST] Call log saved: %s, duration=%ds, urgency=%d", outcome, duration_s, call_ctx.urgency_score)
    except Exception as exc:
        logger.error("Failed to save call log: %s", exc, exc_info=True)


# ── GET /calls/today ──────────────────────────────────────────────────────────


@router.get("/calls/today")
async def get_calls_today(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste des appels du jour (admin uniquement)."""
    if auth.role not in ("admin", "titulaire"):
        raise HTTPException(status_code=403, detail="Admin only")

    today = datetime.date.today()
    today_start = datetime.datetime.combine(today, datetime.time.min, tzinfo=datetime.UTC)

    stmt = (
        select(ReceptionistCallLogModel)
        .where(
            and_(
                ReceptionistCallLogModel.cabinet_id == auth.cabinet_id,
                ReceptionistCallLogModel.created_at >= today_start,
            )
        )
        .order_by(ReceptionistCallLogModel.created_at.desc())
        .limit(50)
    )
    result = await db.execute(stmt)
    calls = result.scalars().all()

    # Stats
    total = len(calls)
    escalated = sum(1 for c in calls if c.outcome == "escalated")
    rdv_created = sum(1 for c in calls if c.appointment_id is not None)
    avg_duration = int(sum(c.call_duration_seconds for c in calls) / total) if total else 0

    return {
        "stats": {
            "total": total,
            "escalated": escalated,
            "rdv_created": rdv_created,
            "avg_duration_seconds": avg_duration,
        },
        "calls": [
            {
                "id": str(c.id),
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "duration_seconds": c.call_duration_seconds,
                "outcome": c.outcome,
                "urgency_score": c.urgency_score,
                "appointment_id": str(c.appointment_id) if c.appointment_id else None,
                "patient_id": str(c.patient_id) if c.patient_id else None,
                "avg_turn_latency_ms": c.avg_turn_latency_ms,
            }
            for c in calls
        ],
    }


# ── GET /calls/{call_id}/transcript ───────────────────────────────────────────


@router.get("/calls/{call_id}/transcript")
async def get_call_transcript(
    call_id: str,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transcription pseudonymisée d'un appel (admin uniquement)."""
    if auth.role not in ("admin", "titulaire"):
        raise HTTPException(status_code=403, detail="Admin only")

    stmt = select(ReceptionistCallLogModel).where(
        and_(
            ReceptionistCallLogModel.id == uuid.UUID(call_id),
            ReceptionistCallLogModel.cabinet_id == auth.cabinet_id,
        )
    )
    result = await db.execute(stmt)
    call = result.scalar_one_or_none()

    if not call:
        raise HTTPException(status_code=404, detail="Appel non trouvé")

    return {
        "id": str(call.id),
        "created_at": call.created_at.isoformat() if call.created_at else None,
        "duration_seconds": call.call_duration_seconds,
        "outcome": call.outcome,
        "urgency_score": call.urgency_score,
        "transcript": call.transcript_pseudonymized or [],
    }
