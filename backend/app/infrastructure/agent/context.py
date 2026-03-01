"""Contexte d'exécution de l'agent IA."""

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemyTourneeRepo,
    SQLAlchemyCareCatalogRepo,
)
from app.infrastructure.security.key_manager import KeyManager


@dataclass
class AgentContext:
    """Contexte sécurisé de la requête agent."""

    user_id: UUID
    cabinet_id: UUID
    role: str
    session_id: str


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
