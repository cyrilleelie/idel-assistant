import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.invoice import Invoice, InvoiceLine


class InvoiceRepository(ABC):
    @abstractmethod
    async def get_by_id(self, invoice_id: UUID) -> Invoice | None: ...

    @abstractmethod
    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        from_date: datetime.date | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Invoice], int]: ...

    @abstractmethod
    async def create_with_lines(
        self, invoice: Invoice, lines: list[InvoiceLine]
    ) -> Invoice: ...

    @abstractmethod
    async def get_lines(self, invoice_id: UUID) -> list[InvoiceLine]: ...

    @abstractmethod
    async def update(self, invoice: Invoice) -> Invoice: ...

    @abstractmethod
    async def get_stats(
        self, cabinet_id: UUID, month: datetime.date
    ) -> dict: ...
