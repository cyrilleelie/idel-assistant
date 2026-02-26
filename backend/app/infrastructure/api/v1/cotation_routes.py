"""Routes API pour la cotation automatique NGAP."""

import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.application.dtos.cotation_dto import SimulateCotationDTO
from app.application.use_cases.billing.create_all_daily_invoices import (
    CreateAllDailyInvoicesUseCase,
)
from app.application.use_cases.billing.create_invoice_from_appointment import (
    CreateInvoiceFromAppointmentUseCase,
)
from app.application.use_cases.billing.create_invoice_from_cotation import (
    CreateInvoiceFromCotationUseCase,
)
from app.application.use_cases.billing.get_daily_billing import GetDailyBillingUseCase
from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase
from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_care_catalog_repository,
    get_current_user,
    get_invoice_line_repository,
    get_invoice_repository,
    get_patient_repository,
)
from app.infrastructure.api.schemas.cotation_schemas import (
    CotationLigneResponse,
    CotationResultResponse,
    SimulateCotationRequest,
)
from app.infrastructure.api.schemas.invoice_schemas import InvoiceResponse
from app.infrastructure.persistence.repositories import (
    SQLAlchemyAppointmentRepo,
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyInvoiceLineRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
)

router = APIRouter(prefix="/cotation", tags=["cotation"])


# --- Request schemas for new endpoints ---


class CreateFromAppointmentRequest(BaseModel):
    appointment_id: UUID
    zone_ik: str = Field(default="plaine", description="'plaine' ou 'montagne'")


class CreateAllDailyRequest(BaseModel):
    date: datetime.date
    zone_ik: str = Field(default="plaine", description="'plaine' ou 'montagne'")


# --- Response schemas for daily billing ---


class DailyBillingItemResponse(BaseModel):
    appointment_id: str
    patient_id: str
    patient_name: str
    idel_id: str
    scheduled_at: datetime.datetime
    care_type: str
    act_codes: list[str]
    status: str
    invoice_id: str | None
    invoice_status: str | None


class DailyBillingResponse(BaseModel):
    date: datetime.date
    items: list[DailyBillingItemResponse]
    total_facture: int
    total_non_facture: int


# --- Helpers ---


def _request_to_dto(body: SimulateCotationRequest) -> SimulateCotationDTO:
    return SimulateCotationDTO(
        patient_id=body.patient_id,
        idel_id=body.idel_id,
        actes=body.actes,
        date_heure_soin=body.date_heure_soin.isoformat(),
        distance_km=body.distance_km,
        lieu=body.lieu,
        zone_ik=body.zone_ik,
        est_premier_soin_journee=body.est_premier_soin_journee,
    )


# --- Existing endpoints ---


@router.post("/simulate", response_model=CotationResultResponse)
async def simulate_cotation(
    body: SimulateCotationRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    catalog_repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Simule une cotation NGAP sans creer de facture."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = _request_to_dto(body)
    use_case = SimulateCotationUseCase(patient_repo, catalog_repo)

    try:
        result = await use_case.execute(auth.cabinet_id, dto)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    return CotationResultResponse(
        lignes=[
            CotationLigneResponse(
                code=l.code,
                label=l.label,
                montant=l.montant,
                quantity=l.quantity,
                coefficient=l.coefficient,
                base_rate=l.base_rate,
                category=l.category,
            )
            for l in result.lignes
        ],
        total=result.total,
        repartition_amo=result.repartition_amo,
        repartition_amc=result.repartition_amc,
        repartition_patient=result.repartition_patient,
        auto_corrections=result.auto_corrections,
        explications=result.explications,
    )


@router.post(
    "/create-invoice",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invoice_from_cotation(
    body: SimulateCotationRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    line_repo: SQLAlchemyInvoiceLineRepo = Depends(get_invoice_line_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    catalog_repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Cree une facture brouillon a partir d'une cotation automatique NGAP."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = _request_to_dto(body)
    use_case = CreateInvoiceFromCotationUseCase(invoice_repo, line_repo, patient_repo, catalog_repo)

    try:
        result = await use_case.execute(auth.cabinet_id, dto)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    from app.infrastructure.api.v1.invoice_routes import _dto_to_response
    return _dto_to_response(result)


# --- New endpoints: daily billing ---


@router.post(
    "/create-from-appointment",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invoice_from_appointment(
    body: CreateFromAppointmentRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    line_repo: SQLAlchemyInvoiceLineRepo = Depends(get_invoice_line_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    catalog_repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Cree une facture a partir d'un RDV complete (utilise ses act_codes et distance_km)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = CreateInvoiceFromAppointmentUseCase(
        appointment_repo, invoice_repo, line_repo, patient_repo, catalog_repo
    )

    try:
        result = await use_case.execute(auth.cabinet_id, body.appointment_id, body.zone_ik)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    from app.infrastructure.api.v1.invoice_routes import _dto_to_response
    return _dto_to_response(result)


@router.get("/daily-billing", response_model=DailyBillingResponse)
async def get_daily_billing(
    request: Request,
    date: datetime.date = Query(..., description="Date au format YYYY-MM-DD"),
    auth: AuthContext = Depends(get_current_user),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Liste les RDV du jour avec statut facturation."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetDailyBillingUseCase(appointment_repo, invoice_repo, patient_repo)
    result = await use_case.execute(auth.cabinet_id, date)

    return DailyBillingResponse(
        date=result.date,
        items=[
            DailyBillingItemResponse(
                appointment_id=str(item.appointment_id),
                patient_id=str(item.patient_id),
                patient_name=item.patient_name,
                idel_id=str(item.idel_id),
                scheduled_at=item.scheduled_at,
                care_type=item.care_type,
                act_codes=item.act_codes,
                status=item.status,
                invoice_id=str(item.invoice_id) if item.invoice_id else None,
                invoice_status=item.invoice_status,
            )
            for item in result.items
        ],
        total_facture=result.total_facture,
        total_non_facture=result.total_non_facture,
    )


@router.post("/create-all-daily", response_model=list[InvoiceResponse])
async def create_all_daily_invoices(
    body: CreateAllDailyRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    appointment_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    line_repo: SQLAlchemyInvoiceLineRepo = Depends(get_invoice_line_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    catalog_repo: SQLAlchemyCareCatalogRepo = Depends(get_care_catalog_repository),
):
    """Genere les factures pour tous les RDV completes non factures du jour."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = CreateAllDailyInvoicesUseCase(
        appointment_repo, invoice_repo, line_repo, patient_repo, catalog_repo
    )
    results = await use_case.execute(auth.cabinet_id, body.date, body.zone_ik)

    from app.infrastructure.api.v1.invoice_routes import _dto_to_response
    return [_dto_to_response(r) for r in results]
