"""Routes pour les transmissions infirmières (CRUD + audio upload + pipeline IA)."""

import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Request, UploadFile, status

from app.application.use_cases.transmissions.create_transmission import (
    CreateTransmissionDTO,
    CreateTransmissionUseCase,
)
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_current_user,
    get_key_manager,
    get_transmission_repository,
)
from app.infrastructure.api.schemas.transmission_schemas import (
    AudioUploadResponse,
    TransmissionCreateRequest,
    TransmissionListResponse,
    TransmissionResponse,
    TransmissionUpdateRequest,
)
from app.infrastructure.persistence.repositories.sqlalchemy_transmission_repo import (
    SQLAlchemyTransmissionRepo,
)
from app.infrastructure.security.key_manager import KeyManager
from app.domain.entities.transmission import Transmission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transmissions", tags=["transmissions"])

AUDIO_UPLOAD_DIR = Path("uploads/audio")
MAX_AUDIO_SIZE = 25 * 1024 * 1024  # 25 Mo
ALLOWED_AUDIO_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/ogg",
    "audio/webm",
    "audio/x-m4a",
}


def _entity_to_response(t: Transmission) -> TransmissionResponse:
    return TransmissionResponse(
        id=str(t.id),
        cabinet_id=str(t.cabinet_id),
        idel_id=str(t.idel_id),
        patient_id=str(t.patient_id),
        appointment_id=str(t.appointment_id) if t.appointment_id else None,
        type=t.type,
        status=t.status,
        transcription=t.transcription,
        structured_data=t.structured_data,
        audio_file_path=t.audio_file_path,
        recording_duration_seconds=t.recording_duration_seconds,
        generation_time_ms=t.generation_time_ms,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.post(
    "/",
    response_model=TransmissionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transmission(
    body: TransmissionCreateRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
):
    """Crée une transmission écrite."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = CreateTransmissionDTO(
        patient_id=UUID(body.patient_id),
        idel_id=auth.user_id,
        type=body.type,
        status="draft" if body.type == "written" else "pending_transcription",
        appointment_id=UUID(body.appointment_id) if body.appointment_id else None,
        transcription=body.transcription,
        structured_data=body.structured_data,
        recording_duration_seconds=body.recording_duration_seconds,
    )

    # If written transmission has content, mark as transcribed
    if body.type == "written" and body.transcription:
        dto.status = "transcribed"

    use_case = CreateTransmissionUseCase(repo)
    transmission = await use_case.execute(auth.cabinet_id, dto)
    return _entity_to_response(transmission)


@router.post(
    "/upload-audio",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio_new(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    request: Request,
    patient_id: str = Form(...),
    appointment_id: str | None = Form(None),
    duration_ms: int = Form(0),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    km: KeyManager = Depends(get_key_manager),
):
    """Crée une transmission vocale ET uploade l'audio en une seule requête.

    Accepte un multipart/form-data avec :
    - file: le fichier audio (.m4a, .wav, etc.)
    - patient_id: UUID du patient
    - appointment_id: UUID du RDV (optionnel)
    - duration_ms: durée en ms
    """
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # Read and validate audio
    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier audio trop volumineux ({len(content)} octets). Maximum: {MAX_AUDIO_SIZE}.",
        )

    # Create transmission entity
    dto = CreateTransmissionDTO(
        patient_id=UUID(patient_id),
        idel_id=auth.user_id,
        type="vocal",
        status="pending_transcription",
        appointment_id=UUID(appointment_id) if appointment_id else None,
        transcription="",
        structured_data=None,
        recording_duration_seconds=max(duration_ms // 1000, 1),
    )

    use_case = CreateTransmissionUseCase(repo)
    t = await use_case.execute(auth.cabinet_id, dto)

    # Store audio file (encrypted with cabinet key)
    cabinet_dir = AUDIO_UPLOAD_DIR / str(auth.cabinet_id)
    cabinet_dir.mkdir(parents=True, exist_ok=True)

    from app.infrastructure.security.encryption import encrypt

    cabinet_key = km.get_cabinet_key(auth.cabinet_id)
    encrypted_audio = encrypt(content.decode("latin-1"), cabinet_key)

    audio_path = cabinet_dir / f"{t.id}.enc"
    audio_path.write_bytes(encrypted_audio)

    # Update transmission with audio path
    t.audio_file_path = str(audio_path)
    await repo.update(t)

    # Launch background IA pipeline
    background_tasks.add_task(
        _run_ia_pipeline,
        transmission_id=t.id,
        cabinet_id=auth.cabinet_id,
        audio_path=str(audio_path),
    )

    return AudioUploadResponse(
        transmission_id=str(t.id),
        status="pending_transcription",
        audio_file_path=str(audio_path),
        message="Audio uploadé. Transcription en cours...",
    )


@router.get("/", response_model=TransmissionListResponse)
async def list_transmissions(
    request: Request,
    patient_id: str | None = None,
    skip: int = 0,
    limit: int = 50,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
):
    """Liste les transmissions (par patient ou par cabinet)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if patient_id:
        items, total = await repo.list_by_patient(
            UUID(patient_id), auth.cabinet_id, skip, limit
        )
    else:
        items, total = await repo.list_by_cabinet(auth.cabinet_id, skip, limit)

    return TransmissionListResponse(
        items=[_entity_to_response(t) for t in items],
        total=total,
    )


@router.get("/{transmission_id}", response_model=TransmissionResponse)
async def get_transmission(
    transmission_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
):
    """Récupère une transmission par ID."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")
    return _entity_to_response(t)


@router.put("/{transmission_id}", response_model=TransmissionResponse)
async def update_transmission(
    transmission_id: UUID,
    body: TransmissionUpdateRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
):
    """Met à jour une transmission (transcription, structured_data, status)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    if body.transcription is not None:
        t.transcription = body.transcription
    if body.structured_data is not None:
        t.structured_data = body.structured_data
    if body.status is not None:
        t.status = body.status

    updated = await repo.update(t)
    return _entity_to_response(updated)


@router.post(
    "/{transmission_id}/audio",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio(
    transmission_id: UUID,
    file: UploadFile,
    background_tasks: BackgroundTasks,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    km: KeyManager = Depends(get_key_manager),
):
    """Upload un fichier audio pour une transmission vocale.

    Démarre le pipeline IA en tâche de fond :
    audio → transcription (Whisper) → synthèse (Mistral)
    """
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    # Validate content type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type audio non supporté: {content_type}",
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier audio trop volumineux ({len(content)} octets). Maximum: {MAX_AUDIO_SIZE}.",
        )

    # Store audio file (encrypted)
    cabinet_dir = AUDIO_UPLOAD_DIR / str(auth.cabinet_id)
    cabinet_dir.mkdir(parents=True, exist_ok=True)

    from app.infrastructure.security.encryption import encrypt

    cabinet_key = km.get_cabinet_key(auth.cabinet_id)
    encrypted_audio = encrypt(content.decode("latin-1"), cabinet_key)

    audio_path = cabinet_dir / f"{transmission_id}.enc"
    audio_path.write_bytes(encrypted_audio)

    # Update transmission with audio path
    t.audio_file_path = str(audio_path)
    t.type = "vocal"
    t.status = "pending_transcription"
    t.recording_duration_seconds = max(t.recording_duration_seconds, 1)
    await repo.update(t)

    # Launch background IA pipeline
    background_tasks.add_task(
        _run_ia_pipeline,
        transmission_id=t.id,
        cabinet_id=auth.cabinet_id,
        audio_path=str(audio_path),
    )

    return AudioUploadResponse(
        transmission_id=str(t.id),
        status="pending_transcription",
        audio_file_path=str(audio_path),
        message="Audio uploadé. Transcription en cours...",
    )


async def _run_ia_pipeline(
    transmission_id: UUID,
    cabinet_id: UUID,
    audio_path: str,
) -> None:
    """Background task: audio → transcription → synthèse.

    Uses a fresh DB session to avoid the request session being closed.
    """
    import time

    from app.infrastructure.persistence.database import async_session_factory
    from app.infrastructure.security.key_manager import KeyManager
    from app.config import settings

    try:
        km = KeyManager(settings.encryption_master_key)

        async with async_session_factory() as session:
            repo = SQLAlchemyTransmissionRepo(session, km)
            t = await repo.get_by_id(transmission_id)
            if not t:
                logger.error("Pipeline IA: transmission %s introuvable", transmission_id)
                return

            start = time.monotonic()

            # Step 1: Transcription
            try:
                from app.infrastructure.services.transcription_service_impl import (
                    create_transcription_service,
                )

                stt = create_transcription_service()

                # Read and decrypt audio
                from app.infrastructure.security.encryption import decrypt

                cabinet_key = km.get_cabinet_key(cabinet_id)
                encrypted = Path(audio_path).read_bytes()
                audio_data_str = decrypt(encrypted, cabinet_key)
                audio_data = audio_data_str.encode("latin-1")

                transcription = await stt.transcribe_audio(audio_data, format="wav")
                t.transcription = transcription
                t.status = "pending_synthesis"
                await repo.update(t)
                await session.commit()
            except Exception:
                logger.exception("Pipeline IA: échec transcription pour %s", transmission_id)
                t.status = "error"
                await repo.update(t)
                await session.commit()
                return

            # Step 2: Synthesis
            try:
                from app.infrastructure.services.synthesis_service_impl import (
                    create_synthesis_service,
                )

                synth = create_synthesis_service()
                structured = await synth.generate_summary(transcription)
                t.structured_data = structured
                t.status = "completed"
                t.generation_time_ms = int((time.monotonic() - start) * 1000)
                await repo.update(t)
                await session.commit()
            except Exception:
                logger.exception("Pipeline IA: échec synthèse pour %s", transmission_id)
                t.status = "transcribed"  # Transcription OK but synthesis failed
                await repo.update(t)
                await session.commit()

    except Exception:
        logger.exception("Pipeline IA: erreur critique pour %s", transmission_id)
