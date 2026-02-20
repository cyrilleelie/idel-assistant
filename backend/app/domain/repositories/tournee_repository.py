import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.tournee import Tournee, TourneeStop


class TourneeRepository(ABC):
    @abstractmethod
    async def get_by_id(self, tournee_id: UUID) -> Tournee | None: ...

    @abstractmethod
    async def get_by_date(
        self, cabinet_id: UUID, idel_id: UUID, date: datetime.date
    ) -> Tournee | None: ...

    @abstractmethod
    async def get_stops(self, tournee_id: UUID) -> list[TourneeStop]: ...

    @abstractmethod
    async def save_with_stops(
        self, tournee: Tournee, stops: list[TourneeStop]
    ) -> Tournee: ...

    @abstractmethod
    async def update(self, tournee: Tournee) -> Tournee: ...

    @abstractmethod
    async def update_stop(self, stop: TourneeStop) -> TourneeStop: ...

    @abstractmethod
    async def get_stats(
        self,
        cabinet_id: UUID,
        from_date: datetime.date,
        to_date: datetime.date,
    ) -> dict: ...
