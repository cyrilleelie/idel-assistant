import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Document:
    cabinet_id: UUID
    entity_type: str        # "care_protocol" | "patient"
    entity_id: UUID
    original_name: str
    mime_type: str
    size_bytes: int
    storage_path: str
    checksum_sha256: str
    uploaded_by: UUID
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
