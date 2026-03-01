"""ExportFsePdfUseCase — PDF feuille de soins (inspiré CERFA S3110)."""

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from fpdf import FPDF
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.fse import Fse
from app.infrastructure.persistence.repositories.sqlalchemy_fse_repo import SQLAlchemyFseRepo


@dataclass
class ExportFsePdfInput:
    cabinet_id: UUID
    fse_id: UUID | None = None          # FSE unique → PDF unitaire
    lot_number: str | None = None       # Lot → PDF groupé (une page par FSE)
    cabinet_name: str = ""
    cabinet_finess: str = ""
    cabinet_address: str = ""


class ExportFsePdfUseCase:
    """Génère un PDF feuille de soins (pour archivage / impression patient)."""

    def __init__(self, session: AsyncSession):
        self._session = session
        self._repo = SQLAlchemyFseRepo(session)

    async def execute(self, inp: ExportFsePdfInput) -> bytes:
        if inp.fse_id:
            fse = await self._repo.get_by_id(inp.fse_id, inp.cabinet_id)
            if not fse:
                raise ValueError("FSE introuvable")
            fses = [fse]
        elif inp.lot_number:
            fses = await self._repo.list_by_lot(inp.cabinet_id, inp.lot_number)
        else:
            raise ValueError("fse_id ou lot_number requis")

        return _build_pdf(fses, inp)


# --- Construction PDF ---

class _FeuilleSoinsPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.cell(0, 6, "FEUILLE DE SOINS — INFIRMIER(E) LIBÉRAL(E)", align="C")
        self.ln(4)
        self.set_draw_color(100, 100, 100)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 7)
        self.cell(0, 5, "Document non opposable à l'Assurance Maladie — Usage interne uniquement", align="C")
        self.ln(3)
        self.cell(0, 5, f"Page {self.page_no()}", align="C")


def _build_pdf(fses: list[Fse], inp: ExportFsePdfInput) -> bytes:
    pdf = _FeuilleSoinsPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.set_margins(15, 15, 15)

    for fse in fses:
        pdf.add_page()
        _render_fse_page(pdf, fse, inp)

    return bytes(pdf.output())


def _render_fse_page(pdf: _FeuilleSoinsPDF, fse: Fse, inp: ExportFsePdfInput) -> None:
    w = pdf.w - 30  # largeur utile

    # --- Cabinet / Professionnel de santé ---
    _section_title(pdf, "PROFESSIONNEL DE SANTÉ")
    _two_col(pdf, "Cabinet / Structure", inp.cabinet_name or "—", w)
    _two_col(pdf, "FINESS", inp.cabinet_finess or "—", w)
    _two_col(pdf, "RPPS", fse.rpps_idel or "—", w)
    if fse.adeli_idel:
        _two_col(pdf, "ADELI", fse.adeli_idel, w)
    _two_col(pdf, "Adresse", inp.cabinet_address or "—", w)
    pdf.ln(4)

    # --- Patient ---
    _section_title(pdf, "PATIENT / ASSURÉ")
    nir_display = fse.nir_patient if fse.nir_patient else "Non renseigné"
    _two_col(pdf, "NIR", nir_display, w)
    if fse.birth_rank:
        _two_col(pdf, "Rang naissance", str(fse.birth_rank), w)
    if fse.organisme_amo:
        _two_col(pdf, "Organisme AMO", fse.organisme_amo, w)
    if fse.organisme_amc:
        _two_col(pdf, "Organisme AMC", fse.organisme_amc, w)
    if fse.exoneration_code:
        _two_col(pdf, "Exonération", fse.exoneration_code, w)
    pdf.ln(4)

    # --- Soins ---
    _section_title(pdf, "SOINS DISPENSÉS")
    _two_col(pdf, "Date des soins", fse.date_soins.strftime("%d/%m/%Y") if fse.date_soins else "—", w)
    if fse.date_prescription:
        _two_col(pdf, "Date prescription", fse.date_prescription.strftime("%d/%m/%Y"), w)
    if fse.rpps_prescripteur:
        _two_col(pdf, "Prescripteur RPPS", fse.rpps_prescripteur, w)
    pdf.ln(3)

    # Tableau des actes
    if fse.actes_fse:
        _table_header(pdf, w)
        for acte in fse.actes_fse:
            _table_row(pdf, acte, w)
    pdf.ln(4)

    # --- Montants ---
    _section_title(pdf, "MONTANTS")
    _montant_row(pdf, "Part AMO (Assurance Maladie)", fse.montant_amo, w)
    _montant_row(pdf, "Part AMC (Complémentaire)", fse.montant_amc, w)
    _montant_row(pdf, "Part patient", fse.montant_patient, w)
    pdf.set_font("Helvetica", "B", 10)
    _montant_row(pdf, "TOTAL", fse.montant_total, w, bold=True)
    pdf.ln(6)

    # --- FSE info ---
    _section_title(pdf, "RÉFÉRENCE FSE")
    _two_col(pdf, "N° FSE", fse.fse_number, w)
    if fse.lot_number:
        _two_col(pdf, "N° Lot", fse.lot_number, w)
    _two_col(pdf, "Statut", fse.status.upper(), w)
    if fse.transmitted_at:
        _two_col(pdf, "Transmis le", fse.transmitted_at.strftime("%d/%m/%Y %H:%M"), w)


# --- Helpers de rendu ---

def _section_title(pdf: _FeuilleSoinsPDF, title: str) -> None:
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(230, 230, 240)
    pdf.cell(0, 6, f"  {title}", fill=True, ln=True)
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 9)


def _two_col(pdf: _FeuilleSoinsPDF, label: str, value: str, w: float) -> None:
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(w * 0.35, 5, label + " :", border=0)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(w * 0.65, 5, value, border=0, ln=True)


def _table_header(pdf: _FeuilleSoinsPDF, w: float) -> None:
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_fill_color(200, 210, 230)
    col_w = [w * p for p in (0.15, 0.40, 0.15, 0.15, 0.15)]
    for header, cw in zip(["Code", "Libellé", "Coef.", "Qté", "Montant (€)"], col_w):
        pdf.cell(cw, 6, header, border=1, fill=True, align="C")
    pdf.ln()


def _table_row(pdf: _FeuilleSoinsPDF, acte, w: float) -> None:
    pdf.set_font("Helvetica", "", 8)
    col_w = [w * p for p in (0.15, 0.40, 0.15, 0.15, 0.15)]
    vals = [
        acte.code,
        acte.label[:40] if acte.label else "",
        str(acte.coefficient),
        str(acte.quantite),
        f"{acte.montant:.2f}",
    ]
    aligns = ["C", "L", "C", "C", "R"]
    for val, cw, align in zip(vals, col_w, aligns):
        pdf.cell(cw, 5, val, border=1, align=align)
    pdf.ln()


def _montant_row(pdf: _FeuilleSoinsPDF, label: str, amount: Decimal, w: float, bold: bool = False) -> None:
    style = "B" if bold else ""
    pdf.set_font("Helvetica", style, 9)
    pdf.cell(w * 0.70, 5, label, border=0)
    pdf.cell(w * 0.30, 5, f"{amount:.2f} €", border=0, align="R", ln=True)
