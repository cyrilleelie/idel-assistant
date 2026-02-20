import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Appointment:
    cabinet_id: UUID
    idel_id: UUID
    patient_id: UUID
    scheduled_at: datetime.datetime
    duration_minutes: int
    care_type: str
    care_protocol_id: UUID | None = None
    status: str = "scheduled"  # scheduled | in_progress | completed | canceled | no_show
    cancellation_reason: str = ""
    canceled_at: datetime.datetime | None = None
    created_by: str = "manual"  # manual | vocal_agent | protocol | import
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))

    @property
    def end_at(self) -> datetime.datetime:
        return self.scheduled_at + datetime.timedelta(minutes=self.duration_minutes)
