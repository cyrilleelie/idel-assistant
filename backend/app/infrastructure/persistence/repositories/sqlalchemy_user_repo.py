from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import User
from app.domain.repositories.user_repository import UserRepository
from app.infrastructure.persistence.models.user_model import UserModel


class SQLAlchemyUserRepo(UserRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: UserModel) -> User:
        return User(
            id=model.id,
            email=model.email,
            password_hash=model.password_hash,
            first_name=model.first_name,
            last_name=model.last_name,
            rpps=model.rpps,
            phone=model.phone,
            photo_url=model.photo_url,
            work_hours_start=model.work_hours_start,
            work_hours_end=model.work_hours_end,
            lunch_break_start=model.lunch_break_start,
            lunch_break_duration_minutes=model.lunch_break_duration_minutes,
            work_zone_radius_km=model.work_zone_radius_km,
            vocal_agent_enabled=model.vocal_agent_enabled,
            vocal_agent_phone=model.vocal_agent_phone,
            last_login_at=model.last_login_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, user_id: UUID) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(
            select(UserModel).where(UserModel.email == email)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def create(self, user: User) -> User:
        model = UserModel(
            id=user.id,
            email=user.email,
            password_hash=user.password_hash,
            first_name=user.first_name,
            last_name=user.last_name,
            rpps=user.rpps,
            phone=user.phone,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, user: User) -> User:
        result = await self._session.execute(
            select(UserModel).where(UserModel.id == user.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"User {user.id} not found")

        model.first_name = user.first_name
        model.last_name = user.last_name
        model.phone = user.phone
        model.photo_url = user.photo_url
        model.work_hours_start = user.work_hours_start
        model.work_hours_end = user.work_hours_end
        model.lunch_break_start = user.lunch_break_start
        model.lunch_break_duration_minutes = user.lunch_break_duration_minutes
        model.work_zone_radius_km = user.work_zone_radius_km
        model.vocal_agent_enabled = user.vocal_agent_enabled
        model.vocal_agent_phone = user.vocal_agent_phone
        model.last_login_at = user.last_login_at
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)
