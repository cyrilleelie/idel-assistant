"""Dépendances FastAPI : auth, injection de repos, RLS."""

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models.user_model import (
    CabinetMemberModel,
    UserModel,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyCabinetRepo,
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyDocumentRepo,
    SQLAlchemyPatientRepo,
    SQLAlchemyScheduleAssignmentRepo,
    SQLAlchemySectorRepo,
    SQLAlchemyTariffUpdateRepo,
    SQLAlchemyUserRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_protocol_repo import (
    SQLAlchemyCareProtocolRepo,
)
from app.infrastructure.services.fake_routing_service import FakeRoutingService
from app.infrastructure.security.jwt_handler import TokenError, verify_token
from app.infrastructure.security.key_manager import KeyManager
from app.infrastructure.security.token_blacklist import is_token_blacklisted

from sqlalchemy import select

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# --- KeyManager (singleton) ---


_key_manager: KeyManager | None = None


def get_key_manager() -> KeyManager:
    global _key_manager
    if _key_manager is None:
        _key_manager = KeyManager(settings.encryption_master_key)
    return _key_manager


# --- Current user from JWT ---


class AuthContext:
    """Contexte d'authentification pour la requête courante."""

    def __init__(self, user_id: UUID, cabinet_id: UUID, role: str):
        self.user_id = user_id
        self.cabinet_id = cabinet_id
        self.role = role


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> AuthContext:
    """Extrait et valide le JWT, vérifie l'utilisateur en BDD, active le RLS."""
    try:
        payload = verify_token(token)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Vérifie que le token n'a pas été révoqué (logout)
    jti = payload.get("jti")
    if jti:
        try:
            if await is_token_blacklisted(jti):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token révoqué",
                    headers={"WWW-Authenticate": "Bearer"},
                )
        except HTTPException:
            raise
        except Exception:
            # Si Redis est indisponible, on laisse passer (fail-open)
            pass

    user_id_str = payload.get("sub")
    cabinet_id_str = payload.get("cabinet_id")

    if not user_id_str or not cabinet_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )

    try:
        user_id = UUID(user_id_str)
        cabinet_id = UUID(cabinet_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )

    # Vérifie que l'utilisateur existe
    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable",
        )

    # Vérifie que l'utilisateur est membre actif du cabinet
    result = await db.execute(
        select(CabinetMemberModel).where(
            CabinetMemberModel.cabinet_id == cabinet_id,
            CabinetMemberModel.user_id == user_id,
            CabinetMemberModel.is_active.is_(True),
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Accès au cabinet refusé",
        )

    # Active le Row Level Security pour cette transaction
    await db.execute(
        text("SELECT set_config('app.current_cabinet_id', :cid, true)"),
        {"cid": str(cabinet_id)},
    )

    return AuthContext(
        user_id=user_id,
        cabinet_id=cabinet_id,
        role=member.role,
    )


# --- Repository factories ---


def get_user_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyUserRepo:
    return SQLAlchemyUserRepo(db)


def get_cabinet_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyCabinetRepo:
    return SQLAlchemyCabinetRepo(db)


def get_patient_repository(
    db: AsyncSession = Depends(get_db),
    km: KeyManager = Depends(get_key_manager),
) -> SQLAlchemyPatientRepo:
    return SQLAlchemyPatientRepo(db, km)


def get_appointment_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyAppointmentRepo:
    return SQLAlchemyAppointmentRepo(db)


def get_care_protocol_repository(
    db: AsyncSession = Depends(get_db),
    km: KeyManager = Depends(get_key_manager),
) -> SQLAlchemyCareProtocolRepo:
    return SQLAlchemyCareProtocolRepo(db, km)


def get_document_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyDocumentRepo:
    return SQLAlchemyDocumentRepo(db)


def get_schedule_assignment_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyScheduleAssignmentRepo:
    return SQLAlchemyScheduleAssignmentRepo(db)


def get_sector_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemySectorRepo:
    return SQLAlchemySectorRepo(db)


def get_care_catalog_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyCareCatalogRepo:
    return SQLAlchemyCareCatalogRepo(db)


def get_tariff_update_repository(
    db: AsyncSession = Depends(get_db),
) -> SQLAlchemyTariffUpdateRepo:
    return SQLAlchemyTariffUpdateRepo(db)


def get_routing_service() -> FakeRoutingService:
    return FakeRoutingService()
