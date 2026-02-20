"""Routes pour la suggestion de creneaux."""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.application.use_cases.suggest_slot import SuggestSlotUseCase
from app.domain.entities.appointment import Appointment
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_current_user,
    get_patient_repository,
    get_routing_service,
    get_sector_repository,
)
from app.infrastructure.api.schemas.appointment_schemas import AppointmentResponse
from app.infrastructure.api.schemas.slot_schemas import (
    DaySummary,
    SlotBookRequest,
    SlotSuggestRequest,
    SlotSuggestResponse,
    SlotSuggestionItem,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemySectorRepo,
)
from app.infrastructure.services.fake_routing_service import FakeRoutingService

router = APIRouter(prefix="/slots", tags=["slots"])


@router.post("/suggest", response_model=SlotSuggestResponse)
async def suggest_slots(
    body: SlotSuggestRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    sector_repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
    routing: FakeRoutingService = Depends(get_routing_service),
):
    """Suggere les 3 meilleurs creneaux pour un nouveau RDV."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    idel_id = body.idel_id or auth.user_id

    use_case = SuggestSlotUseCase(
        appointment_repo=appointment_repo,
        patient_repo=patient_repo,
        sector_repo=sector_repo,
        routing_service=routing,
    )

    suggestions = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        idel_id=idel_id,
        patient_id=body.patient_id,
        date=body.date,
        duration=body.duration_minutes,
    )

    # Build day summary
    appts, _ = await appointment_repo.list_by_date(
        cabinet_id=auth.cabinet_id,
        idel_id=idel_id,
        date=body.date,
        limit=100,
    )
    active_appts = [a for a in appts if a.status not in ("canceled", "no_show")]
    sorted_appts = sorted(active_appts, key=lambda a: a.scheduled_at)

    day_summary = DaySummary(
        date=body.date.isoformat(),
        num_appointments=len(sorted_appts),
        first_appointment=sorted_appts[0].scheduled_at.strftime("%H:%M") if sorted_appts else None,
        last_appointment=sorted_appts[-1].scheduled_at.strftime("%H:%M") if sorted_appts else None,
    )

    return SlotSuggestResponse(
        suggestions=[
            SlotSuggestionItem(
                rank=s.rank,
                start_time=s.start_time.strftime("%H:%M"),
                end_time=s.end_time.strftime("%H:%M"),
                previous_appointment_id=str(s.previous_appointment_id) if s.previous_appointment_id else None,
                next_appointment_id=str(s.next_appointment_id) if s.next_appointment_id else None,
                detour_km=s.detour_km,
                detour_minutes=s.detour_minutes,
                same_sector=s.same_sector,
                sector_name=s.sector_name,
                score=s.score,
                explanation=s.explanation,
            )
            for s in suggestions
        ],
        day_summary=day_summary,
    )


@router.post(
    "/suggest/{rank}/book",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def book_suggested_slot(
    rank: int,
    body: SlotBookRequest,
    request: Request,
    suggest_request: SlotSuggestRequest = Depends(),
    auth: AuthContext = Depends(get_current_user),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    sector_repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
    routing: FakeRoutingService = Depends(get_routing_service),
):
    """Reserve le creneau suggere (relance la suggestion et prend le rang demande)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    idel_id = suggest_request.idel_id or auth.user_id

    use_case = SuggestSlotUseCase(
        appointment_repo=appointment_repo,
        patient_repo=patient_repo,
        sector_repo=sector_repo,
        routing_service=routing,
    )

    suggestions = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        idel_id=idel_id,
        patient_id=suggest_request.patient_id,
        date=suggest_request.date,
        duration=suggest_request.duration_minutes,
    )

    chosen = None
    for s in suggestions:
        if s.rank == rank:
            chosen = s
            break

    if chosen is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Suggestion rang {rank} introuvable",
        )

    # Creer le RDV
    scheduled_at = datetime.datetime.combine(
        suggest_request.date,
        chosen.start_time,
        tzinfo=datetime.UTC,
    )

    appointment = Appointment(
        cabinet_id=auth.cabinet_id,
        idel_id=idel_id,
        patient_id=suggest_request.patient_id,
        scheduled_at=scheduled_at,
        duration_minutes=suggest_request.duration_minutes,
        care_type=body.care_type,
        time_window_start=chosen.start_time,
        time_window_end=chosen.end_time,
        care_protocol_id=body.care_protocol_id,
        created_by="suggestion",
    )
    appointment = await appointment_repo.create(appointment)

    return AppointmentResponse(
        id=str(appointment.id),
        cabinet_id=str(appointment.cabinet_id),
        idel_id=str(appointment.idel_id),
        patient_id=str(appointment.patient_id),
        scheduled_at=appointment.scheduled_at,
        duration_minutes=appointment.duration_minutes,
        care_type=appointment.care_type,
        location_type=appointment.location_type,
        care_protocol_id=str(appointment.care_protocol_id) if appointment.care_protocol_id else None,
        status=appointment.status,
        created_by=appointment.created_by,
        created_at=appointment.created_at,
        updated_at=appointment.updated_at,
    )
