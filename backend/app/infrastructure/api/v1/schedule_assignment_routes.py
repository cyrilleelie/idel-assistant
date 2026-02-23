"""Routes pour la gestion du planning cabinet (schedule assignments)."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.domain.entities.schedule_assignment import ScheduleAssignment
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_current_user,
    get_schedule_assignment_repository,
)
from app.infrastructure.api.schemas.schedule_assignment_schemas import (
    ScheduleMonthResponse,
    ScheduleToggleRequest,
    ScheduleToggleResponse,
)
from app.infrastructure.persistence.repositories import SQLAlchemyScheduleAssignmentRepo

router = APIRouter(prefix="/schedule-assignments", tags=["schedule-assignments"])


@router.get("/", response_model=ScheduleMonthResponse)
async def list_month_schedule(
    request: Request,
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyScheduleAssignmentRepo = Depends(get_schedule_assignment_repository),
):
    """Retourne toutes les affectations du mois, pre-formatees pour le frontend."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    assignments = await repo.list_by_month(auth.cabinet_id, year, month)

    # Build { dateStr: { slotId: [nurseId, ...] } }
    schedule: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for a in assignments:
        date_str = a.assigned_date.isoformat()
        schedule[date_str][a.slot_id].append(str(a.nurse_id))

    # Convert defaultdicts to plain dicts for serialization
    schedule_plain = {k: dict(v) for k, v in schedule.items()}

    return ScheduleMonthResponse(year=year, month=month, schedule=schedule_plain)


@router.post("/toggle", response_model=ScheduleToggleResponse)
async def toggle_assignment(
    body: ScheduleToggleRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyScheduleAssignmentRepo = Depends(get_schedule_assignment_repository),
):
    """Toggle une affectation : si elle existe, la supprime ; sinon, la cree."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if auth.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seuls les administrateurs peuvent modifier le planning.",
        )

    deleted = await repo.delete_by_key(
        cabinet_id=auth.cabinet_id,
        nurse_id=body.nurse_id,
        slot_id=body.slot_id,
        assigned_date=body.assigned_date,
    )

    if deleted:
        return ScheduleToggleResponse(
            action="removed",
            nurse_id=body.nurse_id,
            slot_id=body.slot_id,
            assigned_date=body.assigned_date,
        )

    assignment = ScheduleAssignment(
        cabinet_id=auth.cabinet_id,
        nurse_id=body.nurse_id,
        slot_id=body.slot_id,
        assigned_date=body.assigned_date,
    )
    await repo.create(assignment)

    return ScheduleToggleResponse(
        action="added",
        nurse_id=body.nurse_id,
        slot_id=body.slot_id,
        assigned_date=body.assigned_date,
    )
