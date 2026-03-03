"""Point d'entrée FastAPI de l'application IDEL Assistant."""

import logging
from contextlib import asynccontextmanager

from app.infrastructure.logging.log_handler import install_log_handler

install_log_handler()

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.infrastructure.api.middleware import AuditMiddleware
from app.infrastructure.api.v1 import (
    admin_routes,
    agent_routes,
    appointment_routes,
    auth_routes,
    cabinet_member_routes,
    cabinet_routes,
    care_catalog_routes,
    care_label_routes,
    care_protocol_routes,
    cotation_routes,
    document_routes,
    fse_routes,
    invoice_routes,
    patient_routes,
    prescription_routes,
    rpps_doctor_routes,
    schedule_assignment_routes,
    sector_routes,
    slot_routes,
    tournee_routes,
)
from app.infrastructure.persistence.database import async_session_factory, engine
from app.infrastructure.persistence.seeds.seed_ngap_catalog import seed_ngap_catalog
from app.infrastructure.persistence.seeds.seed_care_labels import seed_care_labels
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

    # Seed du referentiel NGAP si table vide
    try:
        async with async_session_factory() as session:
            await seed_ngap_catalog(session)
            await session.commit()
    except Exception:
        logger.exception("Erreur lors du seed NGAP (non bloquant)")

    # Seed du referentiel de libelles de soins si table vide
    try:
        async with async_session_factory() as session:
            await seed_care_labels(session)
            await session.commit()
    except Exception:
        logger.exception("Erreur lors du seed care_labels (non bloquant)")

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
    allow_origins=allowed_origins if settings.environment != "development" else ["*"],
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
app.include_router(cabinet_routes.router, prefix="/api/v1")
app.include_router(cabinet_member_routes.router, prefix="/api/v1")
app.include_router(document_routes.router, prefix="/api/v1")
app.include_router(care_catalog_routes.router, prefix="/api/v1")
app.include_router(care_catalog_routes.tariff_router, prefix="/api/v1")
app.include_router(invoice_routes.router, prefix="/api/v1")
app.include_router(cotation_routes.router, prefix="/api/v1")
app.include_router(schedule_assignment_routes.router, prefix="/api/v1")
app.include_router(care_label_routes.router, prefix="/api/v1")
app.include_router(prescription_routes.router, prefix="/api/v1")
app.include_router(rpps_doctor_routes.router, prefix="/api/v1")
app.include_router(admin_routes.router, prefix="/api/v1")
app.include_router(fse_routes.router, prefix="/api/v1")
app.include_router(agent_routes.router, prefix="/api/v1")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f">>> VALIDATION ERROR on {request.method} {request.url.path}: {exc.errors()}", flush=True)
    return JSONResponse(status_code=422, content={"detail": exc.errors()})


@app.get("/health")
async def health():
    return {"status": "ok"}
