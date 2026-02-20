"""Tests API pour les routes patients."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


class TestCreatePatient:
    async def test_create_patient_success(
        self, client: AsyncClient, auth_headers: dict
    ):
        data = {
            "first_name": "Marie",
            "last_name": "Dupont",
            "birth_date": "1955-03-15",
            "address": "12 rue de la Paix, 44000 Nantes",
            "phone": "0602030405",
        }
        response = await client.post(
            "/api/v1/patients", json=data, headers=auth_headers
        )
        assert response.status_code == 201
        body = response.json()
        assert body["first_name"] == "Marie"
        assert body["last_name"] == "Dupont"
        assert body["status"] == "active"
        assert "id" in body

    async def test_create_patient_minimal(
        self, client: AsyncClient, auth_headers: dict
    ):
        data = {"first_name": "Jean", "last_name": "Martin"}
        response = await client.post(
            "/api/v1/patients", json=data, headers=auth_headers
        )
        assert response.status_code == 201

    async def test_create_patient_unauthenticated(self, client: AsyncClient):
        data = {"first_name": "Jean", "last_name": "Martin"}
        response = await client.post("/api/v1/patients", json=data)
        assert response.status_code == 401


class TestListPatients:
    async def test_list_empty(self, client: AsyncClient, auth_headers: dict):
        response = await client.get("/api/v1/patients", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["items"] == []
        assert body["total"] == 0

    async def test_list_after_create(self, client: AsyncClient, auth_headers: dict):
        # Crée 2 patients
        await client.post(
            "/api/v1/patients",
            json={"first_name": "A", "last_name": "Patient"},
            headers=auth_headers,
        )
        await client.post(
            "/api/v1/patients",
            json={"first_name": "B", "last_name": "Patient"},
            headers=auth_headers,
        )

        response = await client.get("/api/v1/patients", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["total"] == 2
        assert len(body["items"]) == 2

    async def test_list_pagination(self, client: AsyncClient, auth_headers: dict):
        for i in range(5):
            await client.post(
                "/api/v1/patients",
                json={"first_name": f"Patient{i}", "last_name": "Test"},
                headers=auth_headers,
            )
        response = await client.get(
            "/api/v1/patients?skip=0&limit=2", headers=auth_headers
        )
        body = response.json()
        assert len(body["items"]) == 2
        assert body["total"] == 5


class TestGetPatient:
    async def test_get_by_id(self, client: AsyncClient, auth_headers: dict):
        create = await client.post(
            "/api/v1/patients",
            json={"first_name": "Marie", "last_name": "Dupont"},
            headers=auth_headers,
        )
        patient_id = create.json()["id"]

        response = await client.get(
            f"/api/v1/patients/{patient_id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["first_name"] == "Marie"

    async def test_get_nonexistent(self, client: AsyncClient, auth_headers: dict):
        fake_id = str(uuid4())
        response = await client.get(
            f"/api/v1/patients/{fake_id}", headers=auth_headers
        )
        assert response.status_code == 404


class TestUpdatePatient:
    async def test_update_partial(self, client: AsyncClient, auth_headers: dict):
        create = await client.post(
            "/api/v1/patients",
            json={"first_name": "Marie", "last_name": "Dupont", "phone": "0601"},
            headers=auth_headers,
        )
        patient_id = create.json()["id"]

        response = await client.patch(
            f"/api/v1/patients/{patient_id}",
            json={"phone": "0602030405"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["phone"] == "0602030405"
        assert response.json()["first_name"] == "Marie"  # Inchangé


class TestArchivePatient:
    async def test_archive(self, client: AsyncClient, auth_headers: dict):
        create = await client.post(
            "/api/v1/patients",
            json={"first_name": "Marie", "last_name": "Dupont"},
            headers=auth_headers,
        )
        patient_id = create.json()["id"]

        response = await client.delete(
            f"/api/v1/patients/{patient_id}?reason=demenagement",
            headers=auth_headers,
        )
        assert response.status_code == 204

        # Vérifier que le patient n'apparaît plus dans la liste active
        list_resp = await client.get("/api/v1/patients", headers=auth_headers)
        assert list_resp.json()["total"] == 0


class TestCabinetIsolation:
    async def test_user_cannot_see_other_cabinet_patients(
        self, client: AsyncClient
    ):
        """Deux utilisateurs de cabinets différents ne voient pas les mêmes patients."""
        # Utilisateur A
        reg_a = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "usera@example.fr",
                "password": "Pass1234!",
                "first_name": "A",
                "last_name": "User",
                "rpps": "10000000001",
            },
        )
        headers_a = {"Authorization": f"Bearer {reg_a.json()['access_token']}"}

        # Utilisateur B
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "userb@example.fr",
                "password": "Pass1234!",
                "first_name": "B",
                "last_name": "User",
                "rpps": "10000000002",
            },
        )
        headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

        # A crée un patient
        await client.post(
            "/api/v1/patients",
            json={"first_name": "PatientA", "last_name": "Secret"},
            headers=headers_a,
        )

        # B ne doit pas voir le patient de A
        list_b = await client.get("/api/v1/patients", headers=headers_b)
        assert list_b.json()["total"] == 0
