"""Routes CRUD pour les patients."""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.domain.entities.patient import Patient
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_current_user,
    get_patient_repository,
)
from app.infrastructure.api.schemas.patient_schemas import (
    PatientCreate,
    PatientListResponse,
    PatientResponse,
    PatientUpdate,
)
from app.infrastructure.persistence.repositories import SQLAlchemyPatientRepo

router = APIRouter(prefix="/patients", tags=["patients"])


def _entity_to_response(patient: Patient) -> PatientResponse:
    return PatientResponse(
        id=str(patient.id),
        first_name=patient.first_name,
        last_name=patient.last_name,
        birth_date=patient.birth_date,
        address=patient.address,
        lat=patient.lat,
        lon=patient.lon,
        sector_id=str(patient.sector_id) if patient.sector_id else None,
        postal_code=patient.postal_code,
        city=patient.city,
        phone=patient.phone,
        email=patient.email,
        pathologies=patient.pathologies,
        preferred_time_slot=patient.preferred_time_slot,
        care_duration_default=patient.care_duration_default,
        notes=patient.notes,
        ssn=patient.ssn,
        doctor_name=patient.doctor_name,
        doctor_rpps=patient.doctor_rpps,
        doctor_contact=patient.doctor_contact,
        amo_code=patient.amo_code,
        amo_center=patient.amo_center,
        amc_code=patient.amc_code,
        amc_name=patient.amc_name,
        amc_contract=patient.amc_contract,
        exoneration_type=patient.exoneration_type,
        birth_rank=patient.birth_rank,
        status=patient.status,
        created_at=patient.created_at,
        updated_at=patient.updated_at,
    )


@router.get("/", response_model=PatientListResponse)
async def list_patients(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    search: str | None = Query(default=None, max_length=100),
    status_filter: str = Query(default="active", alias="status"),
    sector_id: UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    """Liste les patients du cabinet avec pagination et recherche."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # "all" means no status filter
    effective_status = None if status_filter == "all" else status_filter

    patients, total = await repo.list_by_cabinet(
        cabinet_id=auth.cabinet_id,
        status=effective_status,
        search=search,
        sector_id=sector_id,
        skip=skip,
        limit=limit,
    )
    return PatientListResponse(
        items=[_entity_to_response(p) for p in patients],
        total=total,
    )


@router.post(
    "/",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_patient(
    body: PatientCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Crée un nouveau patient dans le cabinet."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    patient = Patient(
        cabinet_id=auth.cabinet_id,
        first_name=body.first_name,
        last_name=body.last_name,
        birth_date=body.birth_date,
        phone=body.phone,
        email=body.email,
        address=body.address,
        pathologies=body.pathologies,
        preferred_time_slot=body.preferred_time_slot,
        care_duration_default=body.care_duration_default,
        notes=body.notes,
        ssn=body.ssn,
        doctor_name=body.doctor_name,
        doctor_rpps=body.doctor_rpps,
        doctor_contact=body.doctor_contact,
        sector_id=body.sector_id,
        postal_code=body.postal_code,
        city=body.city,
    )
    patient = await repo.create(patient)
    return _entity_to_response(patient)


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Récupère un patient par son ID."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    patient = await repo.get_by_id(patient_id)
    if not patient or patient.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient introuvable",
        )
    return _entity_to_response(patient)


PATIENT_UPDATABLE_FIELDS = frozenset({
    "first_name", "last_name", "birth_date", "address", "phone",
    "email", "pathologies", "preferred_time_slot", "care_duration_default", "notes",
    "ssn", "doctor_name", "doctor_rpps", "doctor_contact",
    "sector_id", "postal_code", "city", "status",
    "amo_code", "amo_center", "amc_code", "amc_name", "amc_contract",
    "exoneration_type", "birth_rank",
})


@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    body: PatientUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Met à jour partiellement un patient."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    patient = await repo.get_by_id(patient_id)
    if not patient or patient.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient introuvable",
        )

    update_data = body.model_dump(exclude_unset=True)

    # Guard: only allow archived -> active transition
    if "status" in update_data:
        new_status = update_data["status"]
        if not (patient.status == "archived" and new_status == "active"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Seule la reactivation (archived -> active) est autorisee",
            )

    # Audit diff : capture avant/après pour chaque champ modifié
    changes = {}
    for field_name, value in update_data.items():
        if field_name in PATIENT_UPDATABLE_FIELDS:
            old_value = getattr(patient, field_name, None)
            # Convertir les UUID en str pour JSON
            old_str = str(old_value) if old_value is not None else None
            new_str = str(value) if value is not None else None
            if old_str != new_str:
                changes[field_name] = {"old": old_str, "new": new_str}
            setattr(patient, field_name, value)

    request.state.audit_changes = changes

    # Clear archive fields on reactivation
    if update_data.get("status") == "active":
        patient.archived_reason = None
        patient.archived_at = None

    patient = await repo.update(patient)
    return _entity_to_response(patient)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_patient(
    patient_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    reason: str = Query(default="", max_length=500),
):
    """Archive un patient (soft delete)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    patient = await repo.get_by_id(patient_id)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient introuvable",
        )

    request.state.audit_changes = {
        "status": {"old": patient.status, "new": "archived"},
        "reason": reason,
    }
    await repo.archive(patient_id, reason)
