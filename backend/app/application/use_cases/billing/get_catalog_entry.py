from uuid import UUID

from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.application.dtos.care_catalog_dto import CareTypeCatalogDTO


class GetCatalogEntryUseCase:
    def __init__(self, repo: CareTypeCatalogRepository):
        self._repo = repo

    async def execute(self, entry_id: UUID) -> CareTypeCatalogDTO | None:
        entity = await self._repo.get_by_id(entry_id)
        if entity is None:
            return None
        return CareTypeCatalogDTO(
            id=entity.id,
            cabinet_id=entity.cabinet_id,
            code=entity.code,
            lettre_cle=entity.lettre_cle,
            label=entity.label,
            category=entity.category,
            coefficient=entity.coefficient,
            base_rate=entity.base_rate,
            fixed_amount=entity.fixed_amount,
            unit=entity.unit,
            default_duration_minutes=entity.default_duration_minutes,
            is_cumulative=entity.is_cumulative,
            cumul_rules=entity.cumul_rules,
            context_rules=entity.context_rules,
            effective_from=entity.effective_from,
            effective_to=entity.effective_to,
            avenant_source=entity.avenant_source,
            is_system=entity.is_system,
            is_active=entity.is_active,
            display_order=entity.display_order,
            created_at=entity.created_at,
            updated_at=entity.updated_at,
        )
