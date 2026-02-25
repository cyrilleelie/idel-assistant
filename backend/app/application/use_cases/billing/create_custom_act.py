import datetime
from uuid import UUID

from app.application.dtos.care_catalog_dto import CareTypeCatalogDTO, CreateCustomActDTO
from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository


class CreateCustomActUseCase:
    def __init__(self, repo: CareTypeCatalogRepository):
        self._repo = repo

    async def execute(
        self,
        cabinet_id: UUID,
        dto: CreateCustomActDTO,
    ) -> CareTypeCatalogDTO:
        # Verifie que le code n'existe pas deja pour ce cabinet
        existing = await self._repo.get_by_code(
            code=dto.code,
            cabinet_id=cabinet_id,
        )
        if existing is not None:
            raise ValueError(f"Un acte avec le code '{dto.code}' existe deja")

        entity = CareTypeCatalog(
            cabinet_id=cabinet_id,
            code=dto.code,
            lettre_cle=dto.lettre_cle,
            label=dto.label,
            category=dto.category,
            unit=dto.unit,
            coefficient=dto.coefficient,
            base_rate=dto.base_rate,
            fixed_amount=dto.fixed_amount,
            default_duration_minutes=dto.default_duration_minutes,
            is_cumulative=dto.is_cumulative,
            cumul_rules=dto.cumul_rules,
            context_rules=dto.context_rules,
            effective_from=dto.effective_from or datetime.date.today(),
            is_system=False,
            is_active=True,
            display_order=dto.display_order,
        )
        created = await self._repo.create(entity)
        return CareTypeCatalogDTO(
            id=created.id,
            cabinet_id=created.cabinet_id,
            code=created.code,
            lettre_cle=created.lettre_cle,
            label=created.label,
            category=created.category,
            coefficient=created.coefficient,
            base_rate=created.base_rate,
            fixed_amount=created.fixed_amount,
            unit=created.unit,
            default_duration_minutes=created.default_duration_minutes,
            is_cumulative=created.is_cumulative,
            cumul_rules=created.cumul_rules,
            context_rules=created.context_rules,
            effective_from=created.effective_from,
            effective_to=created.effective_to,
            avenant_source=created.avenant_source,
            is_system=created.is_system,
            is_active=created.is_active,
            display_order=created.display_order,
            created_at=created.created_at,
            updated_at=created.updated_at,
        )
