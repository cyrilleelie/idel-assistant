from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class CareLabelModel(Base):
    __tablename__ = "care_labels"

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    cabinet_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cabinets.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    act_codes = mapped_column(ARRAY(String(30)), nullable=False)
    default_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    display_order: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="0"
    )
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("ix_care_labels_cabinet_category", "cabinet_id", "category"),
        UniqueConstraint("cabinet_id", "label", name="uq_care_labels_cabinet_id_label"),
    )
