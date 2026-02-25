"""Fixtures pour les tests API."""

import os
from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


from app.infrastructure.persistence.models import *  # noqa: F401, F403
from app.infrastructure.persistence.models.base import Base

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://idel:idel_dev@localhost:5432/idel_db_test",
)

_tables_created = False


async def _ensure_tables():
    global _tables_created
    if _tables_created:
        return
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        # Drop all tables with CASCADE to handle FK dependencies from stale tables
        await conn.execute(text("DROP SCHEMA public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO PUBLIC"))
        await conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    _tables_created = True


_ALL_TABLES = [
    "audit_logs",
    "invoice_lines",
    "invoices",
    "tournee_stops",
    "tournees",
    "transmissions",
    "appointments",
    "care_protocols",
    "patients",
    "sectors",
    "tariff_updates",
    "care_type_catalog",
    "cabinet_members",
    "users",
    "cabinets",
]


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Session de test avec nettoyage entre les tests."""
    await _ensure_tables()
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session
    # Cleanup
    async with factory() as cleanup_session:
        for table in _ALL_TABLES:
            await cleanup_session.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
        await cleanup_session.commit()
    await engine.dispose()


@pytest.fixture
def override_get_db(db_session: AsyncSession):
    """Override de la dépendance get_db pour utiliser la session de test."""

    async def _override():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    return _override


@pytest.fixture
async def client(override_get_db) -> AsyncGenerator[AsyncClient, None]:
    """Client HTTP de test avec BDD de test."""
    from app.infrastructure.persistence.database import get_db
    from app.main import app

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", follow_redirects=True) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Crée un utilisateur de test et retourne les headers d'auth."""
    register_data = {
        "email": f"test-{uuid4().hex[:8]}@example.fr",
        "password": "TestPass123!",
        "first_name": "Sophie",
        "last_name": "Martin",
        "rpps": f"{uuid4().int % 10**11:011d}",
        "phone": "0601020304",
    }
    response = await client.post("/api/v1/auth/register", json=register_data)
    assert response.status_code == 201, response.text
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}
