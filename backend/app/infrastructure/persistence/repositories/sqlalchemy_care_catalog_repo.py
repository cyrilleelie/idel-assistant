import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.repositories.care_type_catalog_repository import CareTypeCatalogRepository
from app.infrastructure.persistence.models.care_type_catalog_model import CareTypeCatalogModel


class SQLAlchemyCareCatalogRepo(CareTypeCatalogRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: CareTypeCatalogModel) -> CareTypeCatalog:
        return CareTypeCatalog(
            id=model.id,
            cabinet_id=model.cabinet_id,
            code=model.code,
            lettre_cle=model.lettre_cle,
            label=model.label,
            category=model.category,
            coefficient=Decimal(str(model.coefficient)) if model.coefficient is not None else None,
            base_rate=Decimal(str(model.base_rate)) if model.base_rate is not None else None,
            fixed_amount=Decimal(str(model.fixed_amount)) if model.fixed_amount is not None else None,
            unit=model.unit,
            default_duration_minutes=model.default_duration_minutes,
            is_cumulative=model.is_cumulative,
            cumul_rules=model.cumul_rules,
            context_rules=model.context_rules,
            effective_from=model.effective_from,
            effective_to=model.effective_to,
            avenant_source=model.avenant_source,
            is_system=model.is_system,
            is_active=model.is_active,
            display_order=model.display_order,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, id: UUID) -> CareTypeCatalog | None:
        result = await self._session.execute(
            select(CareTypeCatalogModel).where(CareTypeCatalogModel.id == id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def get_by_code(
        self,
        code: str,
        cabinet_id: UUID | None = None,
        at_date: datetime.date | None = None,
    ) -> CareTypeCatalog | None:
        check_date = at_date or datetime.date.today()
        query = select(CareTypeCatalogModel).where(
            CareTypeCatalogModel.code == code,
            CareTypeCatalogModel.is_active.is_(True),
            CareTypeCatalogModel.effective_from <= check_date,
            or_(
                CareTypeCatalogModel.effective_to.is_(None),
                CareTypeCatalogModel.effective_to >= check_date,
            ),
        )
        if cabinet_id is not None:
            query = query.where(
                or_(
                    CareTypeCatalogModel.cabinet_id == cabinet_id,
                    CareTypeCatalogModel.cabinet_id.is_(None),
                )
            )
        else:
            query = query.where(CareTypeCatalogModel.cabinet_id.is_(None))

        # Prefer cabinet-specific over system
        query = query.order_by(CareTypeCatalogModel.cabinet_id.desc().nulls_last())
        result = await self._session.execute(query)
        model = result.scalars().first()
        return self._model_to_entity(model) if model else None

    async def list_active(
        self,
        cabinet_id: UUID,
        category: str | None = None,
        lettre_cle: str | None = None,
    ) -> list[CareTypeCatalog]:
        today = datetime.date.today()
        query = select(CareTypeCatalogModel).where(
            CareTypeCatalogModel.is_active.is_(True),
            CareTypeCatalogModel.effective_from <= today,
            or_(
                CareTypeCatalogModel.effective_to.is_(None),
                CareTypeCatalogModel.effective_to >= today,
            ),
            or_(
                CareTypeCatalogModel.cabinet_id == cabinet_id,
                CareTypeCatalogModel.cabinet_id.is_(None),
            ),
        )

        if category is not None:
            query = query.where(CareTypeCatalogModel.category == category)
        if lettre_cle is not None:
            query = query.where(CareTypeCatalogModel.lettre_cle == lettre_cle)

        query = query.order_by(
            CareTypeCatalogModel.display_order,
            CareTypeCatalogModel.code,
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()]

    async def create(self, entity: CareTypeCatalog) -> CareTypeCatalog:
        model = CareTypeCatalogModel(
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
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, entity: CareTypeCatalog) -> CareTypeCatalog:
        result = await self._session.execute(
            select(CareTypeCatalogModel).where(CareTypeCatalogModel.id == entity.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"CareTypeCatalog {entity.id} not found")

        model.code = entity.code
        model.lettre_cle = entity.lettre_cle
        model.label = entity.label
        model.category = entity.category
        model.coefficient = entity.coefficient
        model.base_rate = entity.base_rate
        model.fixed_amount = entity.fixed_amount
        model.unit = entity.unit
        model.default_duration_minutes = entity.default_duration_minutes
        model.is_cumulative = entity.is_cumulative
        model.cumul_rules = entity.cumul_rules
        model.context_rules = entity.context_rules
        model.effective_from = entity.effective_from
        model.effective_to = entity.effective_to
        model.avenant_source = entity.avenant_source
        model.is_system = entity.is_system
        model.is_active = entity.is_active
        model.display_order = entity.display_order
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def toggle_active(self, id: UUID, is_active: bool) -> CareTypeCatalog:
        result = await self._session.execute(
            select(CareTypeCatalogModel).where(CareTypeCatalogModel.id == id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"CareTypeCatalog {id} not found")

        model.is_active = is_active
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)
