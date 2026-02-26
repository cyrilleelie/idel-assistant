from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.care_label import CareLabel
from app.domain.repositories.care_label_repository import CareLabelRepository
from app.infrastructure.persistence.models.care_label_model import CareLabelModel


class SQLAlchemyCareLabelRepo(CareLabelRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: CareLabelModel) -> CareLabel:
        return CareLabel(
            id=model.id,
            cabinet_id=model.cabinet_id,
            label=model.label,
            act_codes=list(model.act_codes) if model.act_codes else [],
            default_duration_minutes=model.default_duration_minutes,
            category=model.category,
            is_system=model.is_system,
            is_active=model.is_active,
            display_order=model.display_order,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def list_active(self, cabinet_id: UUID) -> list[CareLabel]:
        query = (
            select(CareLabelModel)
            .where(
                or_(
                    CareLabelModel.cabinet_id == cabinet_id,
                    CareLabelModel.cabinet_id.is_(None),
                ),
                CareLabelModel.is_active.is_(True),
            )
            .order_by(CareLabelModel.display_order, CareLabelModel.label)
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def get_by_id(self, id: UUID) -> CareLabel | None:
        result = await self._session.execute(
            select(CareLabelModel).where(CareLabelModel.id == id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def create(self, entity: CareLabel) -> CareLabel:
        model = CareLabelModel(
            id=entity.id,
            cabinet_id=entity.cabinet_id,
            label=entity.label,
            act_codes=entity.act_codes,
            default_duration_minutes=entity.default_duration_minutes,
            category=entity.category,
            is_system=entity.is_system,
            is_active=entity.is_active,
            display_order=entity.display_order,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, entity: CareLabel) -> CareLabel:
        result = await self._session.execute(
            select(CareLabelModel).where(CareLabelModel.id == entity.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"CareLabel {entity.id} not found")

        model.label = entity.label
        model.act_codes = entity.act_codes
        model.default_duration_minutes = entity.default_duration_minutes
        model.category = entity.category
        model.is_system = entity.is_system
        model.is_active = entity.is_active
        model.display_order = entity.display_order
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def delete(self, id: UUID) -> None:
        result = await self._session.execute(
            select(CareLabelModel).where(CareLabelModel.id == id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"CareLabel {id} not found")
        await self._session.delete(model)
        await self._session.flush()
