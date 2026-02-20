from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class InvoiceModel(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    idel_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    patient_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("patients.id"), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    invoice_date = mapped_column(Date, nullable=False)
    total_amount = mapped_column(Numeric(10, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft", index=True)
    rejection_reason: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    transmitted_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    paid_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class InvoiceLineModel(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    invoice_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("appointments.id"), nullable=False)
    act_code: Mapped[str] = mapped_column(String(20), nullable=False)
    coefficient = mapped_column(Numeric(5, 2), nullable=False, default=1)
    base_rate = mapped_column(Numeric(10, 2), nullable=False, default=0)
    supplements = mapped_column(JSONB, nullable=True)
    line_total = mapped_column(Numeric(10, 2), nullable=False, default=0)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
