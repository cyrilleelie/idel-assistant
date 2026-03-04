"""Modèle SQLAlchemy pour les logs d'appels du secrétaire médical IA."""

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class ReceptionistCallLogModel(Base):
    __tablename__ = "receptionist_call_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    cabinet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cabinets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    caller_number: Mapped[str] = mapped_column(String(255), nullable=False)
    call_duration_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    outcome: Mapped[str] = mapped_column(String(50), nullable=False)
    urgency_score: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    escalation_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    sms_sent_to: Mapped[str | None] = mapped_column(String(255), nullable=True)

    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )
    patient_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
    )

    transcript_pseudonymized: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    avg_turn_latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
