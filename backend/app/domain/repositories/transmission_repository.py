import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.transmission import Transmission


class TransmissionRepository(ABC):
    @abstractmethod
    async def get_by_id(self, transmission_id: UUID) -> Transmission | None: ...

    @abstractmethod
    async def list_by_patient(
        self, patient_id: UUID, cabinet_id: UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[Transmission], int]: ...

    @abstractmethod
    async def list_by_cabinet(
        self, cabinet_id: UUID, skip: int = 0, limit: int = 50
    ) -> tuple[list[Transmission], int]: ...

    @abstractmethod
    async def list_by_patient_since(
        self, patient_id: UUID, cabinet_id: UUID, since: datetime.datetime
    ) -> list[Transmission]: ...

    @abstractmethod
    async def list_updated_since(
        self, cabinet_id: UUID, since: datetime.datetime
    ) -> list[Transmission]: ...

    @abstractmethod
    async def create(self, transmission: Transmission) -> Transmission: ...

    @abstractmethod
    async def update(self, transmission: Transmission) -> Transmission: ...
