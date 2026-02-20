"""Routes CRUD pour les secteurs geographiques."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.domain.entities.sector import Sector
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_current_user,
    get_sector_repository,
)
from app.infrastructure.api.schemas.sector_schemas import (
    SectorCreate,
    SectorListResponse,
    SectorResponse,
    SectorUpdate,
)
from app.infrastructure.persistence.repositories import SQLAlchemySectorRepo

router = APIRouter(prefix="/sectors", tags=["sectors"])


def _entity_to_response(sector: Sector) -> SectorResponse:
    return SectorResponse(
        id=str(sector.id),
        cabinet_id=str(sector.cabinet_id),
        name=sector.name,
        postal_codes=sector.postal_codes,
        communes=sector.communes,
        color=sector.color,
        display_order=sector.display_order,
        created_at=sector.created_at,
    )


@router.get("/", response_model=SectorListResponse)
async def list_sectors(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
):
    """Liste les secteurs du cabinet."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    sectors = await repo.list_by_cabinet(auth.cabinet_id)
    return SectorListResponse(
        items=[_entity_to_response(s) for s in sectors],
        total=len(sectors),
    )


@router.post(
    "/",
    response_model=SectorResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_sector(
    body: SectorCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
):
    """Cree un nouveau secteur."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    sector = Sector(
        cabinet_id=auth.cabinet_id,
        name=body.name,
        postal_codes=body.postal_codes,
        communes=body.communes,
        color=body.color,
        display_order=body.display_order,
    )
    sector = await repo.create(sector)
    return _entity_to_response(sector)


@router.patch("/{sector_id}", response_model=SectorResponse)
async def update_sector(
    sector_id: UUID,
    body: SectorUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
):
    """Met a jour un secteur."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    sector = await repo.get_by_id(sector_id)
    if not sector or sector.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Secteur introuvable",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(sector, field_name, value)

    sector = await repo.update(sector)
    return _entity_to_response(sector)


@router.delete("/{sector_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sector(
    sector_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemySectorRepo = Depends(get_sector_repository),
):
    """Supprime un secteur."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    sector = await repo.get_by_id(sector_id)
    if not sector or sector.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Secteur introuvable",
        )
    await repo.delete(sector_id)
