import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.entities.tariff_update import TariffUpdate


class CareTypeCatalogRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: UUID) -> CareTypeCatalog | None: ...

    @abstractmethod
    async def get_by_code(
        self,
        code: str,
        cabinet_id: UUID | None = None,
        at_date: datetime.date | None = None,
    ) -> CareTypeCatalog | None: ...

    @abstractmethod
    async def list_active(
        self,
        cabinet_id: UUID,
        category: str | None = None,
        lettre_cle: str | None = None,
    ) -> list[CareTypeCatalog]: ...

    @abstractmethod
    async def create(self, entity: CareTypeCatalog) -> CareTypeCatalog: ...

    @abstractmethod
    async def update(self, entity: CareTypeCatalog) -> CareTypeCatalog: ...

    @abstractmethod
    async def toggle_active(self, id: UUID, is_active: bool) -> CareTypeCatalog: ...


class TariffUpdateRepository(ABC):
    @abstractmethod
    async def get_available(self) -> list[TariffUpdate]: ...

    @abstractmethod
    async def get_by_id(self, id: UUID) -> TariffUpdate | None: ...

    @abstractmethod
    async def save(self, entity: TariffUpdate) -> TariffUpdate: ...

    @abstractmethod
    async def mark_applied(self, id: UUID) -> TariffUpdate: ...
