"""Tests API pour les routes d'authentification."""

from uuid import uuid4

import pytest
from httpx import AsyncClient


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        data = {
            "email": "new@example.fr",
            "password": "SecurePass1!",
            "first_name": "Marie",
            "last_name": "Dupont",
            "rpps": "12345678901",
            "phone": "0601020304",
        }
        response = await client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 201
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    async def test_register_duplicate_email(self, client: AsyncClient):
        data = {
            "email": "dup@example.fr",
            "password": "SecurePass1!",
            "first_name": "Marie",
            "last_name": "Dupont",
            "rpps": "12345678901",
        }
        await client.post("/api/v1/auth/register", json=data)
        # Deuxième inscription avec même email
        data["rpps"] = "12345678902"
        response = await client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 409

    async def test_register_duplicate_rpps(self, client: AsyncClient):
        data = {
            "email": "a@example.fr",
            "password": "SecurePass1!",
            "first_name": "Marie",
            "last_name": "Dupont",
            "rpps": "99999999999",
        }
        await client.post("/api/v1/auth/register", json=data)
        data["email"] = "b@example.fr"
        response = await client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 409

    async def test_register_invalid_rpps(self, client: AsyncClient):
        data = {
            "email": "test@example.fr",
            "password": "SecurePass1!",
            "first_name": "Marie",
            "last_name": "Dupont",
            "rpps": "123",  # Trop court
        }
        response = await client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 422

    async def test_register_weak_password(self, client: AsyncClient):
        data = {
            "email": "test@example.fr",
            "password": "short",  # Trop court
            "first_name": "Marie",
            "last_name": "Dupont",
            "rpps": "12345678901",
        }
        response = await client.post("/api/v1/auth/register", json=data)
        assert response.status_code == 422


class TestLogin:
    async def test_login_success(self, client: AsyncClient):
        # Register d'abord
        data = {
            "email": "login@example.fr",
            "password": "SecurePass1!",
            "first_name": "Sophie",
            "last_name": "Martin",
            "rpps": "11111111111",
        }
        await client.post("/api/v1/auth/register", json=data)

        # Login
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "login@example.fr", "password": "SecurePass1!"},
        )
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_login_wrong_password(self, client: AsyncClient):
        data = {
            "email": "wrong@example.fr",
            "password": "SecurePass1!",
            "first_name": "Sophie",
            "last_name": "Martin",
            "rpps": "22222222222",
        }
        await client.post("/api/v1/auth/register", json=data)

        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "wrong@example.fr", "password": "WrongPass!"},
        )
        assert response.status_code == 401

    async def test_login_nonexistent_email(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.fr", "password": "Whatever1!"},
        )
        assert response.status_code == 401
        # Message générique (pas "email inconnu")
        assert "incorrect" in response.json()["detail"].lower()


class TestRefresh:
    async def test_refresh_success(self, client: AsyncClient):
        data = {
            "email": "refresh@example.fr",
            "password": "SecurePass1!",
            "first_name": "Sophie",
            "last_name": "Martin",
            "rpps": "33333333333",
        }
        reg = await client.post("/api/v1/auth/register", json=data)
        refresh_token = reg.json()["refresh_token"]

        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert response.status_code == 200
        body = response.json()
        assert "access_token" in body
        assert "refresh_token" in body

    async def test_refresh_invalid_token(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert response.status_code == 401
