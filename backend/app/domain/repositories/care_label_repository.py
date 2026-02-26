from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.care_label import CareLabel


class CareLabelRepository(ABC):
    @abstractmethod
    async def list_active(self, cabinet_id: UUID) -> list[CareLabel]: ...

    @abstractmethod
    async def get_by_id(self, id: UUID) -> CareLabel | None: ...

    @abstractmethod
    async def create(self, entity: CareLabel) -> CareLabel: ...

    @abstractmethod
    async def update(self, entity: CareLabel) -> CareLabel: ...

    @abstractmethod
    async def delete(self, id: UUID) -> None: ...
