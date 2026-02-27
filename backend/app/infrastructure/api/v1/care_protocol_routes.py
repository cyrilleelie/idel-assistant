"""Routes pour les protocoles de soins."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.domain.entities.care_protocol import CareProtocol
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_care_protocol_repository,
    get_current_user,
    get_patient_repository,
)
from app.infrastructure.api.schemas.care_protocol_schemas import (
    CareProtocolCreate,
    CareProtocolListResponse,
    CareProtocolResponse,
    CareProtocolUpdate,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyPatientRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_care_protocol_repo import (
    SQLAlchemyCareProtocolRepo,
)

router = APIRouter(prefix="/care-protocols", tags=["care-protocols"])


def _entity_to_response(protocol: CareProtocol) -> CareProtocolResponse:
    return CareProtocolResponse(
        id=str(protocol.id),
        patient_id=str(protocol.patient_id),
        cabinet_id=str(protocol.cabinet_id),
        label=protocol.label,
        start_date=protocol.start_date,
        end_date=protocol.end_date,
        status=protocol.status,
        created_at=protocol.created_at,
        updated_at=protocol.updated_at,
    )


@router.post(
    "/",
    response_model=CareProtocolResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_care_protocol(
    body: CareProtocolCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    protocol_repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Crée un plan de soins. Les ordonnances (soins) sont ajoutées séparément via POST /prescriptions."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    patient = await patient_repo.get_by_id(body.patient_id)
    if not patient or patient.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient introuvable",
        )

    protocol = CareProtocol(
        patient_id=body.patient_id,
        cabinet_id=auth.cabinet_id,
        label=body.label,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    protocol = await protocol_repo.create(protocol)
    return _entity_to_response(protocol)


@router.get("/", response_model=CareProtocolListResponse)
async def list_care_protocols(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
    patient_id: UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
):
    """Liste les plans de soins (filtrable par patient)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if patient_id:
        protocols, total = await repo.list_by_patient(
            patient_id=patient_id, status=status_filter, skip=skip, limit=limit
        )
    else:
        protocols, total = await repo.list_by_cabinet(
            cabinet_id=auth.cabinet_id, status=status_filter, skip=skip, limit=limit
        )

    return CareProtocolListResponse(
        items=[_entity_to_response(p) for p in protocols],
        total=total,
    )


@router.patch("/{protocol_id}", response_model=CareProtocolResponse)
async def update_care_protocol(
    protocol_id: UUID,
    body: CareProtocolUpdate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
):
    """Met à jour partiellement un plan de soins (label, dates, statut)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    protocol = await repo.get_by_id(protocol_id)
    if not protocol or protocol.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocole introuvable",
        )

    update_data = body.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(protocol, field_name, value)

    protocol = await repo.update(protocol)
    return _entity_to_response(protocol)


@router.delete("/{protocol_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_care_protocol(
    protocol_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareProtocolRepo = Depends(get_care_protocol_repository),
):
    """Supprime un plan de soins (et les ordonnances liées par CASCADE)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    protocol = await repo.get_by_id(protocol_id)
    if not protocol or protocol.cabinet_id != auth.cabinet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Protocole introuvable",
        )

    await repo.delete(protocol_id)
