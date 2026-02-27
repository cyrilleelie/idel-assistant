"""Implémentation SQLAlchemy du CareProtocolRepository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.care_protocol import CareProtocol
from app.domain.repositories.care_protocol_repository import CareProtocolRepository
from app.infrastructure.persistence.models.care_protocol_model import (
    CareProtocolModel,
)


class SQLAlchemyCareProtocolRepo(CareProtocolRepository):
    def __init__(self, session: AsyncSession):
        self._session = session

    def _model_to_entity(self, model: CareProtocolModel) -> CareProtocol:
        return CareProtocol(
            id=model.id,
            patient_id=model.patient_id,
            cabinet_id=model.cabinet_id,
            label=model.label or "",
            start_date=model.start_date,
            end_date=model.end_date,
            status=model.status,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def get_by_id(self, protocol_id: UUID) -> CareProtocol | None:
        result = await self._session.execute(
            select(CareProtocolModel).where(CareProtocolModel.id == protocol_id)
        )
        model = result.scalar_one_or_none()
        return self._model_to_entity(model) if model else None

    async def list_by_patient(
        self,
        patient_id: UUID,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[CareProtocol], int]:
        query = select(CareProtocolModel).where(
            CareProtocolModel.patient_id == patient_id
        )
        if status:
            query = query.where(CareProtocolModel.status == status)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.offset(skip).limit(limit).order_by(
            CareProtocolModel.created_at.desc()
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()], total

    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[CareProtocol], int]:
        query = select(CareProtocolModel).where(
            CareProtocolModel.cabinet_id == cabinet_id
        )
        if status:
            query = query.where(CareProtocolModel.status == status)

        count_query = select(func.count()).select_from(query.subquery())
        total = (await self._session.execute(count_query)).scalar_one()

        query = query.offset(skip).limit(limit).order_by(
            CareProtocolModel.created_at.desc()
        )
        result = await self._session.execute(query)
        return [self._model_to_entity(m) for m in result.scalars().all()], total

    async def create(self, protocol: CareProtocol) -> CareProtocol:
        model = CareProtocolModel(
            id=protocol.id,
            patient_id=protocol.patient_id,
            cabinet_id=protocol.cabinet_id,
            label=protocol.label,
            start_date=protocol.start_date,
            end_date=protocol.end_date,
            status=protocol.status,
        )
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, protocol: CareProtocol) -> CareProtocol:
        result = await self._session.execute(
            select(CareProtocolModel).where(CareProtocolModel.id == protocol.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"CareProtocol {protocol.id} not found")

        model.label = protocol.label
        model.start_date = protocol.start_date
        model.end_date = protocol.end_date
        model.status = protocol.status
        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def delete(self, protocol_id: UUID) -> None:
        result = await self._session.execute(
            select(CareProtocolModel).where(CareProtocolModel.id == protocol_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"CareProtocol {protocol_id} not found")
        await self._session.delete(model)
        await self._session.flush()
