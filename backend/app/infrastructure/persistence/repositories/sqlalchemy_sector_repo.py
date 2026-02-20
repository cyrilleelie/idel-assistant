from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.sector import Sector
from app.domain.repositories.sector_repository import SectorRepository
from app.infrastructure.persistence.models.sector_model import SectorModel


class SQLAlchemySectorRepo(SectorRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: SectorModel) -> Sector:
        return Sector(
            id=model.id,
            cabinet_id=model.cabinet_id,
            name=model.name,
            postal_codes=model.postal_codes or [],
            communes=model.communes or [],
            color=model.color,
            display_order=model.display_order,
            created_at=model.created_at,
        )

    async def get_by_id(self, sector_id: UUID) -> Sector | None:
        result = await self._session.execute(
            select(SectorModel).where(SectorModel.id == sector_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_cabinet(self, cabinet_id: UUID) -> list[Sector]:
        result = await self._session.execute(
            select(SectorModel)
            .where(SectorModel.cabinet_id == cabinet_id)
            .order_by(SectorModel.display_order)
        )
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def find_by_postal_code(self, cabinet_id: UUID, postal_code: str) -> Sector | None:
        result = await self._session.execute(
            select(SectorModel).where(
                SectorModel.cabinet_id == cabinet_id,
                SectorModel.postal_codes.contains([postal_code]),
            )
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def create(self, sector: Sector) -> Sector:
        model = SectorModel(
            id=sector.id,
            cabinet_id=sector.cabinet_id,
            name=sector.name,
            postal_codes=sector.postal_codes,
            communes=sector.communes,
            color=sector.color,
            display_order=sector.display_order,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, sector: Sector) -> Sector:
        result = await self._session.execute(
            select(SectorModel).where(SectorModel.id == sector.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Sector {sector.id} not found")

        model.name = sector.name
        model.postal_codes = sector.postal_codes
        model.communes = sector.communes
        model.color = sector.color
        model.display_order = sector.display_order
        await self._session.flush()
        return self._model_to_entity(model)

    async def delete(self, sector_id: UUID) -> None:
        result = await self._session.execute(
            select(SectorModel).where(SectorModel.id == sector_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Sector {sector_id} not found")
        await self._session.delete(model)
        await self._session.flush()
