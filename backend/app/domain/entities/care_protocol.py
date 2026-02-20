import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class CareProtocol:
    patient_id: UUID
    cabinet_id: UUID
    care_type: str  # pansement | injection | bsi | ...
    duration_minutes: int
    recurrence_rule: str  # RRULE format
    start_date: datetime.date
    preferred_time: datetime.time | None = None
    preferred_slot: str = ""  # morning | afternoon | evening
    end_date: datetime.date | None = None
    status: str = "active"  # active | paused | completed
    notes: str = ""
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
