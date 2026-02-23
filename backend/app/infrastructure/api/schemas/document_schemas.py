"""Schemas Pydantic pour les documents."""

import datetime

from pydantic import BaseModel


class DocumentResponse(BaseModel):
    id: str
    cabinet_id: str
    entity_type: str
    entity_id: str
    original_name: str
    mime_type: str
    size_bytes: int
    checksum_sha256: str
    uploaded_by: str
    created_at: datetime.datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int
