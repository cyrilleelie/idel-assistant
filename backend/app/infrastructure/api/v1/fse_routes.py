"""Routes API FSE — Préparation télétransmission SESAM-Vitale."""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.billing.export_fse_lot import ExportFseLotInput, ExportFseLotUseCase
from app.application.use_cases.billing.export_fse_pdf import ExportFsePdfInput, ExportFsePdfUseCase
from app.application.use_cases.billing.generate_fse import GenerateFseInput, GenerateFseUseCase
from app.application.use_cases.billing.mark_fse_transmitted import MarkFseTransmittedInput, MarkFseTransmittedUseCase
from app.infrastructure.api.dependencies import AuthContext, get_current_user
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.repositories.sqlalchemy_fse_repo import SQLAlchemyFseRepo

router = APIRouter(prefix="/fse", tags=["fse"])


# --- Pydantic schemas ---

class GenerateFseRequest(BaseModel):
    invoice_ids: list[UUID]
    lot_number: str | None = None


class MarkTransmittedRequest(BaseModel):
    fse_ids: list[UUID]


class FseResponse(BaseModel):
    id: str
    fse_number: str
    lot_number: str | None
    date_soins: datetime.date | None
    nir_patient: str
    rpps_idel: str
    adeli_idel: str | None
    organisme_amo: str | None
    organisme_amc: str | None
    montant_total: str
    montant_amo: str
    montant_amc: str
    montant_patient: str
    actes_count: int
    exoneration_code: str | None
    status: str
    exported_at: datetime.datetime | None
    exported_format: str | None
    transmitted_at: datetime.datetime | None
    created_at: datetime.datetime


# --- Endpoints ---

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_fse(
    body: GenerateFseRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Génère des FSE à partir des factures validées."""
    use_case = GenerateFseUseCase(db)
    result = await use_case.execute(GenerateFseInput(
        cabinet_id=auth.cabinet_id,
        invoice_ids=body.invoice_ids,
        lot_number=body.lot_number,
    ))
    await db.commit()
    return {
        "generated": result.generated,
        "skipped": result.skipped,
        "lot_number": result.lot_number,
        "total_generated": len(result.generated),
        "total_skipped": len(result.skipped),
    }


@router.get("", response_model=list[FseResponse])
async def list_fse(
    status_filter: str | None = Query(None, alias="status"),
    lot_number: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Liste les FSE du cabinet."""
    repo = SQLAlchemyFseRepo(db)
    fses = await repo.list_by_cabinet(
        cabinet_id=auth.cabinet_id,
        status=status_filter,
        lot_number=lot_number,
        limit=limit,
        offset=offset,
    )
    return [
        FseResponse(
            id=str(f.id),
            fse_number=f.fse_number,
            lot_number=f.lot_number,
            date_soins=f.date_soins,
            nir_patient=f.nir_patient,
            rpps_idel=f.rpps_idel,
            adeli_idel=f.adeli_idel,
            organisme_amo=f.organisme_amo,
            organisme_amc=f.organisme_amc,
            montant_total=str(f.montant_total),
            montant_amo=str(f.montant_amo),
            montant_amc=str(f.montant_amc),
            montant_patient=str(f.montant_patient),
            actes_count=len(f.actes_fse),
            exoneration_code=f.exoneration_code,
            status=f.status,
            exported_at=f.exported_at,
            exported_format=f.exported_format,
            transmitted_at=f.transmitted_at,
            created_at=f.created_at,
        )
        for f in fses
    ]


@router.get("/export")
async def export_fse_lot(
    fmt: str = Query("csv", pattern="^(csv|xml|json)$"),
    lot_number: str | None = Query(None),
    status_filter: str = Query("generated", alias="status"),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Exporte un lot FSE en CSV, XML ou JSON."""
    use_case = ExportFseLotUseCase(db)
    content = await use_case.execute(ExportFseLotInput(
        cabinet_id=auth.cabinet_id,
        lot_number=lot_number,
        fmt=fmt,
        status_filter=status_filter,
    ))
    await db.commit()

    content_types = {
        "csv": "text/csv; charset=utf-8",
        "xml": "application/xml; charset=utf-8",
        "json": "application/json; charset=utf-8",
    }
    suffixes = {"csv": "csv", "xml": "xml", "json": "json"}
    lot_tag = lot_number or datetime.datetime.now(datetime.UTC).strftime("%Y%m%d")
    filename = f"fse_lot_{lot_tag}.{suffixes[fmt]}"
    return Response(
        content=content,
        media_type=content_types[fmt],
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{fse_id}/pdf")
async def get_fse_pdf(
    fse_id: UUID,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PDF feuille de soins pour une FSE."""
    use_case = ExportFsePdfUseCase(db)
    try:
        pdf_bytes = await use_case.execute(ExportFsePdfInput(
            cabinet_id=auth.cabinet_id,
            fse_id=fse_id,
        ))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="fse_{fse_id}.pdf"'},
    )


@router.get("/batch-pdf")
async def get_lot_pdf(
    lot_number: str = Query(...),
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PDF groupé pour un lot de FSE."""
    use_case = ExportFsePdfUseCase(db)
    try:
        pdf_bytes = await use_case.execute(ExportFsePdfInput(
            cabinet_id=auth.cabinet_id,
            lot_number=lot_number,
        ))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    filename = f"fse_lot_{lot_number}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/mark-transmitted")
async def mark_fse_transmitted(
    body: MarkTransmittedRequest,
    auth: AuthContext = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Marque des FSE comme transmises."""
    use_case = MarkFseTransmittedUseCase(db)
    result = await use_case.execute(MarkFseTransmittedInput(
        cabinet_id=auth.cabinet_id,
        fse_ids=body.fse_ids,
    ))
    await db.commit()
    return {
        "updated": result.updated,
        "skipped": result.skipped,
        "total_updated": len(result.updated),
    }
