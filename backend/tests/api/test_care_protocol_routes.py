"""Tests API pour les routes protocoles de soins."""

import datetime
from uuid import uuid4

import pytest
from httpx import AsyncClient


async def _create_patient(client: AsyncClient, headers: dict) -> str:
    """Helper : crée un patient et retourne son ID."""
    resp = await client.post(
        "/api/v1/patients",
        json={"first_name": "Marie", "last_name": "Dupont"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestCreateCareProtocol:
    async def test_create_success(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        data = {
            "patient_id": patient_id,
            "care_type": "injection",
            "duration_minutes": 20,
            "recurrence_rule": "FREQ=DAILY;COUNT=10",
            "start_date": str(datetime.date.today()),
        }
        resp = await client.post(
            "/api/v1/care-protocols", json=data, headers=auth_headers
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["care_type"] == "injection"
        assert body["patient_id"] == patient_id
        assert body["status"] == "active"

    async def test_create_unauthenticated(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/care-protocols",
            json={
                "patient_id": str(uuid4()),
                "care_type": "injection",
                "duration_minutes": 20,
                "recurrence_rule": "FREQ=DAILY;COUNT=10",
                "start_date": str(datetime.date.today()),
            },
        )
        assert resp.status_code == 401

    async def test_create_patient_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/care-protocols",
            json={
                "patient_id": str(uuid4()),
                "care_type": "injection",
                "duration_minutes": 20,
                "recurrence_rule": "FREQ=DAILY;COUNT=10",
                "start_date": str(datetime.date.today()),
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_create_invalid_rrule(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        resp = await client.post(
            "/api/v1/care-protocols",
            json={
                "patient_id": patient_id,
                "care_type": "injection",
                "duration_minutes": 20,
                "recurrence_rule": "NOT_A_VALID_RULE",
                "start_date": str(datetime.date.today()),
            },
            headers=auth_headers,
        )
        assert resp.status_code == 422


class TestListCareProtocols:
    async def test_list_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/care-protocols", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["items"] == []
        assert body["total"] == 0

    async def test_list_after_create(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        await client.post(
            "/api/v1/care-protocols",
            json={
                "patient_id": patient_id,
                "care_type": "pansement",
                "duration_minutes": 15,
                "recurrence_rule": "FREQ=DAILY;COUNT=5",
                "start_date": str(datetime.date.today()),
            },
            headers=auth_headers,
        )

        resp = await client.get("/api/v1/care-protocols", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    async def test_list_filter_by_patient(self, client: AsyncClient, auth_headers: dict):
        p1 = await _create_patient(client, auth_headers)
        # Crée un second patient
        resp2 = await client.post(
            "/api/v1/patients",
            json={"first_name": "Jean", "last_name": "Martin"},
            headers=auth_headers,
        )
        p2 = resp2.json()["id"]

        # Protocole pour p1
        await client.post(
            "/api/v1/care-protocols",
            json={
                "patient_id": p1,
                "care_type": "injection",
                "duration_minutes": 20,
                "recurrence_rule": "FREQ=DAILY;COUNT=5",
                "start_date": str(datetime.date.today()),
            },
            headers=auth_headers,
        )

        # Filtre sur p2 → 0 résultat
        resp = await client.get(
            f"/api/v1/care-protocols?patient_id={p2}", headers=auth_headers
        )
        assert resp.json()["total"] == 0

        # Filtre sur p1 → 1 résultat
        resp = await client.get(
            f"/api/v1/care-protocols?patient_id={p1}", headers=auth_headers
        )
        assert resp.json()["total"] == 1
