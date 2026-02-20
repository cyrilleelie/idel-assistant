import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class AuditLog:
    cabinet_id: UUID
    user_id: UUID
    entity_type: str  # patient | appointment | ...
    entity_id: UUID
    action: str  # create | read | update | delete
    changes: dict = field(default_factory=dict)  # avant/apres pour update
    ip_address: str = ""
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
