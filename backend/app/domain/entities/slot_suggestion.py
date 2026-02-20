import datetime
from dataclasses import dataclass
from uuid import UUID


@dataclass
class SlotSuggestion:
    rank: int
    start_time: datetime.time
    end_time: datetime.time
    previous_appointment_id: UUID | None
    next_appointment_id: UUID | None
    detour_km: float
    detour_minutes: float
    same_sector: bool
    sector_name: str
    score: float
    explanation: str
