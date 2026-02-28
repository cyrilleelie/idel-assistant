"""Use case : rejeter une facture."""

from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO, RejectInvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceRepository


class RejectInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(
        self, invoice_id: UUID, cabinet_id: UUID, dto: RejectInvoiceDTO
    ) -> InvoiceDTO:
        invoice = await self._repo.get_by_id(invoice_id, cabinet_id)
        if invoice is None:
            raise ValueError(f"Facture {invoice_id} introuvable")

        invoice.reject(reason=dto.rejection_reason, code=dto.rejection_code)
        updated = await self._repo.update(invoice)
        return invoice_entity_to_dto(updated)
