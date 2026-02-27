import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.prescription import Prescription


class PrescriptionRepository(ABC):
    @abstractmethod
    async def get_by_id(self, prescription_id: UUID, cabinet_id: UUID) -> Prescription | None: ...

    @abstractmethod
    async def list_by_patient(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Prescription], int]: ...

    @abstractmethod
    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Prescription], int]: ...

    @abstractmethod
    async def get_expiring(
        self,
        cabinet_id: UUID,
        days_ahead: int = 7,
        reference_date: datetime.date | None = None,
    ) -> list[Prescription]: ...

    @abstractmethod
    async def get_active_by_patient(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
    ) -> list[Prescription]: ...

    @abstractmethod
    async def list_by_care_protocol(
        self,
        care_protocol_id: UUID,
        status: str | None = None,
    ) -> list[Prescription]: ...

    @abstractmethod
    async def list_by_invoice(
        self,
        prescription_id: UUID,
        cabinet_id: UUID,
    ) -> list: ...

    @abstractmethod
    async def create(self, prescription: Prescription) -> Prescription: ...

    @abstractmethod
    async def update(self, prescription: Prescription) -> Prescription: ...
