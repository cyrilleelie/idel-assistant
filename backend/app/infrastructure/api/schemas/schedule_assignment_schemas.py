import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ScheduleToggleRequest(BaseModel):
    nurse_id: UUID
    slot_id: str = Field(..., max_length=50)
    assigned_date: datetime.date


class ScheduleToggleResponse(BaseModel):
    action: str  # "added" | "removed"
    nurse_id: UUID
    slot_id: str
    assigned_date: datetime.date


class ScheduleMonthResponse(BaseModel):
    year: int
    month: int
    schedule: dict[str, dict[str, list[str]]]
    # { "2026-02-23": { "c1_s1": ["nurse-uuid-1", ...] } }
