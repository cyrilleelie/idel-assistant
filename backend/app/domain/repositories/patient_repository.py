from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.patient import Patient


class PatientRepository(ABC):
    @abstractmethod
    async def get_by_id(self, patient_id: UUID) -> Patient | None: ...

    @abstractmethod
    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = "active",
        search: str | None = None,
        sector_id: UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Patient], int]: ...

    @abstractmethod
    async def create(self, patient: Patient) -> Patient: ...

    @abstractmethod
    async def update(self, patient: Patient) -> Patient: ...

    @abstractmethod
    async def archive(self, patient_id: UUID, reason: str) -> None: ...
