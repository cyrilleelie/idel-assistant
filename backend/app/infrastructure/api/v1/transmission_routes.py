"""Routes pour les transmissions infirmieres (CRUD + audio upload + pipeline IA)."""

import datetime
import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
    PrescriptionBrief,
    TransmissionCreateRequest,
    TransmissionListResponse,
    TransmissionResponse,
    TransmissionUpdatePrescriptions,
    TransmissionUpdateRequest,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models.prescription_model import PrescriptionModel
from app.infrastructure.persistence.models.transmission_model import TransmissionModel
from app.infrastructure.persistence.models.transmission_prescription_model import (
    TransmissionPrescriptionModel,
)
from app.infrastructure.persistence.repositories.sqlalchemy_transmission_repo import (
    SQLAlchemyTransmissionRepo,
)
from app.infrastructure.security.key_manager import KeyManager
from app.infrastructure.services.prescription_resolver import resolve_prescriptions_for_transmission
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


async def _build_prescription_briefs(
    db: AsyncSession, transmission_id: UUID
) -> list[PrescriptionBrief]:
    """Load prescription briefs for a transmission from the liaison table."""
    result = await db.execute(
        select(TransmissionPrescriptionModel, PrescriptionModel)
        .join(PrescriptionModel, TransmissionPrescriptionModel.prescription_id == PrescriptionModel.id)
        .where(TransmissionPrescriptionModel.transmission_id == transmission_id)
    )
    briefs = []
    for tp, p in result.all():
        briefs.append(PrescriptionBrief(
            id=str(p.id),
            prescriber_name=p.prescriber_name,
            care_type_codes=p.act_codes or [],
            start_date=p.start_date,
            end_date=p.end_date,
            is_auto_resolved=tp.is_auto_resolved,
            label=p.label,
        ))
    return briefs


async def _entity_to_response(t: Transmission, db: AsyncSession) -> TransmissionResponse:
    prescriptions = await _build_prescription_briefs(db, t.id)
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
        prescriptions=prescriptions,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


async def _link_prescriptions_auto(
    db: AsyncSession,
    transmission: Transmission,
    cabinet_id: UUID,
) -> None:
    """Auto-resolve prescriptions and create liaison rows."""
    prescription_ids = await resolve_prescriptions_for_transmission(
        db, transmission.appointment_id, transmission.patient_id, cabinet_id
    )
    for pid in prescription_ids:
        db.add(TransmissionPrescriptionModel(
            transmission_id=transmission.id,
            prescription_id=pid,
            is_auto_resolved=True,
        ))
    if prescription_ids:
        await db.flush()


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
    db: AsyncSession = Depends(get_db),
):
    """Cree une transmission ecrite."""
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

    if body.type == "written" and body.transcription:
        dto.status = "transcribed"

    use_case = CreateTransmissionUseCase(repo)
    transmission = await use_case.execute(auth.cabinet_id, dto)

    # Auto-resolve prescriptions
    await _link_prescriptions_auto(db, transmission, auth.cabinet_id)

    return await _entity_to_response(transmission, db)


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
    db: AsyncSession = Depends(get_db),
):
    """Cree une transmission vocale ET uploade l'audio en une seule requete."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier audio trop volumineux ({len(content)} octets). Maximum: {MAX_AUDIO_SIZE}.",
        )

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

    # Auto-resolve prescriptions
    await _link_prescriptions_auto(db, t, auth.cabinet_id)

    # Store audio file (encrypted with cabinet key)
    cabinet_dir = AUDIO_UPLOAD_DIR / str(auth.cabinet_id)
    cabinet_dir.mkdir(parents=True, exist_ok=True)

    from app.infrastructure.security.encryption import encrypt

    cabinet_key = km.get_cabinet_key(auth.cabinet_id)
    encrypted_audio = encrypt(content.decode("latin-1"), cabinet_key)

    audio_path = cabinet_dir / f"{t.id}.enc"
    audio_path.write_bytes(encrypted_audio)

    t.audio_file_path = str(audio_path)
    await repo.update(t)

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
        message="Audio uploade. Transcription en cours...",
    )


@router.get("/", response_model=TransmissionListResponse)
async def list_transmissions(
    request: Request,
    patient_id: str | None = None,
    prescription_id: str | None = None,
    author_user_id: str | None = None,
    transmission_status: str | None = Query(None, alias="status"),
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    db: AsyncSession = Depends(get_db),
):
    """Liste les transmissions avec filtres optionnels."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    from sqlalchemy import func

    stmt = select(TransmissionModel).where(TransmissionModel.cabinet_id == auth.cabinet_id)

    if patient_id:
        stmt = stmt.where(TransmissionModel.patient_id == UUID(patient_id))
    if author_user_id:
        stmt = stmt.where(TransmissionModel.idel_id == UUID(author_user_id))
    if transmission_status:
        stmt = stmt.where(TransmissionModel.status == transmission_status)
    if date_from:
        stmt = stmt.where(TransmissionModel.created_at >= datetime.datetime.combine(date_from, datetime.time.min, tzinfo=datetime.UTC))
    if date_to:
        stmt = stmt.where(TransmissionModel.created_at <= datetime.datetime.combine(date_to, datetime.time.max, tzinfo=datetime.UTC))
    if prescription_id:
        stmt = stmt.join(
            TransmissionPrescriptionModel,
            TransmissionPrescriptionModel.transmission_id == TransmissionModel.id,
        ).where(TransmissionPrescriptionModel.prescription_id == UUID(prescription_id))
    if search:
        # Search in transcription requires decryption - use structured_data instead (unencrypted JSONB)
        stmt = stmt.where(
            TransmissionModel.structured_data.cast(str).ilike(f"%{search}%")
        )

    # Count
    from sqlalchemy import func as sa_func
    count_stmt = select(sa_func.count()).select_from(stmt.subquery())
    count_result = await db.execute(count_stmt)
    total = count_result.scalar_one()

    # Fetch
    stmt = stmt.order_by(TransmissionModel.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    models = result.scalars().all()

    from app.infrastructure.security.key_manager import KeyManager as KM
    items = []
    for m in models:
        entity = repo._to_entity(m, auth.cabinet_id)
        items.append(await _entity_to_response(entity, db))

    return TransmissionListResponse(items=items, total=total)


@router.get("/{transmission_id}", response_model=TransmissionResponse)
async def get_transmission(
    transmission_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    db: AsyncSession = Depends(get_db),
):
    """Recupere une transmission par ID."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")
    return await _entity_to_response(t, db)


@router.put("/{transmission_id}", response_model=TransmissionResponse)
async def update_transmission(
    transmission_id: UUID,
    body: TransmissionUpdateRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    db: AsyncSession = Depends(get_db),
):
    """Met a jour une transmission (transcription, structured_data, status)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    if t.status == "validated":
        raise HTTPException(status_code=400, detail="Transmission validee, modification impossible")

    if body.transcription is not None:
        t.transcription = body.transcription
    if body.structured_data is not None:
        t.structured_data = body.structured_data
    if body.status is not None:
        t.status = body.status

    updated = await repo.update(t)
    return await _entity_to_response(updated, db)


@router.post("/{transmission_id}/validate", response_model=TransmissionResponse)
async def validate_transmission(
    transmission_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    db: AsyncSession = Depends(get_db),
):
    """Valide definitivement une transmission."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    if t.status == "validated":
        raise HTTPException(status_code=400, detail="Transmission deja validee")

    t.status = "validated"
    updated = await repo.update(t)
    return await _entity_to_response(updated, db)


@router.post("/{transmission_id}/synthesize", response_model=TransmissionResponse)
async def regenerate_synthesis(
    transmission_id: UUID,
    background_tasks: BackgroundTasks,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    db: AsyncSession = Depends(get_db),
):
    """Regenere la synthese IA pour une transmission."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    if t.status == "validated":
        raise HTTPException(status_code=400, detail="Transmission validee, regeneration impossible")

    if not t.transcription:
        raise HTTPException(status_code=400, detail="Pas de transcription a synthetiser")

    t.status = "pending_synthesis"
    await repo.update(t)

    background_tasks.add_task(
        _run_synthesis_only,
        transmission_id=t.id,
        cabinet_id=auth.cabinet_id,
    )

    return await _entity_to_response(t, db)


@router.put("/{transmission_id}/prescriptions", response_model=TransmissionResponse)
async def update_transmission_prescriptions(
    transmission_id: UUID,
    body: TransmissionUpdatePrescriptions,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    db: AsyncSession = Depends(get_db),
):
    """Update manual prescription links (auto-resolved links are preserved)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    # Delete existing manual links
    result = await db.execute(
        select(TransmissionPrescriptionModel).where(
            TransmissionPrescriptionModel.transmission_id == transmission_id,
            TransmissionPrescriptionModel.is_auto_resolved.is_(False),
        )
    )
    for tp in result.scalars().all():
        await db.delete(tp)

    # Add new manual links
    for pid_str in body.prescription_ids:
        pid = UUID(pid_str)
        # Check if auto-resolved link already exists
        existing = await db.execute(
            select(TransmissionPrescriptionModel).where(
                TransmissionPrescriptionModel.transmission_id == transmission_id,
                TransmissionPrescriptionModel.prescription_id == pid,
            )
        )
        if existing.scalar_one_or_none():
            continue
        db.add(TransmissionPrescriptionModel(
            transmission_id=transmission_id,
            prescription_id=pid,
            is_auto_resolved=False,
        ))

    await db.flush()
    return await _entity_to_response(t, db)


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
    """Upload un fichier audio pour une transmission vocale."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    t = await repo.get_by_id(transmission_id)
    if not t or t.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=404, detail="Transmission introuvable")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type audio non supporte: {content_type}",
        )

    content = await file.read()
    if len(content) > MAX_AUDIO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier audio trop volumineux ({len(content)} octets). Maximum: {MAX_AUDIO_SIZE}.",
        )

    cabinet_dir = AUDIO_UPLOAD_DIR / str(auth.cabinet_id)
    cabinet_dir.mkdir(parents=True, exist_ok=True)

    from app.infrastructure.security.encryption import encrypt

    cabinet_key = km.get_cabinet_key(auth.cabinet_id)
    encrypted_audio = encrypt(content.decode("latin-1"), cabinet_key)

    audio_path = cabinet_dir / f"{transmission_id}.enc"
    audio_path.write_bytes(encrypted_audio)

    t.audio_file_path = str(audio_path)
    t.type = "vocal"
    t.status = "pending_transcription"
    t.recording_duration_seconds = max(t.recording_duration_seconds, 1)
    await repo.update(t)

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
        message="Audio uploade. Transcription en cours...",
    )


async def _run_ia_pipeline(
    transmission_id: UUID,
    cabinet_id: UUID,
    audio_path: str,
) -> None:
    """Background task: audio -> transcription -> synthese."""
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
                logger.exception("Pipeline IA: echec transcription pour %s", transmission_id)
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
                logger.exception("Pipeline IA: echec synthese pour %s", transmission_id)
                t.status = "transcribed"
                await repo.update(t)
                await session.commit()

    except Exception:
        logger.exception("Pipeline IA: erreur critique pour %s", transmission_id)


async def _run_synthesis_only(
    transmission_id: UUID,
    cabinet_id: UUID,
) -> None:
    """Background task: regenerate synthesis from existing transcription."""
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
                logger.error("Synthesis regen: transmission %s introuvable", transmission_id)
                return

            start = time.monotonic()

            try:
                from app.infrastructure.services.synthesis_service_impl import (
                    create_synthesis_service,
                )

                synth = create_synthesis_service()
                structured = await synth.generate_summary(t.transcription)
                t.structured_data = structured
                t.status = "completed"
                t.generation_time_ms = int((time.monotonic() - start) * 1000)
                await repo.update(t)
                await session.commit()
            except Exception:
                logger.exception("Synthesis regen: echec pour %s", transmission_id)
                t.status = "transcribed"
                await repo.update(t)
                await session.commit()

    except Exception:
        logger.exception("Synthesis regen: erreur critique pour %s", transmission_id)
