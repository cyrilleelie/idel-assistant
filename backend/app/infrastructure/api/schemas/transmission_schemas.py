"""Schemas Pydantic pour les transmissions infirmières."""

import datetime

from pydantic import BaseModel, Field


class TransmissionCreateRequest(BaseModel):
    patient_id: str
    type: str = Field(default="written", pattern="^(vocal|written)$")
    appointment_id: str | None = None
    transcription: str = ""
    structured_data: dict | None = None
    recording_duration_seconds: int = 0


class TransmissionUpdateRequest(BaseModel):
    transcription: str | None = None
    structured_data: dict | None = None
    status: str | None = None


class TransmissionResponse(BaseModel):
    id: str
    cabinet_id: str
    idel_id: str
    patient_id: str
    appointment_id: str | None
    type: str
    status: str
    transcription: str
    structured_data: dict
    audio_file_path: str | None
    recording_duration_seconds: int
    generation_time_ms: int
    created_at: datetime.datetime
    updated_at: datetime.datetime


class TransmissionListResponse(BaseModel):
    items: list[TransmissionResponse]
    total: int


class AudioUploadResponse(BaseModel):
    transmission_id: str
    status: str
    audio_file_path: str
    message: str
