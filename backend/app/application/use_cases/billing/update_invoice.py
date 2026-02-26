from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO, UpdateInvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceRepository


class UpdateInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(
        self,
        invoice_id: UUID,
        cabinet_id: UUID,
        dto: UpdateInvoiceDTO,
    ) -> InvoiceDTO:
        entity = await self._repo.get_by_id(invoice_id, cabinet_id)
        if entity is None:
            raise ValueError("Facture introuvable")

        if not entity.is_modifiable:
            raise PermissionError("Impossible de modifier une facture qui n'est pas en brouillon")

        if dto.care_date is not None:
            entity.care_date = dto.care_date
        if dto.tiers_payant_type is not None:
            entity.tiers_payant_type = dto.tiers_payant_type
        if dto.metadata is not None:
            entity.metadata = dto.metadata

        updated = await self._repo.update(entity)
        return invoice_entity_to_dto(updated)
