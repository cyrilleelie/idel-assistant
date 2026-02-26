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
    label: str = ""                    # Nom libre de l'ordonnance
    frequency_display: str = "daily"   # daily|2xday|3xday|weekly|2xweek|3xweek|custom
    custom_frequency: str = ""         # Texte libre si frequency_display == "custom"
    preferred_time: datetime.time | None = None
    preferred_slot: str = ""  # morning | afternoon | evening
    end_date: datetime.date | None = None
    status: str = "active"  # active | paused | completed
    act_codes: list[str] = field(default_factory=list)
    notes: str = ""
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
