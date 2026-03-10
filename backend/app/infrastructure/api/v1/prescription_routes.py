"""Routes API pour les ordonnances (prescriptions)."""

import datetime
import os
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response

from app.application.dtos.prescription_dto import (
    CreatePrescriptionDTO,
    PrescriptionDTO,
    RenewPrescriptionDTO,
    UpdatePrescriptionDTO,
)
from app.application.use_cases.prescription.create_prescription import (
    CreatePrescriptionUseCase,
    _entity_to_dto,
)
from app.application.use_cases.prescription.get_expiring_prescriptions import (
    GetExpiringPrescriptionsUseCase,
)
from app.application.use_cases.prescription.link_to_invoice import (
    LinkPrescriptionToInvoiceUseCase,
)
from app.application.use_cases.prescription.renew_prescription import (
    RenewPrescriptionUseCase,
)
from app.domain.rules.prescription_rules import (
    compute_end_date,
    days_remaining,
)
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_current_user,
    get_invoice_repository,
    get_key_manager,
    get_prescription_repository,
)
from app.infrastructure.api.schemas.prescription_schemas import (
    ExpiringPrescriptionResponse,
    LinkPrescriptionToInvoiceRequest,
    PrescriptionCreate,
    PrescriptionInvoiceItem,
    PrescriptionListResponse,
    PrescriptionResponse,
    PrescriptionUpdate,
    RenewPrescriptionRequest,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlalchemy_prescription_repo import (
    SQLAlchemyPrescriptionRepo,
)
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])

# Répertoire de stockage des documents uploadés
UPLOAD_DIR = Path(os.environ.get("PRESCRIPTION_UPLOAD_DIR", "uploads/prescriptions"))
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 Mo


def _dto_to_response(dto: PrescriptionDTO) -> PrescriptionResponse:
    preferred_time_str = None
    if dto.preferred_time:
        t = dto.preferred_time
        preferred_time_str = f"{t.hour:02d}:{t.minute:02d}"

    return PrescriptionResponse(
        id=str(dto.id),
        cabinet_id=str(dto.cabinet_id),
        patient_id=str(dto.patient_id),
        status=dto.status,
        care_protocol_id=str(dto.care_protocol_id) if dto.care_protocol_id else None,
        label=dto.label or "",
        care_label_code=dto.care_label_code,
        duration_minutes=dto.duration_minutes,
        frequency_display=dto.frequency_display,
        custom_frequency=dto.custom_frequency or "",
        preferred_time=preferred_time_str,
        preferred_slot=dto.preferred_slot or "",
        recurrence_rule=dto.recurrence_rule or "",
        care_location=dto.care_location or "domicile",
        prescriber_name=dto.prescriber_name,
        prescriber_rpps=dto.prescriber_rpps,
        prescription_date=dto.prescription_date,
        start_date=dto.start_date,
        end_date=dto.end_date,
        duration_days=dto.duration_days,
        care_description=dto.care_description,
        act_codes=dto.act_codes or [],
        frequency=dto.frequency,
        max_renewals=dto.max_renewals,
        current_renewal=dto.current_renewal,
        parent_prescription_id=str(dto.parent_prescription_id) if dto.parent_prescription_id else None,
        document_url=dto.document_url,
        document_filename=dto.document_filename,
        document_type=dto.document_type,
        notes=dto.notes,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
        days_remaining=dto.days_remaining,
        invoices_count=dto.invoices_count,
        patient_name=dto.patient_name,
    )


# --- CRUD ---

@router.post("/", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    body: PrescriptionCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
    db: AsyncSession = Depends(get_db),
):
    """Crée une nouvelle ordonnance. Peut être liée à un plan de soins via care_protocol_id."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = CreatePrescriptionDTO(
        cabinet_id=auth.cabinet_id,
        patient_id=body.patient_id,
        care_protocol_id=body.care_protocol_id,
        label=body.label,
        care_label_code=body.care_label_code,
        duration_minutes=body.duration_minutes,
        frequency_display=body.frequency_display,
        custom_frequency=body.custom_frequency,
        preferred_time=body.preferred_time,
        preferred_slot=body.preferred_slot,
        recurrence_rule=body.recurrence_rule,
        care_location=body.care_location,
        prescriber_name=body.prescriber_name,
        prescriber_rpps=body.prescriber_rpps,
        prescription_date=body.prescription_date,
        start_date=body.start_date,
        end_date=body.end_date,
        duration_days=body.duration_days,
        care_description=body.care_description,
        act_codes=body.act_codes,
        frequency=body.frequency,
        max_renewals=body.max_renewals,
        document_url=body.document_url,
        document_type=body.document_type,
        notes=body.notes,
    )

    use_case = CreatePrescriptionUseCase(repo, db)
    result = await use_case.execute(dto)
    return _dto_to_response(result)


@router.get("/expiring", response_model=list[ExpiringPrescriptionResponse])
async def get_expiring_prescriptions(
    request: Request,
    days_ahead: int = Query(default=7, ge=1, le=30),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
    db: AsyncSession = Depends(get_db),
    km=Depends(get_key_manager),
):
    """Retourne les ordonnances expirant dans les N prochains jours."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetExpiringPrescriptionsUseCase(repo, db, km)
    results = await use_case.execute(auth.cabinet_id, days_ahead)
    return [
        ExpiringPrescriptionResponse(
            prescription=_dto_to_response(r.prescription),
            patient_name=r.patient_name,
            days_remaining=r.days_remaining,
            invoices_count=r.invoices_count,
            care_protocol_id=str(r.care_protocol_id) if r.care_protocol_id else None,
        )
        for r in results
    ]


@router.get("/", response_model=PrescriptionListResponse)
async def list_prescriptions(
    request: Request,
    patient_id: UUID | None = None,
    care_protocol_id: UUID | None = None,
    prescription_status: str | None = Query(default=None, alias="status"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
):
    """Liste les ordonnances (filtrable par patient, plan de soins, statut)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if care_protocol_id:
        # Filtre par plan de soins (retourne les ordonnances d'un plan)
        items = await repo.list_by_care_protocol(
            care_protocol_id=care_protocol_id,
            status=prescription_status,
        )
        total = len(items)
        items = items[offset: offset + limit]
    elif patient_id:
        items, total = await repo.list_by_patient(
            patient_id=patient_id,
            cabinet_id=auth.cabinet_id,
            status=prescription_status,
            offset=offset,
            limit=limit,
        )
    else:
        items, total = await repo.list_by_cabinet(
            cabinet_id=auth.cabinet_id,
            status=prescription_status,
            offset=offset,
            limit=limit,
        )

    dtos = [_entity_to_dto(p) for p in items]
    return PrescriptionListResponse(
        items=[_dto_to_response(d) for d in dtos],
        total=total,
    )


@router.get("/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
    db: AsyncSession = Depends(get_db),
):
    """Détail d'une ordonnance avec stats (nb factures, jours restants)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    prescription = await repo.get_by_id(prescription_id, auth.cabinet_id)
    if prescription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    invoices = await repo.list_by_invoice(prescription_id, auth.cabinet_id)

    dto = _entity_to_dto(
        prescription,
        invoices_count=len(invoices),
    )
    return _dto_to_response(dto)


@router.put("/{prescription_id}", response_model=PrescriptionResponse)
async def update_prescription(
    prescription_id: UUID,
    body: PrescriptionUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
):
    """Modifie une ordonnance."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    prescription = await repo.get_by_id(prescription_id, auth.cabinet_id)
    if prescription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(prescription, field_name, value)

    if ("start_date" in update_data or "duration_days" in update_data) and "end_date" not in update_data:
        prescription.end_date = compute_end_date(
            prescription.start_date, prescription.duration_days, None
        )

    updated = await repo.update(prescription)
    dto = _entity_to_dto(updated)
    return _dto_to_response(dto)


@router.post("/{prescription_id}/document", response_model=PrescriptionResponse)
async def upload_prescription_document(
    prescription_id: UUID,
    request: Request,
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
):
    """
    Upload le document (scan/photo) d'une ordonnance.
    Formats acceptés : JPEG, PNG, WebP, PDF. Taille max : 10 Mo.
    """
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    prescription = await repo.get_by_id(prescription_id, auth.cabinet_id)
    if prescription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Format non supporté. Utilisez JPEG, PNG, WebP ou PDF.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Fichier trop volumineux (max 10 Mo).",
        )

    # Détermine l'extension et le type
    ext_map = {
        "image/jpeg": (".jpg", "photo"),
        "image/png": (".png", "photo"),
        "image/webp": (".webp", "photo"),
        "application/pdf": (".pdf", "pdf"),
    }
    ext, doc_type = ext_map[content_type]

    # Génère un nom de fichier unique par cabinet/prescription
    filename = f"{auth.cabinet_id}/{prescription_id}_{uuid.uuid4().hex[:8]}{ext}"
    dest = UPLOAD_DIR / filename
    dest.parent.mkdir(parents=True, exist_ok=True)

    with open(dest, "wb") as f:
        f.write(content)

    prescription.document_filename = file.filename or f"document{ext}"
    prescription.document_url = f"/api/v1/prescriptions/{prescription_id}/document"
    prescription.document_type = doc_type

    updated = await repo.update(prescription)
    dto = _entity_to_dto(updated)
    return _dto_to_response(dto)


@router.get("/{prescription_id}/document")
async def download_prescription_document(
    prescription_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
):
    """Télécharge le document (scan/photo) d'une ordonnance."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    prescription = await repo.get_by_id(prescription_id, auth.cabinet_id)
    if prescription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    if not prescription.document_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aucun document associé")

    # Le fichier est stocké sous uploads/prescriptions/{cabinet_id}/{prescription_id}_{hash}.{ext}
    # On cherche le fichier correspondant à cette prescription
    cabinet_dir = UPLOAD_DIR / str(auth.cabinet_id)
    matching = list(cabinet_dir.glob(f"{prescription_id}_*")) if cabinet_dir.exists() else []
    if not matching:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fichier introuvable sur le stockage")

    file_path = matching[0]
    content = file_path.read_bytes()

    # Détermine le content-type à partir de l'extension
    ext_to_mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".pdf": "application/pdf"}
    mime = ext_to_mime.get(file_path.suffix.lower(), "application/octet-stream")

    return Response(
        content=content,
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{prescription.document_filename}"'},
    )


@router.get("/{prescription_id}/invoices", response_model=list[PrescriptionInvoiceItem])
async def list_prescription_invoices(
    prescription_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
):
    """Liste des factures rattachées à une ordonnance."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    prescription = await repo.get_by_id(prescription_id, auth.cabinet_id)
    if prescription is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ordonnance introuvable")

    invoices = await repo.list_by_invoice(prescription_id, auth.cabinet_id)
    return [
        PrescriptionInvoiceItem(
            id=str(inv.id),
            invoice_number=inv.invoice_number or "",
            care_date=inv.care_date,
            total_amount=float(inv.total_amount),
            status=inv.status,
        )
        for inv in invoices
    ]


@router.post("/{prescription_id}/renew", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def renew_prescription(
    prescription_id: UUID,
    body: RenewPrescriptionRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
    db: AsyncSession = Depends(get_db),
):
    """Renouvelle une ordonnance. Crée une nouvelle ordonnance liée à l'ancienne."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = RenewPrescriptionDTO(
        new_start_date=body.new_start_date,
        new_duration_days=body.new_duration_days,
        new_end_date=body.new_end_date,
        notes=body.notes,
    )

    use_case = RenewPrescriptionUseCase(repo, db)
    try:
        result = await use_case.execute(prescription_id, auth.cabinet_id, dto)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return _dto_to_response(result)


@router.post("/{invoice_id}/link-prescription", response_model=dict)
async def link_prescription_to_invoice(
    invoice_id: UUID,
    body: LinkPrescriptionToInvoiceRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
    invoice_repo=Depends(get_invoice_repository),
    db: AsyncSession = Depends(get_db),
):
    """Rattache une ordonnance à une facture existante."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = LinkPrescriptionToInvoiceUseCase(repo, invoice_repo, db)
    try:
        await use_case.execute(invoice_id, body.prescription_id, auth.cabinet_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return {"ok": True}


@router.get("/{prescription_id}/transmissions")
async def get_transmissions_for_prescription(
    prescription_id: UUID,
    request: Request,
    limit: int = 50,
    skip: int = 0,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve transmissions linked to a specific prescription."""
    from sqlalchemy import func, select
    from app.infrastructure.persistence.models.transmission_model import TransmissionModel
    from app.infrastructure.persistence.models.transmission_prescription_model import TransmissionPrescriptionModel
    from app.infrastructure.api.schemas.transmission_schemas import PrescriptionBrief
    from app.infrastructure.api.v1.transmission_routes import _build_prescription_briefs

    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # Count
    count_result = await db.execute(
        select(func.count())
        .select_from(TransmissionModel)
        .join(TransmissionPrescriptionModel, TransmissionPrescriptionModel.transmission_id == TransmissionModel.id)
        .where(
            TransmissionPrescriptionModel.prescription_id == prescription_id,
            TransmissionModel.cabinet_id == auth.cabinet_id,
        )
    )
    total = count_result.scalar_one()

    # Fetch
    result = await db.execute(
        select(TransmissionModel)
        .join(TransmissionPrescriptionModel, TransmissionPrescriptionModel.transmission_id == TransmissionModel.id)
        .where(
            TransmissionPrescriptionModel.prescription_id == prescription_id,
            TransmissionModel.cabinet_id == auth.cabinet_id,
        )
        .order_by(TransmissionModel.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    models = result.scalars().all()

    from app.infrastructure.security.key_manager import KeyManager
    from app.config import settings
    km = KeyManager(settings.encryption_master_key)

    items = []
    for m in models:
        from app.infrastructure.persistence.repositories.sqlalchemy_transmission_repo import SQLAlchemyTransmissionRepo
        entity = SQLAlchemyTransmissionRepo(db, km)._to_entity(m, auth.cabinet_id)
        prescriptions = await _build_prescription_briefs(db, entity.id)
        items.append({
            "id": str(entity.id),
            "cabinet_id": str(entity.cabinet_id),
            "idel_id": str(entity.idel_id),
            "patient_id": str(entity.patient_id),
            "appointment_id": str(entity.appointment_id) if entity.appointment_id else None,
            "type": entity.type,
            "status": entity.status,
            "transcription": entity.transcription,
            "structured_data": entity.structured_data,
            "audio_file_path": entity.audio_file_path,
            "recording_duration_seconds": entity.recording_duration_seconds,
            "generation_time_ms": entity.generation_time_ms,
            "prescriptions": [p.model_dump() for p in prescriptions],
            "created_at": entity.created_at.isoformat(),
            "updated_at": entity.updated_at.isoformat(),
        })

    return {"items": items, "total": total}
