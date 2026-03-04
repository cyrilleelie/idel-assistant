import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4

# Valid transmission types
TRANSMISSION_TYPES = ("vocal", "written")

# Valid status transitions: draft → pending_transcription → pending_synthesis → completed
# Error can occur at any stage. validated = manually validated by IDEL.
TRANSMISSION_STATUSES = (
    "draft",
    "pending_transcription",
    "pending_synthesis",
    "transcribed",
    "completed",
    "validated",
    "error",
)


@dataclass
class Transmission:
    cabinet_id: UUID
    idel_id: UUID
    patient_id: UUID
    type: str = "written"  # "vocal" | "written"
    status: str = "draft"
    transcription: str = ""
    appointment_id: UUID | None = None
    structured_data: dict = field(default_factory=dict)
    audio_file_path: str | None = None
    recording_duration_seconds: int = 0
    generation_time_ms: int = 0
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
