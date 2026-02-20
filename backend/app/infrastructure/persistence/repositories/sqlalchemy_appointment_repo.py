import datetime
from uuid import UUID

from sqlalchemy import func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.appointment import Appointment
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.infrastructure.persistence.models.appointment_model import AppointmentModel


class SQLAlchemyAppointmentRepo(AppointmentRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: AppointmentModel) -> Appointment:
        return Appointment(
            id=model.id,
            cabinet_id=model.cabinet_id,
            idel_id=model.idel_id,
            patient_id=model.patient_id,
            care_protocol_id=model.care_protocol_id,
            scheduled_at=model.scheduled_at,
            duration_minutes=model.duration_minutes,
            care_type=model.care_type,
            status=model.status,
            cancellation_reason=model.cancellation_reason,
            canceled_at=model.canceled_at,
            created_by=model.created_by,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, appointment_id: UUID) -> Appointment | None:
        result = await self._session.execute(
            select(AppointmentModel).where(AppointmentModel.id == appointment_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_date(
        self,
        cabinet_id: UUID,
        idel_id: UUID | None = None,
        date: datetime.date | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Appointment], int]:
        query = select(AppointmentModel).where(
            AppointmentModel.cabinet_id == cabinet_id
        )

        if idel_id:
            query = query.where(AppointmentModel.idel_id == idel_id)
        if date:
            day_start = datetime.datetime.combine(date, datetime.time.min, tzinfo=datetime.UTC)
            day_end = datetime.datetime.combine(date, datetime.time.max, tzinfo=datetime.UTC)
            query = query.where(
                AppointmentModel.scheduled_at.between(day_start, day_end)
            )
        if status:
            query = query.where(AppointmentModel.status == status)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.offset(skip).limit(limit).order_by(AppointmentModel.scheduled_at)
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()], total

    async def list_by_patient(
        self, patient_id: UUID, cabinet_id: UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[Appointment], int]:
        query = select(AppointmentModel).where(
            AppointmentModel.patient_id == patient_id,
            AppointmentModel.cabinet_id == cabinet_id,
        )

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.offset(skip).limit(limit).order_by(
            AppointmentModel.scheduled_at.desc()
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()], total

    async def check_time_conflict(
        self,
        idel_id: UUID,
        scheduled_at: datetime.datetime,
        duration_minutes: int,
        exclude_id: UUID | None = None,
    ) -> bool:
        """Retourne True s'il y a un conflit."""
        end_at = scheduled_at + datetime.timedelta(minutes=duration_minutes)

        query = select(AppointmentModel).where(
            AppointmentModel.idel_id == idel_id,
            AppointmentModel.status != "canceled",
            # Chevauchement: existing_start < new_end AND new_start < existing_end
            AppointmentModel.scheduled_at < end_at,
            (
                AppointmentModel.scheduled_at
                + AppointmentModel.duration_minutes * literal_column("INTERVAL '1 minute'")
            )
            > scheduled_at,
        )

        if exclude_id:
            query = query.where(AppointmentModel.id != exclude_id)

        result = await self._session.execute(query)
        return result.scalar_one_or_none() is not None

    async def create(self, appointment: Appointment) -> Appointment:
        model = AppointmentModel(
            id=appointment.id,
            cabinet_id=appointment.cabinet_id,
            idel_id=appointment.idel_id,
            patient_id=appointment.patient_id,
            care_protocol_id=appointment.care_protocol_id,
            scheduled_at=appointment.scheduled_at,
            duration_minutes=appointment.duration_minutes,
            care_type=appointment.care_type,
            status=appointment.status,
            created_by=appointment.created_by,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def create_many(self, appointments: list[Appointment]) -> list[Appointment]:
        models = []
        for appt in appointments:
            model = AppointmentModel(
                id=appt.id,
                cabinet_id=appt.cabinet_id,
                idel_id=appt.idel_id,
                patient_id=appt.patient_id,
                care_protocol_id=appt.care_protocol_id,
                scheduled_at=appt.scheduled_at,
                duration_minutes=appt.duration_minutes,
                care_type=appt.care_type,
                status=appt.status,
                created_by=appt.created_by,
            )
            self._session.add(model)
            models.append(model)
        await self._session.flush()
        return [self._model_to_entity(m) for m in models]

    async def update(self, appointment: Appointment) -> Appointment:
        result = await self._session.execute(
            select(AppointmentModel).where(AppointmentModel.id == appointment.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Appointment {appointment.id} not found")

        model.scheduled_at = appointment.scheduled_at
        model.duration_minutes = appointment.duration_minutes
        model.care_type = appointment.care_type
        model.status = appointment.status
        model.cancellation_reason = appointment.cancellation_reason
        model.canceled_at = appointment.canceled_at
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)
