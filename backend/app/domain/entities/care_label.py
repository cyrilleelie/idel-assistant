import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class CareLabel:
    label: str  # "Pansement complexe"
    act_codes: list[str]  # ["AMI_1.5"]
    default_duration_minutes: int  # 20
    category: str  # "pansement"
    is_system: bool = True
    is_active: bool = True
    cabinet_id: UUID | None = None
    display_order: int = 0
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    updated_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
