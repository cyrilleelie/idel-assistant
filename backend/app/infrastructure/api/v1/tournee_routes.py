"""Routes pour les tournees."""

import datetime

from fastapi import APIRouter, Depends, Query, Request

from app.application.use_cases.build_tournee import BuildDailyTourneeUseCase
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_current_user,
    get_patient_repository,
    get_routing_service,
    get_sector_repository,
)
from app.infrastructure.api.schemas.tournee_schemas import (
    TourneeDetailResponse,
    TourneeMetrics,
    TourneeStopResponse,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemySectorRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_tournee_repo import (
    SQLAlchemyTourneeRepo,
)
from app.infrastructure.services.fake_routing_service import FakeRoutingService
from sqlalchemy.ext.asyncio import AsyncSession
from app.infrastructure.persistence.database import get_db

router = APIRouter(prefix="/tournees", tags=["tournees"])


def _get_tournee_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyTourneeRepo:
    return SQLAlchemyTourneeRepo(db)


@router.get("/today", response_model=TourneeDetailResponse)
async def get_today_tournee(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    date: datetime.date | None = Query(default=None),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    sector_repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
    tournee_repo: SQLAlchemyTourneeRepo = Depends(_get_tournee_repository),
    routing: FakeRoutingService = Depends(get_routing_service),
):
    """Recupere ou construit la tournee du jour."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    target_date = date or datetime.date.today()

    use_case = BuildDailyTourneeUseCase(
        appointment_repo=appointment_repo,
        patient_repo=patient_repo,
        sector_repo=sector_repo,
        tournee_repo=tournee_repo,
        routing_service=routing,
    )

    result = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        idel_id=auth.user_id,
        date=target_date,
    )

    tournee = result["tournee"]
    stops = result["stops"]
    metrics = result["metrics"]
    inefficiencies = result["inefficiencies"]

    return TourneeDetailResponse(
        tournee_id=str(tournee.id) if tournee else None,
        date=target_date.isoformat(),
        status=tournee.status if tournee else "empty",
        stops=[
            TourneeStopResponse(
                stop_order=s.stop_order,
                appointment_id=str(s.appointment_id),
                estimated_arrival=s.estimated_arrival,
                distance_from_previous_km=s.distance_from_previous_km,
                travel_time_from_previous_min=s.travel_time_from_previous_min,
            )
            for s in stops
        ],
        metrics=TourneeMetrics(
            total_distance_km=metrics["total_distance_km"],
            total_travel_minutes=metrics["total_travel_minutes"],
            total_care_minutes=metrics["total_care_minutes"],
            longest_leg_km=metrics["longest_leg_km"],
            num_stops=len(stops),
        ),
        inefficiencies=inefficiencies,
    )
