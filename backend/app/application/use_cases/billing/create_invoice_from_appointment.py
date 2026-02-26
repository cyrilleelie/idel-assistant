"""Use case : creation d'une facture a partir d'un RDV complete."""

import datetime
from decimal import Decimal
from uuid import UUID

from app.application.dtos.cotation_dto import SimulateCotationDTO
from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.value_objects.invoice_number import generate_next_invoice_number


class CreateInvoiceFromAppointmentUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        invoice_repo: InvoiceRepository,
        line_repo: InvoiceLineRepository,
        patient_repo: PatientRepository,
        catalog_repo: CareTypeCatalogRepository,
    ):
        self._appointment_repo = appointment_repo
        self._invoice_repo = invoice_repo
        self._line_repo = line_repo
        self._patient_repo = patient_repo
        self._catalog_repo = catalog_repo

    async def execute(
        self,
        cabinet_id: UUID,
        appointment_id: UUID,
        zone_ik: str = "plaine",
    ) -> InvoiceDTO:
        # 1. Charge le RDV
        appt = await self._appointment_repo.get_by_id(appointment_id)
        if appt is None or appt.cabinet_id != cabinet_id:
            raise ValueError("Rendez-vous introuvable")

        if appt.status != "completed":
            raise ValueError("Seul un rendez-vous realise peut etre facture")

        if not appt.act_codes:
            raise ValueError("Le rendez-vous n'a pas de codes actes NGAP associes")

        # 2. Verifie qu'il n'y a pas deja une facture pour ce RDV
        existing_invoices, _ = await self._invoice_repo.list_invoices(
            cabinet_id=cabinet_id,
            date_from=appt.scheduled_at.date(),
            date_to=appt.scheduled_at.date(),
            offset=0,
            limit=200,
        )
        for inv in existing_invoices:
            if inv.appointment_id == appointment_id and inv.status != "canceled":
                raise ValueError("Une facture existe deja pour ce rendez-vous")

        # 3. Simule la cotation
        distance_km = appt.distance_km or Decimal("0")
        lieu = "cabinet" if appt.location_type == "office" else "domicile"

        cotation_dto = SimulateCotationDTO(
            patient_id=appt.patient_id,
            idel_id=appt.idel_id,
            actes=appt.act_codes,
            date_heure_soin=appt.scheduled_at.isoformat(),
            distance_km=distance_km,
            lieu=lieu,
            zone_ik=zone_ik,
            est_premier_soin_journee=True,
        )

        simulate_uc = SimulateCotationUseCase(self._patient_repo, self._catalog_repo)
        cotation = await simulate_uc.execute(cabinet_id, cotation_dto)

        # 4. Genere le numero de facture
        today = datetime.date.today()
        seq = await self._invoice_repo.get_next_sequence(cabinet_id, today.year, today.month)
        invoice_number = generate_next_invoice_number(cabinet_id, today.year, today.month, seq)

        # 5. Cree la facture
        invoice = Invoice(
            cabinet_id=cabinet_id,
            idel_id=appt.idel_id,
            patient_id=appt.patient_id,
            appointment_id=appointment_id,
            invoice_number=invoice_number,
            invoice_date=today,
            care_date=appt.scheduled_at.date(),
            total_amo=cotation.repartition_amo,
            total_amc=cotation.repartition_amc,
            total_patient=cotation.repartition_patient,
            total_amount=cotation.total,
            tiers_payant_type="total",
            status="draft",
            metadata={
                "auto_cotation": True,
                "from_appointment": str(appointment_id),
                "auto_corrections": cotation.auto_corrections,
                "explications": cotation.explications,
            },
        )

        created = await self._invoice_repo.create(invoice)

        # 6. Cree les lignes de facture
        from uuid import uuid4
        for i, ligne in enumerate(cotation.lignes):
            invoice_line = InvoiceLine(
                id=uuid4(),
                invoice_id=created.id,
                line_order=i + 1,
                act_code=ligne.code,
                act_label=ligne.label,
                coefficient=ligne.coefficient or Decimal("1"),
                base_rate=ligne.base_rate or Decimal("0.00"),
                quantity=ligne.quantity,
                line_subtotal=ligne.montant,
                supplements=None,
                supplements_total=Decimal("0.00"),
                line_total=ligne.montant,
            )
            await self._line_repo.create(invoice_line)

        # 7. Re-fetch avec les lignes
        final = await self._invoice_repo.get_by_id(created.id, cabinet_id)
        if final is None:
            raise ValueError("Facture introuvable apres creation")
        return invoice_entity_to_dto(final)
