from sqlalchemy import Date, ForeignKey, Integer, LargeBinary, String, Time, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class CareProtocolModel(Base):
    __tablename__ = "care_protocols"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    patient_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    care_type: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    frequency_display: Mapped[str] = mapped_column(String(20), nullable=False, default="daily")
    custom_frequency_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    recurrence_rule: Mapped[str] = mapped_column(String(255), nullable=False)
    preferred_time = mapped_column(Time, nullable=True)
    preferred_slot: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    start_date = mapped_column(Date, nullable=False)
    end_date = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    notes_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
