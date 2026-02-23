"""Routes pour consulter et modifier les informations du cabinet."""

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.infrastructure.api.dependencies import (
    AuthContext,
    get_cabinet_repository,
    get_current_user,
)
from app.infrastructure.api.schemas.cabinet_schemas import (
    CabinetResponse,
    CabinetUpdate,
)
from app.infrastructure.persistence.repositories import SQLAlchemyCabinetRepo

router = APIRouter(prefix="/cabinet", tags=["cabinet"])


def _cabinet_to_response(cabinet) -> CabinetResponse:
    return CabinetResponse(
        id=str(cabinet.id),
        name=cabinet.name,
        address=cabinet.address,
        plan=cabinet.plan,
        subscription_status=cabinet.subscription_status,
        lat=cabinet.lat,
        lon=cabinet.lon,
        trial_ends_at=cabinet.trial_ends_at,
        created_at=cabinet.created_at,
        updated_at=cabinet.updated_at,
    )


@router.get("/", response_model=CabinetResponse)
async def get_cabinet(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    cabinet_repo: SQLAlchemyCabinetRepo = Depends(get_cabinet_repository),
):
    """Retourne les informations complètes du cabinet."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    cabinet = await cabinet_repo.get_by_id(auth.cabinet_id)
    if cabinet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabinet introuvable",
        )

    return _cabinet_to_response(cabinet)


@router.patch("/", response_model=CabinetResponse)
async def update_cabinet(
    body: CabinetUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    cabinet_repo: SQLAlchemyCabinetRepo = Depends(get_cabinet_repository),
):
    """Modifie le nom et/ou l'adresse du cabinet (admin uniquement)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if auth.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un administrateur peut modifier les informations du cabinet",
        )

    cabinet = await cabinet_repo.get_by_id(auth.cabinet_id)
    if cabinet is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cabinet introuvable",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(cabinet, field_name, value)

    cabinet = await cabinet_repo.update(cabinet)

    return _cabinet_to_response(cabinet)
