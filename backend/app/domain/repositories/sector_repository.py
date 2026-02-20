from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.sector import Sector


class SectorRepository(ABC):
    @abstractmethod
    async def get_by_id(self, sector_id: UUID) -> Sector | None: ...

    @abstractmethod
    async def list_by_cabinet(self, cabinet_id: UUID) -> list[Sector]: ...

    @abstractmethod
    async def find_by_postal_code(self, cabinet_id: UUID, postal_code: str) -> Sector | None: ...

    @abstractmethod
    async def create(self, sector: Sector) -> Sector: ...

    @abstractmethod
    async def update(self, sector: Sector) -> Sector: ...

    @abstractmethod
    async def delete(self, sector_id: UUID) -> None: ...
