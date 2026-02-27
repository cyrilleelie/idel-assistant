"""Use case : liste des ordonnances expirant bientôt."""

import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.prescription_dto import ExpiringPrescriptionDTO, PrescriptionDTO
from app.application.use_cases.prescription.create_prescription import _entity_to_dto
from app.domain.repositories.prescription_repository import PrescriptionRepository
from app.domain.rules.prescription_rules import days_remaining
from app.infrastructure.persistence.models.care_protocol_model import CareProtocolModel
from app.infrastructure.persistence.models.invoice_model import InvoiceModel
from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.security.key_manager import KeyManager
from app.infrastructure.security.encryption import decrypt


class GetExpiringPrescriptionsUseCase:
    def __init__(
        self,
        prescription_repo: PrescriptionRepository,
        db_session: AsyncSession,
        key_manager: KeyManager,
    ):
        self._repo = prescription_repo
        self._session = db_session
        self._km = key_manager

    async def execute(
        self,
        cabinet_id: UUID,
        days_ahead: int = 7,
    ) -> list[ExpiringPrescriptionDTO]:
        prescriptions = await self._repo.get_expiring(cabinet_id, days_ahead)
        results = []

        for p in prescriptions:
            # Nom du patient (déchiffrement)
            patient_name = await self._get_patient_name(p.patient_id, p.cabinet_id)

            # Nombre de factures
            invoices_count = await self._count_invoices(p.id, cabinet_id)

            # Plan de soins lié
            protocol_id = await self._get_care_protocol_id(p.id, cabinet_id)

            dr = days_remaining(p)
            dto = _entity_to_dto(
                p,
                days_remaining=dr,
                invoices_count=invoices_count,
                care_protocol_id=protocol_id,
                patient_name=patient_name,
            )

            results.append(ExpiringPrescriptionDTO(
                prescription=dto,
                patient_name=patient_name,
                days_remaining=dr,
                invoices_count=invoices_count,
                care_protocol_id=protocol_id,
            ))

        return sorted(results, key=lambda r: r.prescription.end_date or datetime.date.max)

    async def _get_patient_name(self, patient_id, cabinet_id) -> str:
        from app.infrastructure.persistence.models.patient_model import PatientModel
        result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == patient_id)
        )
        patient = result.scalar_one_or_none()
        if not patient:
            return ""
        try:
            key = self._km.get_cabinet_key(cabinet_id)
            first = decrypt(patient.first_name_encrypted, key) if patient.first_name_encrypted else ""
            last = decrypt(patient.last_name_encrypted, key) if patient.last_name_encrypted else ""
            return f"{first} {last}".strip()
        except Exception:
            return ""

    async def _count_invoices(self, prescription_id, cabinet_id) -> int:
        result = await self._session.execute(
            select(InvoiceModel).where(
                InvoiceModel.prescription_id == prescription_id,
                InvoiceModel.cabinet_id == cabinet_id,
                InvoiceModel.status != "canceled",
            )
        )
        return len(result.scalars().all())

    async def _get_care_protocol_id(self, prescription_id, cabinet_id):
        result = await self._session.execute(
            select(CareProtocolModel).where(
                CareProtocolModel.prescription_id == prescription_id,
                CareProtocolModel.cabinet_id == cabinet_id,
            )
        )
        protocol = result.scalar_one_or_none()
        return protocol.id if protocol else None
