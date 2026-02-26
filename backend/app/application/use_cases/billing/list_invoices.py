import datetime
from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO, InvoiceListDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceRepository


class ListInvoicesUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        patient_id: UUID | None = None,
        date_from: datetime.date | None = None,
        date_to: datetime.date | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> InvoiceListDTO:
        items, total = await self._repo.list_invoices(
            cabinet_id=cabinet_id,
            status=status,
            patient_id=patient_id,
            date_from=date_from,
            date_to=date_to,
            offset=offset,
            limit=limit,
        )
        return InvoiceListDTO(
            items=[invoice_entity_to_dto(i) for i in items],
            total=total,
            offset=offset,
            limit=limit,
        )
