from uuid import UUID

from app.application.dtos.invoice_dto import AddInvoiceLineDTO, InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository
from app.domain.rules.invoice_rules import snapshot_line_from_catalog


class AddInvoiceLineUseCase:
    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        line_repo: InvoiceLineRepository,
        catalog_repo: CareTypeCatalogRepository,
    ):
        self._invoice_repo = invoice_repo
        self._line_repo = line_repo
        self._catalog_repo = catalog_repo

    async def execute(
        self,
        invoice_id: UUID,
        cabinet_id: UUID,
        dto: AddInvoiceLineDTO,
    ) -> InvoiceDTO:
        invoice = await self._invoice_repo.get_by_id(invoice_id, cabinet_id)
        if invoice is None:
            raise ValueError("Facture introuvable")

        if not invoice.is_modifiable:
            raise PermissionError("Impossible d'ajouter une ligne a une facture qui n'est pas en brouillon")

        # Resoud l'acte depuis le catalogue, filtre par date du soin
        catalog_entry = await self._catalog_repo.get_by_code(
            code=dto.act_code,
            cabinet_id=cabinet_id,
            at_date=invoice.care_date,
        )
        if catalog_entry is None:
            raise ValueError(f"Acte '{dto.act_code}' introuvable dans le catalogue")

        # Determine line_order
        max_order = max((l.line_order for l in invoice.lines), default=0)

        # Cree la ligne avec tarifs snapshotes
        line = snapshot_line_from_catalog(
            catalog_entry=catalog_entry,
            invoice_id=invoice.id,
            quantity=dto.quantity,
            supplements=dto.supplements,
            appointment_id=dto.appointment_id,
            line_order=max_order + 1,
        )

        await self._line_repo.create(line)

        # Recalcule le total de la facture
        invoice = await self._invoice_repo.get_by_id(invoice_id, cabinet_id)
        assert invoice is not None
        invoice.recalculate_totals()
        updated = await self._invoice_repo.update(invoice)

        return invoice_entity_to_dto(updated)
