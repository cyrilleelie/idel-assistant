"""Routes pour les protocoles de soins."""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.domain.entities.care_protocol import CareProtocol
from app.domain.rules.care_protocol_rules import generate_appointments_from_protocol
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_care_protocol_repository,
    get_current_user,
    get_patient_repository,
)
from app.infrastructure.api.schemas.care_protocol_schemas import (
    CareProtocolCreate,
    CareProtocolListResponse,
    CareProtocolResponse,
    CareProtocolUpdate,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyPatientRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_protocol_repo import (
    SQLAlchemyCareProtocolRepo,
)

router = APIRouter(prefix="/care-protocols", tags=["care-protocols"])


def _entity_to_response(protocol: CareProtocol) -> CareProtocolResponse:
    return CareProtocolResponse(
        id=str(protocol.id),
        patient_id=str(protocol.patient_id),
        cabinet_id=str(protocol.cabinet_id),
        care_type=protocol.care_type,
        label=protocol.label,
        frequency_display=protocol.frequency_display,
        custom_frequency=protocol.custom_frequency,
        duration_minutes=protocol.duration_minutes,
        recurrence_rule=protocol.recurrence_rule,
        start_date=protocol.start_date,
        end_date=protocol.end_date,
        preferred_time=protocol.preferred_time,
        preferred_slot=protocol.preferred_slot,
        status=protocol.status,
        notes=protocol.notes,
        created_at=protocol.created_at,
        updated_at=protocol.updated_at,
    )


@router.post(
    "/",
    response_model=CareProtocolResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_care_protocol(
    body: CareProtocolCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    protocol_repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Crée un protocole de soins et génère les RDV des 4 prochaines semaines."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # Vérifie que le patient appartient au cabinet
    patient = await patient_repo.get_by_id(body.patient_id)
    if not patient or patient.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient introuvable",
        )

    # Valide le RRULE
    try:
        from app.domain.value_objects.recurrence import RecurrenceRule
        RecurrenceRule(body.recurrence_rule)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Règle de récurrence invalide : {e}",
        )

    protocol = CareProtocol(
        patient_id=body.patient_id,
        cabinet_id=auth.cabinet_id,
        care_type=body.care_type,
        label=body.label,
        frequency_display=body.frequency_display,
        custom_frequency=body.custom_frequency,
        duration_minutes=body.duration_minutes,
        recurrence_rule=body.recurrence_rule,
        start_date=body.start_date,
        end_date=body.end_date,
        preferred_time=body.preferred_time,
        preferred_slot=body.preferred_slot,
        notes=body.notes,
    )
    protocol = await protocol_repo.create(protocol)

    # Génère les RDV sur 4 semaines
    idel_id = body.idel_id or auth.user_id
    from_date = body.start_date
    to_date = from_date + datetime.timedelta(weeks=4)
    if body.end_date and body.end_date < to_date:
        to_date = body.end_date

    appointments = generate_appointments_from_protocol(
        protocol, idel_id, from_date, to_date
    )
    if appointments:
        await appointment_repo.create_many(appointments)

    return _entity_to_response(protocol)


@router.get("/", response_model=CareProtocolListResponse)
async def list_care_protocols(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
    patient_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    """Liste les protocoles de soins (filtrable par patient)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if patient_id:
        protocols, total = await repo.list_by_patient(
            patient_id=patient_id, status=status_filter, skip=skip, limit=limit
        )
    else:
        protocols, total = await repo.list_by_cabinet(
            cabinet_id=auth.cabinet_id, status=status_filter, skip=skip, limit=limit
        )

    return CareProtocolListResponse(
        items=[_entity_to_response(p) for p in protocols],
        total=total,
    )


CARE_PROTOCOL_UPDATABLE_FIELDS = frozenset({
    "care_type", "label", "frequency_display", "custom_frequency",
    "duration_minutes", "recurrence_rule", "start_date", "end_date",
    "preferred_time", "preferred_slot", "notes", "status",
})


@router.patch("/{protocol_id}", response_model=CareProtocolResponse)
async def update_care_protocol(
    protocol_id: UUID,
    body: CareProtocolUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
):
    """Met à jour partiellement un protocole de soins."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    protocol = await repo.get_by_id(protocol_id)
    if not protocol or protocol.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocole introuvable",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        if field_name in CARE_PROTOCOL_UPDATABLE_FIELDS:
            setattr(protocol, field_name, value)

    protocol = await repo.update(protocol)
    return _entity_to_response(protocol)


@router.delete("/{protocol_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_protocol(
    protocol_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
):
    """Supprime un protocole de soins."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    protocol = await repo.get_by_id(protocol_id)
    if not protocol or protocol.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocole introuvable",
        )

    await repo.delete(protocol_id)
