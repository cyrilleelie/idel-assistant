"""Use case : export Livre des recettes (BNC — factures payées uniquement)."""

import csv
import datetime
import io
from decimal import Decimal
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def _fmt_date(d: datetime.date | None) -> str:
    if d is None:
        return ""
    return d.strftime("%d/%m/%Y")


def _fmt_decimal(v: Decimal | str | None) -> str:
    if v is None:
        return "0.00"
    return f"{Decimal(str(v)):.2f}"


class ExportRecettesUseCase:
    """Export du livre des recettes.

    Uniquement les factures payées (status = 'paid').
    Une ligne par facture.
    Séparateur ; (standard FR), encodage UTF-8 BOM.
    """

    def __init__(self, session: AsyncSession, patient_repo=None):
        self._session = session
        self._patient_repo = patient_repo

    async def execute(
        self,
        cabinet_id: UUID,
        date_from: datetime.date,
        date_to: datetime.date,
        idel_id: UUID | None = None,
    ) -> bytes:
        idel_filter = ""
        idel_params: dict = {}
        if idel_id is not None:
            idel_filter = "AND i.idel_id = :idel_id"
            idel_params = {"idel_id": str(idel_id)}

        sql = text(f"""
            SELECT
                i.payment_date,
                i.patient_id,
                i.tiers_payant_type,
                i.total_amo,
                i.total_amc,
                i.total_patient,
                i.total_amount,
                i.payment_reference,
                i.invoice_number
            FROM invoices i
            WHERE i.cabinet_id = :cabinet_id
              AND i.care_date BETWEEN :date_from AND :date_to
              AND i.status = 'paid'
              {idel_filter}
            ORDER BY i.payment_date ASC NULLS LAST, i.care_date ASC
        """)

        params: dict = {
            "cabinet_id": str(cabinet_id),
            "date_from": date_from,
            "date_to": date_to,
            **idel_params,
        }
        result = await self._session.execute(sql, params)
        rows = result.fetchall()

        if not rows:
            return self._build_csv([])

        # Charger les noms de patients si le patient_repo est disponible
        patient_names: dict[str, str] = {}
        if self._patient_repo is not None:
            unique_patient_ids = list({str(r[1]) for r in rows})
            for pid_str in unique_patient_ids:
                try:
                    patient = await self._patient_repo.get_by_id(UUID(pid_str), cabinet_id)
                    if patient is not None:
                        patient_names[pid_str] = f"{patient.last_name} {patient.first_name}".strip()
                except Exception:
                    pass

        csv_rows = []
        for row in rows:
            payment_date = row[0]
            patient_id = str(row[1])
            tiers_payant = row[2] or "total"
            total_amo = Decimal(str(row[3])) if row[3] else Decimal("0")
            total_amc = Decimal(str(row[4])) if row[4] else Decimal("0")
            total_patient = Decimal(str(row[5])) if row[5] else Decimal("0")
            total_amount = Decimal(str(row[6])) if row[6] else Decimal("0")
            payment_reference = row[7] or ""
            invoice_number = row[8] or ""

            # Détermine le client et le mode de règlement
            if tiers_payant == "total":
                if total_amo > 0 and total_amc > 0:
                    identite = "CPAM + Mutuelle"
                    mode = "Virement CPAM / Mutuelle"
                elif total_amo > 0:
                    identite = "CPAM"
                    mode = "Virement CPAM"
                elif total_amc > 0:
                    identite = "Mutuelle"
                    mode = "Virement mutuelle"
                else:
                    identite = "CPAM"
                    mode = "Virement CPAM"
            elif tiers_payant == "partiel":
                pat_name = patient_names.get(patient_id, f"Patient #{patient_id[:8]}")
                identite = f"CPAM + {pat_name}"
                mode = "Virement CPAM + Paiement patient"
            else:
                pat_name = patient_names.get(patient_id, f"Patient #{patient_id[:8]}")
                identite = pat_name
                mode = "Paiement direct"

            csv_rows.append({
                "date_encaissement": _fmt_date(payment_date),
                "numero_facture": invoice_number,
                "identite_client": identite,
                "nature_recette": "Honoraires infirmiers",
                "montant": _fmt_decimal(total_amount),
                "mode_reglement": mode,
                "reference": payment_reference,
            })

        return self._build_csv(csv_rows)

    @staticmethod
    def _build_csv(rows: list[dict]) -> bytes:
        headers = [
            "date_encaissement",
            "numero_facture",
            "identite_client",
            "nature_recette",
            "montant",
            "mode_reglement",
            "reference",
        ]
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=headers, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
        return ("\ufeff" + buffer.getvalue()).encode("utf-8")
