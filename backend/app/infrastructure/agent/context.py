"""Contexte d'exécution de l'agent IA."""

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemyTourneeRepo,
)
from app.infrastructure.security.key_manager import KeyManager


@dataclass
class AgentContext:
    """Contexte sécurisé de la requête agent."""

    user_id: UUID
    cabinet_id: UUID
    role: str
    session_id: str
    daily_context_str: str = ""


@dataclass
class AgentDeps:
    """Dépendances injectées dans les outils PydanticAI."""

    db: AsyncSession
    context: AgentContext
    patient_repo: SQLAlchemyPatientRepo
    appointment_repo: SQLAlchemyAppointmentRepo
    invoice_repo: SQLAlchemyInvoiceRepo
    tournee_repo: SQLAlchemyTourneeRepo
    care_catalog_repo: SQLAlchemyCareCatalogRepo
    key_manager: KeyManager

    # Iter B — résultats structurés accumulés pendant l'exécution des outils
    # (PydanticAI 0.4.x ne fournit pas result.tool_calls en contexte streaming)
    pending_tool_results: list = field(default_factory=list)

    # Iter B — repo transmissions (None si non initialisé)
    transmission_repo: Any | None = None
