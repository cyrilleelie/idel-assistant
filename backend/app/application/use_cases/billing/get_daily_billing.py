"""Use case : liste les RDV du jour avec statut de facturation."""

import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.cotation_dto import DailyBillingItemDTO, DailyBillingResponseDTO
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.rules.prescription_rules import compute_prescription_status


class GetDailyBillingUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        invoice_repo: InvoiceRepository,
        patient_repo: PatientRepository,
        db_session: AsyncSession | None = None,
    ):
        self._appointment_repo = appointment_repo
        self._invoice_repo = invoice_repo
        self._patient_repo = patient_repo
        self._session = db_session

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

        # 2. Charge les factures du jour pour trouver celles liées à un RDV
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

        # 3. Charge les ordonnances via care_protocol_id si une session DB est disponible
        # Nouvelle logique : Prescription.care_protocol_id (au lieu de CareProtocol.prescription_id)
        prescriptions_by_protocol: dict = {}
        if self._session:
            prescriptions_by_protocol = await self._load_prescriptions_for_protocols(
                cabinet_id, date
            )

        # 4. Construit les items
        items: list[DailyBillingItemDTO] = []
        total_facture = 0
        total_non_facture = 0

        for appt in appointments:
            if appt.status in ("canceled", "no_show"):
                continue

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

            # Infos ordonnance : prend la première ordonnance active du plan
            prescription_id = None
            prescription_status = None
            prescription_missing = False
            prescription_warning = None

            if appt.care_protocol_id and self._session:
                prescriptions = prescriptions_by_protocol.get(appt.care_protocol_id, [])
                if not prescriptions:
                    prescription_missing = True
                    prescription_warning = "Pas d'ordonnance rattachée"
                else:
                    # Prend la première ordonnance valide pour la date
                    for prescription in prescriptions:
                        effective_status = compute_prescription_status(prescription, date)
                        if effective_status not in ("expired", "canceled", "completed"):
                            prescription_id = prescription.id
                            prescription_status = effective_status
                            if effective_status == "expiring" and prescription.end_date:
                                days_left = (prescription.end_date - date).days
                                prescription_warning = f"Ordonnance expire dans {days_left} jour(s)"
                            elif effective_status == "expired":
                                prescription_warning = "Ordonnance expirée — renouvellement nécessaire"
                            break
                    if prescription_id is None:
                        prescription_warning = "Ordonnance expirée — renouvellement nécessaire"

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
                prescription_id=prescription_id,
                prescription_status=prescription_status,
                prescription_missing=prescription_missing,
                prescription_warning=prescription_warning,
            ))

        return DailyBillingResponseDTO(
            date=date,
            items=items,
            total_facture=total_facture,
            total_non_facture=total_non_facture,
        )

    async def _load_prescriptions_for_protocols(
        self, cabinet_id: UUID, date: datetime.date
    ) -> dict:
        """
        Retourne un dict care_protocol_id -> list[Prescription]
        pour tous les plans de soins du cabinet.
        Vide = plan de soins sans ordonnance rattachée.
        """
        from app.infrastructure.persistence.models.prescription_model import PrescriptionModel
        from app.domain.entities.prescription import Prescription

        result = await self._session.execute(
            select(PrescriptionModel)
            .where(
                PrescriptionModel.cabinet_id == cabinet_id,
                PrescriptionModel.care_protocol_id.is_not(None),
            )
            .order_by(PrescriptionModel.care_protocol_id, PrescriptionModel.created_at)
        )

        mapping: dict = {}
        for presc_model in result.scalars().all():
            protocol_id = presc_model.care_protocol_id
            entity = Prescription(
                id=presc_model.id,
                cabinet_id=presc_model.cabinet_id,
                patient_id=presc_model.patient_id,
                prescriber_name=presc_model.prescriber_name,
                prescription_date=presc_model.prescription_date,
                start_date=presc_model.start_date,
                end_date=presc_model.end_date,
                care_description=presc_model.care_description,
                status=presc_model.status,
            )
            if protocol_id not in mapping:
                mapping[protocol_id] = []
            mapping[protocol_id].append(entity)

        return mapping
