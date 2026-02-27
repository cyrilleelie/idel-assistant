"""Use case : genere les factures pour tous les RDV completes non factures du jour."""

import datetime
from uuid import UUID

from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.create_invoice_from_appointment import (
    CreateInvoiceFromAppointmentUseCase,
)
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository


class CreateAllDailyInvoicesUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        invoice_repo: InvoiceRepository,
        line_repo: InvoiceLineRepository,
        patient_repo: PatientRepository,
        catalog_repo: CareTypeCatalogRepository,
        db_session=None,
    ):
        self._appointment_repo = appointment_repo
        self._invoice_repo = invoice_repo
        self._line_repo = line_repo
        self._patient_repo = patient_repo
        self._catalog_repo = catalog_repo
        self._session = db_session

    async def execute(
        self,
        cabinet_id: UUID,
        date: datetime.date,
        zone_ik: str = "plaine",
    ) -> list[InvoiceDTO]:
        # 1. Liste les RDV completes du jour
        appointments, _ = await self._appointment_repo.list_by_date(
            cabinet_id=cabinet_id,
            date=date,
            status="completed",
            skip=0,
            limit=200,
        )

        # 2. Charge les factures du jour pour savoir lesquelles sont deja facturees
        invoices, _ = await self._invoice_repo.list_invoices(
            cabinet_id=cabinet_id,
            date_from=date,
            date_to=date,
            offset=0,
            limit=200,
        )

        already_billed = set()
        for inv in invoices:
            if inv.appointment_id and inv.status != "canceled":
                already_billed.add(inv.appointment_id)

        # 3. Facture chaque RDV non facture qui a des act_codes
        create_uc = CreateInvoiceFromAppointmentUseCase(
            self._appointment_repo,
            self._invoice_repo,
            self._line_repo,
            self._patient_repo,
            self._catalog_repo,
            self._session,
        )

        created_invoices: list[InvoiceDTO] = []
        for appt in appointments:
            if appt.id in already_billed:
                continue
            if not appt.act_codes:
                continue

            try:
                invoice_dto = await create_uc.execute(
                    cabinet_id=cabinet_id,
                    appointment_id=appt.id,
                    zone_ik=zone_ik,
                )
                created_invoices.append(invoice_dto)
            except ValueError:
                # Skip RDV qui ne peuvent pas etre factures (pas de codes, deja facture, etc.)
                continue

        return created_invoices
