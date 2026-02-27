from abc import ABC, abstractmethod

from app.domain.entities.rpps_doctor import RppsDoctor


class RppsDoctorRepository(ABC):
    @abstractmethod
    async def search(self, query: str, limit: int = 10) -> list[RppsDoctor]: ...

    @abstractmethod
    async def bulk_upsert(self, doctors: list[RppsDoctor]) -> int: ...
