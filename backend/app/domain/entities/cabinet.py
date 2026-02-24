import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Cabinet:
    name: str
    address: str
    plan: str = "solo"  # solo | cabinet | cabinet_plus
    subscription_status: str = "trial"  # trial | active | canceled
    lat: float | None = None
    lon: float | None = None
    settings: dict = field(default_factory=dict)
    trial_ends_at: datetime.datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
