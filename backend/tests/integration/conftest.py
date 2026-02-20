"""Fixtures d'integration : BDD PostgreSQL de test + async session."""

from collections.abc import AsyncGenerator
from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.infrastructure.persistence.models import *  # noqa: F401, F403
from app.infrastructure.persistence.models.base import Base
from app.infrastructure.security.key_manager import KeyManager

# BDD de test creee par docker/init-extensions.sql
TEST_DATABASE_URL = "postgresql+asyncpg://idel:idel_dev@localhost:5432/idel_db_test"

TEST_CABINET_ID = UUID("00000000-0000-0000-0000-000000000001")
TEST_MASTER_KEY = "test-encryption-master-key-32b!!"

# Flag pour ne creer les tables qu'une seule fois
_tables_created = False


async def _ensure_tables():
    """Cree les tables si necessaire (une seule fois par run pytest)."""
    global _tables_created
    if _tables_created:
        return
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    _tables_created = True


# Tables a nettoyer entre les tests (ordre inverse des dependances)
_ALL_TABLES = [
    "audit_logs",
    "invoice_lines",
    "invoices",
    "tournee_stops",
    "tournees",
    "transmissions",
    "appointments",
    "care_protocols",
    "care_type_catalog",
    "patients",
    "cabinet_members",
    "users",
    "cabinets",
]


@pytest.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    """Async session avec nettoyage des tables apres chaque test."""
    await _ensure_tables()
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session

    # Nettoie toutes les tables apres chaque test
    async with factory() as cleanup_session:
        for table in _ALL_TABLES:
            await cleanup_session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        await cleanup_session.commit()
    await engine.dispose()


@pytest.fixture
def key_manager() -> KeyManager:
    """KeyManager de test."""
    return KeyManager(TEST_MASTER_KEY)


@pytest.fixture
def cabinet_id() -> UUID:
    """Cabinet ID de test."""
    return TEST_CABINET_ID
