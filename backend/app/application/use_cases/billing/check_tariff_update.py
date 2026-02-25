from app.application.dtos.care_catalog_dto import TariffUpdateDTO
from app.domain.repositories.care_type_catalog_repository import TariffUpdateRepository


class CheckTariffUpdateUseCase:
    def __init__(self, repo: TariffUpdateRepository):
        self._repo = repo

    async def execute(self) -> list[TariffUpdateDTO]:
        entities = await self._repo.get_available()
        return [
            TariffUpdateDTO(
                id=e.id,
                version=e.version,
                avenant_reference=e.avenant_reference,
                published_at=e.published_at,
                effective_at=e.effective_at,
                description=e.description,
                changes=e.changes,
                status=e.status,
                applied_at=e.applied_at,
                created_at=e.created_at,
            )
            for e in entities
        ]
