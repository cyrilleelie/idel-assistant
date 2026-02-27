"""Use case : rattachement d'une ordonnance à une facture."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.repositories.invoice_repository import InvoiceRepository
from app.domain.repositories.prescription_repository import PrescriptionRepository
from app.domain.rules.prescription_rules import can_bill_against_prescription
from app.infrastructure.persistence.models.invoice_model import InvoiceModel


class LinkPrescriptionToInvoiceUseCase:
    def __init__(
        self,
        prescription_repo: PrescriptionRepository,
        invoice_repo: InvoiceRepository,
        db_session: AsyncSession,
    ):
        self._prescription_repo = prescription_repo
        self._invoice_repo = invoice_repo
        self._session = db_session

    async def execute(
        self,
        invoice_id: UUID,
        prescription_id: UUID,
        cabinet_id: UUID,
    ):
        """
        Rattache une ordonnance à une facture.
        Retourne l'InvoiceDTO mis à jour.
        Lève ValueError si l'ordonnance n'est pas valide pour la date de soin.
        """
        # Charge la facture
        invoice = await self._invoice_repo.get_by_id(invoice_id, cabinet_id)
        if invoice is None:
            raise ValueError("Facture introuvable")

        # Charge l'ordonnance
        prescription = await self._prescription_repo.get_by_id(prescription_id, cabinet_id)
        if prescription is None:
            raise ValueError("Ordonnance introuvable")

        # Vérifie la validité
        ok, reason = can_bill_against_prescription(prescription, invoice.care_date)
        if not ok:
            raise ValueError(f"Ordonnance non valide pour cette facture : {reason}")

        # Met à jour la facture directement en BDD (évite de repasser par le domaine)
        result = await self._session.execute(
            select(InvoiceModel).where(
                InvoiceModel.id == invoice_id,
                InvoiceModel.cabinet_id == cabinet_id,
            )
        )
        inv_model = result.scalar_one_or_none()
        if inv_model:
            inv_model.prescription_id = prescription_id
            await self._session.flush()

        # Re-fetch via le repo pour avoir le DTO complet
        return await self._invoice_repo.get_by_id(invoice_id, cabinet_id)
