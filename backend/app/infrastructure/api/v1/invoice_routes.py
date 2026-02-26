"""Routes API pour la facturation (invoices + invoice lines)."""

import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.application.dtos.invoice_dto import (
    AddInvoiceLineDTO,
    CreateInvoiceDTO,
    InvoiceValidationErrorDTO,
    UpdateInvoiceDTO,
    UpdateInvoiceLineDTO,
)
from app.application.use_cases.billing.add_invoice_line import AddInvoiceLineUseCase
from app.application.use_cases.billing.cancel_invoice import CancelInvoiceUseCase
from app.application.use_cases.billing.create_invoice import CreateInvoiceUseCase
from app.application.use_cases.billing.delete_invoice import DeleteInvoiceUseCase
from app.application.use_cases.billing.get_invoice import GetInvoiceUseCase
from app.application.use_cases.billing.list_invoices import ListInvoicesUseCase
from app.application.use_cases.billing.remove_invoice_line import RemoveInvoiceLineUseCase
from app.application.use_cases.billing.update_invoice import UpdateInvoiceUseCase
from app.application.use_cases.billing.update_invoice_line import UpdateInvoiceLineUseCase
from app.application.use_cases.billing.validate_invoice import ValidateInvoiceUseCase
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_care_catalog_repository,
    get_current_user,
    get_invoice_line_repository,
    get_invoice_repository,
    get_patient_repository,
)
from app.infrastructure.api.schemas.invoice_schemas import (
    AddInvoiceLineRequest,
    CreateInvoiceRequest,
    InvoiceListResponse,
    InvoiceLineResponse,
    InvoiceResponse,
    InvoiceValidationErrorResponse,
    UpdateInvoiceLineRequest,
    UpdateInvoiceRequest,
)
from app.infrastructure.persistence.repositories import (
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyInvoiceLineRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
)

router = APIRouter(prefix="/invoices", tags=["invoices"])


def _line_dto_to_response(dto) -> InvoiceLineResponse:
    return InvoiceLineResponse(
        id=str(dto.id),
        invoice_id=str(dto.invoice_id),
        appointment_id=str(dto.appointment_id) if dto.appointment_id else None,
        line_order=dto.line_order,
        act_code=dto.act_code,
        act_label=dto.act_label,
        coefficient=dto.coefficient,
        base_rate=dto.base_rate,
        quantity=dto.quantity,
        line_subtotal=dto.line_subtotal,
        supplements=dto.supplements,
        supplements_total=dto.supplements_total,
        line_total=dto.line_total,
        created_at=dto.created_at,
    )


def _dto_to_response(dto) -> InvoiceResponse:
    return InvoiceResponse(
        id=str(dto.id),
        cabinet_id=str(dto.cabinet_id),
        idel_id=str(dto.idel_id),
        patient_id=str(dto.patient_id),
        prescription_id=str(dto.prescription_id) if dto.prescription_id else None,
        invoice_number=dto.invoice_number,
        invoice_date=dto.invoice_date,
        care_date=dto.care_date,
        total_amo=dto.total_amo,
        total_amc=dto.total_amc,
        total_patient=dto.total_patient,
        total_amount=dto.total_amount,
        tiers_payant_type=dto.tiers_payant_type,
        status=dto.status,
        rejection_reason=dto.rejection_reason,
        validated_at=dto.validated_at,
        transmitted_at=dto.transmitted_at,
        paid_at=dto.paid_at,
        metadata=dto.metadata,
        lines=[_line_dto_to_response(l) for l in dto.lines],
        created_at=dto.created_at,
        updated_at=dto.updated_at,
    )


# --- Invoice CRUD ---


@router.post(
    "/",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invoice(
    body: CreateInvoiceRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Cree une nouvelle facture en brouillon."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = CreateInvoiceDTO(
        patient_id=body.patient_id,
        idel_id=body.idel_id,
        care_date=body.care_date,
        tiers_payant_type=body.tiers_payant_type,
        metadata=body.metadata,
    )

    use_case = CreateInvoiceUseCase(repo)
    result = await use_case.execute(auth.cabinet_id, dto)
    return _dto_to_response(result)


@router.get("/", response_model=InvoiceListResponse)
async def list_invoices(
    request: Request,
    invoice_status: str | None = Query(None, alias="status"),
    patient_id: UUID | None = None,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Liste les factures du cabinet avec filtres et pagination."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ListInvoicesUseCase(repo)
    result = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        status=invoice_status,
        patient_id=patient_id,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=limit,
    )
    return InvoiceListResponse(
        items=[_dto_to_response(i) for i in result.items],
        total=result.total,
        offset=result.offset,
        limit=result.limit,
    )


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Recupere une facture par son ID avec ses lignes."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetInvoiceUseCase(repo)
    result = await use_case.execute(invoice_id, auth.cabinet_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Facture introuvable",
        )
    return _dto_to_response(result)


@router.put("/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: UUID,
    body: UpdateInvoiceRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Modifie les champs editables d'une facture brouillon."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = UpdateInvoiceDTO(
        care_date=body.care_date,
        tiers_payant_type=body.tiers_payant_type,
        metadata=body.metadata,
    )

    use_case = UpdateInvoiceUseCase(repo)
    try:
        result = await use_case.execute(invoice_id, auth.cabinet_id, dto)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _dto_to_response(result)


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Supprime une facture brouillon."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = DeleteInvoiceUseCase(repo)
    try:
        await use_case.execute(invoice_id, auth.cabinet_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


# --- Invoice lifecycle ---


@router.post("/{invoice_id}/validate", response_model=InvoiceResponse)
async def validate_invoice(
    invoice_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Valide une facture brouillon (verrouille, recalcule AMO/AMC)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ValidateInvoiceUseCase(repo, patient_repo)
    try:
        result = await use_case.execute(invoice_id, auth.cabinet_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    if isinstance(result, InvoiceValidationErrorDTO):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result.errors,
        )
    return _dto_to_response(result)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Annule une facture (brouillon ou validee)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = CancelInvoiceUseCase(repo)
    try:
        result = await use_case.execute(invoice_id, auth.cabinet_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _dto_to_response(result)


# --- Invoice lines ---


@router.post(
    "/{invoice_id}/lines",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_invoice_line(
    invoice_id: UUID,
    body: AddInvoiceLineRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    line_repo: SQLAlchemyInvoiceLineRepo = Depends(get_invoice_line_repository),
    catalog_repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Ajoute une ligne d'acte a la facture (tarifs snapshotes depuis le catalogue)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = AddInvoiceLineDTO(
        act_code=body.act_code,
        quantity=body.quantity,
        supplements=body.supplements,
        appointment_id=body.appointment_id,
    )

    use_case = AddInvoiceLineUseCase(invoice_repo, line_repo, catalog_repo)
    try:
        result = await use_case.execute(invoice_id, auth.cabinet_id, dto)
    except ValueError as e:
        detail = str(e)
        if "introuvable" in detail and "catalogue" in detail:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        if "introuvable" in detail:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _dto_to_response(result)


@router.put("/{invoice_id}/lines/{line_id}", response_model=InvoiceResponse)
async def update_invoice_line(
    invoice_id: UUID,
    line_id: UUID,
    body: UpdateInvoiceLineRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    line_repo: SQLAlchemyInvoiceLineRepo = Depends(get_invoice_line_repository),
):
    """Modifie une ligne de facture (quantite, supplements)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = UpdateInvoiceLineDTO(
        quantity=body.quantity,
        supplements=body.supplements,
    )

    use_case = UpdateInvoiceLineUseCase(invoice_repo, line_repo)
    try:
        result = await use_case.execute(invoice_id, line_id, auth.cabinet_id, dto)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _dto_to_response(result)


@router.delete(
    "/{invoice_id}/lines/{line_id}",
    response_model=InvoiceResponse,
)
async def remove_invoice_line(
    invoice_id: UUID,
    line_id: UUID,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    line_repo: SQLAlchemyInvoiceLineRepo = Depends(get_invoice_line_repository),
):
    """Supprime une ligne de facture et recalcule les totaux."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = RemoveInvoiceLineUseCase(invoice_repo, line_repo)
    try:
        result = await use_case.execute(invoice_id, line_id, auth.cabinet_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return _dto_to_response(result)
