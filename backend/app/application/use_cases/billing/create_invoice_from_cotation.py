"""Use case : creation d'une facture a partir d'une cotation automatique."""

import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from app.application.dtos.cotation_dto import SimulateCotationDTO
from app.application.dtos.invoice_dto import InvoiceDTO
from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.domain.repositories.invoice_repository import InvoiceLineRepository, InvoiceRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.value_objects.invoice_number import generate_next_invoice_number


class CreateInvoiceFromCotationUseCase:
    def __init__(
        self,
        invoice_repo: InvoiceRepository,
        line_repo: InvoiceLineRepository,
        patient_repo: PatientRepository,
        catalog_repo: CareTypeCatalogRepository,
    ):
        self._invoice_repo = invoice_repo
        self._line_repo = line_repo
        self._patient_repo = patient_repo
        self._catalog_repo = catalog_repo

    async def execute(
        self,
        cabinet_id: UUID,
        dto: SimulateCotationDTO,
    ) -> InvoiceDTO:
        # 1. Simule la cotation
        simulate_uc = SimulateCotationUseCase(self._patient_repo, self._catalog_repo)
        cotation = await simulate_uc.execute(cabinet_id, dto)

        # 2. Recupere le patient pour ALD/maternite
        patient = await self._patient_repo.get_by_id(dto.patient_id)
        if patient is None:
            raise ValueError("Patient introuvable")

        # 3. Genere le numero de facture
        date_heure = datetime.datetime.fromisoformat(dto.date_heure_soin)
        care_date = date_heure.date()
        today = datetime.date.today()

        seq = await self._invoice_repo.get_next_sequence(
            cabinet_id, today.year, today.month
        )
        invoice_number = generate_next_invoice_number(
            cabinet_id, today.year, today.month, seq
        )

        # 4. Cree l'entite facture
        invoice = Invoice(
            cabinet_id=cabinet_id,
            idel_id=dto.idel_id,
            patient_id=dto.patient_id,
            invoice_number=invoice_number,
            invoice_date=today,
            care_date=care_date,
            total_amo=cotation.repartition_amo,
            total_amc=cotation.repartition_amc,
            total_patient=cotation.repartition_patient,
            total_amount=cotation.total,
            tiers_payant_type="total",
            status="draft",
            metadata={
                "auto_cotation": True,
                "auto_corrections": cotation.auto_corrections,
                "explications": cotation.explications,
            },
        )

        # 5. Persiste la facture
        created = await self._invoice_repo.create(invoice)

        # 6. Cree les lignes de facture a partir de la cotation
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
