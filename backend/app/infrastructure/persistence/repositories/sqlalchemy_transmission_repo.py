"""Repository SQLAlchemy pour les transmissions infirmières."""

import datetime
import logging
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.transmission import Transmission
from app.domain.repositories.transmission_repository import TransmissionRepository
from app.infrastructure.persistence.models.transmission_model import TransmissionModel
from app.infrastructure.security.encryption import decrypt, encrypt
from app.infrastructure.security.key_manager import KeyManager

logger = logging.getLogger(__name__)


class SQLAlchemyTransmissionRepo(TransmissionRepository):
    """Implémentation SQLAlchemy du TransmissionRepository.

    La transcription est chiffrée AES-256-GCM avec la clé cabinet.
    Le structured_data (DAR JSON) est stocké en clair dans la colonne JSONB.
    """

    def __init__(self, db: AsyncSession, key_manager: KeyManager):
        self._db = db
        self._km = key_manager

    def _cabinet_key(self, cabinet_id: UUID) -> bytes:
        return self._km.get_cabinet_key(cabinet_id)

    def _to_entity(self, model: TransmissionModel, cabinet_id: UUID) -> Transmission:
        """Convertit le modèle SQLAlchemy en entité domaine (déchiffrement transcription)."""
        transcription = ""
        if model.transcription_encrypted:
            try:
                key = self._cabinet_key(cabinet_id)
                transcription = decrypt(model.transcription_encrypted, key)
            except Exception:
                logger.warning("Impossible de déchiffrer la transcription (id=%s)", model.id)

        return Transmission(
            id=model.id,
            cabinet_id=cabinet_id,
            idel_id=model.idel_id,
            patient_id=model.patient_id,
            type=model.type or "written",
            status=model.status or "draft",
            appointment_id=model.appointment_id,
            transcription=transcription,
            structured_data=model.structured_data or {},
            audio_file_path=model.audio_file_path,
            recording_duration_seconds=model.recording_duration_seconds or 0,
            generation_time_ms=model.generation_time_ms or 0,
            created_at=model.created_at or datetime.datetime.now(datetime.UTC),
            updated_at=model.updated_at or datetime.datetime.now(datetime.UTC),
        )

    async def get_by_id(self, transmission_id: UUID) -> Transmission | None:
        result = await self._db.execute(
            select(TransmissionModel).where(TransmissionModel.id == transmission_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._to_entity(model, model.cabinet_id)

    async def list_by_patient(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Transmission], int]:
        count_result = await self._db.execute(
            select(func.count()).where(
                TransmissionModel.patient_id == patient_id,
                TransmissionModel.cabinet_id == cabinet_id,
            )
        )
        total = count_result.scalar_one()

        result = await self._db.execute(
            select(TransmissionModel)
            .where(
                TransmissionModel.patient_id == patient_id,
                TransmissionModel.cabinet_id == cabinet_id,
            )
            .order_by(TransmissionModel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        models = result.scalars().all()
        return [self._to_entity(m, cabinet_id) for m in models], total

    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Transmission], int]:
        count_result = await self._db.execute(
            select(func.count()).where(
                TransmissionModel.cabinet_id == cabinet_id,
            )
        )
        total = count_result.scalar_one()

        result = await self._db.execute(
            select(TransmissionModel)
            .where(TransmissionModel.cabinet_id == cabinet_id)
            .order_by(TransmissionModel.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        models = result.scalars().all()
        return [self._to_entity(m, cabinet_id) for m in models], total

    async def list_by_patient_since(
        self,
        patient_id: UUID,
        cabinet_id: UUID,
        since: datetime.datetime,
    ) -> list[Transmission]:
        """Returns transmissions for a patient created since a given datetime."""
        result = await self._db.execute(
            select(TransmissionModel)
            .where(
                TransmissionModel.patient_id == patient_id,
                TransmissionModel.cabinet_id == cabinet_id,
                TransmissionModel.created_at >= since,
            )
            .order_by(TransmissionModel.created_at.desc())
        )
        models = result.scalars().all()
        return [self._to_entity(m, cabinet_id) for m in models]

    async def list_updated_since(
        self,
        cabinet_id: UUID,
        since: datetime.datetime,
    ) -> list[Transmission]:
        """Returns all transmissions updated since a given datetime (for sync)."""
        result = await self._db.execute(
            select(TransmissionModel)
            .where(
                TransmissionModel.cabinet_id == cabinet_id,
                TransmissionModel.updated_at >= since,
            )
            .order_by(TransmissionModel.updated_at.asc())
        )
        models = result.scalars().all()
        return [self._to_entity(m, cabinet_id) for m in models]

    async def create(
        self,
        transmission: Transmission,
    ) -> Transmission:
        """Crée une transmission en chiffrant la transcription."""
        encrypted_transcription = None
        if transmission.transcription:
            try:
                key = self._cabinet_key(transmission.cabinet_id)
                encrypted_transcription = encrypt(transmission.transcription, key)
            except Exception:
                logger.warning("Impossible de chiffrer la transcription, stockage ignoré")

        model = TransmissionModel(
            id=transmission.id,
            cabinet_id=transmission.cabinet_id,
            idel_id=transmission.idel_id,
            patient_id=transmission.patient_id,
            appointment_id=transmission.appointment_id,
            type=transmission.type,
            status=transmission.status,
            transcription_encrypted=encrypted_transcription,
            structured_data=transmission.structured_data,
            audio_file_path=transmission.audio_file_path,
            recording_duration_seconds=transmission.recording_duration_seconds,
            generation_time_ms=transmission.generation_time_ms,
        )
        self._db.add(model)
        await self._db.flush()
        await self._db.refresh(model)
        return self._to_entity(model, transmission.cabinet_id)

    async def update(self, transmission: Transmission) -> Transmission:
        result = await self._db.execute(
            select(TransmissionModel).where(TransmissionModel.id == transmission.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Transmission introuvable : {transmission.id}")

        model.type = transmission.type
        model.status = transmission.status
        model.audio_file_path = transmission.audio_file_path

        if transmission.transcription:
            try:
                key = self._cabinet_key(transmission.cabinet_id)
                model.transcription_encrypted = encrypt(transmission.transcription, key)
            except Exception:
                pass

        model.structured_data = transmission.structured_data
        model.recording_duration_seconds = transmission.recording_duration_seconds
        model.generation_time_ms = transmission.generation_time_ms

        await self._db.flush()
        await self._db.refresh(model)
        return self._to_entity(model, transmission.cabinet_id)
