from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.rules.invoice_rules import can_cancel_invoice


class CancelInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(self, invoice_id: UUID, cabinet_id: UUID) -> InvoiceDTO:
        entity = await self._repo.get_by_id(invoice_id, cabinet_id)
        if entity is None:
            raise ValueError("Facture introuvable")

        if not can_cancel_invoice(entity):
            raise PermissionError(
                f"Impossible d'annuler une facture en statut '{entity.status}'"
            )

        entity.cancel()
        updated = await self._repo.update(entity)
        return invoice_entity_to_dto(updated)
