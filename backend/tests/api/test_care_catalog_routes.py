"""Tests API pour les routes du catalogue d'actes NGAP."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.care_type_catalog_model import CareTypeCatalogModel

pytestmark = pytest.mark.asyncio


async def _seed_system_acts(db_session: AsyncSession):
    """Insere quelques actes systeme pour les tests."""
    acts = [
        CareTypeCatalogModel(
            cabinet_id=None,
            code="AMI_4",
            lettre_cle="AMI",
            label="Acte medical infirmier coefficient 4",
            category="technique",
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
            unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            is_system=True,
            is_active=True,
            display_order=10,
        ),
        CareTypeCatalogModel(
            cabinet_id=None,
            code="BSA",
            lettre_cle="BSA",
            label="BSI - Soins legers (forfait A)",
            category="bsi_forfait",
            fixed_amount=Decimal("13.00"),
            unit="jour",
            effective_from=datetime.date(2024, 1, 28),
            is_system=True,
            is_active=True,
            display_order=30,
        ),
        CareTypeCatalogModel(
            cabinet_id=None,
            code="IFD",
            lettre_cle="IFD",
            label="Indemnite forfaitaire de deplacement",
            category="indemnite_deplacement",
            fixed_amount=Decimal("2.75"),
            unit="passage",
            effective_from=datetime.date(2024, 1, 28),
            is_system=True,
            is_active=True,
            display_order=50,
        ),
    ]
    for act in acts:
        db_session.add(act)
    await db_session.flush()


class TestListCatalog:
    async def test_list_all(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
        await _seed_system_acts(db_session)

        response = await client.get("/api/v1/care-catalog/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    async def test_filter_by_category(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
        await _seed_system_acts(db_session)

        response = await client.get(
            "/api/v1/care-catalog/",
            params={"category": "technique"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["code"] == "AMI_4"

    async def test_filter_by_lettre_cle(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
        await _seed_system_acts(db_session)

        response = await client.get(
            "/api/v1/care-catalog/",
            params={"lettre_cle": "BSA"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["code"] == "BSA"

    async def test_unauthenticated(self, client: AsyncClient):
        response = await client.get("/api/v1/care-catalog/")
        assert response.status_code == 401


class TestGetCatalogEntry:
    async def test_get_existing(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
        await _seed_system_acts(db_session)

        # First list to get an ID
        list_resp = await client.get("/api/v1/care-catalog/", headers=auth_headers)
        entry_id = list_resp.json()["items"][0]["id"]

        response = await client.get(f"/api/v1/care-catalog/{entry_id}", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["id"] == entry_id

    async def test_get_nonexistent(self, client: AsyncClient, auth_headers: dict):
        response = await client.get(f"/api/v1/care-catalog/{uuid4()}", headers=auth_headers)
        assert response.status_code == 404


class TestCreateCustomAct:
    async def test_create_success(self, client: AsyncClient, auth_headers: dict):
        body = {
            "code": "CUSTOM_1",
            "lettre_cle": "AMI",
            "label": "Mon acte personnalise",
            "category": "technique",
            "unit": "acte",
            "base_rate": "5.00",
            "coefficient": "1",
        }
        response = await client.post("/api/v1/care-catalog/", json=body, headers=auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["code"] == "CUSTOM_1"
        assert data["is_system"] is False
        assert data["cabinet_id"] is not None

    async def test_create_duplicate_code(self, client: AsyncClient, auth_headers: dict):
        body = {
            "code": "DUP_1",
            "lettre_cle": "AMI",
            "label": "Premier acte",
            "category": "technique",
            "unit": "acte",
            "base_rate": "5.00",
            "coefficient": "1",
        }
        response1 = await client.post("/api/v1/care-catalog/", json=body, headers=auth_headers)
        assert response1.status_code == 201

        response2 = await client.post("/api/v1/care-catalog/", json=body, headers=auth_headers)
        assert response2.status_code == 409


class TestToggleAct:
    async def test_toggle_deactivate(self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession):
        await _seed_system_acts(db_session)

        list_resp = await client.get("/api/v1/care-catalog/", headers=auth_headers)
        entry_id = list_resp.json()["items"][0]["id"]

        response = await client.patch(
            f"/api/v1/care-catalog/{entry_id}/toggle",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

    async def test_toggle_nonexistent(self, client: AsyncClient, auth_headers: dict):
        response = await client.patch(
            f"/api/v1/care-catalog/{uuid4()}/toggle",
            json={"is_active": False},
            headers=auth_headers,
        )
        assert response.status_code == 404
