"""Tests unitaires pour le module de chiffrement."""

import pytest
from cryptography.exceptions import InvalidTag

from app.infrastructure.security.encryption import (
    compute_search_hash,
    decrypt,
    derive_key,
    encrypt,
)


class TestEncryptDecrypt:
    def test_roundtrip(self):
        key = derive_key("master-key", "test-context")
        plaintext = "Donnees sensibles patient"
        ciphertext = encrypt(plaintext, key)
        result = decrypt(ciphertext, key)
        assert result == plaintext

    def test_roundtrip_unicode(self):
        key = derive_key("master-key", "test-context")
        plaintext = "Nom: Dupont-Moreau, prenom: Helene"
        ciphertext = encrypt(plaintext, key)
        assert decrypt(ciphertext, key) == plaintext

    def test_ciphertext_differs_from_plaintext(self):
        key = derive_key("master-key", "test-context")
        plaintext = "secret"
        ciphertext = encrypt(plaintext, key)
        assert ciphertext != plaintext.encode("utf-8")

    def test_different_nonces_produce_different_ciphertexts(self):
        key = derive_key("master-key", "test-context")
        plaintext = "same content"
        ct1 = encrypt(plaintext, key)
        ct2 = encrypt(plaintext, key)
        assert ct1 != ct2
        assert decrypt(ct1, key) == decrypt(ct2, key) == plaintext

    def test_associated_data(self):
        key = derive_key("master-key", "test-context")
        plaintext = "data"
        ad = b"cabinet:123"
        ciphertext = encrypt(plaintext, key, associated_data=ad)
        result = decrypt(ciphertext, key, associated_data=ad)
        assert result == plaintext

    def test_wrong_key_fails(self):
        key1 = derive_key("master-key", "context-1")
        key2 = derive_key("master-key", "context-2")
        ciphertext = encrypt("secret", key1)
        with pytest.raises(InvalidTag):
            decrypt(ciphertext, key2)

    def test_tampered_ciphertext_raises(self):
        key = derive_key("master-key", "test-context")
        ciphertext = encrypt("secret data", key)
        tampered = ciphertext[:15] + bytes([ciphertext[15] ^ 0xFF]) + ciphertext[16:]
        with pytest.raises(InvalidTag):
            decrypt(tampered, key)

    def test_wrong_associated_data_fails(self):
        key = derive_key("master-key", "test-context")
        ciphertext = encrypt("patient data", key, associated_data=b"cabinet:aaa")
        with pytest.raises(InvalidTag):
            decrypt(ciphertext, key, associated_data=b"cabinet:bbb")

    def test_empty_string(self):
        key = derive_key("master-key", "test")
        ciphertext = encrypt("", key)
        assert decrypt(ciphertext, key) == ""


class TestDeriveKey:
    def test_different_contexts_produce_different_keys(self):
        k1 = derive_key("master", "cabinet:aaa")
        k2 = derive_key("master", "cabinet:bbb")
        assert k1 != k2

    def test_same_context_produces_same_key(self):
        k1 = derive_key("master", "cabinet:aaa")
        k2 = derive_key("master", "cabinet:aaa")
        assert k1 == k2

    def test_key_length_is_32_bytes(self):
        key = derive_key("master", "context")
        assert len(key) == 32

    def test_different_master_keys_produce_different_keys(self):
        k1 = derive_key("master-1", "same-context")
        k2 = derive_key("master-2", "same-context")
        assert k1 != k2


class TestSearchHash:
    def test_deterministic(self):
        key = derive_key("master", "context")
        h1 = compute_search_hash("Dupont", key)
        h2 = compute_search_hash("Dupont", key)
        assert h1 == h2

    def test_case_insensitive(self):
        key = derive_key("master", "context")
        h1 = compute_search_hash("Dupont", key)
        h2 = compute_search_hash("dupont", key)
        h3 = compute_search_hash("DUPONT", key)
        assert h1 == h2 == h3

    def test_strips_whitespace(self):
        key = derive_key("master", "context")
        h1 = compute_search_hash("Dupont", key)
        h2 = compute_search_hash("  Dupont  ", key)
        assert h1 == h2

    def test_different_values_produce_different_hashes(self):
        key = derive_key("master", "context")
        h1 = compute_search_hash("Dupont", key)
        h2 = compute_search_hash("Martin", key)
        assert h1 != h2

    def test_hash_is_hex_string(self):
        key = derive_key("master", "context")
        h = compute_search_hash("test", key)
        assert len(h) == 64
        int(h, 16)  # Should not raise
