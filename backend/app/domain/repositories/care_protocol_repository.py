import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.care_protocol import CareProtocol


class CareProtocolRepository(ABC):
    @abstractmethod
    async def get_by_id(self, protocol_id: UUID) -> CareProtocol | None: ...

    @abstractmethod
    async def list_by_patient(
        self,
        patient_id: UUID,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[CareProtocol], int]: ...

    @abstractmethod
    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[CareProtocol], int]: ...

    @abstractmethod
    async def create(self, protocol: CareProtocol) -> CareProtocol: ...

    @abstractmethod
    async def update(self, protocol: CareProtocol) -> CareProtocol: ...
