from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository


class RemoveInvoiceLineUseCase:
    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        line_repo: InvoiceLineRepository,
    ):
        self._invoice_repo = invoice_repo
        self._line_repo = line_repo

    async def execute(
        self,
        invoice_id: UUID,
        line_id: UUID,
        cabinet_id: UUID,
    ) -> InvoiceDTO:
        invoice = await self._invoice_repo.get_by_id(invoice_id, cabinet_id)
        if invoice is None:
            raise ValueError("Facture introuvable")

        if not invoice.is_modifiable:
            raise PermissionError("Impossible de supprimer une ligne d'une facture qui n'est pas en brouillon")

        line = await self._line_repo.get_by_id(line_id)
        if line is None or line.invoice_id != invoice_id:
            raise ValueError("Ligne introuvable")

        await self._line_repo.delete(line_id)

        # Recalcule le total de la facture
        invoice = await self._invoice_repo.get_by_id(invoice_id, cabinet_id)
        assert invoice is not None
        invoice.recalculate_totals()
        updated = await self._invoice_repo.update(invoice)

        return invoice_entity_to_dto(updated)
