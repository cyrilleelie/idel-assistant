"""Liaison N-N entre transmissions et prescriptions (ordonnances)."""

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.persistence.models.base import Base


class TransmissionPrescriptionModel(Base):
    __tablename__ = "transmission_prescriptions"

    __table_args__ = (
        UniqueConstraint("transmission_id", "prescription_id", name="uq_transmission_prescription"),
    )

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    transmission_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("transmissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    prescription_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_auto_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())

    transmission = relationship("TransmissionModel", back_populates="transmission_prescriptions")
    prescription = relationship("PrescriptionModel")
