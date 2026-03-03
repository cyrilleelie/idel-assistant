import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.appointment import Appointment


class AppointmentRepository(ABC):
    @abstractmethod
    async def get_by_id(self, appointment_id: UUID) -> Appointment | None: ...

    @abstractmethod
    async def list_by_date(
        self,
        cabinet_id: UUID,
        idel_id: UUID | None = None,
        date: datetime.date | None = None,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Appointment], int]: ...

    @abstractmethod
    async def list_by_patient(
        self, patient_id: UUID, cabinet_id: UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[Appointment], int]: ...

    @abstractmethod
    async def check_time_conflict(
        self,
        idel_id: UUID,
        scheduled_at: datetime.datetime,
        duration_minutes: int,
        exclude_id: UUID | None = None,
    ) -> bool: ...

    @abstractmethod
    async def create(self, appointment: Appointment) -> Appointment: ...

    @abstractmethod
    async def create_many(self, appointments: list[Appointment]) -> list[Appointment]: ...

    @abstractmethod
    async def list_by_care_protocol(
        self, care_protocol_id: UUID, cabinet_id: UUID
    ) -> list[Appointment]: ...

    @abstractmethod
    async def update(self, appointment: Appointment) -> Appointment: ...
