"""Modèle SQLAlchemy pour les feedbacks terrain sur les réponses de l'agent IA."""

import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.infrastructure.persistence.models.base import Base


class AgentFeedbackModel(Base):
    __tablename__ = "agent_feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Contexte de la session
    session_id: Mapped[str] = mapped_column(String(36), nullable=False)
    cabinet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cabinets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Message évalué
    user_message: Mapped[str] = mapped_column(Text, nullable=False)
    agent_response: Mapped[str] = mapped_column(Text, nullable=False)
    tool_called: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tool_result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Feedback
    rating: Mapped[str] = mapped_column(String(10), nullable=False)  # "positive" | "negative"
    correction: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Métadonnées
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
