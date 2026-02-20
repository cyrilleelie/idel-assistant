"""Tests d'integration pour SQLAlchemyPatientRepo."""

from uuid import uuid4

import pytest

from app.domain.entities.patient import Patient
from app.infrastructure.persistence.models.cabinet_model import CabinetModel
from app.infrastructure.persistence.repositories.sqlalchemy_patient_repo import (
    SQLAlchemyPatientRepo,
)


@pytest.fixture
async def cabinet_in_db(session, cabinet_id):
    """Insere un cabinet de test dans la BDD."""
    cabinet = CabinetModel(
        id=cabinet_id,
        name="Cabinet Test",
        address="1 rue du Test",
    )
    session.add(cabinet)
    await session.flush()
    return cabinet


@pytest.fixture
def patient_repo(session, key_manager):
    """Repo patient instancie avec session et key_manager de test."""
    return SQLAlchemyPatientRepo(session, key_manager)


def _make_patient(cabinet_id, **kwargs):
    """Helper pour creer une entite Patient de test."""
    defaults = {
        "id": uuid4(),
        "cabinet_id": cabinet_id,
        "first_name": "Marie",
        "last_name": "Dupont",
        "birth_date": None,
        "phone": "0612345678",
        "email": "marie@example.com",
        "address": "10 rue de la Paix, 75001 Paris",
        "lat": 48.8566,
        "lon": 2.3522,
        "pathologies": ["diabete"],
        "preferred_time_slot": "morning",
        "care_duration_default": 30,
        "notes": "Patiente reguliere",
        "status": "active",
    }
    defaults.update(kwargs)
    return Patient(**defaults)


class TestCreateAndGetById:
    async def test_create_and_retrieve(self, cabinet_in_db, patient_repo, cabinet_id):
        patient = _make_patient(cabinet_id)
        created = await patient_repo.create(patient)

        assert created.id == patient.id
        assert created.first_name == "Marie"
        assert created.last_name == "Dupont"

        # Recupere et verifie le dechiffrement
        retrieved = await patient_repo.get_by_id(patient.id)
        assert retrieved is not None
        assert retrieved.first_name == "Marie"
        assert retrieved.last_name == "Dupont"
        assert retrieved.phone == "0612345678"
        assert retrieved.email == "marie@example.com"
        assert retrieved.address == "10 rue de la Paix, 75001 Paris"
        assert retrieved.pathologies == ["diabete"]
        assert retrieved.notes == "Patiente reguliere"

    async def test_get_nonexistent_returns_none(self, cabinet_in_db, patient_repo):
        result = await patient_repo.get_by_id(uuid4())
        assert result is None


class TestListByCabinet:
    async def test_list_and_search(self, cabinet_in_db, patient_repo, cabinet_id):
        p1 = _make_patient(cabinet_id, first_name="Alice", last_name="Martin")
        p2 = _make_patient(cabinet_id, first_name="Bob", last_name="Martin")
        p3 = _make_patient(cabinet_id, first_name="Claire", last_name="Durand")
        await patient_repo.create(p1)
        await patient_repo.create(p2)
        await patient_repo.create(p3)

        # Liste tous
        patients, total = await patient_repo.list_by_cabinet(cabinet_id)
        assert total == 3
        assert len(patients) == 3

        # Recherche par nom (case-insensitive)
        patients, total = await patient_repo.list_by_cabinet(cabinet_id, search="martin")
        assert total == 2

    async def test_pagination(self, cabinet_in_db, patient_repo, cabinet_id):
        for i in range(5):
            p = _make_patient(cabinet_id, first_name=f"Patient{i}", last_name="Test")
            await patient_repo.create(p)

        patients, total = await patient_repo.list_by_cabinet(cabinet_id, skip=0, limit=2)
        assert total == 5
        assert len(patients) == 2

        patients, total = await patient_repo.list_by_cabinet(cabinet_id, skip=3, limit=10)
        assert total == 5
        assert len(patients) == 2


class TestArchive:
    async def test_archive_patient(self, cabinet_in_db, patient_repo, cabinet_id):
        patient = _make_patient(cabinet_id)
        await patient_repo.create(patient)

        await patient_repo.archive(patient.id, "demenagement")

        archived = await patient_repo.get_by_id(patient.id)
        assert archived is not None
        assert archived.status == "archived"
        assert archived.archived_reason == "demenagement"
        assert archived.archived_at is not None

    async def test_archive_excludes_from_active_list(self, cabinet_in_db, patient_repo, cabinet_id):
        p1 = _make_patient(cabinet_id, first_name="Active", last_name="Patient")
        p2 = _make_patient(cabinet_id, first_name="Archived", last_name="Patient")
        await patient_repo.create(p1)
        await patient_repo.create(p2)
        await patient_repo.archive(p2.id, "parti")

        patients, total = await patient_repo.list_by_cabinet(cabinet_id, status="active")
        assert total == 1
        assert patients[0].first_name == "Active"


class TestUpdate:
    async def test_update_patient(self, cabinet_in_db, patient_repo, cabinet_id):
        patient = _make_patient(cabinet_id)
        created = await patient_repo.create(patient)

        # Modifie le patient
        updated_patient = Patient(
            id=created.id,
            cabinet_id=cabinet_id,
            first_name="Marie-Claire",
            last_name="Dupont-Martin",
            phone="0698765432",
            email="marie-claire@example.com",
            address="20 avenue des Champs",
            lat=48.87,
            lon=2.30,
            pathologies=["diabete", "hypertension"],
            preferred_time_slot="afternoon",
            care_duration_default=45,
            notes="Mise a jour",
            status="active",
        )
        result = await patient_repo.update(updated_patient)

        assert result.first_name == "Marie-Claire"
        assert result.last_name == "Dupont-Martin"
        assert result.phone == "0698765432"
        assert result.pathologies == ["diabete", "hypertension"]
