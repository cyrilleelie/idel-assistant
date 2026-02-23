"""Routes CRUD pour les membres du cabinet."""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import CabinetMember
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_cabinet_repository,
    get_current_user,
    get_user_repository,
)
from app.infrastructure.api.schemas.cabinet_member_schemas import (
    CabinetMemberInvite,
    CabinetMemberListResponse,
    CabinetMemberResponse,
    CabinetMemberUpdate,
)
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models.user_model import (
    CabinetMemberModel,
    UserModel,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyCabinetRepo,
    SQLAlchemyUserRepo,
)

router = APIRouter(prefix="/cabinet-members", tags=["cabinet-members"])


def _require_admin(auth: AuthContext) -> None:
    """Vérifie que l'utilisateur courant est admin du cabinet."""
    if auth.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un administrateur peut effectuer cette action",
        )


@router.get("/", response_model=CabinetMemberListResponse)
async def list_members(
    request: Request,
    include_inactive: bool = False,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les membres du cabinet avec leurs infos utilisateur."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    query = (
        select(CabinetMemberModel, UserModel)
        .join(UserModel, CabinetMemberModel.user_id == UserModel.id)
        .where(CabinetMemberModel.cabinet_id == auth.cabinet_id)
    )
    if not include_inactive:
        query = query.where(CabinetMemberModel.is_active.is_(True))

    result = await db.execute(query)
    rows = result.all()

    items = []
    for member, user in rows:
        items.append(
            CabinetMemberResponse(
                id=str(member.id),
                cabinet_id=str(member.cabinet_id),
                user_id=str(member.user_id),
                first_name=user.first_name,
                last_name=user.last_name,
                email=user.email,
                phone=user.phone,
                role=member.role,
                color=member.color or "#3B82F6",
                is_active=member.is_active,
                joined_at=member.joined_at.date() if member.joined_at else None,
            )
        )

    return CabinetMemberListResponse(items=items, total=len(items))


@router.post(
    "/invite",
    response_model=CabinetMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def invite_member(
    body: CabinetMemberInvite,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    cabinet_repo: SQLAlchemyCabinetRepo = Depends(get_cabinet_repository),
    user_repo: SQLAlchemyUserRepo = Depends(get_user_repository),
):
    """Invite un utilisateur existant dans le cabinet (par email)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    _require_admin(auth)

    user = await user_repo.get_by_email(body.email)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun utilisateur trouvé avec cet email",
        )

    existing = await cabinet_repo.get_member(auth.cabinet_id, user.id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cet utilisateur est déjà membre du cabinet",
        )

    member = CabinetMember(
        cabinet_id=auth.cabinet_id,
        user_id=user.id,
        role=body.role,
        color=body.color,
    )
    member = await cabinet_repo.add_member(member)

    return CabinetMemberResponse(
        id=str(member.id),
        cabinet_id=str(member.cabinet_id),
        user_id=str(member.user_id),
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        phone=user.phone,
        role=member.role,
        color=member.color,
        is_active=member.is_active,
        joined_at=member.joined_at,
    )


@router.patch("/{member_id}", response_model=CabinetMemberResponse)
async def update_member(
    member_id: UUID,
    body: CabinetMemberUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    cabinet_repo: SQLAlchemyCabinetRepo = Depends(get_cabinet_repository),
    db: AsyncSession = Depends(get_db),
):
    """Met à jour le rôle, la couleur ou le statut d'un membre."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    _require_admin(auth)

    # Récupère le membre + user en une requête
    result = await db.execute(
        select(CabinetMemberModel, UserModel)
        .join(UserModel, CabinetMemberModel.user_id == UserModel.id)
        .where(
            CabinetMemberModel.id == member_id,
            CabinetMemberModel.cabinet_id == auth.cabinet_id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membre introuvable",
        )

    member_model, user_model = row

    # Construit l'entité domain pour la mise à jour
    member = CabinetMember(
        id=member_model.id,
        cabinet_id=member_model.cabinet_id,
        user_id=member_model.user_id,
        role=member_model.role,
        is_active=member_model.is_active,
        color=member_model.color or "#3B82F6",
        joined_at=member_model.joined_at.date() if member_model.joined_at else None,
        left_at=member_model.left_at.date() if member_model.left_at else None,
    )

    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(member, field_name, value)

    # Si on désactive, on met la date de départ
    if "is_active" in update_data and not update_data["is_active"]:
        member.left_at = datetime.date.today()

    member = await cabinet_repo.update_member(member)

    return CabinetMemberResponse(
        id=str(member.id),
        cabinet_id=str(member.cabinet_id),
        user_id=str(member.user_id),
        first_name=user_model.first_name,
        last_name=user_model.last_name,
        email=user_model.email,
        phone=user_model.phone,
        role=member.role,
        color=member.color,
        is_active=member.is_active,
        joined_at=member.joined_at,
    )
