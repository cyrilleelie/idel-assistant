"""Routes API pour la cotation automatique NGAP."""

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.application.dtos.cotation_dto import SimulateCotationDTO
from app.application.use_cases.billing.create_invoice_from_cotation import (
    CreateInvoiceFromCotationUseCase,
)
from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase
from app.infrastructure.api.dependencies import (
    AuthContext,
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
    SQLAlchemyCareCatalogRepo,
    SQLAlchemyInvoiceLineRepo,
    SQLAlchemyInvoiceRepo,
    SQLAlchemyPatientRepo,
)

router = APIRouter(prefix="/cotation", tags=["cotation"])


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

    # Reuse invoice response helper from invoice_routes
    from app.infrastructure.api.v1.invoice_routes import _dto_to_response
    return _dto_to_response(result)
