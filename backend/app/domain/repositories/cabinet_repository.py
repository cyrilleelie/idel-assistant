from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.cabinet import Cabinet
from app.domain.entities.user import CabinetMember


class CabinetRepository(ABC):
    @abstractmethod
    async def get_by_id(self, cabinet_id: UUID) -> Cabinet | None: ...

    @abstractmethod
    async def create(self, cabinet: Cabinet) -> Cabinet: ...

    @abstractmethod
    async def update(self, cabinet: Cabinet) -> Cabinet: ...

    @abstractmethod
    async def add_member(self, member: CabinetMember) -> CabinetMember: ...

    @abstractmethod
    async def get_members(self, cabinet_id: UUID) -> list[CabinetMember]: ...

    @abstractmethod
    async def get_member(
        self, cabinet_id: UUID, user_id: UUID
    ) -> CabinetMember | None: ...
