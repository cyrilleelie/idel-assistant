"""Tests unitaires pour le JWT handler."""

from uuid import uuid4

import pytest

from app.infrastructure.security.jwt_handler import (
    ALGORITHM,
    TokenError,
    create_access_token,
    create_refresh_token,
    verify_token,
)


class TestAccessToken:
    def test_roundtrip(self):
        uid, cid = uuid4(), uuid4()
        token = create_access_token(uid, cid, "titulaire")
        payload = verify_token(token)
        assert payload["sub"] == str(uid)
        assert payload["cabinet_id"] == str(cid)
        assert payload["role"] == "titulaire"
        assert payload["type"] == "access"

    def test_expired_token_raises(self):
        uid, cid = uuid4(), uuid4()
        token = create_access_token(uid, cid, "titulaire", expires_minutes=-1)
        with pytest.raises(TokenError):
            verify_token(token)


class TestRefreshToken:
    def test_roundtrip(self):
        uid = uuid4()
        token = create_refresh_token(uid)
        payload = verify_token(token)
        assert payload["sub"] == str(uid)
        assert payload["type"] == "refresh"
        assert "cabinet_id" not in payload

    def test_expired_refresh_raises(self):
        uid = uuid4()
        token = create_refresh_token(uid, expires_days=-1)
        with pytest.raises(TokenError):
            verify_token(token)


class TestVerifyToken:
    def test_invalid_token_raises(self):
        with pytest.raises(TokenError):
            verify_token("not.a.valid.token")

    def test_empty_token_raises(self):
        with pytest.raises(TokenError):
            verify_token("")

    def test_algorithm_is_hs256(self):
        assert ALGORITHM == "HS256"
