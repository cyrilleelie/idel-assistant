import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Transmission:
    cabinet_id: UUID
    idel_id: UUID
    patient_id: UUID
    transcription: str = ""
    appointment_id: UUID | None = None
    structured_data: dict = field(default_factory=dict)
    recording_duration_seconds: int = 0
    generation_time_ms: int = 0
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
