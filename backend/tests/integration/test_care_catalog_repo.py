"""Tests d'integration pour le repository CareTypeCatalog."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.infrastructure.persistence.models.cabinet_model import CabinetModel
from app.infrastructure.persistence.repositories.sqlalchemy_care_catalog_repo import (
    SQLAlchemyCareCatalogRepo,
)

pytestmark = pytest.mark.asyncio


async def _create_cabinet(session, cabinet_id=None):
    """Cree un cabinet de test."""
    cid = cabinet_id or uuid4()
    cabinet = CabinetModel(
        id=cid,
        name="Cabinet Test",
        address="1 rue de la Paix",
    )
    session.add(cabinet)
    await session.flush()
    return cid


def _make_system_act(**overrides) -> CareTypeCatalog:
    defaults = {
        "code": "AMI_4",
        "lettre_cle": "AMI",
        "label": "Acte medical infirmier coefficient 4",
        "category": "technique",
        "coefficient": Decimal("4"),
        "base_rate": Decimal("3.15"),
        "unit": "acte",
        "effective_from": datetime.date(2024, 1, 28),
        "is_system": True,
        "is_active": True,
        "cabinet_id": None,
    }
    defaults.update(overrides)
    return CareTypeCatalog(**defaults)


class TestCareCatalogRepoCreate:
    async def test_create_system_act(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        act = _make_system_act()
        created = await repo.create(act)
        assert created.id == act.id
        assert created.code == "AMI_4"
        assert created.cabinet_id is None
        assert created.is_system is True

    async def test_create_custom_act(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyCareCatalogRepo(session)
        act = _make_system_act(
            code="CUSTOM_1",
            cabinet_id=cabinet_id,
            is_system=False,
            label="Acte personnalise",
        )
        created = await repo.create(act)
        assert created.cabinet_id == cabinet_id
        assert created.is_system is False


class TestCareCatalogRepoGetById:
    async def test_get_existing(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        act = _make_system_act()
        await repo.create(act)

        found = await repo.get_by_id(act.id)
        assert found is not None
        assert found.code == "AMI_4"
        assert found.base_rate == Decimal("3.15")

    async def test_get_nonexistent(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        found = await repo.get_by_id(uuid4())
        assert found is None


class TestCareCatalogRepoGetByCode:
    async def test_get_system_act_by_code(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        act = _make_system_act()
        await repo.create(act)

        found = await repo.get_by_code("AMI_4")
        assert found is not None
        assert found.code == "AMI_4"

    async def test_returns_none_for_unknown_code(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        found = await repo.get_by_code("NONEXISTENT")
        assert found is None

    async def test_filters_by_effective_date(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)

        # Acte pas encore en vigueur
        future_act = _make_system_act(
            effective_from=datetime.date(2099, 1, 1),
        )
        await repo.create(future_act)

        found = await repo.get_by_code("AMI_4", at_date=datetime.date(2025, 6, 1))
        assert found is None


class TestCareCatalogRepoListActive:
    async def test_list_active_system_acts(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyCareCatalogRepo(session)

        await repo.create(_make_system_act(code="AMI_1", coefficient=Decimal("1")))
        await repo.create(_make_system_act(code="AMI_2", coefficient=Decimal("2")))
        await repo.create(_make_system_act(code="BSA", lettre_cle="BSA", category="bsi_forfait", fixed_amount=Decimal("13.00"), coefficient=None, base_rate=None))

        items = await repo.list_active(cabinet_id)
        assert len(items) == 3

    async def test_filter_by_category(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyCareCatalogRepo(session)

        await repo.create(_make_system_act(code="AMI_1", coefficient=Decimal("1")))
        await repo.create(_make_system_act(code="BSA", lettre_cle="BSA", category="bsi_forfait", fixed_amount=Decimal("13.00"), coefficient=None, base_rate=None))

        items = await repo.list_active(cabinet_id, category="technique")
        assert len(items) == 1
        assert items[0].code == "AMI_1"

    async def test_filter_by_lettre_cle(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyCareCatalogRepo(session)

        await repo.create(_make_system_act(code="AMI_1", coefficient=Decimal("1")))
        await repo.create(_make_system_act(code="AMI_2", coefficient=Decimal("2")))
        await repo.create(_make_system_act(code="AMX_1", lettre_cle="AMX", category="technique_bsi", coefficient=Decimal("1")))

        items = await repo.list_active(cabinet_id, lettre_cle="AMI")
        assert len(items) == 2
        for item in items:
            assert item.lettre_cle == "AMI"

    async def test_excludes_inactive(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyCareCatalogRepo(session)

        await repo.create(_make_system_act(code="AMI_1", coefficient=Decimal("1")))
        await repo.create(_make_system_act(code="AMI_2", coefficient=Decimal("2"), is_active=False))

        items = await repo.list_active(cabinet_id)
        assert len(items) == 1
        assert items[0].code == "AMI_1"

    async def test_excludes_expired(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyCareCatalogRepo(session)

        await repo.create(_make_system_act(code="AMI_1", coefficient=Decimal("1")))
        await repo.create(_make_system_act(
            code="AMI_OLD",
            coefficient=Decimal("4"),
            effective_from=datetime.date(2020, 1, 1),
            effective_to=datetime.date(2020, 12, 31),
        ))

        items = await repo.list_active(cabinet_id)
        assert len(items) == 1
        assert items[0].code == "AMI_1"


class TestCareCatalogRepoToggle:
    async def test_toggle_deactivate(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        act = _make_system_act()
        await repo.create(act)

        toggled = await repo.toggle_active(act.id, False)
        assert toggled.is_active is False

    async def test_toggle_reactivate(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        act = _make_system_act(is_active=False)
        await repo.create(act)

        toggled = await repo.toggle_active(act.id, True)
        assert toggled.is_active is True

    async def test_toggle_nonexistent(self, session):
        repo = SQLAlchemyCareCatalogRepo(session)
        with pytest.raises(ValueError):
            await repo.toggle_active(uuid4(), True)
