"""Routes API pour le referentiel de libelles de soins."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.infrastructure.api.dependencies import (
    AuthContext,
    get_care_label_repository,
    get_current_user,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_label_repo import (
    SQLAlchemyCareLabelRepo,
)
from app.domain.entities.care_label import CareLabel

router = APIRouter(prefix="/care-labels", tags=["care-labels"])


# --- Schemas ---


class CareLabelResponse(BaseModel):
    id: str
    cabinet_id: str | None
    label: str
    act_codes: list[str]
    default_duration_minutes: int
    category: str
    is_system: bool
    is_active: bool
    display_order: int

    model_config = {"from_attributes": True}


class CreateCareLabelRequest(BaseModel):
    label: str
    act_codes: list[str]
    default_duration_minutes: int
    category: str
    display_order: int = 0


class UpdateCareLabelRequest(BaseModel):
    label: str | None = None
    act_codes: list[str] | None = None
    default_duration_minutes: int | None = None
    category: str | None = None
    display_order: int | None = None


def _entity_to_response(entity: CareLabel) -> CareLabelResponse:
    return CareLabelResponse(
        id=str(entity.id),
        cabinet_id=str(entity.cabinet_id) if entity.cabinet_id else None,
        label=entity.label,
        act_codes=entity.act_codes,
        default_duration_minutes=entity.default_duration_minutes,
        category=entity.category,
        is_system=entity.is_system,
        is_active=entity.is_active,
        display_order=entity.display_order,
    )


# --- Routes ---


@router.get("/", response_model=list[CareLabelResponse])
async def list_care_labels(
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareLabelRepo = Depends(get_care_label_repository),
):
    """Liste les libelles de soins actifs (systeme + cabinet)."""
    entities = await repo.list_active(auth.cabinet_id)
    return [_entity_to_response(e) for e in entities]


@router.post("/", response_model=CareLabelResponse, status_code=status.HTTP_201_CREATED)
async def create_care_label(
    body: CreateCareLabelRequest,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareLabelRepo = Depends(get_care_label_repository),
):
    """Cree un libelle de soin personnalise pour le cabinet."""
    entity = CareLabel(
        label=body.label,
        act_codes=body.act_codes,
        default_duration_minutes=body.default_duration_minutes,
        category=body.category,
        display_order=body.display_order,
        is_system=False,
        cabinet_id=auth.cabinet_id,
    )
    created = await repo.create(entity)
    return _entity_to_response(created)


@router.put("/{care_label_id}", response_model=CareLabelResponse)
async def update_care_label(
    care_label_id: UUID,
    body: UpdateCareLabelRequest,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareLabelRepo = Depends(get_care_label_repository),
):
    """Modifie un libelle de soin (systeme ou personnalise)."""
    existing = await repo.get_by_id(care_label_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Label introuvable")
    if existing.cabinet_id is not None and existing.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=403, detail="Acces refuse")

    if body.label is not None:
        existing.label = body.label
    if body.act_codes is not None:
        existing.act_codes = body.act_codes
    if body.default_duration_minutes is not None:
        existing.default_duration_minutes = body.default_duration_minutes
    if body.category is not None:
        existing.category = body.category
    if body.display_order is not None:
        existing.display_order = body.display_order

    updated = await repo.update(existing)
    return _entity_to_response(updated)


@router.delete("/{care_label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_label(
    care_label_id: UUID,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareLabelRepo = Depends(get_care_label_repository),
):
    """Supprime un libelle de soin (systeme ou personnalise)."""
    existing = await repo.get_by_id(care_label_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Label introuvable")
    if existing.cabinet_id is not None and existing.cabinet_id != auth.cabinet_id:
        raise HTTPException(status_code=403, detail="Acces refuse")

    await repo.delete(care_label_id)
