"""Use case : génération du PDF récapitulatif trimestriel."""

import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.billing.get_quarterly_summary import GetQuarterlySummaryUseCase

_QUARTER_LABELS = {1: "1er", 2: "2ème", 3: "3ème", 4: "4ème"}
_MONTH_NAMES = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
    5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
    9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
}


def _fmt(v: Decimal | None) -> str:
    if v is None:
        return "0,00 €"
    # Format français : séparateur de milliers espace, décimale virgule
    parts = f"{v:.2f}".split(".")
    int_part = parts[0]
    # Ajouter des espaces comme séparateurs de milliers
    int_part_fmt = ""
    for i, c in enumerate(reversed(int_part)):
        if i > 0 and i % 3 == 0:
            int_part_fmt = " " + int_part_fmt
        int_part_fmt = c + int_part_fmt
    return f"{int_part_fmt},{parts[1]} €"


class ExportQuarterlyPDFUseCase:
    """Génère un PDF récapitulatif trimestriel via fpdf2."""

    def __init__(self, session: AsyncSession):
        self._session = session

    async def execute(
        self,
        cabinet_id: UUID,
        year: int,
        quarter: int,
        cabinet_name: str = "Cabinet Infirmier",
    ) -> bytes:
        summary_uc = GetQuarterlySummaryUseCase(self._session)
        s = await summary_uc.execute(cabinet_id, year, quarter)

        return _build_pdf(s, cabinet_name)


def _build_pdf(s, cabinet_name: str) -> bytes:
    """Construit le PDF avec fpdf2."""
    from fpdf import FPDF

    quarter_label = _QUARTER_LABELS.get(s.quarter, str(s.quarter))
    title = f"Récapitulatif trimestriel — {quarter_label} trimestre {s.year}"

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()
    pdf.set_margins(20, 20, 20)

    # En-tête
    pdf.set_fill_color(59, 130, 246)  # bleu
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 14, "Récapitulatif Trimestriel d'Activité", new_x="LMARGIN", new_y="NEXT", align="C", fill=True)
    pdf.set_font("Helvetica", "", 13)
    pdf.cell(0, 10, f"{quarter_label} trimestre {s.year}", new_x="LMARGIN", new_y="NEXT", align="C", fill=True)

    pdf.set_text_color(0, 0, 0)
    pdf.ln(6)

    # Infos cabinet
    pdf.set_font("Helvetica", "", 11)
    pdf.set_fill_color(241, 245, 249)
    pdf.cell(0, 8, f"Cabinet : {cabinet_name}", new_x="LMARGIN", new_y="NEXT", fill=True)
    period_str = (
        f"Période : du {s.period_start.strftime('%d/%m/%Y')} "
        f"au {s.period_end.strftime('%d/%m/%Y')}"
    )
    pdf.cell(0, 8, period_str, new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.ln(6)

    # Section RECETTES
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_fill_color(59, 130, 246)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "Recettes", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    recette_lines = [
        ("Honoraires (actes techniques + majorations)", s.total_honoraires),
        ("Indemnités de déplacement (IFD / IFI)", s.total_indemnites_deplacement),
        ("Indemnités kilométriques (IK)", s.total_ik),
    ]
    pdf.set_font("Helvetica", "", 11)
    for label, amount in recette_lines:
        pdf.set_fill_color(248, 250, 252)
        pdf.cell(120, 9, label, fill=True, border="B")
        pdf.cell(0, 9, _fmt(amount), align="R", fill=True, border="B", new_x="LMARGIN", new_y="NEXT")

    # Total
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(59, 130, 246)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(120, 10, "TOTAL BRUT", fill=True)
    pdf.cell(0, 10, _fmt(s.total_brut), align="R", fill=True, new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(0, 0, 0)
    pdf.ln(6)

    # Section DÉTAIL PAR MOIS
    if s.monthly_breakdown:
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_fill_color(59, 130, 246)
        pdf.set_text_color(255, 255, 255)
        pdf.cell(0, 10, "Détail par mois", new_x="LMARGIN", new_y="NEXT", fill=True)
        pdf.set_text_color(0, 0, 0)
        pdf.ln(2)

        pdf.set_font("Helvetica", "B", 10)
        pdf.set_fill_color(226, 232, 240)
        pdf.cell(50, 8, "Mois", fill=True, border=1)
        pdf.cell(40, 8, "Honoraires", fill=True, border=1, align="R")
        pdf.cell(40, 8, "Indemnités", fill=True, border=1, align="R")
        pdf.cell(30, 8, "IK", fill=True, border=1, align="R")
        pdf.cell(0, 8, "Total", fill=True, border=1, align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 10)
        for mb in s.monthly_breakdown:
            year_part, month_part = mb.month.split("-")
            month_name = _MONTH_NAMES.get(int(month_part), mb.month)
            label = f"{month_name} {year_part}"
            pdf.set_fill_color(248, 250, 252)
            pdf.cell(50, 7, label, fill=True, border=1)
            pdf.cell(40, 7, _fmt(mb.honoraires), fill=True, border=1, align="R")
            pdf.cell(40, 7, _fmt(mb.indemnites), fill=True, border=1, align="R")
            pdf.cell(30, 7, _fmt(mb.ik), fill=True, border=1, align="R")
            pdf.cell(0, 7, _fmt(mb.total), fill=True, border=1, align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.ln(6)

    # Section ACTIVITÉ
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_fill_color(59, 130, 246)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 10, "Activité", new_x="LMARGIN", new_y="NEXT", fill=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(2)

    activity_lines = [
        ("Factures émises", str(s.num_invoices)),
        ("Factures payées", str(s.num_invoices_paid)),
        ("Patients facturés", str(s.num_patients)),
        ("Jours travaillés", str(s.num_working_days)),
    ]
    pdf.set_font("Helvetica", "", 11)
    for label, value in activity_lines:
        pdf.set_fill_color(248, 250, 252)
        pdf.cell(120, 9, label, fill=True, border="B")
        pdf.cell(0, 9, value, align="R", fill=True, border="B", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)

    # Estimation URSSAF
    if s.cotisations_estimees is not None:
        pdf.set_fill_color(254, 243, 199)
        pdf.set_draw_color(251, 191, 36)
        pdf.set_font("Helvetica", "I", 10)
        pdf.multi_cell(
            0, 8,
            f"Estimation cotisations URSSAF (~45 %) : {_fmt(s.cotisations_estimees)}\n"
            "(Indicatif, non contractuel — à vérifier avec votre expert-comptable)",
            fill=True,
            border=1,
        )
        pdf.ln(4)

    # Pied de page
    pdf.set_font("Helvetica", "I", 9)
    pdf.set_text_color(148, 163, 184)
    generated_at = datetime.datetime.now(datetime.UTC).strftime("%d/%m/%Y à %H:%M")
    pdf.cell(0, 8, f"Généré le {generated_at} — Assistant IDEL", align="C", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())
