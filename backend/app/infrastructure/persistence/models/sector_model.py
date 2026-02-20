from sqlalchemy import ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class SectorModel(Base):
    __tablename__ = "sectors"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_codes = mapped_column(JSONB, nullable=False, server_default="[]")
    communes = mapped_column(JSONB, nullable=False, server_default="[]")
    color: Mapped[str] = mapped_column(String(20), nullable=False, server_default="'#3B82F6'")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
