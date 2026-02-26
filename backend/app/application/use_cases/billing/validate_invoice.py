from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO, InvoiceValidationErrorDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.rules.invoice_rules import validate_invoice_for_validation


class ValidateInvoiceUseCase:
    def __init__(self, repo: InvoiceRepository, patient_repo: PatientRepository):
        self._repo = repo
        self._patient_repo = patient_repo

    async def execute(
        self,
        invoice_id: UUID,
        cabinet_id: UUID,
    ) -> InvoiceDTO | InvoiceValidationErrorDTO:
        entity = await self._repo.get_by_id(invoice_id, cabinet_id)
        if entity is None:
            raise ValueError("Facture introuvable")

        errors = validate_invoice_for_validation(entity)
        if errors:
            return InvoiceValidationErrorDTO(errors=errors)

        # Recupere le patient pour calculer la repartition AMO/AMC
        patient = await self._patient_repo.get_by_id(entity.patient_id)
        is_ald = patient.is_ald if patient else False
        is_maternity = patient.is_maternity if patient else False

        # Recalcule les totaux des lignes puis le total facture
        for line in entity.lines:
            line.recalculate()

        entity.recalculate_totals(is_ald=is_ald, is_maternity=is_maternity)
        entity.validate()

        updated = await self._repo.update(entity)
        return invoice_entity_to_dto(updated)
