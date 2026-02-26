"""Use case : simulation de cotation automatique NGAP."""

import datetime
from decimal import Decimal
from uuid import UUID

from app.application.dtos.cotation_dto import (
    CotationLigneDTO,
    CotationResultDTO,
    SimulateCotationDTO,
)
from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.rules.cotation_engine import CotationEngine
from app.domain.value_objects.patient_cotation_context import PatientCotationContext


class SimulateCotationUseCase:
    def __init__(
        self,
        patient_repo: PatientRepository,
        catalog_repo: CareTypeCatalogRepository,
    ):
        self._patient_repo = patient_repo
        self._catalog_repo = catalog_repo
        self._engine = CotationEngine()

    async def execute(
        self,
        cabinet_id: UUID,
        dto: SimulateCotationDTO,
    ) -> CotationResultDTO:
        # 1. Recupere le patient
        patient = await self._patient_repo.get_by_id(dto.patient_id)
        if patient is None:
            raise ValueError("Patient introuvable")

        # 2. Construit le contexte patient
        today = datetime.date.today()
        age = today.year - patient.birth_date.year if patient.birth_date else 50
        if patient.birth_date:
            had_birthday = (today.month, today.day) >= (patient.birth_date.month, patient.birth_date.day)
            if not had_birthday:
                age -= 1

        patient_ctx = PatientCotationContext(
            has_active_bsi=patient.has_active_bsi,
            bsi_level=patient.bsi_level,
            bsi_already_billed_today=False,  # Simulation => on ne check pas
            is_ald=patient.is_ald,
            is_maternity=patient.is_maternity,
            age=age,
            is_palliative=False,  # TODO: ajouter quand le champ existera
        )

        # 3. Charge le catalogue pour les actes demandes
        catalog = await self._build_catalog(dto.actes, patient_ctx, cabinet_id)

        # 4. Parse la date/heure
        date_heure = datetime.datetime.fromisoformat(dto.date_heure_soin)

        # 5. Execute le moteur de cotation
        result = self._engine.coter_passage(
            actes=dto.actes,
            date_heure_soin=date_heure,
            distance_km=dto.distance_km,
            lieu=dto.lieu,
            zone_ik=dto.zone_ik,
            est_premier_soin_journee=dto.est_premier_soin_journee,
            patient_context=patient_ctx,
            catalog=catalog,
        )

        # 6. Convertit en DTO
        return CotationResultDTO(
            lignes=[
                CotationLigneDTO(
                    code=l.code,
                    label=l.label,
                    montant=l.montant,
                    quantity=l.quantity,
                    coefficient=l.coefficient,
                    base_rate=l.base_rate,
                    category=l.category,
                )
                for l in result.lignes
            ],
            total=result.total,
            repartition_amo=result.repartition_amo,
            repartition_amc=result.repartition_amc,
            repartition_patient=result.repartition_patient,
            auto_corrections=result.auto_corrections,
            explications=result.explications,
        )

    async def _build_catalog(
        self,
        actes: list[str],
        ctx: PatientCotationContext,
        cabinet_id: UUID,
    ) -> dict[str, CareTypeCatalog]:
        """Charge les entrees catalogue necessaires pour le moteur."""
        catalog: dict[str, CareTypeCatalog] = {}

        # Codes des actes demandes + leurs equivalents AMX si BSI
        codes_needed: set[str] = set()
        for acte in actes:
            codes_needed.add(acte)
            if ctx.has_active_bsi and acte.upper().startswith("AMI"):
                suffix = acte[3:]
                codes_needed.add(f"AMX{suffix}")

        # Charge les forfaits BSI si applicable
        if ctx.has_active_bsi and ctx.bsi_level:
            codes_needed.add(ctx.bsi_level.upper())

        for code in codes_needed:
            entry = await self._catalog_repo.get_by_code(code, cabinet_id)
            if entry is not None:
                catalog[code] = entry

        return catalog
