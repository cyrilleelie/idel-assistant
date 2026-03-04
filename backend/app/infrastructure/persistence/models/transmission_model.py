from sqlalchemy import ForeignKey, Integer, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class TransmissionModel(Base):
    __tablename__ = "transmissions"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    idel_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    appointment_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="written", index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, server_default="draft", index=True)
    transcription_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    structured_data = mapped_column(JSONB, nullable=True)
    audio_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recording_duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    generation_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
