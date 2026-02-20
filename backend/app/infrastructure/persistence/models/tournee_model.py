from sqlalchemy import Date, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class TourneeModel(Base):
    __tablename__ = "tournees"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    idel_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    tournee_date = mapped_column(Date, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    start_location = mapped_column(JSONB, nullable=True)
    end_location = mapped_column(JSONB, nullable=True)
    total_distance_km: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    total_duration_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    travel_time_minutes: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    num_stops: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    completed_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class TourneeStopModel(Base):
    __tablename__ = "tournee_stops"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    tournee_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("tournees.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=False)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_arrival = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    actual_arrival = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    distance_from_previous_km: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    travel_time_from_previous_min: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
