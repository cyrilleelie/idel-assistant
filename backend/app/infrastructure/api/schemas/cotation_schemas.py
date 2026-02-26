"""Schemas Pydantic pour la cotation automatique NGAP."""

import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- Request schemas ---


class SimulateCotationRequest(BaseModel):
    patient_id: UUID
    idel_id: UUID
    actes: list[str] = Field(
        description="Liste des codes actes (ex: ['AMI_4', 'AMI_1.5'])",
    )
    date_heure_soin: datetime.datetime = Field(
        description="Date et heure du soin (ISO 8601)",
    )
    distance_km: Decimal = Field(
        ge=0, description="Distance domicile du patient en km",
    )
    lieu: str = Field(description="'domicile' ou 'cabinet'")
    zone_ik: str = Field(
        default="plaine", description="'plaine' ou 'montagne'",
    )
    est_premier_soin_journee: bool = Field(
        default=True,
        description="Premier soin technique du patient aujourd'hui",
    )

    model_config = ConfigDict(json_schema_extra={"examples": [
        {
            "summary": "Pansement standard domicile",
            "value": {
                "patient_id": "550e8400-e29b-41d4-a716-446655440000",
                "idel_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                "actes": ["AMI_4"],
                "date_heure_soin": "2026-03-16T09:00:00",
                "distance_km": "5",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
        },
        {
            "summary": "Patient BSI dimanche nuit",
            "value": {
                "patient_id": "550e8400-e29b-41d4-a716-446655440001",
                "idel_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
                "actes": ["AMI_1.5"],
                "date_heure_soin": "2026-03-15T21:00:00",
                "distance_km": "8",
                "lieu": "domicile",
                "zone_ik": "plaine",
                "est_premier_soin_journee": True,
            },
        },
    ]})


# --- Response schemas ---


class CotationLigneResponse(BaseModel):
    code: str
    label: str
    montant: Decimal
    quantity: Decimal
    coefficient: Decimal | None
    base_rate: Decimal | None
    category: str


class CotationResultResponse(BaseModel):
    lignes: list[CotationLigneResponse]
    total: Decimal
    repartition_amo: Decimal
    repartition_amc: Decimal
    repartition_patient: Decimal
    auto_corrections: list[str]
    explications: list[str]

    model_config = ConfigDict(json_schema_extra={"examples": [
        {
            "lignes": [
                {
                    "code": "AMI_4",
                    "label": "Acte medical infirmier coefficient 4",
                    "montant": "12.60",
                    "quantity": "1",
                    "coefficient": "4",
                    "base_rate": "3.15",
                    "category": "acte",
                },
                {
                    "code": "IFD",
                    "label": "Indemnite forfaitaire de deplacement",
                    "montant": "2.75",
                    "quantity": "1",
                    "coefficient": None,
                    "base_rate": "2.75",
                    "category": "indemnite",
                },
                {
                    "code": "MCI",
                    "label": "Majoration coordination infirmiere",
                    "montant": "5.00",
                    "quantity": "1",
                    "coefficient": None,
                    "base_rate": "5.00",
                    "category": "majoration",
                },
                {
                    "code": "MAU",
                    "label": "Majoration acte unique",
                    "montant": "1.35",
                    "quantity": "1",
                    "coefficient": None,
                    "base_rate": "1.35",
                    "category": "majoration",
                },
            ],
            "total": "21.70",
            "repartition_amo": "13.02",
            "repartition_amc": "8.68",
            "repartition_patient": "0.00",
            "auto_corrections": [],
            "explications": [
                "MCI : premier soin technique du patient aujourd'hui",
                "MAU : acte technique unique dans le passage",
            ],
        }
    ]})
