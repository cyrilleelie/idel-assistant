"""Use case : corriger une facture rejetée et soumettre une nouvelle."""

import datetime
from decimal import Decimal
from uuid import UUID

from app.application.dtos.invoice_dto import CorrectAndResubmitDTO, InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.value_objects.invoice_number import generate_next_invoice_number


class CorrectAndResubmitUseCase:
    def __init__(self, repo: InvoiceRepository):
        self._repo = repo

    async def execute(
        self,
        invoice_id: UUID,
        cabinet_id: UUID,
        dto: CorrectAndResubmitDTO,
    ) -> InvoiceDTO:
        # Charge la facture rejetée
        original = await self._repo.get_by_id(invoice_id, cabinet_id)
        if original is None:
            raise ValueError(f"Facture {invoice_id} introuvable")
        if original.status != "rejected":
            raise ValueError(
                f"Seule une facture rejetée peut être corrigée "
                f"(statut actuel : '{original.status}')"
            )

        # Génère un nouveau numéro de facture
        today = datetime.date.today()
        seq = await self._repo.get_next_sequence(cabinet_id, today.year, today.month)
        new_invoice_number = generate_next_invoice_number(
            cabinet_id, today.year, today.month, seq
        )

        # Clone l'entité avec les nouvelles lignes et le lien vers l'originale
        new_invoice = Invoice(
            cabinet_id=original.cabinet_id,
            idel_id=original.idel_id,
            patient_id=original.patient_id,
            invoice_number=new_invoice_number,
            invoice_date=today,
            care_date=original.care_date,
            tiers_payant_type=original.tiers_payant_type,
            prescription_id=dto.prescription_id or original.prescription_id,
            appointment_id=original.appointment_id,
            metadata=original.metadata,
            status="draft",
            corrected_invoice_id=original.id,
        )

        # Construit les nouvelles lignes depuis le DTO
        for order, line_input in enumerate(dto.lines, start=1):
            line = InvoiceLine(
                invoice_id=new_invoice.id,
                line_order=order,
                act_code=line_input.act_code,
                act_label=line_input.act_label,
                coefficient=line_input.coefficient,
                base_rate=line_input.base_rate,
                quantity=line_input.quantity,
                supplements=line_input.supplements,
            )
            line.recalculate()
            new_invoice.lines.append(line)

        # Recalcule les totaux
        new_invoice.recalculate_totals()

        created = await self._repo.create(new_invoice)
        return invoice_entity_to_dto(created)
