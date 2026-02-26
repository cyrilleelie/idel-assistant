from sqlalchemy import ForeignKey, Integer, Numeric, String, Time, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class AppointmentModel(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    idel_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    patient_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    care_protocol_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("care_protocols.id", ondelete="SET NULL"), nullable=True)
    scheduled_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, index=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    care_type: Mapped[str] = mapped_column(String(50), nullable=False)
    location_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="home")
    time_window_start = mapped_column(Time, nullable=True)
    time_window_end = mapped_column(Time, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled", index=True)
    cancellation_reason: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    canceled_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    act_codes = mapped_column(ARRAY(String(30)), nullable=True)
    care_labels = mapped_column(ARRAY(String(200)), nullable=True)
    distance_km = mapped_column(Numeric(6, 2), nullable=True)
    created_by: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
