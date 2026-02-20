from sqlalchemy import ForeignKey, Integer, LargeBinary, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class PatientModel(Base):
    __tablename__ = "patients"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)

    # Colonnes chiffrees stockees en binaire
    first_name_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    last_name_encrypted: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    birth_date_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    phone_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    email_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    address_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    pathologies_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    notes_encrypted: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)

    # Hash pour recherche par nom
    first_name_search_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    last_name_search_hash: Mapped[str | None] = mapped_column(String(64), index=True)

    # Colonnes en clair (non identifiantes ou necessaires pour requetes)
    lat: Mapped[float | None] = mapped_column(Numeric(10, 8), nullable=True)
    lon: Mapped[float | None] = mapped_column(Numeric(11, 8), nullable=True)
    preferred_time_slot: Mapped[str | None] = mapped_column(String(20), nullable=True)
    care_duration_default: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", index=True)
    archived_reason: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    archived_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
