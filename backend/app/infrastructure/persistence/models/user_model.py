from sqlalchemy import Boolean, ForeignKey, Integer, String, Time, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rpps: Mapped[str] = mapped_column(String(11), unique=True, nullable=False, index=True)
    adeli: Mapped[str | None] = mapped_column(String(9), nullable=True)
    am_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    convention_zone: Mapped[int | None] = mapped_column(Integer, nullable=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    photo_url: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    work_hours_start = mapped_column(Time, nullable=False, server_default="07:00:00")
    work_hours_end = mapped_column(Time, nullable=False, server_default="19:00:00")
    lunch_break_start = mapped_column(Time, nullable=False, server_default="12:00:00")
    lunch_break_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    work_zone_radius_km: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    vocal_agent_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    vocal_agent_phone: Mapped[str] = mapped_column(String(20), nullable=False, default="")
    last_login_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    updated_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class CabinetMemberModel(Base):
    __tablename__ = "cabinet_members"

    id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("cabinets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="member")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    color: Mapped[str] = mapped_column(String(20), nullable=False, server_default="#3B82F6")
    joined_at = mapped_column(TIMESTAMP(timezone=True), nullable=False, server_default=func.now())
    left_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)
