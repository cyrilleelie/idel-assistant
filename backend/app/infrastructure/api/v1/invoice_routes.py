"""Routes API pour la facturation (invoices + invoice lines)."""

import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.invoice_dto import (
    AddInvoiceLineDTO,
    CorrectAndResubmitDTO,
    CreateInvoiceDTO,
    InvoiceLineInputDTO,
    InvoiceValidationErrorDTO,
    MarkPaidDTO,
    RejectInvoiceDTO,
    UpdateInvoiceDTO,
    UpdateInvoiceLineDTO,
)
from app.application.use_cases.billing.add_invoice_line import AddInvoiceLineUseCase
from app.application.use_cases.billing.export_csv import ExportCSVUseCase
from app.application.use_cases.billing.export_fec import ExportFECUseCase
from app.application.use_cases.billing.export_quarterly_pdf import ExportQuarterlyPDFUseCase
from app.application.use_cases.billing.export_recettes import ExportRecettesUseCase
from app.application.use_cases.billing.get_quarterly_summary import GetQuarterlySummaryUseCase
from app.application.use_cases.billing.cancel_invoice import CancelInvoiceUseCase
from app.application.use_cases.billing.compare_periods import ComparePeriodsUseCase
from app.application.use_cases.billing.correct_and_resubmit import CorrectAndResubmitUseCase
from app.application.use_cases.billing.create_invoice import CreateInvoiceUseCase
from app.application.use_cases.billing.delete_invoice import DeleteInvoiceUseCase
from app.application.use_cases.billing.get_invoice import GetInvoiceUseCase
from app.application.use_cases.billing.get_monthly_stats import GetMonthlyStatsUseCase
from app.application.use_cases.billing.get_stats_per_idel import GetStatsPerIdelUseCase
from app.application.use_cases.billing.list_invoices import ListInvoicesUseCase
from app.application.use_cases.billing.mark_invoices_paid import MarkInvoicesPaidUseCase
from app.application.use_cases.billing.reject_invoice import RejectInvoiceUseCase
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
    CorrectAndResubmitRequest,
    CreateInvoiceRequest,
    IdelStatsResponse,
    InvoiceListResponse,
    InvoiceLineResponse,
    InvoiceResponse,
    InvoiceValidationErrorResponse,
    MarkPaidRequest,
    MarkPaidResultResponse,
    MonthlyStatsResponse,
    PeriodComparisonResponse,
    RejectInvoiceRequest,
    RejectedInvoiceResponse,
    UpdateInvoiceLineRequest,
    UpdateInvoiceRequest,
)
from app.infrastructure.persistence.database import get_db
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
        appointment_id=str(dto.appointment_id) if dto.appointment_id else None,
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
        payment_date=dto.payment_date,
        payment_reference=dto.payment_reference,
        payment_amount=dto.payment_amount,
        rejection_code=dto.rejection_code,
        rejected_at=dto.rejected_at,
        corrected_invoice_id=str(dto.corrected_invoice_id) if dto.corrected_invoice_id else None,
    )


# --- Stats (déclarées avant /{invoice_id} pour éviter capture par la route paramétrique) ---


@router.get("/stats/monthly", response_model=MonthlyStatsResponse)
async def get_monthly_stats(
    request: Request,
    period: str = Query(..., description="Période YYYY-MM, ex: 2026-02"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Statistiques mensuelles : totaux par statut, répartition journalière, top actes."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetMonthlyStatsUseCase(db)
    dto = await use_case.execute(auth.cabinet_id, period)

    return MonthlyStatsResponse(
        period=dto.period,
        total_invoiced=dto.total_invoiced,
        total_pending=dto.total_pending,
        total_paid=dto.total_paid,
        total_rejected=dto.total_rejected,
        num_invoices=dto.num_invoices,
        num_working_days=dto.num_working_days,
        avg_daily_revenue=dto.avg_daily_revenue,
        daily_breakdown=[
            {"date": b.date, "total": b.total, "count": b.count}
            for b in dto.daily_breakdown
        ],
        top_acts=[
            {
                "act_code": a.act_code,
                "act_label": a.act_label,
                "count": a.count,
                "total": a.total,
                "percentage": a.percentage,
            }
            for a in dto.top_acts
        ],
    )


@router.get("/stats/compare", response_model=PeriodComparisonResponse)
async def compare_periods(
    request: Request,
    period1: str = Query(..., description="Première période YYYY-MM"),
    period2: str = Query(..., description="Deuxième période YYYY-MM"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Comparaison de deux périodes mensuelles avec évolutions en %."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ComparePeriodsUseCase(db)
    dto = await use_case.execute(auth.cabinet_id, period1, period2)

    def _monthly_to_response(m):
        return MonthlyStatsResponse(
            period=m.period,
            total_invoiced=m.total_invoiced,
            total_pending=m.total_pending,
            total_paid=m.total_paid,
            total_rejected=m.total_rejected,
            num_invoices=m.num_invoices,
            num_working_days=m.num_working_days,
            avg_daily_revenue=m.avg_daily_revenue,
            daily_breakdown=[
                {"date": b.date, "total": b.total, "count": b.count}
                for b in m.daily_breakdown
            ],
            top_acts=[
                {
                    "act_code": a.act_code,
                    "act_label": a.act_label,
                    "count": a.count,
                    "total": a.total,
                    "percentage": a.percentage,
                }
                for a in m.top_acts
            ],
        )

    return PeriodComparisonResponse(
        period1=_monthly_to_response(dto.period1),
        period2=_monthly_to_response(dto.period2),
        evolution_invoiced=dto.evolution_invoiced,
        evolution_paid=dto.evolution_paid,
        evolution_rejected=dto.evolution_rejected,
    )


@router.get("/stats/per-idel", response_model=list[IdelStatsResponse])
async def get_stats_per_idel(
    request: Request,
    period: str = Query(..., description="Période YYYY-MM"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Statistiques de facturation par IDEL pour la période donnée."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetStatsPerIdelUseCase(db)
    stats = await use_case.execute(auth.cabinet_id, period)

    return [
        IdelStatsResponse(
            idel_id=str(s.idel_id),
            idel_name=s.idel_name,
            total_invoiced=s.total_invoiced,
            num_invoices=s.num_invoices,
            percentage_of_cabinet=s.percentage_of_cabinet,
        )
        for s in stats
    ]


@router.post("/mark-paid", response_model=MarkPaidResultResponse)
async def mark_invoices_paid(
    body: MarkPaidRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Marque un lot de factures comme payées."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = MarkPaidDTO(
        invoice_ids=list(body.invoice_ids),
        payment_date=body.payment_date,
        payment_reference=body.payment_reference,
        payment_amount=body.payment_amount,
    )
    use_case = MarkInvoicesPaidUseCase(repo)
    result = await use_case.execute(auth.cabinet_id, dto)
    return MarkPaidResultResponse(marked_paid=result.marked_paid, errors=result.errors)


@router.get("/unpaid", response_model=InvoiceListResponse)
async def list_unpaid_invoices(
    request: Request,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Liste les factures en attente de paiement (validated + transmitted)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    items, total = await repo.list_unpaid(
        cabinet_id=auth.cabinet_id,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=limit,
    )
    from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
    dtos = [invoice_entity_to_dto(inv) for inv in items]
    return InvoiceListResponse(
        items=[_dto_to_response(d) for d in dtos],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/rejected", response_model=list[RejectedInvoiceResponse])
async def list_rejected_invoices(
    request: Request,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Liste les factures rejetées avec indication si une correction existe."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    pairs = await repo.list_rejected(
        cabinet_id=auth.cabinet_id,
        date_from=date_from,
        date_to=date_to,
    )
    from app.application.use_cases.billing.invoice_helpers import invoice_entity_to_dto
    return [
        RejectedInvoiceResponse(
            invoice=_dto_to_response(invoice_entity_to_dto(inv)),
            correction_invoice_id=str(correction_id) if correction_id else None,
        )
        for inv, correction_id in pairs
    ]


# --- Export comptable ---


@router.get("/export/csv")
async def export_invoices_csv(
    request: Request,
    date_from: datetime.date = Query(..., description="Date début (YYYY-MM-DD)"),
    date_to: datetime.date = Query(..., description="Date fin (YYYY-MM-DD)"),
    invoice_status: str | None = Query(None, alias="status", description="Statuts séparés par virgule (ex: validated,paid)"),
    idel_id: UUID | None = Query(None),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Export CSV des factures — séparateur ; UTF-8 BOM, format comptable français."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    if invoice_status:
        statuses = [s.strip() for s in invoice_status.split(",") if s.strip()]
    else:
        statuses = ["validated", "transmitted", "paid"]

    use_case = ExportCSVUseCase(db, patient_repo)
    content = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        date_from=date_from,
        date_to=date_to,
        statuses=statuses,
        idel_id=idel_id,
    )

    filename = f"factures_{date_from}_{date_to}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/fec")
async def export_fec(
    request: Request,
    year: int = Query(..., description="Exercice comptable (ex: 2026)"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export FEC (Fichier des Écritures Comptables) — format fiscal normalisé."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ExportFECUseCase(db)
    content = await use_case.execute(cabinet_id=auth.cabinet_id, year=year)

    filename = f"CabinetFEC{year}1231.txt"
    return Response(
        content=content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/recettes")
async def export_livre_recettes(
    request: Request,
    date_from: datetime.date = Query(...),
    date_to: datetime.date = Query(...),
    idel_id: UUID | None = Query(None),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
):
    """Export livre des recettes — factures payées uniquement, format BNC."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ExportRecettesUseCase(db, patient_repo)
    content = await use_case.execute(
        cabinet_id=auth.cabinet_id,
        date_from=date_from,
        date_to=date_to,
        idel_id=idel_id,
    )

    filename = f"livre_recettes_{date_from}_{date_to}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/quarterly-summary")
async def get_quarterly_summary(
    request: Request,
    year: int = Query(...),
    quarter: int = Query(..., ge=1, le=4),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Récapitulatif trimestriel en JSON (URSSAF / CARPIMKO)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = GetQuarterlySummaryUseCase(db)
    try:
        dto = await use_case.execute(auth.cabinet_id, year, quarter)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    return {
        "year": dto.year,
        "quarter": dto.quarter,
        "period_start": dto.period_start.isoformat(),
        "period_end": dto.period_end.isoformat(),
        "total_honoraires": str(dto.total_honoraires),
        "total_indemnites_deplacement": str(dto.total_indemnites_deplacement),
        "total_ik": str(dto.total_ik),
        "total_brut": str(dto.total_brut),
        "num_invoices": dto.num_invoices,
        "num_invoices_paid": dto.num_invoices_paid,
        "num_patients": dto.num_patients,
        "num_working_days": dto.num_working_days,
        "cotisations_estimees": str(dto.cotisations_estimees) if dto.cotisations_estimees else None,
        "monthly_breakdown": [
            {
                "month": mb.month,
                "honoraires": str(mb.honoraires),
                "indemnites": str(mb.indemnites),
                "ik": str(mb.ik),
                "total": str(mb.total),
                "num_invoices": mb.num_invoices,
            }
            for mb in dto.monthly_breakdown
        ],
    }


@router.get("/export/quarterly-pdf")
async def export_quarterly_pdf(
    request: Request,
    year: int = Query(...),
    quarter: int = Query(..., ge=1, le=4),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export PDF du récapitulatif trimestriel."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    use_case = ExportQuarterlyPDFUseCase(db)
    try:
        content = await use_case.execute(auth.cabinet_id, year, quarter)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    filename = f"recap_trimestriel_{year}-T{quarter}.pdf"
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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
    limit: int = Query(20, ge=1, le=500),
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


# --- Invoice lifecycle : reject + correct-and-resubmit ---


@router.post("/{invoice_id}/reject", response_model=InvoiceResponse)
async def reject_invoice(
    invoice_id: UUID,
    body: RejectInvoiceRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Rejette une facture validée ou transmise (ex : refus CPAM)."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    dto = RejectInvoiceDTO(
        rejection_reason=body.rejection_reason,
        rejection_code=body.rejection_code,
    )
    use_case = RejectInvoiceUseCase(repo)
    try:
        result = await use_case.execute(invoice_id, auth.cabinet_id, dto)
    except ValueError as e:
        detail = str(e)
        code = status.HTTP_409_CONFLICT if "statut" in detail else status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=detail)
    return _dto_to_response(result)


@router.post("/{invoice_id}/correct-and-resubmit", response_model=InvoiceResponse)
async def correct_and_resubmit(
    invoice_id: UUID,
    body: CorrectAndResubmitRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
):
    """Crée une nouvelle facture corrigeant une facture rejetée."""
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    from decimal import Decimal as D
    lines_dto = [
        InvoiceLineInputDTO(
            act_code=l.act_code,
            act_label=l.act_label,
            coefficient=l.coefficient,
            base_rate=l.base_rate,
            quantity=l.quantity,
            supplements=l.supplements,
        )
        for l in body.lines
    ]
    dto = CorrectAndResubmitDTO(
        lines=lines_dto,
        prescription_id=body.prescription_id,
    )
    use_case = CorrectAndResubmitUseCase(repo)
    try:
        result = await use_case.execute(invoice_id, auth.cabinet_id, dto)
    except ValueError as e:
        detail = str(e)
        code = status.HTTP_409_CONFLICT if "statut" in detail else status.HTTP_404_NOT_FOUND
        raise HTTPException(status_code=code, detail=detail)
    return _dto_to_response(result)
