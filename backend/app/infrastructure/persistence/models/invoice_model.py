from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base


class InvoiceModel(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False)
    idel_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False)
    prescription_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, server_default="")
    invoice_date = mapped_column(Date, nullable=False)
    care_date = mapped_column(Date, nullable=False)
    total_amo = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    total_amc = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    total_patient = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    total_amount = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    tiers_payant_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="total")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="draft")
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    validated_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    transmitted_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    paid_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    appointment_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    metadata_ = mapped_column("metadata", JSONB, nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    lines: Mapped[list["InvoiceLineModel"]] = relationship(
        "InvoiceLineModel",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="InvoiceLineModel.line_order",
    )

    __table_args__ = (
        Index("ix_invoices_cabinet_id_invoice_number", "cabinet_id", "invoice_number", unique=True),
        Index("ix_invoices_cabinet_id_status", "cabinet_id", "status"),
        Index("ix_invoices_cabinet_id_patient_id", "cabinet_id", "patient_id"),
        Index("ix_invoices_cabinet_id_care_date", "cabinet_id", "care_date"),
    )


class InvoiceLineModel(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    invoice_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    line_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    act_code: Mapped[str] = mapped_column(String(30), nullable=False)
    act_label: Mapped[str] = mapped_column(String(200), nullable=False, server_default="")
    coefficient = mapped_column(Numeric(8, 2), nullable=False, server_default="1")
    base_rate = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    quantity = mapped_column(Numeric(10, 2), nullable=False, server_default="1")
    line_subtotal = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    supplements = mapped_column(JSONB, nullable=True)
    supplements_total = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    line_total = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    invoice: Mapped["InvoiceModel"] = relationship("InvoiceModel", back_populates="lines")

    __table_args__ = (
        Index("ix_invoice_lines_invoice_id", "invoice_id"),
    )
