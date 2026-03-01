"""Use case : export FEC (Fichier des Écritures Comptables).

Format normalisé par l'article A.47 A-1 du Livre des Procédures Fiscales.
18 colonnes, séparateur tabulation, UTF-8 sans BOM.
"""

import csv
import datetime
import io
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.billing.export_csv import classify_act_code

# Plan comptable simplifié IDEL BNC
PLAN_COMPTABLE = {
    "411100": "Organismes sociaux (CPAM)",
    "411200": "Mutuelles / Complémentaires",
    "411300": "Patients - Reste à charge",
    "706100": "Honoraires infirmiers",
    "706200": "Indemnités de déplacement (IFD/IFI)",
    "706300": "Indemnités kilométriques (IK)",
    "706400": "Majorations",
}

FEC_HEADERS = [
    "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
    "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
    "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
    "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
]


def _fmt_date_fec(d: datetime.date | datetime.datetime | None) -> str:
    if d is None:
        return ""
    if isinstance(d, datetime.datetime):
        return d.strftime("%Y%m%d")
    return d.strftime("%Y%m%d")


def _fmt_amount(v: Decimal | str | None) -> str:
    if v is None:
        return "0.00"
    return f"{Decimal(str(v)):.2f}"


class ExportFECUseCase:
    """Export FEC — 2 écritures comptables par facture (débit + crédit).

    Séparateur tabulation, UTF-8 sans BOM, 18 colonnes.
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def execute(self, cabinet_id: UUID, year: int) -> bytes:
        date_from = datetime.date(year, 1, 1)
        date_to = datetime.date(year, 12, 31)

        # Charger les factures validées, transmises ou payées de l'exercice
        invoices_sql = text("""
            SELECT
                i.id,
                i.care_date,
                i.invoice_number,
                i.invoice_date,
                i.total_amo,
                i.total_amc,
                i.total_patient,
                i.total_amount,
                i.tiers_payant_type,
                i.status,
                i.validated_at,
                i.patient_id
            FROM invoices i
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status IN ('validated', 'transmitted', 'paid')
            ORDER BY i.care_date ASC, i.created_at ASC
        """)
        inv_result = await self._session.execute(invoices_sql, {
            "cabinet_id": str(cabinet_id),
            "date_from": date_from,
            "date_to": date_to,
        })
        invoice_rows = inv_result.fetchall()

        if not invoice_rows:
            return self._build_fec([])

        # Charger les lignes pour ventiler les produits par nature
        invoice_ids = [str(r[0]) for r in invoice_rows]
        id_placeholders = ", ".join(f":id{i}" for i in range(len(invoice_ids)))
        id_params = {f"id{i}": iid for i, iid in enumerate(invoice_ids)}

        lines_sql = text(f"""
            SELECT invoice_id, act_code, line_total
            FROM invoice_lines
            WHERE invoice_id IN ({id_placeholders})
        """)
        lines_result = await self._session.execute(lines_sql, id_params)
        lines_rows = lines_result.fetchall()

        lines_by_invoice: dict[str, list] = {}
        for row in lines_rows:
            lines_by_invoice.setdefault(str(row[0]), []).append(row)

        # Construire les écritures FEC
        ecritures = []
        for idx, row in enumerate(invoice_rows, start=1):
            inv_id = str(row[0])
            care_date = row[1]
            invoice_number = row[2] or f"FAC{idx:04d}"
            invoice_date = row[3]
            total_amo = Decimal(str(row[4])) if row[4] else Decimal("0")
            total_amc = Decimal(str(row[5])) if row[5] else Decimal("0")
            total_patient = Decimal(str(row[6])) if row[6] else Decimal("0")
            total_amount = Decimal(str(row[7])) if row[7] else Decimal("0")
            tiers_payant = row[8] or "total"
            validated_at = row[10]

            # Ventiler les produits par nature comptable
            inv_lines = lines_by_invoice.get(inv_id, [])
            honoraires = Decimal("0")
            indem = Decimal("0")
            ik = Decimal("0")
            for lrow in inv_lines:
                lt = Decimal(str(lrow[2])) if lrow[2] else Decimal("0")
                cat = classify_act_code(lrow[1] or "")
                if cat == "ik":
                    ik += lt
                elif cat == "indem":
                    indem += lt
                else:
                    honoraires += lt

            valid_date_str = _fmt_date_fec(validated_at)
            ecriture_date = _fmt_date_fec(care_date)
            piece_date = _fmt_date_fec(invoice_date)
            ecriture_lib = f"Soins {_fmt_date_fec(care_date)}"

            # -- Écriture débit : compte client (qui doit payer) --
            # Selon le type de tiers payant, le compte client varie
            if tiers_payant == "total":
                # Tout en tiers payant : CPAM paie la part AMO, mutuelle paie AMC
                if total_amo > 0:
                    ecritures.append({
                        "JournalCode": "VT",
                        "JournalLib": "Journal des ventes",
                        "EcritureNum": invoice_number,
                        "EcritureDate": ecriture_date,
                        "CompteNum": "411100",
                        "CompteLib": PLAN_COMPTABLE["411100"],
                        "CompAuxNum": "",
                        "CompAuxLib": "",
                        "PieceRef": invoice_number,
                        "PieceDate": piece_date,
                        "EcritureLib": ecriture_lib + " (CPAM)",
                        "Debit": _fmt_amount(total_amo),
                        "Credit": "0.00",
                        "EcritureLet": "",
                        "DateLet": "",
                        "ValidDate": valid_date_str,
                        "Montantdevise": "",
                        "Idevise": "",
                    })
                if total_amc > 0:
                    ecritures.append({
                        "JournalCode": "VT",
                        "JournalLib": "Journal des ventes",
                        "EcritureNum": invoice_number,
                        "EcritureDate": ecriture_date,
                        "CompteNum": "411200",
                        "CompteLib": PLAN_COMPTABLE["411200"],
                        "CompAuxNum": "",
                        "CompAuxLib": "",
                        "PieceRef": invoice_number,
                        "PieceDate": piece_date,
                        "EcritureLib": ecriture_lib + " (Mutuelle)",
                        "Debit": _fmt_amount(total_amc),
                        "Credit": "0.00",
                        "EcritureLet": "",
                        "DateLet": "",
                        "ValidDate": valid_date_str,
                        "Montantdevise": "",
                        "Idevise": "",
                    })
            else:
                # Tiers partiel ou aucun : compte patient
                ecritures.append({
                    "JournalCode": "VT",
                    "JournalLib": "Journal des ventes",
                    "EcritureNum": invoice_number,
                    "EcritureDate": ecriture_date,
                    "CompteNum": "411300",
                    "CompteLib": PLAN_COMPTABLE["411300"],
                    "CompAuxNum": "",
                    "CompAuxLib": "",
                    "PieceRef": invoice_number,
                    "PieceDate": piece_date,
                    "EcritureLib": ecriture_lib,
                    "Debit": _fmt_amount(total_amount),
                    "Credit": "0.00",
                    "EcritureLet": "",
                    "DateLet": "",
                    "ValidDate": valid_date_str,
                    "Montantdevise": "",
                    "Idevise": "",
                })

            # -- Écriture(s) crédit : comptes de produits --
            product_lines = [
                ("706100", honoraires),
                ("706200", indem),
                ("706300", ik),
            ]
            for compte, montant in product_lines:
                if montant > 0:
                    ecritures.append({
                        "JournalCode": "VT",
                        "JournalLib": "Journal des ventes",
                        "EcritureNum": invoice_number,
                        "EcritureDate": ecriture_date,
                        "CompteNum": compte,
                        "CompteLib": PLAN_COMPTABLE[compte],
                        "CompAuxNum": "",
                        "CompAuxLib": "",
                        "PieceRef": invoice_number,
                        "PieceDate": piece_date,
                        "EcritureLib": ecriture_lib,
                        "Debit": "0.00",
                        "Credit": _fmt_amount(montant),
                        "EcritureLet": "",
                        "DateLet": "",
                        "ValidDate": valid_date_str,
                        "Montantdevise": "",
                        "Idevise": "",
                    })

            # Si aucune ligne (facture sans lignes), écriture unique en 706100
            if not inv_lines:
                ecritures.append({
                    "JournalCode": "VT",
                    "JournalLib": "Journal des ventes",
                    "EcritureNum": invoice_number,
                    "EcritureDate": ecriture_date,
                    "CompteNum": "706100",
                    "CompteLib": PLAN_COMPTABLE["706100"],
                    "CompAuxNum": "",
                    "CompAuxLib": "",
                    "PieceRef": invoice_number,
                    "PieceDate": piece_date,
                    "EcritureLib": ecriture_lib,
                    "Debit": "0.00",
                    "Credit": _fmt_amount(total_amount),
                    "EcritureLet": "",
                    "DateLet": "",
                    "ValidDate": valid_date_str,
                    "Montantdevise": "",
                    "Idevise": "",
                })

        return self._build_fec(ecritures)

    @staticmethod
    def _build_fec(ecritures: list[dict]) -> bytes:
        buffer = io.StringIO()
        writer = csv.DictWriter(
            buffer,
            fieldnames=FEC_HEADERS,
            delimiter="\t",
            quoting=csv.QUOTE_MINIMAL,
            lineterminator="\r\n",
        )
        writer.writeheader()
        for e in ecritures:
            writer.writerow(e)
        # FEC : UTF-8 sans BOM
        return buffer.getvalue().encode("utf-8")
