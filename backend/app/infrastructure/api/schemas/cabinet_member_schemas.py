"""Schemas Pydantic pour la gestion des membres du cabinet."""

import datetime

from pydantic import BaseModel, Field


class CabinetMemberInvite(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    role: str = Field(default="member", pattern=r"^(admin|member|replacement)$")
    color: str = Field(default="#3B82F6", max_length=20)


class CabinetMemberUpdate(BaseModel):
    role: str | None = Field(default=None, pattern=r"^(admin|member|replacement)$")
    color: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None


class CabinetMemberResponse(BaseModel):
    id: str
    cabinet_id: str
    user_id: str
    first_name: str
    last_name: str
    email: str
    phone: str
    role: str
    color: str
    is_active: bool
    joined_at: datetime.date | None


class CabinetMemberListResponse(BaseModel):
    items: list[CabinetMemberResponse]
    total: int
