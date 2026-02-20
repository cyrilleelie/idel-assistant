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
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    """Liste les patients du cabinet avec pagination et recherche."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    patients, total = await repo.list_by_cabinet(
        cabinet_id=auth.cabinet_id,
        status=status_filter,
        search=search,
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
    "sector_id", "postal_code", "city",
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
    for field_name, value in update_data.items():
        if field_name in PATIENT_UPDATABLE_FIELDS:
            setattr(patient, field_name, value)

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
    await repo.archive(patient_id, reason)
