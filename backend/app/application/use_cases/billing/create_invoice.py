import datetime
from uuid import UUID

from app.application.dtos.invoice_dto import CreateInvoiceDTO, InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.entities.invoice import Invoice
from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.value_objects.invoice_number import generate_next_invoice_number


class CreateInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(
        self,
        cabinet_id: UUID,
        dto: CreateInvoiceDTO,
    ) -> InvoiceDTO:
        today = datetime.date.today()
        year = today.year
        month = today.month

        seq = await self._repo.get_next_sequence(cabinet_id, year, month)
        invoice_number = generate_next_invoice_number(cabinet_id, year, month, seq)

        entity = Invoice(
            cabinet_id=cabinet_id,
            idel_id=dto.idel_id,
            patient_id=dto.patient_id,
            invoice_number=invoice_number,
            invoice_date=today,
            care_date=dto.care_date,
            tiers_payant_type=dto.tiers_payant_type,
            metadata=dto.metadata,
            status="draft",
        )

        created = await self._repo.create(entity)
        return invoice_entity_to_dto(created)
