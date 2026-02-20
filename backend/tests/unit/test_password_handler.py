"""Tests unitaires pour le password handler."""

from app.infrastructure.security.password_handler import hash_password, verify_password


class TestPasswordHandler:
    def test_hash_and_verify(self):
        hashed = hash_password("MyP@ssw0rd!")
        assert verify_password("MyP@ssw0rd!", hashed)

    def test_wrong_password_fails(self):
        hashed = hash_password("correct")
        assert not verify_password("wrong", hashed)

    def test_different_hashes_for_same_password(self):
        h1 = hash_password("same")
        h2 = hash_password("same")
        assert h1 != h2  # Different salts

    def test_hash_starts_with_bcrypt_prefix(self):
        hashed = hash_password("test")
        assert hashed.startswith("$2b$")
