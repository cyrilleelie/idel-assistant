"""Tests API pour les routes rendez-vous."""

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


async def _create_appointment(
    client: AsyncClient,
    headers: dict,
    patient_id: str,
    scheduled_at: str | None = None,
) -> dict:
    """Helper : crée un rendez-vous et retourne le body."""
    if scheduled_at is None:
        dt = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)
        scheduled_at = dt.isoformat()
    data = {
        "patient_id": patient_id,
        "scheduled_at": scheduled_at,
        "duration_minutes": 30,
        "care_type": "injection",
    }
    resp = await client.post(
        "/api/v1/appointments", json=data, headers=headers
    )
    assert resp.status_code == 201
    return resp.json()


class TestCreateAppointment:
    async def test_create_success(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        body = await _create_appointment(client, auth_headers, patient_id)
        assert body["patient_id"] == patient_id
        assert body["status"] == "scheduled"
        assert body["care_type"] == "injection"
        assert body["duration_minutes"] == 30

    async def test_create_unauthenticated(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/appointments",
            json={
                "patient_id": str(uuid4()),
                "scheduled_at": datetime.datetime.now(datetime.UTC).isoformat(),
                "duration_minutes": 30,
                "care_type": "injection",
            },
        )
        assert resp.status_code == 401

    async def test_create_patient_not_found(self, client: AsyncClient, auth_headers: dict):
        resp = await client.post(
            "/api/v1/appointments",
            json={
                "patient_id": str(uuid4()),
                "scheduled_at": (
                    datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=1)
                ).isoformat(),
                "duration_minutes": 30,
                "care_type": "injection",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 404

    async def test_create_time_conflict(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        dt = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=2)
        scheduled_at = dt.isoformat()

        await _create_appointment(client, auth_headers, patient_id, scheduled_at)
        # Même créneau → conflit
        resp = await client.post(
            "/api/v1/appointments",
            json={
                "patient_id": patient_id,
                "scheduled_at": scheduled_at,
                "duration_minutes": 30,
                "care_type": "pansement",
            },
            headers=auth_headers,
        )
        assert resp.status_code == 409


class TestListAppointments:
    async def test_list_empty(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get("/api/v1/appointments", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["items"] == []
        assert body["total"] == 0

    async def test_list_after_create(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        await _create_appointment(client, auth_headers, patient_id)

        resp = await client.get("/api/v1/appointments", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] == 1


class TestGetAppointment:
    async def test_get_by_id(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        appt = await _create_appointment(client, auth_headers, patient_id)

        resp = await client.get(
            f"/api/v1/appointments/{appt['id']}", headers=auth_headers
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == appt["id"]

    async def test_get_nonexistent(self, client: AsyncClient, auth_headers: dict):
        resp = await client.get(
            f"/api/v1/appointments/{uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 404


class TestUpdateAppointment:
    async def test_update_care_type(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        appt = await _create_appointment(client, auth_headers, patient_id)

        resp = await client.patch(
            f"/api/v1/appointments/{appt['id']}",
            json={"care_type": "pansement"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["care_type"] == "pansement"


class TestCancelAppointment:
    async def test_cancel_success(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        appt = await _create_appointment(client, auth_headers, patient_id)

        resp = await client.post(
            f"/api/v1/appointments/{appt['id']}/cancel",
            json={"reason": "Patient absent"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "canceled"
        assert body["cancellation_reason"] == "Patient absent"

    async def test_cancel_already_canceled(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        appt = await _create_appointment(client, auth_headers, patient_id)

        # Première annulation
        await client.post(
            f"/api/v1/appointments/{appt['id']}/cancel",
            json={"reason": "Raison 1"},
            headers=auth_headers,
        )
        # Deuxième annulation → conflit
        resp = await client.post(
            f"/api/v1/appointments/{appt['id']}/cancel",
            json={"reason": "Raison 2"},
            headers=auth_headers,
        )
        assert resp.status_code == 409


class TestCompleteAppointment:
    async def test_complete_success(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        appt = await _create_appointment(client, auth_headers, patient_id)

        resp = await client.post(
            f"/api/v1/appointments/{appt['id']}/complete",
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    async def test_complete_already_completed(self, client: AsyncClient, auth_headers: dict):
        patient_id = await _create_patient(client, auth_headers)
        appt = await _create_appointment(client, auth_headers, patient_id)

        await client.post(
            f"/api/v1/appointments/{appt['id']}/complete",
            headers=auth_headers,
        )
        # Deuxième complétion → conflit
        resp = await client.post(
            f"/api/v1/appointments/{appt['id']}/complete",
            headers=auth_headers,
        )
        assert resp.status_code == 409
