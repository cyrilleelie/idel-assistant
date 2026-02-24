"""Schemas Pydantic pour les infos du cabinet."""

import datetime

from pydantic import BaseModel, Field, field_validator


class CabinetResponse(BaseModel):
    id: str
    name: str
    address: str
    plan: str
    subscription_status: str
    lat: float | None = None
    lon: float | None = None
    settings: dict = {}
    trial_ends_at: datetime.datetime | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"from_attributes": True}


class CabinetUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    address: str | None = Field(default=None, max_length=500)
    settings: dict | None = None

    @field_validator("settings")
    @classmethod
    def validate_settings(cls, v: dict | None) -> dict | None:
        if v is None:
            return v
        if "care_labels" in v:
            labels = v["care_labels"]
            if not isinstance(labels, list):
                raise ValueError("care_labels doit être une liste")
            if len(labels) > 50:
                raise ValueError("Maximum 50 libellés de soins")
            for label in labels:
                if not isinstance(label, str):
                    raise ValueError("Chaque libellé doit être une chaîne de caractères")
                if len(label) > 100:
                    raise ValueError("Chaque libellé ne doit pas dépasser 100 caractères")
        return v
