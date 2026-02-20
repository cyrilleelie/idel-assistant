"""Schemas Pydantic pour les secteurs geographiques."""

import datetime

from pydantic import BaseModel, Field


class SectorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    postal_codes: list[str] = Field(default_factory=list)
    communes: list[str] = Field(default_factory=list)
    color: str = Field(default="#3B82F6", max_length=20)
    display_order: int = Field(default=0, ge=0)


class SectorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    postal_codes: list[str] | None = None
    communes: list[str] | None = None
    color: str | None = Field(default=None, max_length=20)
    display_order: int | None = Field(default=None, ge=0)


class SectorResponse(BaseModel):
    id: str
    cabinet_id: str
    name: str
    postal_codes: list[str]
    communes: list[str]
    color: str
    display_order: int
    created_at: datetime.datetime


class SectorListResponse(BaseModel):
    items: list[SectorResponse]
    total: int
