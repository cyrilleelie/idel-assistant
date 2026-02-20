import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Tournee:
    cabinet_id: UUID
    idel_id: UUID
    tournee_date: datetime.date
    status: str = "planned"  # planned | in_progress | completed
    start_location_lat: float | None = None
    start_location_lon: float | None = None
    end_location_lat: float | None = None
    end_location_lon: float | None = None
    total_distance_km: float = 0.0
    total_duration_minutes: float = 0.0
    travel_time_minutes: float = 0.0
    num_stops: int = 0
    started_at: datetime.datetime | None = None
    completed_at: datetime.datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))


@dataclass
class TourneeStop:
    tournee_id: UUID
    appointment_id: UUID
    stop_order: int
    estimated_arrival: datetime.datetime | None = None
    actual_arrival: datetime.datetime | None = None
    distance_from_previous_km: float = 0.0
    travel_time_from_previous_min: int = 0
    status: str = "pending"  # pending | arrived | completed | skipped
    id: UUID = field(default_factory=uuid4)
