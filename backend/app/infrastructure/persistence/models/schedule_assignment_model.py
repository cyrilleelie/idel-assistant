from sqlalchemy import Date, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class ScheduleAssignmentModel(Base):
    __tablename__ = "schedule_assignments"
    __table_args__ = (
        UniqueConstraint(
            "cabinet_id", "nurse_id", "slot_id", "assigned_date",
            name="uq_schedule_assignment_key",
        ),
    )

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    nurse_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    slot_id: Mapped[str] = mapped_column(String(50), nullable=False)
    assigned_date = mapped_column(Date, nullable=False, index=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
