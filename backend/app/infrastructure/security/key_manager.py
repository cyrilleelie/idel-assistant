from uuid import UUID

from app.infrastructure.security.encryption import derive_key


class KeyManager:
    def __init__(self, master_key: str):
        self._master_key = master_key

    def __repr__(self) -> str:
        return "KeyManager(***)"

    def __str__(self) -> str:
        return "KeyManager(***)"

    def get_cabinet_key(self, cabinet_id: UUID) -> bytes:
        """Derive une cle unique par cabinet depuis la master key."""
        return derive_key(self._master_key, f"cabinet:{cabinet_id}")
