"""Point d'entrée FastAPI de l'application IDEL Assistant."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.infrastructure.api.middleware import AuditMiddleware
from app.infrastructure.api.v1 import (
    appointment_routes,
    auth_routes,
    cabinet_member_routes,
    care_protocol_routes,
    document_routes,
    patient_routes,
    schedule_assignment_routes,
    sector_routes,
    slot_routes,
    tournee_routes,
)
from app.infrastructure.persistence.database import engine
from app.infrastructure.security.token_blacklist import close_redis

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Vérifications au démarrage et nettoyage à l'arrêt."""
    # Startup : vérifier la connexion BDD
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Connexion PostgreSQL OK")
    except Exception:
        logger.exception("Impossible de se connecter à PostgreSQL")
        raise

    yield

    # Shutdown : fermer les connexions
    await close_redis()
    await engine.dispose()
    logger.info("Pool de connexions fermé")


app = FastAPI(
    title="IDEL Assistant API",
    description="API pour les infirmières libérales",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# --- Middleware (ordre : dernier ajouté = premier exécuté) ---

# CORS
allowed_origins = ["http://localhost:3000", "http://localhost:5173"]
if settings.environment == "development":
    allowed_origins.append("http://localhost:8080")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit
app.add_middleware(AuditMiddleware)

# --- Routers ---

app.include_router(auth_routes.router, prefix="/api/v1")
app.include_router(patient_routes.router, prefix="/api/v1")
app.include_router(appointment_routes.router, prefix="/api/v1")
app.include_router(care_protocol_routes.router, prefix="/api/v1")
app.include_router(sector_routes.router, prefix="/api/v1")
app.include_router(slot_routes.router, prefix="/api/v1")
app.include_router(tournee_routes.router, prefix="/api/v1")
app.include_router(cabinet_member_routes.router, prefix="/api/v1")
app.include_router(document_routes.router, prefix="/api/v1")
app.include_router(schedule_assignment_routes.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
