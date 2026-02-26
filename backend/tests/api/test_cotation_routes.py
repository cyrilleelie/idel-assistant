"""Tests API pour les routes de cotation automatique NGAP."""

import datetime
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.care_type_catalog_model import CareTypeCatalogModel
from app.infrastructure.persistence.models.patient_model import PatientModel

pytestmark = pytest.mark.asyncio


async def _seed_catalog(db_session: AsyncSession):
    """Insere les actes NGAP necessaires pour les tests de cotation."""
    effective = datetime.date(2024, 1, 28)
    acts = [
        # AMI
        CareTypeCatalogModel(
            cabinet_id=None, code="AMI_4", lettre_cle="AMI",
            label="Acte medical infirmier coefficient 4",
            category="technique", coefficient=Decimal("4"),
            base_rate=Decimal("3.15"), unit="acte",
            effective_from=effective, is_system=True, is_active=True, display_order=10,
        ),
        CareTypeCatalogModel(
            cabinet_id=None, code="AMI_1.5", lettre_cle="AMI",
            label="Pansement simple",
            category="technique", coefficient=Decimal("1.5"),
            base_rate=Decimal("3.15"), unit="acte",
            effective_from=effective, is_system=True, is_active=True, display_order=11,
        ),
        CareTypeCatalogModel(
            cabinet_id=None, code="AMI_1", lettre_cle="AMI",
            label="Injection simple",
            category="technique", coefficient=Decimal("1"),
            base_rate=Decimal("3.15"), unit="acte",
            effective_from=effective, is_system=True, is_active=True, display_order=12,
        ),
        # AMX (BSI equivalents)
        CareTypeCatalogModel(
            cabinet_id=None, code="AMX_1.5", lettre_cle="AMX",
            label="Pansement simple (BSI)",
            category="technique_bsi", coefficient=Decimal("1.5"),
            base_rate=Decimal("3.15"), unit="acte",
            effective_from=effective, is_system=True, is_active=True, display_order=20,
        ),
        # BSI forfaits
        CareTypeCatalogModel(
            cabinet_id=None, code="BSA", lettre_cle="BSA",
            label="BSI soins legers (forfait A)",
            category="bsi_forfait", fixed_amount=Decimal("13.00"),
            unit="jour", effective_from=effective, is_system=True,
            is_active=True, display_order=30,
        ),
        CareTypeCatalogModel(
            cabinet_id=None, code="BSB", lettre_cle="BSB",
            label="BSI soins intermediaires (forfait B)",
            category="bsi_forfait", fixed_amount=Decimal("18.20"),
            unit="jour", effective_from=effective, is_system=True,
            is_active=True, display_order=31,
        ),
    ]
    for act in acts:
        db_session.add(act)
    await db_session.flush()


async def _create_patient(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    *,
    is_ald: bool = False,
    has_active_bsi: bool = False,
    bsi_level: str | None = None,
    birth_date: str | None = None,
) -> str:
    """Cree un patient de test et retourne son ID."""
    body = {
        "first_name": "Jean",
        "last_name": "Dupont",
        "phone": "0612345678",
        "address": "10 rue des Lilas",
        "postal_code": "75001",
        "city": "Paris",
    }
    if birth_date:
        body["birth_date"] = birth_date
    resp = await client.post("/api/v1/patients/", json=body, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    patient_id = resp.json()["id"]

    # Update billing fields directly in DB (not exposed via API yet)
    if is_ald or has_active_bsi:
        from uuid import UUID
        stmt = update(PatientModel).where(
            PatientModel.id == UUID(patient_id)
        ).values(
            is_ald=is_ald,
            has_active_bsi=has_active_bsi,
            bsi_level=bsi_level,
        )
        await db_session.execute(stmt)
        await db_session.flush()

    return patient_id


def _get_idel_id(auth_headers: dict) -> str:
    """Extrait l'idel_id du JWT (user_id = idel_id dans notre cas)."""
    import base64
    import json
    token = auth_headers["Authorization"].split(" ")[1]
    payload = json.loads(base64.b64decode(token.split(".")[1] + "=="))
    return payload["sub"]


class TestSimulateCotation:
    async def test_simulate_standard_patient(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Simulation basique : AMI_4, domicile, lundi 9h."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers, db_session)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/simulate",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "5",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()

        # Verify structure
        assert "lignes" in data
        assert "total" in data
        assert "repartition_amo" in data
        assert "repartition_amc" in data
        assert "auto_corrections" in data
        assert "explications" in data

        # Verify acte present
        codes = [l["code"] for l in data["lignes"]]
        assert "AMI_4" in codes
        assert "IFD" in codes
        assert "MCI" in codes
        assert "MAU" in codes

        # Verify total > 0
        assert Decimal(data["total"]) > 0

    async def test_simulate_patient_not_found(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Patient inexistant retourne 404."""
        await _seed_catalog(db_session)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/simulate",
            json={
                "patient_id": "00000000-0000-0000-0000-000000000000",
                "idel_id": idel_id,
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "5",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_simulate_bsi_patient(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Patient BSI : AMI_1.5 -> AMX_1.5, IFI au lieu de IFD."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(
            client, auth_headers, db_session,
            has_active_bsi=True, bsi_level="BSB",
        )
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/simulate",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "actes": ["AMI_1.5"],
                "date_heure_soin": "2026-03-16T10:00:00",
                "distance_km": "6",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()

        codes = [l["code"] for l in data["lignes"]]
        assert "AMX_1.5" in codes  # AMI -> AMX
        assert "AMI_1.5" not in codes
        assert "BSB" in codes  # Forfait BSI
        assert "IFI" in codes  # IFI au lieu de IFD
        assert "IFD" not in codes

        # Auto corrections
        assert any("AMI_1.5" in c and "AMX_1.5" in c for c in data["auto_corrections"])

    async def test_simulate_cabinet(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Soin au cabinet : pas d'IFD ni d'IK."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers, db_session)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/simulate",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "actes": ["AMI_1"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "0",
                "lieu": "cabinet",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        codes = [l["code"] for l in data["lignes"]]
        assert "IFD" not in codes
        assert "IK" not in codes

    async def test_simulate_dimanche(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Dimanche : majoration MAJ_DIM presente."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers, db_session)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/simulate",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "actes": ["AMI_1"],
                # 15 mars 2026 = dimanche
                "date_heure_soin": "2026-03-15T09:00:00",
                "distance_km": "0",
                "lieu": "cabinet",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        codes = [l["code"] for l in resp.json()["lignes"]]
        assert "MAJ_DIM" in codes

    async def test_simulate_ald_full_amo(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Patient ALD : repartition 100% AMO."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers, db_session, is_ald=True)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/simulate",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "0",
                "lieu": "cabinet",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert Decimal(data["repartition_amo"]) == Decimal(data["total"])
        assert Decimal(data["repartition_amc"]) == Decimal("0.00")


class TestCreateInvoiceFromCotation:
    async def test_create_invoice_from_cotation(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Cree une facture brouillon a partir de la cotation."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers, db_session)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/create-invoice",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "5",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        data = resp.json()

        # Facture creee en brouillon
        assert data["status"] == "draft"
        assert len(data["lines"]) > 0
        assert Decimal(data["total_amount"]) > 0

        # Ligne AMI_4 presente
        act_codes = [l["act_code"] for l in data["lines"]]
        assert "AMI_4" in act_codes

        # Metadata contient les infos de cotation auto
        assert data["metadata"] is not None
        assert data["metadata"].get("auto_cotation") is True

    async def test_create_invoice_patient_not_found(
        self, client: AsyncClient, auth_headers: dict, db_session: AsyncSession,
    ):
        """Patient inexistant retourne 404."""
        await _seed_catalog(db_session)
        idel_id = _get_idel_id(auth_headers)

        resp = await client.post(
            "/api/v1/cotation/create-invoice",
            json={
                "patient_id": "00000000-0000-0000-0000-000000000000",
                "idel_id": idel_id,
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "5",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_create_invoice_no_auth(self, client: AsyncClient):
        """Sans authentification retourne 401."""
        resp = await client.post(
            "/api/v1/cotation/create-invoice",
            json={
                "patient_id": "00000000-0000-0000-0000-000000000000",
                "idel_id": "00000000-0000-0000-0000-000000000001",
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "5",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
        )
        assert resp.status_code == 401
