"""Tests API pour les routes de facturation."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.care_type_catalog_model import CareTypeCatalogModel
from app.infrastructure.persistence.models.patient_model import PatientModel

pytestmark = pytest.mark.asyncio


async def _seed_catalog(db_session: AsyncSession):
    """Insere des actes systeme pour les tests."""
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
        CareTypeCatalogModel(
            cabinet_id=None,
            code="IK",
            lettre_cle="IK",
            label="Indemnite kilometrique",
            category="indemnite_km",
            fixed_amount=Decimal("0.50"),
            unit="km",
            effective_from=datetime.date(2024, 1, 28),
            is_system=True,
            is_active=True,
            display_order=60,
        ),
    ]
    for act in acts:
        db_session.add(act)
    await db_session.flush()


async def _create_patient(client: AsyncClient, auth_headers: dict) -> str:
    """Cree un patient de test et retourne son ID."""
    body = {
        "first_name": "Jean",
        "last_name": "Dupont",
        "phone": "0612345678",
        "address": "10 rue des Lilas",
        "postal_code": "75001",
        "city": "Paris",
    }
    resp = await client.post("/api/v1/patients/", json=body, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _get_current_user_id(client: AsyncClient, auth_headers: dict) -> str:
    """Extrait l'user_id du JWT en listant le catalogue (le header auth donne le user_id)."""
    # On utilise /api/v1/auth/me si disponible, sinon on parse le token
    import base64
    import json
    token = auth_headers["Authorization"].split(" ")[1]
    # Decode JWT payload (sans verification)
    payload_b64 = token.split(".")[1]
    # Fix padding
    payload_b64 += "=" * (4 - len(payload_b64) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    return payload["sub"]


class TestInvoiceWorkflow:
    async def test_full_workflow_create_add_lines_validate(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        """Test workflow complet : create invoice -> add 3 lines -> validate -> verify totals."""
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        # 1. Create invoice
        create_resp = await client.post(
            "/api/v1/invoices/",
            json={
                "patient_id": patient_id,
                "idel_id": idel_id,
                "care_date": "2026-02-26",
                "tiers_payant_type": "total",
            },
            headers=auth_headers,
        )
        assert create_resp.status_code == 201, create_resp.text
        invoice = create_resp.json()
        invoice_id = invoice["id"]
        assert invoice["status"] == "draft"
        assert invoice["invoice_number"].startswith("2026-")

        # 2. Add line 1: AMI_4
        resp = await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "AMI_4", "quantity": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 201, resp.text
        invoice = resp.json()
        assert len(invoice["lines"]) == 1
        assert invoice["lines"][0]["act_code"] == "AMI_4"
        assert Decimal(invoice["lines"][0]["line_total"]) == Decimal("12.60")

        # 3. Add line 2: IFD
        resp = await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "IFD", "quantity": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        invoice = resp.json()
        assert len(invoice["lines"]) == 2

        # 4. Add line 3: IK (15 km)
        resp = await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "IK", "quantity": 15},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        invoice = resp.json()
        assert len(invoice["lines"]) == 3

        # Total should be: 12.60 + 2.75 + 7.50 = 22.85
        assert Decimal(invoice["total_amount"]) == Decimal("22.85")

        # 5. Validate
        resp = await client.post(
            f"/api/v1/invoices/{invoice_id}/validate",
            headers=auth_headers,
        )
        assert resp.status_code == 200, resp.text
        invoice = resp.json()
        assert invoice["status"] == "validated"
        assert invoice["validated_at"] is not None
        # 60/40 split (patient is not ALD)
        assert Decimal(invoice["total_amo"]) == Decimal("13.71")
        assert Decimal(invoice["total_amc"]) == Decimal("9.14")


class TestInvoiceFilters:
    async def test_list_by_status(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        # Create two invoices
        for _ in range(2):
            await client.post(
                "/api/v1/invoices/",
                json={
                    "patient_id": patient_id,
                    "idel_id": idel_id,
                    "care_date": "2026-02-26",
                },
                headers=auth_headers,
            )

        resp = await client.get(
            "/api/v1/invoices/",
            params={"status": "draft"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        for item in data["items"]:
            assert item["status"] == "draft"

    async def test_list_by_patient(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient1 = await _create_patient(client, auth_headers)
        patient2 = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient1, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient2, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/invoices/",
            params={"patient_id": patient1},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["patient_id"] == patient1

    async def test_list_by_date_range(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-01-15"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-02-15"},
            headers=auth_headers,
        )

        resp = await client.get(
            "/api/v1/invoices/",
            params={"date_from": "2026-02-01", "date_to": "2026-02-28"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


class TestInvoiceDeleteValidated:
    async def test_delete_validated_returns_409(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        # Create and add a line so we can validate
        resp = await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )
        invoice_id = resp.json()["id"]

        await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "AMI_4"},
            headers=auth_headers,
        )

        await client.post(f"/api/v1/invoices/{invoice_id}/validate", headers=auth_headers)

        # Try to delete
        resp = await client.delete(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
        assert resp.status_code == 409


class TestAddLineOnValidated:
    async def test_add_line_validated_returns_409(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        resp = await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )
        invoice_id = resp.json()["id"]

        await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "AMI_4"},
            headers=auth_headers,
        )

        await client.post(f"/api/v1/invoices/{invoice_id}/validate", headers=auth_headers)

        # Try to add another line
        resp = await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "IFD"},
            headers=auth_headers,
        )
        assert resp.status_code == 409


class TestCancelInvoice:
    async def test_cancel_draft(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        resp = await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )
        invoice_id = resp.json()["id"]

        resp = await client.post(f"/api/v1/invoices/{invoice_id}/cancel", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "canceled"

    async def test_cancel_validated(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        resp = await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )
        invoice_id = resp.json()["id"]

        await client.post(
            f"/api/v1/invoices/{invoice_id}/lines",
            json={"act_code": "AMI_4"},
            headers=auth_headers,
        )
        await client.post(f"/api/v1/invoices/{invoice_id}/validate", headers=auth_headers)

        resp = await client.post(f"/api/v1/invoices/{invoice_id}/cancel", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "canceled"


class TestValidationErrors:
    async def test_validate_empty_invoice_returns_422(
        self,
        client: AsyncClient,
        auth_headers: dict,
        db_session: AsyncSession,
    ):
        await _seed_catalog(db_session)
        patient_id = await _create_patient(client, auth_headers)
        idel_id = await _get_current_user_id(client, auth_headers)

        resp = await client.post(
            "/api/v1/invoices/",
            json={"patient_id": patient_id, "idel_id": idel_id, "care_date": "2026-02-26"},
            headers=auth_headers,
        )
        invoice_id = resp.json()["id"]

        resp = await client.post(f"/api/v1/invoices/{invoice_id}/validate", headers=auth_headers)
        assert resp.status_code == 422
        errors = resp.json()["detail"]
        assert isinstance(errors, list)
        assert any("aucune ligne" in e for e in errors)


class TestUnauthenticated:
    async def test_unauthenticated(self, client: AsyncClient):
        resp = await client.get("/api/v1/invoices/")
        assert resp.status_code == 401
