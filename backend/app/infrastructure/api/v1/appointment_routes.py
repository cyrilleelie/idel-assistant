"""Routes CRUD pour les rendez-vous."""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.domain.entities.appointment import Appointment
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_current_user,
    get_patient_repository,
)
from app.infrastructure.api.schemas.appointment_schemas import (
    AppointmentCreate,
    AppointmentListResponse,
    AppointmentResponse,
    AppointmentUpdate,
    CancelRequest,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyPatientRepo,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

APPOINTMENT_UPDATABLE_FIELDS = frozenset({
    "scheduled_at", "duration_minutes", "care_type", "care_protocol_id",
    "location_type", "act_codes", "care_labels", "distance_km", "status",
})


def _entity_to_response(appt: Appointment) -> AppointmentResponse:
    return AppointmentResponse(
        id=str(appt.id),
        cabinet_id=str(appt.cabinet_id),
        idel_id=str(appt.idel_id),
        patient_id=str(appt.patient_id),
        scheduled_at=appt.scheduled_at,
        duration_minutes=appt.duration_minutes,
        care_type=appt.care_type,
        location_type=appt.location_type,
        time_window_start=appt.time_window_start,
        time_window_end=appt.time_window_end,
        care_protocol_id=str(appt.care_protocol_id) if appt.care_protocol_id else None,
        act_codes=appt.act_codes,
        care_labels=appt.care_labels,
        distance_km=appt.distance_km,
        status=appt.status,
        cancellation_reason=appt.cancellation_reason,
        canceled_at=appt.canceled_at,
        created_by=appt.created_by,
        created_at=appt.created_at,
        updated_at=appt.updated_at,
    )


@router.get("/", response_model=AppointmentListResponse)
async def list_appointments(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    date: datetime.date | None = Query(default=None),
    idel_id: UUID | None = Query(default=None),
    patient_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
):
    """Liste les rendez-vous avec filtres optionnels."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if patient_id:
        appointments, total = await repo.list_by_patient(
            patient_id=patient_id,
            cabinet_id=auth.cabinet_id,
            skip=skip,
            limit=limit,
        )
    else:
        appointments, total = await repo.list_by_date(
            cabinet_id=auth.cabinet_id,
            idel_id=idel_id,
            date=date,
            status=status_filter,
            skip=skip,
            limit=limit,
        )

    return AppointmentListResponse(
        items=[_entity_to_response(a) for a in appointments],
        total=total,
    )


@router.post(
    "/",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_appointment(
    body: AppointmentCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Crée un nouveau rendez-vous après vérification des conflits horaires."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # Vérifie que le patient appartient au cabinet
    patient = await patient_repo.get_by_id(body.patient_id)
    if not patient or patient.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient introuvable",
        )

    idel_id = body.idel_id or auth.user_id

    # Vérifie les conflits horaires
    has_conflict = await repo.check_time_conflict(
        idel_id=idel_id,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
    )
    if has_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflit horaire avec un rendez-vous existant",
        )

    appointment = Appointment(
        cabinet_id=auth.cabinet_id,
        idel_id=idel_id,
        patient_id=body.patient_id,
        scheduled_at=body.scheduled_at,
        duration_minutes=body.duration_minutes,
        care_type=body.care_type,
        location_type=body.location_type,
        time_window_start=body.time_window_start,
        time_window_end=body.time_window_end,
        care_protocol_id=body.care_protocol_id,
        act_codes=body.act_codes,
        care_labels=body.care_labels,
        distance_km=body.distance_km,
    )
    appointment = await repo.create(appointment)
    return _entity_to_response(appointment)


@router.get("/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
):
    """Récupère un rendez-vous par son ID."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    appt = await repo.get_by_id(appointment_id)
    if not appt or appt.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendez-vous introuvable",
        )
    return _entity_to_response(appt)


@router.patch("/{appointment_id}", response_model=AppointmentResponse)
async def update_appointment(
    appointment_id: UUID,
    body: AppointmentUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
):
    """Met à jour un rendez-vous."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    appt = await repo.get_by_id(appointment_id)
    if not appt or appt.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendez-vous introuvable",
        )

    if appt.status not in ("scheduled", "completed"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seuls les rendez-vous planifiés ou réalisés peuvent être modifiés",
        )

    update_data = body.model_dump(exclude_unset=True)

    # Si l'horaire ou la durée change, vérifie les conflits
    new_scheduled_at = update_data.get("scheduled_at", appt.scheduled_at)
    new_duration = update_data.get("duration_minutes", appt.duration_minutes)
    if "scheduled_at" in update_data or "duration_minutes" in update_data:
        has_conflict = await repo.check_time_conflict(
            idel_id=appt.idel_id,
            scheduled_at=new_scheduled_at,
            duration_minutes=new_duration,
            exclude_id=appointment_id,
        )
        if has_conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Conflit horaire avec un rendez-vous existant",
            )

    for field_name, value in update_data.items():
        if field_name in APPOINTMENT_UPDATABLE_FIELDS:
            setattr(appt, field_name, value)

    appt = await repo.update(appt)
    return _entity_to_response(appt)


@router.post("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    appointment_id: UUID,
    body: CancelRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
):
    """Annule un rendez-vous avec une raison."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    appt = await repo.get_by_id(appointment_id)
    if not appt or appt.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendez-vous introuvable",
        )

    if appt.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seuls les rendez-vous planifiés peuvent être annulés",
        )

    appt.status = "canceled"
    appt.cancellation_reason = body.reason
    appt.canceled_at = datetime.datetime.now(datetime.UTC)
    appt = await repo.update(appt)
    return _entity_to_response(appt)


@router.post("/{appointment_id}/complete", response_model=AppointmentResponse)
async def complete_appointment(
    appointment_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
):
    """Marque un rendez-vous comme réalisé."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    appt = await repo.get_by_id(appointment_id)
    if not appt or appt.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rendez-vous introuvable",
        )

    if appt.status != "scheduled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Seuls les rendez-vous planifiés peuvent être complétés",
        )

    appt.status = "completed"
    appt = await repo.update(appt)
    return _entity_to_response(appt)
