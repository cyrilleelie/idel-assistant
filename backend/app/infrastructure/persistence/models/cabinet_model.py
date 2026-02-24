from sqlalchemy import Numeric, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class CabinetModel(Base):
    __tablename__ = "cabinets"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    lat: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    lon: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="solo")
    subscription_status: Mapped[str] = mapped_column(String(20), nullable=False, default="trial")
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    trial_ends_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
