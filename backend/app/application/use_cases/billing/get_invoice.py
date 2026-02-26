from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceRepository


class GetInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(self, invoice_id: UUID, cabinet_id: UUID) -> InvoiceDTO | None:
        entity = await self._repo.get_by_id(invoice_id, cabinet_id)
        if entity is None:
            return None
        return invoice_entity_to_dto(entity)
