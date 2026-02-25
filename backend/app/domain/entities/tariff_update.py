import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class TariffUpdate:
    version: str
    effective_at: datetime.date
    description: str
    changes: dict
    status: str = "available"  # available | applied | skipped
    avenant_reference: str | None = None
    published_at: datetime.date | None = None
    applied_at: datetime.datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
