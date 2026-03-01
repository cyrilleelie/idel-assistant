from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Integer, LargeBinary, Numeric, String, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class FseModel(Base):
    __tablename__ = "fse"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)

    # Numérotation
    fse_number: Mapped[str] = mapped_column(String(50), nullable=False, server_default="")
    lot_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Identité patient
    nir_patient: Mapped[str] = mapped_column(String(15), nullable=False, server_default="")
    birth_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Identité professionnel
    rpps_idel: Mapped[str] = mapped_column(String(11), nullable=False, server_default="")
    adeli_idel: Mapped[str | None] = mapped_column(String(9), nullable=True)
    rpps_prescripteur: Mapped[str | None] = mapped_column(String(11), nullable=True)

    # Dates
    date_soins = mapped_column(Date, nullable=False)
    date_prescription = mapped_column(Date, nullable=True)

    # Organismes
    organisme_amo: Mapped[str | None] = mapped_column(String(9), nullable=True)
    organisme_amc: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Montants
    montant_total = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    montant_amo = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    montant_amc = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    montant_patient = mapped_column(Numeric(10, 2), nullable=False, server_default="0")

    # Actes
    actes_fse = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))

    # Classification
    type_fse: Mapped[str] = mapped_column(String(10), nullable=False, server_default="FSE")
    nature_assurance: Mapped[str | None] = mapped_column(String(3), nullable=True)
    exoneration_code: Mapped[str | None] = mapped_column(String(3), nullable=True)

    # Données brutes
    raw_fse_data = mapped_column(JSONB, nullable=True)

    # Statut
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="generated")
    exported_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    exported_format: Mapped[str | None] = mapped_column(String(10), nullable=True)
    transmitted_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    arl_received_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_fse_cabinet_id", "cabinet_id"),
        Index("ix_fse_cabinet_id_status", "cabinet_id", "status"),
        Index("ix_fse_invoice_id", "invoice_id"),
        Index("ix_fse_fse_number", "cabinet_id", "fse_number", unique=True),
    )
