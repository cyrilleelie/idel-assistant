import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Sector:
    cabinet_id: UUID
    name: str
    postal_codes: list[str] = field(default_factory=list)
    communes: list[str] = field(default_factory=list)
    color: str = "#3B82F6"
    display_order: int = 0
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
