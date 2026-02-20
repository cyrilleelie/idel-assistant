from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID, uuid4


@dataclass
class CareTypeCatalog:
    cabinet_id: UUID
    code: str  # AMI_4 | AIS_3 | BSI_REF | ...
    label: str  # Pansement complexe
    category: str  # technique | nursing | bsi
    default_duration_minutes: int = 30
    base_rate: Decimal = Decimal("0.00")
    is_active: bool = True
    id: UUID = field(default_factory=uuid4)
