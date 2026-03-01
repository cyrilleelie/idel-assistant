import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class User:
    email: str
    password_hash: str
    first_name: str
    last_name: str
    rpps: str
    adeli: str = ""                         # Numéro ADELI (9 chiffres)
    am_number: str = ""                     # Numéro d'identification AM (convention CPAM)
    convention_zone: int | None = None      # Zone conventionnelle: 1, 2 ou 3
    phone: str = ""
    photo_url: str = ""
    work_hours_start: datetime.time = datetime.time(7, 0)
    work_hours_end: datetime.time = datetime.time(19, 0)
    lunch_break_start: datetime.time = datetime.time(12, 0)
    lunch_break_duration_minutes: int = 60
    work_zone_radius_km: int = 30
    vocal_agent_enabled: bool = False
    vocal_agent_phone: str = ""
    last_login_at: datetime.datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))


@dataclass
class CabinetMember:
    cabinet_id: UUID
    user_id: UUID
    role: str = "member"  # admin | member | replacement
    is_active: bool = True
    color: str = "#3B82F6"
    joined_at: datetime.date = field(default_factory=datetime.date.today)
    left_at: datetime.date | None = None
    id: UUID = field(default_factory=uuid4)
