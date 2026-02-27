"""Use case : renouvellement d'une ordonnance."""

import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.prescription_dto import PrescriptionDTO, RenewPrescriptionDTO
from app.application.use_cases.prescription.create_prescription import _entity_to_dto
from app.domain.entities.prescription import Prescription
from app.domain.repositories.prescription_repository import PrescriptionRepository
from app.domain.rules.prescription_rules import compute_end_date
from app.infrastructure.persistence.models.care_protocol_model import CareProtocolModel


class RenewPrescriptionUseCase:
    def __init__(
        self,
        prescription_repo: PrescriptionRepository,
        db_session: AsyncSession,
    ):
        self._repo = prescription_repo
        self._session = db_session

    async def execute(
        self,
        prescription_id,
        cabinet_id,
        dto: RenewPrescriptionDTO,
    ) -> PrescriptionDTO:
        # Charge l'ordonnance source
        source = await self._repo.get_by_id(prescription_id, cabinet_id)
        if source is None:
            raise ValueError("Ordonnance introuvable")

        # Vérifie le statut (on peut renouveler une ordonnance active, expiring ou expired)
        if source.status == "canceled":
            raise ValueError("Impossible de renouveler une ordonnance annulée")
        if source.status == "completed":
            raise ValueError("Cette ordonnance a déjà été renouvelée (complétée)")

        # Vérifie le quota de renouvellements
        if source.max_renewals > 0 and source.current_renewal >= source.max_renewals:
            raise ValueError(
                f"Quota de renouvellements atteint ({source.max_renewals} autorisé(s))"
            )

        # Calcule la date de début du renouvellement
        if dto.new_start_date:
            new_start = dto.new_start_date
        elif source.end_date:
            new_start = source.end_date + datetime.timedelta(days=1)
        else:
            new_start = datetime.date.today()

        # Durée du renouvellement : priorité au DTO, sinon copie source
        new_duration = dto.new_duration_days or source.duration_days
        new_end = compute_end_date(new_start, new_duration, dto.new_end_date)

        # Passe l'ancienne ordonnance en "completed"
        source.status = "completed"
        await self._repo.update(source)

        # Crée la nouvelle ordonnance
        renewal = Prescription(
            cabinet_id=source.cabinet_id,
            patient_id=source.patient_id,
            prescriber_name=source.prescriber_name,
            prescriber_rpps=source.prescriber_rpps,
            prescription_date=datetime.date.today(),
            start_date=new_start,
            end_date=new_end,
            duration_days=new_duration,
            care_description=source.care_description,
            act_codes=list(source.act_codes),
            frequency=source.frequency,
            max_renewals=source.max_renewals,
            current_renewal=source.current_renewal + 1,
            parent_prescription_id=source.id,
            status="active",
            notes=dto.notes,
        )
        created = await self._repo.create(renewal)

        # Si un plan de soins est lié à l'ancienne ordonnance → le rattacher à la nouvelle
        result = await self._session.execute(
            select(CareProtocolModel).where(
                CareProtocolModel.prescription_id == source.id,
                CareProtocolModel.cabinet_id == cabinet_id,
            )
        )
        for protocol in result.scalars().all():
            protocol.prescription_id = created.id
        await self._session.flush()

        return _entity_to_dto(created)
