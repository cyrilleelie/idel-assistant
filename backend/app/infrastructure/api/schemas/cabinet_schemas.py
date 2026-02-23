"""Schemas Pydantic pour les infos du cabinet."""

import datetime

from pydantic import BaseModel, Field


class CabinetResponse(BaseModel):
    id: str
    name: str
    address: str
    plan: str
    subscription_status: str
    lat: float | None = None
    lon: float | None = None
    trial_ends_at: datetime.datetime | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class CabinetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, max_length=500)
