"""Implémentation SQLAlchemy du PrescriptionRepository."""

import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.prescription import Prescription
from app.domain.repositories.prescription_repository import PrescriptionRepository
from app.infrastructure.persistence.models.invoice_model import InvoiceModel
from app.infrastructure.persistence.models.prescription_model import PrescriptionModel


class SQLAlchemyPrescriptionRepo(PrescriptionRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: PrescriptionModel) -> Prescription:
        return Prescription(
            id=model.id,
            cabinet_id=model.cabinet_id,
            patient_id=model.patient_id,
            care_protocol_id=model.care_protocol_id,
            label=model.label or "",
            care_label_code=model.care_label_code,
            duration_minutes=model.duration_minutes or 30,
            frequency_display=model.frequency_display or "daily",
            custom_frequency=model.custom_frequency or "",
            preferred_time=model.preferred_time,
            preferred_slot=model.preferred_slot or "",
            recurrence_rule=model.recurrence_rule or "",
            prescriber_name=model.prescriber_name,
            prescriber_rpps=model.prescriber_rpps,
            prescription_date=model.prescription_date,
            start_date=model.start_date,
            end_date=model.end_date,
            duration_days=model.duration_days,
            care_description=model.care_description,
            act_codes=list(model.act_codes) if model.act_codes else [],
            frequency=model.frequency,
            max_renewals=model.max_renewals,
            current_renewal=model.current_renewal,
            parent_prescription_id=model.parent_prescription_id,
            status=model.status,
            document_url=model.document_url,
            document_filename=model.document_filename,
            document_type=model.document_type,
            notes=model.notes,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, prescription_id: UUID, cabinet_id: UUID) -> Prescription | None:
        result = await self._session.execute(
            select(PrescriptionModel).where(
                PrescriptionModel.id == prescription_id,
                PrescriptionModel.cabinet_id == cabinet_id,
            )
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_patient(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Prescription], int]:
        query = select(PrescriptionModel).where(
            PrescriptionModel.patient_id == patient_id,
            PrescriptionModel.cabinet_id == cabinet_id,
        )
        if status:
            query = query.where(PrescriptionModel.status == status)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.offset(offset).limit(limit).order_by(
            PrescriptionModel.created_at.desc()
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()], total

    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[Prescription], int]:
        query = select(PrescriptionModel).where(
            PrescriptionModel.cabinet_id == cabinet_id,
        )
        if status:
            query = query.where(PrescriptionModel.status == status)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.offset(offset).limit(limit).order_by(
            PrescriptionModel.created_at.desc()
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()], total

    async def list_by_care_protocol(
        self,
        care_protocol_id: UUID,
        status: str | None = None,
    ) -> list[Prescription]:
        """Retourne toutes les ordonnances liées à un plan de soins."""
        query = select(PrescriptionModel).where(
            PrescriptionModel.care_protocol_id == care_protocol_id,
        )
        if status:
            query = query.where(PrescriptionModel.status == status)
        query = query.order_by(PrescriptionModel.created_at)
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def get_expiring(
        self,
        cabinet_id: UUID,
        days_ahead: int = 7,
        reference_date: datetime.date | None = None,
    ) -> list[Prescription]:
        today = reference_date or datetime.date.today()
        deadline = today + datetime.timedelta(days=days_ahead)

        result = await self._session.execute(
            select(PrescriptionModel).where(
                PrescriptionModel.cabinet_id == cabinet_id,
                PrescriptionModel.status.in_(["active", "expiring"]),
                PrescriptionModel.end_date.is_not(None),
                PrescriptionModel.end_date >= today,
                PrescriptionModel.end_date <= deadline,
            ).order_by(PrescriptionModel.end_date)
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def get_active_by_patient(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
    ) -> list[Prescription]:
        result = await self._session.execute(
            select(PrescriptionModel).where(
                PrescriptionModel.patient_id == patient_id,
                PrescriptionModel.cabinet_id == cabinet_id,
                PrescriptionModel.status.in_(["active", "expiring"]),
            ).order_by(PrescriptionModel.created_at.desc())
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def list_by_invoice(self, prescription_id: UUID, cabinet_id: UUID) -> list:
        """Retourne les InvoiceModel liées à cette prescription."""
        result = await self._session.execute(
            select(InvoiceModel).where(
                InvoiceModel.prescription_id == prescription_id,
                InvoiceModel.cabinet_id == cabinet_id,
                InvoiceModel.status != "canceled",
            ).order_by(InvoiceModel.care_date.desc())
        )
        return result.scalars().all()

    async def create(self, prescription: Prescription) -> Prescription:
        model = PrescriptionModel(
            id=prescription.id,
            cabinet_id=prescription.cabinet_id,
            patient_id=prescription.patient_id,
            care_protocol_id=prescription.care_protocol_id,
            label=prescription.label or None,
            care_label_code=prescription.care_label_code,
            duration_minutes=prescription.duration_minutes,
            frequency_display=prescription.frequency_display,
            custom_frequency=prescription.custom_frequency or None,
            preferred_time=prescription.preferred_time,
            preferred_slot=prescription.preferred_slot or None,
            recurrence_rule=prescription.recurrence_rule or None,
            prescriber_name=prescription.prescriber_name,
            prescriber_rpps=prescription.prescriber_rpps,
            prescription_date=prescription.prescription_date,
            start_date=prescription.start_date,
            end_date=prescription.end_date,
            duration_days=prescription.duration_days,
            care_description=prescription.care_description,
            act_codes=prescription.act_codes or None,
            frequency=prescription.frequency,
            max_renewals=prescription.max_renewals,
            current_renewal=prescription.current_renewal,
            parent_prescription_id=prescription.parent_prescription_id,
            status=prescription.status,
            document_url=prescription.document_url,
            document_filename=prescription.document_filename,
            document_type=prescription.document_type,
            notes=prescription.notes,
        )
        self._session.add(model)
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def update(self, prescription: Prescription) -> Prescription:
        result = await self._session.execute(
            select(PrescriptionModel).where(PrescriptionModel.id == prescription.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Prescription {prescription.id} introuvable")

        model.care_protocol_id = prescription.care_protocol_id
        model.label = prescription.label or None
        model.care_label_code = prescription.care_label_code
        model.duration_minutes = prescription.duration_minutes
        model.frequency_display = prescription.frequency_display
        model.custom_frequency = prescription.custom_frequency or None
        model.preferred_time = prescription.preferred_time
        model.preferred_slot = prescription.preferred_slot or None
        model.recurrence_rule = prescription.recurrence_rule or None
        model.prescriber_name = prescription.prescriber_name
        model.prescriber_rpps = prescription.prescriber_rpps
        model.prescription_date = prescription.prescription_date
        model.start_date = prescription.start_date
        model.end_date = prescription.end_date
        model.duration_days = prescription.duration_days
        model.care_description = prescription.care_description
        model.act_codes = prescription.act_codes or None
        model.frequency = prescription.frequency
        model.max_renewals = prescription.max_renewals
        model.current_renewal = prescription.current_renewal
        model.parent_prescription_id = prescription.parent_prescription_id
        model.status = prescription.status
        model.document_url = prescription.document_url
        model.document_filename = prescription.document_filename
        model.document_type = prescription.document_type
        model.notes = prescription.notes

        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)
