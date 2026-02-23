import datetime
from uuid import UUID

from sqlalchemy import and_, delete, extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.schedule_assignment import ScheduleAssignment
from app.infrastructure.persistence.models.schedule_assignment_model import ScheduleAssignmentModel


class SQLAlchemyScheduleAssignmentRepo:
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: ScheduleAssignmentModel) -> ScheduleAssignment:
        return ScheduleAssignment(
            id=model.id,
            cabinet_id=model.cabinet_id,
            nurse_id=model.nurse_id,
            slot_id=model.slot_id,
            assigned_date=model.assigned_date,
            created_at=model.created_at,
        )

    async def list_by_month(
        self, cabinet_id: UUID, year: int, month: int
    ) -> list[ScheduleAssignment]:
        result = await self._session.execute(
            select(ScheduleAssignmentModel).where(
                ScheduleAssignmentModel.cabinet_id == cabinet_id,
                extract("year", ScheduleAssignmentModel.assigned_date) == year,
                extract("month", ScheduleAssignmentModel.assigned_date) == month,
            )
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def create(self, assignment: ScheduleAssignment) -> ScheduleAssignment:
        model = ScheduleAssignmentModel(
            id=assignment.id,
            cabinet_id=assignment.cabinet_id,
            nurse_id=assignment.nurse_id,
            slot_id=assignment.slot_id,
            assigned_date=assignment.assigned_date,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def delete_by_key(
        self,
        cabinet_id: UUID,
        nurse_id: UUID,
        slot_id: str,
        assigned_date: datetime.date,
    ) -> bool:
        """Delete an assignment by its composite key. Returns True if deleted, False if not found."""
        result = await self._session.execute(
            select(ScheduleAssignmentModel).where(
                and_(
                    ScheduleAssignmentModel.cabinet_id == cabinet_id,
                    ScheduleAssignmentModel.nurse_id == nurse_id,
                    ScheduleAssignmentModel.slot_id == slot_id,
                    ScheduleAssignmentModel.assigned_date == assigned_date,
                )
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            return False
        await self._session.delete(model)
        await self._session.flush()
        return True
