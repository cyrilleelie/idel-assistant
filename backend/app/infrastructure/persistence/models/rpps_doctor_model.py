from sqlalchemy import Boolean, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class RppsDoctorModel(Base):
    __tablename__ = "rpps_doctors"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    rpps_number: Mapped[str] = mapped_column(String(11), nullable=False, unique=True, index=True)
    last_name: Mapped[str] = mapped_column(String(150), nullable=False)
    first_name: Mapped[str] = mapped_column(String(150), nullable=False)
    profession_code: Mapped[str] = mapped_column(String(3), nullable=False)
    profession_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    specialty_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    specialty_label: Mapped[str | None] = mapped_column(String(200), nullable=True)
    department: Mapped[str | None] = mapped_column(String(3), nullable=True)
    city: Mapped[str | None] = mapped_column(String(150), nullable=True)
    finess_site: Mapped[str | None] = mapped_column(String(9), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
