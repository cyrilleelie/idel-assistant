from sqlalchemy import Date, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class TariffUpdateModel(Base):
    __tablename__ = "tariff_updates"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    version: Mapped[str] = mapped_column(String(20), nullable=False)
    avenant_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    published_at = mapped_column(Date, nullable=True)
    effective_at = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    changes = mapped_column(JSONB, nullable=False, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="'available'")
    applied_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
