from uuid import UUID

from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.application.dtos.care_catalog_dto import CareTypeCatalogDTO


class ListCatalogUseCase:
    def __init__(self, repo: CareTypeCatalogRepository):
        self._repo = repo

    async def execute(
        self,
        cabinet_id: UUID,
        category: str | None = None,
        lettre_cle: str | None = None,
    ) -> list[CareTypeCatalogDTO]:
        entities = await self._repo.list_active(
            cabinet_id=cabinet_id,
            category=category,
            lettre_cle=lettre_cle,
        )
        return [
            CareTypeCatalogDTO(
                id=e.id,
                cabinet_id=e.cabinet_id,
                code=e.code,
                lettre_cle=e.lettre_cle,
                label=e.label,
                category=e.category,
                coefficient=e.coefficient,
                base_rate=e.base_rate,
                fixed_amount=e.fixed_amount,
                unit=e.unit,
                default_duration_minutes=e.default_duration_minutes,
                is_cumulative=e.is_cumulative,
                cumul_rules=e.cumul_rules,
                context_rules=e.context_rules,
                effective_from=e.effective_from,
                effective_to=e.effective_to,
                avenant_source=e.avenant_source,
                is_system=e.is_system,
                is_active=e.is_active,
                display_order=e.display_order,
                created_at=e.created_at,
                updated_at=e.updated_at,
            )
            for e in entities
        ]
