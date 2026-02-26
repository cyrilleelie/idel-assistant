"""Use case : liste les RDV du jour avec statut de facturation."""

import datetime
from uuid import UUID

from app.application.dtos.cotation_dto import DailyBillingItemDTO, DailyBillingResponseDTO
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository


class GetDailyBillingUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        invoice_repo: InvoiceRepository,
        patient_repo: PatientRepository,
    ):
        self._appointment_repo = appointment_repo
        self._invoice_repo = invoice_repo
        self._patient_repo = patient_repo

    async def execute(
        self,
        cabinet_id: UUID,
        date: datetime.date,
        idel_id: UUID | None = None,
    ) -> DailyBillingResponseDTO:
        # 1. Liste les RDV du jour
        appointments, _ = await self._appointment_repo.list_by_date(
            cabinet_id=cabinet_id,
            idel_id=idel_id,
            date=date,
            skip=0,
            limit=200,
        )

        # 2. Charge les factures du jour pour trouver celles liees a un RDV
        invoices, _ = await self._invoice_repo.list_invoices(
            cabinet_id=cabinet_id,
            date_from=date,
            date_to=date,
            offset=0,
            limit=200,
        )

        # Index factures par appointment_id
        invoice_by_appt: dict[UUID, tuple] = {}
        for inv in invoices:
            if inv.appointment_id:
                invoice_by_appt[inv.appointment_id] = (inv.id, inv.status)

        # 3. Construit les items
        items: list[DailyBillingItemDTO] = []
        total_facture = 0
        total_non_facture = 0

        for appt in appointments:
            if appt.status in ("canceled", "no_show"):
                continue

            # Nom du patient
            patient = await self._patient_repo.get_by_id(appt.patient_id)
            patient_name = ""
            if patient:
                patient_name = f"{patient.first_name} {patient.last_name}"

            inv_data = invoice_by_appt.get(appt.id)
            invoice_id = inv_data[0] if inv_data else None
            invoice_status = inv_data[1] if inv_data else None

            if invoice_id:
                total_facture += 1
            else:
                total_non_facture += 1

            items.append(DailyBillingItemDTO(
                appointment_id=appt.id,
                patient_id=appt.patient_id,
                patient_name=patient_name,
                idel_id=appt.idel_id,
                scheduled_at=appt.scheduled_at,
                care_type=appt.care_type,
                act_codes=appt.act_codes,
                status=appt.status,
                invoice_id=invoice_id,
                invoice_status=invoice_status,
            ))

        return DailyBillingResponseDTO(
            date=date,
            items=items,
            total_facture=total_facture,
            total_non_facture=total_non_facture,
        )
