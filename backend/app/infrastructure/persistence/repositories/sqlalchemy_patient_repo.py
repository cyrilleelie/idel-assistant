import datetime
import json
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.patient import Patient
from app.domain.repositories.patient_repository import PatientRepository
from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.security.encryption import compute_search_hash, decrypt, encrypt
from app.infrastructure.security.key_manager import KeyManager


class SQLAlchemyPatientRepo(PatientRepository):
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

    def _search_hash(self, value: str, cabinet_id: UUID) -> str:
        key = self._km.get_cabinet_key(cabinet_id)
        return compute_search_hash(value, key)

    def _model_to_entity(self, model: PatientModel) -> Patient:
        cabinet_id = model.cabinet_id
        pathologies_raw = self._decrypt_field(model.pathologies_encrypted, cabinet_id)
        if not pathologies_raw:
            pathologies = []
        else:
            try:
                pathologies = json.loads(pathologies_raw)
            except (json.JSONDecodeError, TypeError):
                # Legacy data stored as plain text instead of JSON array
                pathologies = [line for line in pathologies_raw.split("\n") if line.strip()]

        birth_date_raw = self._decrypt_field(model.birth_date_encrypted, cabinet_id)
        birth_date = (
            datetime.date.fromisoformat(birth_date_raw) if birth_date_raw else None
        )

        return Patient(
            id=model.id,
            cabinet_id=cabinet_id,
            first_name=self._decrypt_field(model.first_name_encrypted, cabinet_id),
            last_name=self._decrypt_field(model.last_name_encrypted, cabinet_id),
            birth_date=birth_date,
            phone=self._decrypt_field(model.phone_encrypted, cabinet_id),
            email=self._decrypt_field(model.email_encrypted, cabinet_id),
            address=self._decrypt_field(model.address_encrypted, cabinet_id),
            lat=float(model.lat) if model.lat is not None else None,
            lon=float(model.lon) if model.lon is not None else None,
            sector_id=model.sector_id,
            postal_code=model.postal_code or "",
            city=model.city or "",
            pathologies=pathologies,
            preferred_time_slot=model.preferred_time_slot or "",
            care_duration_default=model.care_duration_default,
            notes=self._decrypt_field(model.notes_encrypted, cabinet_id),
            ssn=self._decrypt_field(model.ssn_encrypted, cabinet_id),
            doctor_name=self._decrypt_field(model.doctor_name_encrypted, cabinet_id),
            doctor_contact=self._decrypt_field(model.doctor_contact_encrypted, cabinet_id),
            status=model.status,
            archived_reason=model.archived_reason or "",
            archived_at=model.archived_at,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    def _entity_to_model_data(self, patient: Patient) -> dict:
        cid = patient.cabinet_id
        data = {
            "id": patient.id,
            "cabinet_id": cid,
            "first_name_encrypted": self._encrypt_field(patient.first_name, cid),
            "last_name_encrypted": self._encrypt_field(patient.last_name, cid),
            "first_name_search_hash": self._search_hash(patient.first_name, cid),
            "last_name_search_hash": self._search_hash(patient.last_name, cid),
            "lat": patient.lat,
            "lon": patient.lon,
            "sector_id": patient.sector_id,
            "postal_code": patient.postal_code,
            "city": patient.city,
            "preferred_time_slot": patient.preferred_time_slot or None,
            "care_duration_default": patient.care_duration_default,
            "status": patient.status,
            "archived_reason": patient.archived_reason or "",
            "archived_at": patient.archived_at,
        }
        # Champs optionnels chiffres (toujours inclure la cle pour que update() ecrase)
        data["birth_date_encrypted"] = (
            self._encrypt_field(patient.birth_date.isoformat(), cid)
            if patient.birth_date
            else None
        )
        data["phone_encrypted"] = (
            self._encrypt_field(patient.phone, cid) if patient.phone else None
        )
        data["email_encrypted"] = (
            self._encrypt_field(patient.email, cid) if patient.email else None
        )
        data["address_encrypted"] = (
            self._encrypt_field(patient.address, cid) if patient.address else None
        )
        data["pathologies_encrypted"] = (
            self._encrypt_field(json.dumps(patient.pathologies), cid)
            if patient.pathologies
            else None
        )
        data["notes_encrypted"] = (
            self._encrypt_field(patient.notes, cid) if patient.notes else None
        )
        data["ssn_encrypted"] = (
            self._encrypt_field(patient.ssn, cid) if patient.ssn else None
        )
        data["ssn_search_hash"] = (
            self._search_hash(patient.ssn, cid) if patient.ssn else None
        )
        data["doctor_name_encrypted"] = (
            self._encrypt_field(patient.doctor_name, cid) if patient.doctor_name else None
        )
        data["doctor_contact_encrypted"] = (
            self._encrypt_field(patient.doctor_contact, cid) if patient.doctor_contact else None
        )
        return data

    async def get_by_id(self, patient_id: UUID) -> Patient | None:
        result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == patient_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return self._model_to_entity(model)

    async def list_by_cabinet(
        self,
        cabinet_id: UUID,
        status: str | None = "active",
        search: str | None = None,
        sector_id: UUID | None = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Patient], int]:
        query = select(PatientModel).where(
            PatientModel.cabinet_id == cabinet_id,
        )
        if status is not None:
            query = query.where(PatientModel.status == status)

        if sector_id is not None:
            query = query.where(PatientModel.sector_id == sector_id)

        if search:
            search_hash = self._search_hash(search, cabinet_id)
            query = query.where(
                (PatientModel.last_name_search_hash == search_hash)
                | (PatientModel.first_name_search_hash == search_hash)
            )

        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self._session.execute(count_query)
        total = total_result.scalar_one()

        # Paginate
        query = query.offset(skip).limit(limit).order_by(PatientModel.created_at.desc())
        result = await self._session.execute(query)
        models = result.scalars().all()

        return [self._model_to_entity(m) for m in models], total

    async def create(self, patient: Patient) -> Patient:
        data = self._entity_to_model_data(patient)
        model = PatientModel(**data)
        self._session.add(model)
        await self._session.flush()
        return self._model_to_entity(model)

    async def update(self, patient: Patient) -> Patient:
        result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == patient.id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Patient {patient.id} not found")

        data = self._entity_to_model_data(patient)
        for key, value in data.items():
            if key != "id":
                setattr(model, key, value)

        await self._session.flush()
        await self._session.refresh(model)
        return self._model_to_entity(model)

    async def archive(self, patient_id: UUID, reason: str) -> None:
        result = await self._session.execute(
            select(PatientModel).where(PatientModel.id == patient_id)
        )
        model = result.scalar_one_or_none()
        if model is None:
            raise ValueError(f"Patient {patient_id} not found")

        model.status = "archived"
        model.archived_reason = reason
        model.archived_at = datetime.datetime.now(datetime.UTC)
        await self._session.flush()
