import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.tariff_update import TariffUpdate
from app.domain.repositories.care_type_catalog_repository import TariffUpdateRepository
from app.infrastructure.persistence.models.tariff_update_model import TariffUpdateModel


class SQLAlchemyTariffUpdateRepo(TariffUpdateRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: TariffUpdateModel) -> TariffUpdate:
        return TariffUpdate(
            id=model.id,
            version=model.version,
            avenant_reference=model.avenant_reference,
            published_at=model.published_at,
            effective_at=model.effective_at,
            description=model.description,
            changes=model.changes or {},
            status=model.status,
            applied_at=model.applied_at,
            created_at=model.created_at,
        )

    async def get_available(self) -> list[TariffUpdate]:
        result = await self._session.execute(
            select(TariffUpdateModel)
            .where(TariffUpdateModel.status == "available")
            .order_by(TariffUpdateModel.effective_at.desc())
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def get_by_id(self, id: UUID) -> TariffUpdate | None:
        result = await self._session.execute(
            select(TariffUpdateModel).where(TariffUpdateModel.id == id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def save(self, entity: TariffUpdate) -> TariffUpdate:
        model = TariffUpdateModel(
            id=entity.id,
            version=entity.version,
            avenant_reference=entity.avenant_reference,
            published_at=entity.published_at,
            effective_at=entity.effective_at,
            description=entity.description,
            changes=entity.changes,
            status=entity.status,
            applied_at=entity.applied_at,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def mark_applied(self, id: UUID) -> TariffUpdate:
        result = await self._session.execute(
            select(TariffUpdateModel).where(TariffUpdateModel.id == id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"TariffUpdate {id} not found")

        model.status = "applied"
        model.applied_at = datetime.datetime.now(datetime.UTC)
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)
