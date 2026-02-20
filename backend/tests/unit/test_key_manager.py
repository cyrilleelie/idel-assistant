"""Tests unitaires pour le KeyManager."""

from uuid import uuid4

from app.infrastructure.security.key_manager import KeyManager


class TestKeyManager:
    def test_different_cabinets_different_keys(self):
        km = KeyManager("master-secret")
        k1 = km.get_cabinet_key(uuid4())
        k2 = km.get_cabinet_key(uuid4())
        assert k1 != k2

    def test_same_cabinet_same_key(self):
        km = KeyManager("master-secret")
        cid = uuid4()
        assert km.get_cabinet_key(cid) == km.get_cabinet_key(cid)

    def test_key_is_32_bytes(self):
        km = KeyManager("master-secret")
        key = km.get_cabinet_key(uuid4())
        assert len(key) == 32

    def test_repr_hides_master_key(self):
        km = KeyManager("super-secret-key")
        assert "super-secret-key" not in repr(km)
        assert "***" in repr(km)

    def test_str_hides_master_key(self):
        km = KeyManager("super-secret-key")
        assert "super-secret-key" not in str(km)
