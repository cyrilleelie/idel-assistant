"""Use case : export CSV générique pour le cabinet comptable."""

import csv
import datetime
import io
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# Codes NGAP classifiés par catégorie
_IK_PREFIXES = frozenset({"IK", "IKM", "IKS"})
_INDEM_CODES = frozenset({"IFD", "IFI"})

_STATUS_LABELS = {
    "draft": "Brouillon",
    "validated": "Validée",
    "transmitted": "Transmise",
    "paid": "Payée",
    "rejected": "Rejetée",
    "canceled": "Annulée",
}


def classify_act_code(act_code: str) -> str:
    """Classifie un code acte : 'honoraires', 'indem' ou 'ik'."""
    code = act_code.strip().upper().split()[0]
    if code in _IK_PREFIXES:
        return "ik"
    if code in _INDEM_CODES:
        return "indem"
    return "honoraires"


def _fmt_date(d: datetime.date | None) -> str:
    if d is None:
        return ""
    return d.strftime("%d/%m/%Y")


def _fmt_decimal(v: Decimal | str | None) -> str:
    if v is None:
        return "0.00"
    return f"{Decimal(str(v)):.2f}"


class ExportCSVUseCase:
    """Export CSV des factures pour le cabinet comptable.

    Séparateur ; (standard FR), encodage UTF-8 BOM.
    Ventilation honoraires / indemnités de déplacement / IK.
    """

    def __init__(self, session: AsyncSession, patient_repo=None):
        self._session = session
        self._patient_repo = patient_repo

    async def execute(
        self,
        cabinet_id: UUID,
        date_from: datetime.date,
        date_to: datetime.date,
        statuses: list[str] | None = None,
        idel_id: UUID | None = None,
    ) -> bytes:
        if statuses is None:
            statuses = ["validated", "transmitted", "paid"]

        # --- 1. Charger les factures avec leurs lignes ---
        status_placeholders = ", ".join(f":s{i}" for i in range(len(statuses)))
        status_params = {f"s{i}": s for i, s in enumerate(statuses)}

        idel_filter = ""
        idel_params: dict = {}
        if idel_id is not None:
            idel_filter = "AND i.idel_id = :idel_id"
            idel_params = {"idel_id": str(idel_id)}

        invoices_sql = text(f"""
            SELECT
                i.id,
                i.care_date,
                i.invoice_number,
                i.patient_id,
                i.prescription_id,
                i.total_amo,
                i.total_amc,
                i.total_patient,
                i.total_amount,
                i.status,
                i.payment_date,
                i.payment_reference
            FROM invoices i
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status IN ({status_placeholders})
              {idel_filter}
            ORDER BY i.care_date ASC, i.created_at ASC
        """)

        params: dict = {
            "cabinet_id": str(cabinet_id),
            "date_from": date_from,
            "date_to": date_to,
            **status_params,
            **idel_params,
        }
        inv_result = await self._session.execute(invoices_sql, params)
        invoice_rows = inv_result.fetchall()

        if not invoice_rows:
            return self._build_csv([])

        # --- 2. Charger les lignes pour toutes ces factures ---
        invoice_ids = [str(r[0]) for r in invoice_rows]
        id_placeholders = ", ".join(f":id{i}" for i in range(len(invoice_ids)))
        id_params = {f"id{i}": iid for i, iid in enumerate(invoice_ids)}

        lines_sql = text(f"""
            SELECT invoice_id, act_code, act_label, line_total
            FROM invoice_lines
            WHERE invoice_id IN ({id_placeholders})
            ORDER BY invoice_id, line_order
        """)
        lines_result = await self._session.execute(lines_sql, id_params)
        lines_rows = lines_result.fetchall()

        # Indexer les lignes par invoice_id
        lines_by_invoice: dict[str, list] = {}
        for row in lines_rows:
            inv_id = str(row[0])
            lines_by_invoice.setdefault(inv_id, []).append(row)

        # --- 3. Charger les noms de prescripteurs (prescriptions) ---
        prescription_ids = [str(r[4]) for r in invoice_rows if r[4] is not None]
        prescriber_by_id: dict[str, str] = {}
        if prescription_ids:
            presc_placeholders = ", ".join(f":pid{i}" for i in range(len(prescription_ids)))
            presc_params = {f"pid{i}": pid for i, pid in enumerate(prescription_ids)}
            presc_sql = text(f"""
                SELECT id, prescriber_name
                FROM prescriptions
                WHERE id IN ({presc_placeholders})
            """)
            presc_result = await self._session.execute(presc_sql, presc_params)
            for row in presc_result.fetchall():
                prescriber_by_id[str(row[0])] = row[1] or ""

        # --- 4. Charger les noms de patients (via patient_repo si disponible) ---
        patient_names: dict[str, tuple[str, str]] = {}
        if self._patient_repo is not None:
            unique_patient_ids = list({str(r[3]) for r in invoice_rows})
            for pid_str in unique_patient_ids:
                try:
                    patient = await self._patient_repo.get_by_id(UUID(pid_str), cabinet_id)
                    if patient is not None:
                        patient_names[pid_str] = (patient.last_name, patient.first_name)
                except Exception:
                    pass

        # --- 5. Construire les lignes CSV ---
        csv_rows = []
        for row in invoice_rows:
            inv_id = str(row[0])
            care_date = row[1]
            invoice_number = row[2] or ""
            patient_id = str(row[3])
            prescription_id = str(row[4]) if row[4] else None
            total_amo = Decimal(str(row[5])) if row[5] is not None else Decimal("0")
            total_amc = Decimal(str(row[6])) if row[6] is not None else Decimal("0")
            total_patient = Decimal(str(row[7])) if row[7] is not None else Decimal("0")
            total_amount = Decimal(str(row[8])) if row[8] is not None else Decimal("0")
            status = row[9] or "draft"
            payment_date = row[10]
            payment_reference = row[11] or ""

            # Noms patient
            pat_last, pat_first = patient_names.get(patient_id, ("", ""))

            # Prescripteur
            prescriber = prescriber_by_id.get(prescription_id, "") if prescription_id else ""

            # Lignes d'actes
            inv_lines = lines_by_invoice.get(inv_id, [])
            codes = []
            labels = []
            total_honoraires = Decimal("0")
            total_indem = Decimal("0")
            total_ik = Decimal("0")

            for lrow in inv_lines:
                code = lrow[1] or ""
                label = lrow[2] or ""
                lt = Decimal(str(lrow[3])) if lrow[3] is not None else Decimal("0")
                codes.append(code)
                labels.append(label)
                cat = classify_act_code(code)
                if cat == "ik":
                    total_ik += lt
                elif cat == "indem":
                    total_indem += lt
                else:
                    total_honoraires += lt

            csv_rows.append({
                "date_soin": _fmt_date(care_date),
                "numero_facture": invoice_number,
                "patient_nom": pat_last,
                "patient_prenom": pat_first,
                "prescripteur": prescriber,
                "actes_codes": "+".join(codes),
                "actes_labels": "+".join(labels),
                "total_honoraires": _fmt_decimal(total_honoraires),
                "total_indemnites": _fmt_decimal(total_indem),
                "total_deplacements": _fmt_decimal(total_ik),
                "total_amo": _fmt_decimal(total_amo),
                "total_amc": _fmt_decimal(total_amc),
                "total_patient": _fmt_decimal(total_patient),
                "total_ttc": _fmt_decimal(total_amount),
                "statut": _STATUS_LABELS.get(status, status),
                "date_paiement": _fmt_date(payment_date),
                "reference_paiement": payment_reference,
            })

        return self._build_csv(csv_rows)

    @staticmethod
    def _build_csv(rows: list[dict]) -> bytes:
        headers = [
            "date_soin",
            "numero_facture",
            "patient_nom",
            "patient_prenom",
            "prescripteur",
            "actes_codes",
            "actes_labels",
            "total_honoraires",
            "total_indemnites",
            "total_deplacements",
            "total_amo",
            "total_amc",
            "total_patient",
            "total_ttc",
            "statut",
            "date_paiement",
            "reference_paiement",
        ]
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=headers, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        # UTF-8 BOM pour compatibilité Excel FR
        return ("\ufeff" + buffer.getvalue()).encode("utf-8")
