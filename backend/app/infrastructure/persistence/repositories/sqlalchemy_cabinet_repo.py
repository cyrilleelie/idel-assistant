from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.cabinet import Cabinet
from app.domain.entities.user import CabinetMember
from app.domain.repositories.cabinet_repository import CabinetRepository
from app.infrastructure.persistence.models.cabinet_model import CabinetModel
from app.infrastructure.persistence.models.user_model import CabinetMemberModel


class SQLAlchemyCabinetRepo(CabinetRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: CabinetModel) -> Cabinet:
        return Cabinet(
            id=model.id,
            name=model.name,
            address=model.address,
            lat=float(model.lat) if model.lat is not None else None,
            lon=float(model.lon) if model.lon is not None else None,
            plan=model.plan,
            subscription_status=model.subscription_status,
            trial_ends_at=model.trial_ends_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _member_to_entity(self, model: CabinetMemberModel) -> CabinetMember:
        return CabinetMember(
            id=model.id,
            cabinet_id=model.cabinet_id,
            user_id=model.user_id,
            role=model.role,
            is_active=model.is_active,
            joined_at=model.joined_at.date() if model.joined_at else None,
            left_at=model.left_at.date() if model.left_at else None,
        )

    async def get_by_id(self, cabinet_id: UUID) -> Cabinet | None:
        result = await self._session.execute(
            select(CabinetModel).where(CabinetModel.id == cabinet_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def create(self, cabinet: Cabinet) -> Cabinet:
        model = CabinetModel(
            id=cabinet.id,
            name=cabinet.name,
            address=cabinet.address,
            lat=cabinet.lat,
            lon=cabinet.lon,
            plan=cabinet.plan,
            subscription_status=cabinet.subscription_status,
            trial_ends_at=cabinet.trial_ends_at,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, cabinet: Cabinet) -> Cabinet:
        result = await self._session.execute(
            select(CabinetModel).where(CabinetModel.id == cabinet.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Cabinet {cabinet.id} not found")

        model.name = cabinet.name
        model.address = cabinet.address
        model.lat = cabinet.lat
        model.lon = cabinet.lon
        model.plan = cabinet.plan
        model.subscription_status = cabinet.subscription_status
        model.trial_ends_at = cabinet.trial_ends_at
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def add_member(self, member: CabinetMember) -> CabinetMember:
        model = CabinetMemberModel(
            id=member.id,
            cabinet_id=member.cabinet_id,
            user_id=member.user_id,
            role=member.role,
            is_active=member.is_active,
        )
        self._session.add(model)
        await self._session.flush()
        return self._member_to_entity(model)

    async def get_members(self, cabinet_id: UUID) -> list[CabinetMember]:
        result = await self._session.execute(
            select(CabinetMemberModel).where(
                CabinetMemberModel.cabinet_id == cabinet_id,
                CabinetMemberModel.is_active.is_(True),
            )
        )
        return [self._member_to_entity(m) for m in result.scalars().all()]

    async def get_member(
        self, cabinet_id: UUID, user_id: UUID
    ) -> CabinetMember | None:
        result = await self._session.execute(
            select(CabinetMemberModel).where(
                CabinetMemberModel.cabinet_id == cabinet_id,
                CabinetMemberModel.user_id == user_id,
                CabinetMemberModel.is_active.is_(True),
            )
        )
        model = result.scalar_one_or_none()
        return self._member_to_entity(model) if model else None

    async def get_members_for_user(self, user_id: UUID) -> list[CabinetMember]:
        result = await self._session.execute(
            select(CabinetMemberModel).where(
                CabinetMemberModel.user_id == user_id,
                CabinetMemberModel.is_active.is_(True),
            )
        )
        return [self._member_to_entity(m) for m in result.scalars().all()]
