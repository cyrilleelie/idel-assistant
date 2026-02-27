"""Use case : création d'une ordonnance."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.prescription_dto import CreatePrescriptionDTO, PrescriptionDTO
from app.domain.entities.prescription import Prescription
from app.domain.repositories.prescription_repository import PrescriptionRepository
from app.domain.rules.prescription_rules import compute_end_date, days_remaining


def _entity_to_dto(p: Prescription, **kwargs) -> PrescriptionDTO:
    return PrescriptionDTO(
        id=p.id,
        cabinet_id=p.cabinet_id,
        patient_id=p.patient_id,
        care_protocol_id=p.care_protocol_id,
        label=p.label,
        care_label_code=p.care_label_code,
        duration_minutes=p.duration_minutes,
        frequency_display=p.frequency_display,
        custom_frequency=p.custom_frequency,
        preferred_time=p.preferred_time,
        preferred_slot=p.preferred_slot,
        recurrence_rule=p.recurrence_rule,
        prescriber_name=p.prescriber_name,
        prescriber_rpps=p.prescriber_rpps,
        prescription_date=p.prescription_date,
        start_date=p.start_date,
        end_date=p.end_date,
        duration_days=p.duration_days,
        care_description=p.care_description,
        act_codes=p.act_codes,
        frequency=p.frequency,
        max_renewals=p.max_renewals,
        current_renewal=p.current_renewal,
        parent_prescription_id=p.parent_prescription_id,
        status=p.status,
        document_url=p.document_url,
        document_filename=p.document_filename,
        document_type=p.document_type,
        notes=p.notes,
        created_at=p.created_at,
        updated_at=p.updated_at,
        days_remaining=days_remaining(p),
        **kwargs,
    )


class CreatePrescriptionUseCase:
    def __init__(
        self,
        prescription_repo: PrescriptionRepository,
        db_session: AsyncSession,
    ):
        self._repo = prescription_repo
        self._session = db_session

    async def execute(self, dto: CreatePrescriptionDTO) -> PrescriptionDTO:
        end_date = compute_end_date(dto.start_date, dto.duration_days, dto.end_date)

        prescription = Prescription(
            cabinet_id=dto.cabinet_id,
            patient_id=dto.patient_id,
            care_protocol_id=dto.care_protocol_id,
            label=dto.label,
            care_label_code=dto.care_label_code,
            duration_minutes=dto.duration_minutes,
            frequency_display=dto.frequency_display,
            custom_frequency=dto.custom_frequency,
            preferred_time=dto.preferred_time,
            preferred_slot=dto.preferred_slot,
            recurrence_rule=dto.recurrence_rule,
            prescriber_name=dto.prescriber_name.strip() if dto.prescriber_name else None,
            prescriber_rpps=dto.prescriber_rpps,
            prescription_date=dto.prescription_date,
            start_date=dto.start_date,
            end_date=end_date,
            duration_days=dto.duration_days,
            care_description=dto.care_description.strip() if dto.care_description else None,
            act_codes=dto.act_codes or [],
            frequency=dto.frequency,
            max_renewals=dto.max_renewals,
            current_renewal=0,
            status="active",
            document_url=dto.document_url,
            document_type=dto.document_type,
            notes=dto.notes,
        )

        created = await self._repo.create(prescription)
        return _entity_to_dto(created)
