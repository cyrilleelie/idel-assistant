from sqlalchemy import Boolean, Date, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class CareTypeCatalogModel(Base):
    __tablename__ = "care_type_catalog"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    lettre_cle: Mapped[str] = mapped_column(String(10), nullable=False, server_default="")
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    coefficient = mapped_column(Numeric(8, 2), nullable=True)
    base_rate = mapped_column(Numeric(10, 2), nullable=True)
    fixed_amount = mapped_column(Numeric(10, 2), nullable=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False, server_default="acte")
    default_duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_cumulative: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    cumul_rules = mapped_column(JSONB, nullable=True)
    context_rules = mapped_column(JSONB, nullable=True)
    effective_from = mapped_column(Date, nullable=False)
    effective_to = mapped_column(Date, nullable=True)
    avenant_source: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_care_type_catalog_code_effective", "cabinet_id", "code", "effective_from"),
        Index("ix_care_type_catalog_category", "category"),
        Index("ix_care_type_catalog_lettre_cle", "lettre_cle"),
    )
