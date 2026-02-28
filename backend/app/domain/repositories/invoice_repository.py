import datetime
from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.invoice import Invoice, InvoiceLine


class InvoiceRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: UUID, cabinet_id: UUID) -> Invoice | None: ...

    @abstractmethod
    async def list_invoices(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        patient_id: UUID | None = None,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> tuple[list[Invoice], int]: ...

    @abstractmethod
    async def create(self, entity: Invoice) -> Invoice: ...

    @abstractmethod
    async def update(self, entity: Invoice) -> Invoice: ...

    @abstractmethod
    async def delete(self, id: UUID, cabinet_id: UUID) -> bool: ...

    @abstractmethod
    async def get_next_sequence(self, cabinet_id: UUID, year: int, month: int) -> int: ...

    @abstractmethod
    async def list_unpaid(
        self,
        cabinet_id: UUID,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Invoice], int]: ...

    @abstractmethod
    async def list_rejected(
        self,
        cabinet_id: UUID,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
    ) -> list[tuple[Invoice, UUID | None]]: ...


class InvoiceLineRepository(ABC):
    @abstractmethod
    async def get_by_id(self, id: UUID) -> InvoiceLine | None: ...

    @abstractmethod
    async def list_by_invoice(self, invoice_id: UUID) -> list[InvoiceLine]: ...

    @abstractmethod
    async def create(self, entity: InvoiceLine) -> InvoiceLine: ...

    @abstractmethod
    async def update(self, entity: InvoiceLine) -> InvoiceLine: ...

    @abstractmethod
    async def delete(self, id: UUID) -> bool: ...
