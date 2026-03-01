"""Use case : création d'une transmission infirmière (DAR)."""

from dataclasses import dataclass
from uuid import UUID

from app.domain.entities.transmission import Transmission
from app.domain.repositories.transmission_repository import TransmissionRepository


@dataclass
class CreateTransmissionDTO:
    patient_id: UUID
    idel_id: UUID
    transcription: str
    structured_data: dict
    appointment_id: UUID | None = None
    recording_duration_seconds: int = 0
    generation_time_ms: int = 0


class CreateTransmissionUseCase:
    def __init__(self, transmission_repo: TransmissionRepository):
        self._repo = transmission_repo

    async def execute(self, cabinet_id: UUID, dto: CreateTransmissionDTO) -> Transmission:
        transmission = Transmission(
            cabinet_id=cabinet_id,
            idel_id=dto.idel_id,
            patient_id=dto.patient_id,
            appointment_id=dto.appointment_id,
            transcription=dto.transcription,
            structured_data=dto.structured_data,
            recording_duration_seconds=dto.recording_duration_seconds,
            generation_time_ms=dto.generation_time_ms,
        )
        return await self._repo.create(transmission)
