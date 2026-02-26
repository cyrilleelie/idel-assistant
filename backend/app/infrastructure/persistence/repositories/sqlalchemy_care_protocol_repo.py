"""Implémentation SQLAlchemy du CareProtocolRepository."""

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.care_protocol import CareProtocol
from app.domain.repositories.care_protocol_repository import CareProtocolRepository
from app.infrastructure.persistence.models.care_protocol_model import (
    CareProtocolModel,
)
from app.infrastructure.security.encryption import decrypt, encrypt
from app.infrastructure.security.key_manager import KeyManager


class SQLAlchemyCareProtocolRepo(CareProtocolRepository):
    def __init__(self, session: AsyncSession, key_manager: KeyManager):
        self._session = session
        self._km = key_manager

    def _encrypt_field(self, value: str, cabinet_id: UUID) -> bytes:
        key = self._km.get_cabinet_key(cabinet_id)
        return encrypt(value, key)

    def _decrypt_field(self, data: bytes | None, cabinet_id: UUID) -> str:
        if data is None:
            return ""
        key = self._km.get_cabinet_key(cabinet_id)
        return decrypt(data, key)

    def _model_to_entity(self, model: CareProtocolModel) -> CareProtocol:
        return CareProtocol(
            id=model.id,
            patient_id=model.patient_id,
            cabinet_id=model.cabinet_id,
            care_type=model.care_type,
            label=model.label or "",
            frequency_display=model.frequency_display or "daily",
            custom_frequency=self._decrypt_field(model.custom_frequency_encrypted, model.cabinet_id),
            duration_minutes=model.duration_minutes,
            recurrence_rule=model.recurrence_rule,
            start_date=model.start_date,
            end_date=model.end_date,
            preferred_time=model.preferred_time,
            preferred_slot=model.preferred_slot or "",
            status=model.status,
            act_codes=list(model.act_codes) if model.act_codes else [],
            notes=self._decrypt_field(model.notes_encrypted, model.cabinet_id),
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
            care_type=protocol.care_type,
            label=protocol.label,
            frequency_display=protocol.frequency_display,
            custom_frequency_encrypted=(
                self._encrypt_field(protocol.custom_frequency, protocol.cabinet_id)
                if protocol.custom_frequency else None
            ),
            duration_minutes=protocol.duration_minutes,
            recurrence_rule=protocol.recurrence_rule,
            start_date=protocol.start_date,
            end_date=protocol.end_date,
            preferred_time=protocol.preferred_time,
            preferred_slot=protocol.preferred_slot,
            act_codes=protocol.act_codes or None,
            status=protocol.status,
            notes_encrypted=(
                self._encrypt_field(protocol.notes, protocol.cabinet_id)
                if protocol.notes else None
            ),
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

        model.care_type = protocol.care_type
        model.label = protocol.label
        model.frequency_display = protocol.frequency_display
        model.custom_frequency_encrypted = (
            self._encrypt_field(protocol.custom_frequency, protocol.cabinet_id)
            if protocol.custom_frequency else None
        )
        model.duration_minutes = protocol.duration_minutes
        model.recurrence_rule = protocol.recurrence_rule
        model.start_date = protocol.start_date
        model.end_date = protocol.end_date
        model.preferred_time = protocol.preferred_time
        model.preferred_slot = protocol.preferred_slot
        model.act_codes = protocol.act_codes or None
        model.status = protocol.status
        model.notes_encrypted = (
            self._encrypt_field(protocol.notes, protocol.cabinet_id)
            if protocol.notes else None
        )
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
