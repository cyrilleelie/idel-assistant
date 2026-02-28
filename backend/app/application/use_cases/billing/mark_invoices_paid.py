"""Use case : marquer un lot de factures comme payées."""

from uuid import UUID

from app.application.dtos.invoice_dto import MarkPaidDTO, MarkPaidResultDTO
from app.domain.repositories.invoice_repository import InvoiceRepository


class MarkInvoicesPaidUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(
        self, cabinet_id: UUID, dto: MarkPaidDTO
    ) -> MarkPaidResultDTO:
        marked = 0
        errors: list[str] = []

        for invoice_id in dto.invoice_ids:
            invoice = await self._repo.get_by_id(invoice_id, cabinet_id)
            if invoice is None:
                errors.append(f"Facture {invoice_id} introuvable")
                continue
            try:
                invoice.mark_paid(
                    payment_date=dto.payment_date,
                    reference=dto.payment_reference,
                    amount=dto.payment_amount,
                )
                await self._repo.update(invoice)
                marked += 1
            except ValueError as e:
                errors.append(f"Facture {invoice.invoice_number or invoice_id} : {e}")

        return MarkPaidResultDTO(marked_paid=marked, errors=errors)
