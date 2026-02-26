from uuid import UUID

from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.rules.invoice_rules import can_delete_invoice


class DeleteInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(self, invoice_id: UUID, cabinet_id: UUID) -> None:
        entity = await self._repo.get_by_id(invoice_id, cabinet_id)
        if entity is None:
            raise ValueError("Facture introuvable")

        if not can_delete_invoice(entity):
            raise PermissionError("Seule une facture en brouillon peut etre supprimee")

        await self._repo.delete(invoice_id, cabinet_id)
