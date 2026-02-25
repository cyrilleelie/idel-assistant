"""Schemas Pydantic pour le catalogue d'actes NGAP et les mises a jour tarifaires."""

import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class CareCatalogCreate(BaseModel):
    """Creation d'un acte custom par le cabinet."""

    code: str = Field(min_length=1, max_length=30, examples=["CUSTOM_1"])
    lettre_cle: str = Field(min_length=1, max_length=10, examples=["AMI"])
    label: str = Field(min_length=1, max_length=200, examples=["Acte personnalise"])
    category: str = Field(
        min_length=1,
        max_length=30,
        examples=["technique"],
        description="technique | technique_bsi | nursing | bsi_forfait | majoration | indemnite_deplacement | indemnite_km | teleconsultation | forfait",
    )
    unit: str = Field(default="acte", max_length=20, examples=["acte"])
    coefficient: Decimal | None = Field(default=None, ge=0, examples=[1.0])
    base_rate: Decimal | None = Field(default=None, ge=0, examples=[3.15])
    fixed_amount: Decimal | None = Field(default=None, ge=0, examples=[10.00])
    default_duration_minutes: int | None = Field(default=None, ge=0, examples=[30])
    is_cumulative: bool = Field(default=False)
    cumul_rules: dict | None = Field(default=None)
    context_rules: dict | None = Field(default=None)
    effective_from: datetime.date | None = Field(default=None, examples=["2026-03-01"])
    display_order: int = Field(default=0, ge=0)


class CareCatalogToggle(BaseModel):
    """Activation/desactivation d'un acte."""

    is_active: bool = Field(examples=[True])


class CareCatalogResponse(BaseModel):
    """Reponse pour un acte du catalogue."""

    id: str
    cabinet_id: str | None
    code: str
    lettre_cle: str
    label: str
    category: str
    coefficient: Decimal | None
    base_rate: Decimal | None
    fixed_amount: Decimal | None
    unit: str
    default_duration_minutes: int | None
    is_cumulative: bool
    cumul_rules: dict | None
    context_rules: dict | None
    effective_from: datetime.date
    effective_to: datetime.date | None
    avenant_source: str | None
    is_system: bool
    is_active: bool
    display_order: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = {"json_schema_extra": {"examples": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "cabinet_id": None,
            "code": "AMI_4",
            "lettre_cle": "AMI",
            "label": "Acte medical infirmier coefficient 4",
            "category": "technique",
            "coefficient": "4.00",
            "base_rate": "3.15",
            "fixed_amount": None,
            "unit": "acte",
            "default_duration_minutes": 30,
            "is_cumulative": True,
            "cumul_rules": None,
            "context_rules": None,
            "effective_from": "2024-01-28",
            "effective_to": None,
            "avenant_source": "avenant_10",
            "is_system": True,
            "is_active": True,
            "display_order": 0,
            "created_at": "2026-02-25T10:00:00Z",
            "updated_at": "2026-02-25T10:00:00Z",
        }
    ]}}


class CareCatalogListResponse(BaseModel):
    """Liste paginee des actes du catalogue."""

    items: list[CareCatalogResponse]
    total: int


class TariffUpdateResponse(BaseModel):
    """Reponse pour une mise a jour tarifaire."""

    id: str
    version: str
    avenant_reference: str | None
    published_at: datetime.date | None
    effective_at: datetime.date
    description: str
    changes: dict
    status: str
    applied_at: datetime.datetime | None
    created_at: datetime.datetime


class TariffUpdateListResponse(BaseModel):
    """Liste des mises a jour tarifaires disponibles."""

    items: list[TariffUpdateResponse]
    total: int
