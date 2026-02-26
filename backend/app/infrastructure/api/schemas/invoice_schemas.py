"""Schemas Pydantic pour la facturation (invoices + invoice lines)."""

import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# --- Request schemas ---


class CreateInvoiceRequest(BaseModel):
    patient_id: UUID
    idel_id: UUID
    care_date: datetime.date
    tiers_payant_type: str = Field(default="total", description="total | partiel | none")
    metadata: dict | None = None

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "patient_id": "550e8400-e29b-41d4-a716-446655440000",
            "idel_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "care_date": "2026-03-15",
            "tiers_payant_type": "total",
        }
    })


class UpdateInvoiceRequest(BaseModel):
    care_date: datetime.date | None = None
    tiers_payant_type: str | None = Field(default=None, description="total | partiel | none")
    metadata: dict | None = None

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "care_date": "2026-03-16",
            "tiers_payant_type": "partiel",
        }
    })


class AddInvoiceLineRequest(BaseModel):
    act_code: str
    quantity: Decimal = Field(default=Decimal("1"), ge=0)
    supplements: dict | None = None

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "act_code": "AMI_4",
            "quantity": 1,
            "supplements": {"MAJ_DIM": 8.50, "MCI": 5.00},
        }
    })


class UpdateInvoiceLineRequest(BaseModel):
    quantity: Decimal | None = Field(default=None, ge=0)
    supplements: dict | None = None

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "quantity": 2,
            "supplements": {"MAJ_DIM": 8.50},
        }
    })


# --- Response schemas ---


class InvoiceLineResponse(BaseModel):
    id: str
    invoice_id: str
    line_order: int
    act_code: str
    act_label: str
    coefficient: Decimal
    base_rate: Decimal
    quantity: Decimal
    line_subtotal: Decimal
    supplements: dict | None
    supplements_total: Decimal
    line_total: Decimal
    created_at: datetime.datetime


class InvoiceResponse(BaseModel):
    id: str
    cabinet_id: str
    idel_id: str
    patient_id: str
    prescription_id: str | None
    appointment_id: str | None = None
    invoice_number: str
    invoice_date: datetime.date
    care_date: datetime.date
    total_amo: Decimal
    total_amc: Decimal
    total_patient: Decimal
    total_amount: Decimal
    tiers_payant_type: str
    status: str
    rejection_reason: str | None
    validated_at: datetime.datetime | None
    transmitted_at: datetime.datetime | None
    paid_at: datetime.datetime | None
    metadata: dict | None
    lines: list[InvoiceLineResponse]
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(json_schema_extra={"examples": [
        {
            "id": "550e8400-e29b-41d4-a716-446655440000",
            "cabinet_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
            "idel_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c9",
            "patient_id": "6ba7b810-9dad-11d1-80b4-00c04fd430ca",
            "prescription_id": None,
            "invoice_number": "2026-03-0001",
            "invoice_date": "2026-03-15",
            "care_date": "2026-03-15",
            "total_amo": "12.60",
            "total_amc": "8.40",
            "total_patient": "0.00",
            "total_amount": "21.00",
            "tiers_payant_type": "total",
            "status": "draft",
            "rejection_reason": None,
            "validated_at": None,
            "transmitted_at": None,
            "paid_at": None,
            "metadata": None,
            "lines": [],
            "created_at": "2026-03-15T10:00:00Z",
            "updated_at": "2026-03-15T10:00:00Z",
        }
    ]})


class InvoiceListResponse(BaseModel):
    items: list[InvoiceResponse]
    total: int
    offset: int
    limit: int


class InvoiceValidationErrorResponse(BaseModel):
    errors: list[str]
