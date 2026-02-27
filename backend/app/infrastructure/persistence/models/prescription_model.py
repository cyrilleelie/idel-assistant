from sqlalchemy import Date, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class PrescriptionModel(Base):
    __tablename__ = "prescriptions"

    id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    cabinet_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("cabinets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Lien vers le plan de soins (ordonnance issue d'un plan)
    care_protocol_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("care_protocols.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Libellé du soin (référentiel CareLabel)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    care_label_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Scheduling (repris des soins)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    frequency_display: Mapped[str | None] = mapped_column(String(20), nullable=True, server_default="daily")
    custom_frequency: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_time = mapped_column(Time, nullable=True)
    preferred_slot: Mapped[str | None] = mapped_column(String(20), nullable=True)
    recurrence_rule: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Prescripteur (optionnel)
    prescriber_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prescriber_rpps: Mapped[str | None] = mapped_column(String(11), nullable=True)

    # Dates
    prescription_date = mapped_column(Date, nullable=True)
    start_date = mapped_column(Date, nullable=True)
    end_date = mapped_column(Date, nullable=True)
    duration_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Contenu médical
    care_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    act_codes = mapped_column(ARRAY(String(30)), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Renouvellement
    max_renewals: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    current_renewal: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    parent_prescription_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("prescriptions.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Statut
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")

    # Document joint
    document_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    document_filename: Mapped[str | None] = mapped_column(String(500), nullable=True)
    document_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Notes
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Audit
    created_at = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
