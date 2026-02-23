import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class ScheduleAssignment:
    cabinet_id: UUID
    nurse_id: UUID
    slot_id: str
    assigned_date: datetime.date
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
