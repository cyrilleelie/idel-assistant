"""Routes API pour le catalogue d'actes NGAP et les mises a jour tarifaires."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.application.dtos.care_catalog_dto import CreateCustomActDTO
from app.application.use_cases.billing.apply_tariff_update import ApplyTariffUpdateUseCase
from app.application.use_cases.billing.check_tariff_update import CheckTariffUpdateUseCase
from app.application.use_cases.billing.create_custom_act import CreateCustomActUseCase
from app.application.use_cases.billing.get_catalog_entry import GetCatalogEntryUseCase
from app.application.use_cases.billing.list_catalog import ListCatalogUseCase
from app.application.use_cases.billing.toggle_act import ToggleActUseCase
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_care_catalog_repository,
    get_current_user,
    get_tariff_update_repository,
)
from app.infrastructure.api.schemas.care_catalog_schemas import (
    CareCatalogCreate,
    CareCatalogListResponse,
    CareCatalogResponse,
    CareCatalogToggle,
    TariffUpdateListResponse,
    TariffUpdateResponse,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyTariffUpdateRepo,
)

router = APIRouter(prefix="/care-catalog", tags=["care-catalog"])
tariff_router = APIRouter(prefix="/tariff-updates", tags=["tariff-updates"])


def _dto_to_response(dto) -> CareCatalogResponse:
    return CareCatalogResponse(
        id=str(dto.id),
        cabinet_id=str(dto.cabinet_id) if dto.cabinet_id else None,
        code=dto.code,
        lettre_cle=dto.lettre_cle,
        label=dto.label,
        category=dto.category,
        coefficient=dto.coefficient,
        base_rate=dto.base_rate,
        fixed_amount=dto.fixed_amount,
        unit=dto.unit,
        default_duration_minutes=dto.default_duration_minutes,
        is_cumulative=dto.is_cumulative,
        cumul_rules=dto.cumul_rules,
        context_rules=dto.context_rules,
        effective_from=dto.effective_from,
        effective_to=dto.effective_to,
        avenant_source=dto.avenant_source,
        is_system=dto.is_system,
        is_active=dto.is_active,
        display_order=dto.display_order,
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


def _tariff_dto_to_response(dto) -> TariffUpdateResponse:
    return TariffUpdateResponse(
        id=str(dto.id),
        version=dto.version,
        avenant_reference=dto.avenant_reference,
        published_at=dto.published_at,
        effective_at=dto.effective_at,
        description=dto.description,
        changes=dto.changes,
        status=dto.status,
        applied_at=dto.applied_at,
        created_at=dto.created_at,
    )


@router.get("/", response_model=CareCatalogListResponse)
async def list_catalog(
    request: Request,
    category: str | None = None,
    lettre_cle: str | None = None,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Liste les actes du catalogue actifs et en vigueur."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ListCatalogUseCase(repo)
    items = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        category=category,
        lettre_cle=lettre_cle,
    )
    return CareCatalogListResponse(
        items=[_dto_to_response(i) for i in items],
        total=len(items),
    )


@router.get("/suggest-codes")
async def suggest_codes(
    care_type: str,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
):
    """Suggere les codes NGAP par defaut pour un type de soin."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    from app.domain.services.care_type_ngap_mapping import suggest_ngap_codes
    codes = suggest_ngap_codes(care_type)
    return {"care_type": care_type, "suggested_codes": codes}


@router.get("/{entry_id}", response_model=CareCatalogResponse)
async def get_catalog_entry(
    entry_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Recupere un acte du catalogue par son ID."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetCatalogEntryUseCase(repo)
    result = await use_case.execute(entry_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acte introuvable",
        )
    return _dto_to_response(result)


@router.post(
    "/",
    response_model=CareCatalogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_custom_act(
    body: CareCatalogCreate,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Cree un acte personnalise pour le cabinet."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = CreateCustomActDTO(
        code=body.code,
        lettre_cle=body.lettre_cle,
        label=body.label,
        category=body.category,
        unit=body.unit,
        coefficient=body.coefficient,
        base_rate=body.base_rate,
        fixed_amount=body.fixed_amount,
        default_duration_minutes=body.default_duration_minutes,
        is_cumulative=body.is_cumulative,
        cumul_rules=body.cumul_rules,
        context_rules=body.context_rules,
        effective_from=body.effective_from,
        display_order=body.display_order,
    )

    use_case = CreateCustomActUseCase(repo)
    try:
        result = await use_case.execute(auth.cabinet_id, dto)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )
    return _dto_to_response(result)


@router.patch("/{entry_id}/toggle", response_model=CareCatalogResponse)
async def toggle_act(
    entry_id: UUID,
    body: CareCatalogToggle,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Active ou desactive un acte du catalogue."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ToggleActUseCase(repo)
    try:
        result = await use_case.execute(entry_id, body.is_active)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Acte introuvable",
        )
    return _dto_to_response(result)


@tariff_router.get("/check", response_model=TariffUpdateListResponse)
async def check_tariff_updates(
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyTariffUpdateRepo = Depends(get_tariff_update_repository),
):
    """Verifie les mises a jour tarifaires disponibles."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = CheckTariffUpdateUseCase(repo)
    items = await use_case.execute()
    return TariffUpdateListResponse(
        items=[_tariff_dto_to_response(i) for i in items],
        total=len(items),
    )


@tariff_router.post("/{update_id}/apply", response_model=TariffUpdateResponse)
async def apply_tariff_update(
    update_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    catalog_repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
    tariff_repo: SQLAlchemyTariffUpdateRepo = Depends(get_tariff_update_repository),
):
    """Applique une mise a jour tarifaire."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ApplyTariffUpdateUseCase(catalog_repo, tariff_repo)
    try:
        result = await use_case.execute(update_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return _tariff_dto_to_response(result)
