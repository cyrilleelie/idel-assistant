import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class RppsDoctor:
    rpps_number: str
    last_name: str
    first_name: str
    profession_code: str
    profession_label: str | None = None
    specialty_code: str | None = None
    specialty_label: str | None = None
    department: str | None = None
    city: str | None = None
    finess_site: str | None = None
    active: bool = True
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
