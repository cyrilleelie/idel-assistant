"""Routes d'authentification : register, login, refresh, logout."""

import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.cabinet import Cabinet
from app.domain.entities.user import CabinetMember, User
from app.infrastructure.api.dependencies import AuthContext, get_current_user
from app.infrastructure.api.schemas.auth_schemas import (
    LoginRequest,
    LogoutRequest,
    MeCabinetResponse,
    MeResponse,
    MeUserResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories import (
    SQLAlchemyCabinetRepo,
    SQLAlchemyUserRepo,
)
from app.infrastructure.security.jwt_handler import (
    TokenError,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from app.infrastructure.security.password_handler import hash_password, verify_password
from app.infrastructure.security.token_blacklist import blacklist_token

router = APIRouter(prefix="/auth", tags=["auth"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """Inscrit un nouvel utilisateur avec son cabinet solo."""
    user_repo = SQLAlchemyUserRepo(db)
    cabinet_repo = SQLAlchemyCabinetRepo(db)

    # Vérifie unicité email
    existing = await user_repo.get_by_email(body.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte avec cet email existe déjà",
        )

    # Vérifie unicité RPPS
    from sqlalchemy import select
    from app.infrastructure.persistence.models.user_model import UserModel

    result = await db.execute(
        select(UserModel).where(UserModel.rpps == body.rpps)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ce numéro RPPS est déjà enregistré",
        )

    # Crée le User
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        first_name=body.first_name,
        last_name=body.last_name,
        rpps=body.rpps,
        phone=body.phone,
    )
    user = await user_repo.create(user)

    # Crée le Cabinet solo
    cabinet_name = body.cabinet_name or f"Cabinet {body.last_name}"
    cabinet = Cabinet(
        name=cabinet_name,
        address=body.cabinet_address,
        plan="solo",
        subscription_status="trial",
        trial_ends_at=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
    )
    cabinet = await cabinet_repo.create(cabinet)

    # Ajoute le user comme admin du cabinet
    member = CabinetMember(
        cabinet_id=cabinet.id,
        user_id=user.id,
        role="admin",
    )
    await cabinet_repo.add_member(member)

    # Génère les tokens
    access_token = create_access_token(user.id, cabinet.id, "admin")
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authentifie un utilisateur et retourne les tokens."""
    user_repo = SQLAlchemyUserRepo(db)
    cabinet_repo = SQLAlchemyCabinetRepo(db)

    user = await user_repo.get_by_email(body.email)
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou mot de passe incorrect",
        )

    # Récupère le premier cabinet actif de l'utilisateur
    members = await cabinet_repo.get_members_for_user(user.id)
    if not members:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aucun cabinet associé",
        )

    member = members[0]

    # Met à jour last_login_at
    user.last_login_at = datetime.datetime.now(datetime.UTC)
    await user_repo.update(user)

    access_token = create_access_token(user.id, member.cabinet_id, member.role)
    refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
):
    """Renouvelle les tokens via un refresh token valide."""
    try:
        payload = verify_token(body.refresh_token)
    except TokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token invalide ou expiré",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )

    from uuid import UUID

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide",
        )
    user_id = UUID(sub)

    user_repo = SQLAlchemyUserRepo(db)
    cabinet_repo = SQLAlchemyCabinetRepo(db)

    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Utilisateur introuvable",
        )

    members = await cabinet_repo.get_members_for_user(user.id)
    if not members:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Aucun cabinet associé",
        )

    member = members[0]

    access_token = create_access_token(user.id, member.cabinet_id, member.role)
    new_refresh_token = create_refresh_token(user.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    body: LogoutRequest,
    token: str = Depends(_oauth2_scheme),
):
    """Révoque l'access token courant (et optionnellement le refresh token)."""
    import datetime as dt

    # Blacklist l'access token
    try:
        payload = verify_token(token)
        jti = payload.get("jti")
        exp = payload.get("exp")
        if jti and exp:
            remaining = int(exp - dt.datetime.now(dt.UTC).timestamp())
            if remaining > 0:
                await blacklist_token(jti, remaining)
    except TokenError:
        pass  # Token déjà expiré, rien à faire

    # Blacklist le refresh token si fourni
    if body.refresh_token:
        try:
            payload = verify_token(body.refresh_token)
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                remaining = int(exp - dt.datetime.now(dt.UTC).timestamp())
                if remaining > 0:
                    await blacklist_token(jti, remaining)
        except TokenError:
            pass


@router.get("/me", response_model=MeResponse)
async def get_me(
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retourne le profil de l'utilisateur connecté et les infos de son cabinet."""
    user_repo = SQLAlchemyUserRepo(db)
    cabinet_repo = SQLAlchemyCabinetRepo(db)

    user = await user_repo.get_by_id(auth.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur introuvable",
        )

    cabinet = await cabinet_repo.get_by_id(auth.cabinet_id)
    if not cabinet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabinet introuvable",
        )

    return MeResponse(
        user=MeUserResponse(
            id=str(user.id),
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            rpps=user.rpps,
            phone=user.phone,
            role=auth.role,
        ),
        cabinet=MeCabinetResponse(
            id=str(cabinet.id),
            name=cabinet.name,
            address=cabinet.address,
            plan=cabinet.plan,
            subscription_status=cabinet.subscription_status,
        ),
    )
