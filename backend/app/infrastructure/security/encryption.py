import hashlib
import hmac
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes


def encrypt(plaintext: str, key: bytes, associated_data: bytes | None = None) -> bytes:
    """Chiffre avec AES-256-GCM. Retourne nonce (12 bytes) + ciphertext."""
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data)
    return nonce + ct


def decrypt(ciphertext: bytes, key: bytes, associated_data: bytes | None = None) -> str:
    """Dechiffre AES-256-GCM. Input = nonce (12 bytes) + ciphertext."""
    aesgcm = AESGCM(key)
    nonce = ciphertext[:12]
    ct = ciphertext[12:]
    return aesgcm.decrypt(nonce, ct, associated_data).decode("utf-8")


def derive_key(master_key: str, context: str) -> bytes:
    """Derive une cle AES-256 depuis la master key via HKDF-SHA256.

    Chaque context different produit une cle differente.
    Utilise pour deriver une cle par cabinet.
    """
    hkdf = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"idel-assistant-v1",
        info=context.encode("utf-8"),
    )
    return hkdf.derive(master_key.encode("utf-8"))


def compute_search_hash(value: str, key: bytes) -> str:
    """Calcule un HMAC-SHA256 pour la recherche par nom sans dechiffrer.

    La valeur est normalisee en lowercase + strip avant le hash
    pour permettre une recherche case-insensitive.
    """
    normalized = value.strip().lower()
    return hmac.new(key, normalized.encode("utf-8"), hashlib.sha256).hexdigest()
