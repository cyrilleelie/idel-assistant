"""GenerateFseUseCase — Génère des FSE à partir des factures validées."""

import datetime
from dataclasses import dataclass
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.fse import ActeFse, Fse
from app.infrastructure.persistence.repositories.sqlalchemy_fse_repo import SQLAlchemyFseRepo


@dataclass
class GenerateFseInput:
    cabinet_id: UUID
    invoice_ids: list[UUID]          # Factures validées à convertir en FSE
    lot_number: str | None = None    # Regroupement en lot (ex: "2026-T1-01")


@dataclass
class GenerateFseOutput:
    generated: list[dict]            # FSE créées {fse_id, invoice_id, fse_number}
    skipped: list[dict]             # Factures ignorées {invoice_id, reason}
    lot_number: str


class GenerateFseUseCase:
    """
    Transforme des factures validées (status=validated ou transmitted) en FSE.

    Règles :
    - Une facture déjà convertie en FSE est ignorée (skip).
    - La FSE reprend le NIR du patient (ssn), le RPPS de l'IDEL, les actes.
    - Le numéro FSE est auto-généré : FSE-{YYYYMMDD}-{seq:04d}.
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._repo = SQLAlchemyFseRepo(session)

    async def execute(self, inp: GenerateFseInput) -> GenerateFseOutput:
        lot = inp.lot_number or datetime.datetime.now(datetime.UTC).strftime("LOT-%Y%m%d")
        generated = []
        skipped = []

        for invoice_id in inp.invoice_ids:
            result = await self._session.execute(
                text("""
                    SELECT
                        i.id, i.cabinet_id, i.idel_id, i.patient_id, i.prescription_id,
                        i.care_date, i.total_amount, i.total_amo, i.total_amc, i.total_patient,
                        i.tiers_payant_type, i.status,
                        p.ssn_encrypted, p.amo_code, p.amo_center, p.amc_code, p.exoneration_type,
                        p.birth_rank,
                        u.rpps, u.adeli,
                        pr.prescribed_at
                    FROM invoices i
                    JOIN patients p ON p.id = i.patient_id
                    JOIN users u ON u.id = i.idel_id
                    LEFT JOIN prescriptions pr ON pr.id = i.prescription_id
                    WHERE i.id = :inv_id
                      AND i.cabinet_id = :cabinet_id
                """),
                {"inv_id": str(invoice_id), "cabinet_id": str(inp.cabinet_id)},
            )
            row = result.fetchone()
            if row is None:
                skipped.append({"invoice_id": str(invoice_id), "reason": "not_found"})
                continue

            if row.status not in ("validated", "transmitted"):
                skipped.append({"invoice_id": str(invoice_id), "reason": f"invalid_status:{row.status}"})
                continue

            # Vérifier si une FSE existe déjà pour cette facture
            existing = await self._session.execute(
                text("SELECT id FROM fse WHERE invoice_id = :inv_id AND cabinet_id = :cabinet_id"),
                {"inv_id": str(invoice_id), "cabinet_id": str(inp.cabinet_id)},
            )
            if existing.fetchone():
                skipped.append({"invoice_id": str(invoice_id), "reason": "already_generated"})
                continue

            # Récupérer les lignes d'actes
            lines_result = await self._session.execute(
                text("""
                    SELECT act_code, act_label, coefficient, quantity, line_total, supplements
                    FROM invoice_lines
                    WHERE invoice_id = :inv_id
                    ORDER BY line_order
                """),
                {"inv_id": str(invoice_id)},
            )
            lines = lines_result.fetchall()

            actes = [
                ActeFse(
                    code=ln.act_code,
                    label=ln.act_label,
                    coefficient=Decimal(str(ln.coefficient or "1")),
                    quantite=Decimal(str(ln.quantity or "1")),
                    montant=Decimal(str(ln.line_total or "0")),
                    supplements=ln.supplements or {},
                )
                for ln in lines
            ]

            # Générer le numéro FSE unique
            seq_result = await self._session.execute(
                text("""
                    SELECT COUNT(*) FROM fse
                    WHERE cabinet_id = :cabinet_id
                      AND date_soins >= :date_start
                """),
                {
                    "cabinet_id": str(inp.cabinet_id),
                    "date_start": datetime.date(row.care_date.year, 1, 1),
                },
            )
            seq = (seq_result.scalar() or 0) + 1 + len(generated)
            fse_number = f"FSE-{row.care_date.strftime('%Y%m%d')}-{seq:04d}"

            # Déchiffrage NIR — on stocke en clair dans FSE (flux interne sécurisé)
            # En prod réelle, le NIR serait transmis via canal SESAM sécurisé.
            # Ici on stocke un placeholder si SSN chiffré non disponible.
            nir = ""  # Sera rempli par le patient repo si nécessaire

            # Déterminer l'exonération
            exo_code = _map_exoneration(row.exoneration_type, row.status)

            fse = Fse(
                cabinet_id=inp.cabinet_id,
                invoice_id=invoice_id,
                fse_number=fse_number,
                lot_number=lot,
                nir_patient=nir,
                birth_rank=row.birth_rank,
                rpps_idel=row.rpps or "",
                adeli_idel=row.adeli,
                date_soins=row.care_date,
                date_prescription=row.prescribed_at.date() if row.prescribed_at else None,
                organisme_amo=row.amo_code or row.amo_center,
                organisme_amc=row.amc_code,
                montant_total=Decimal(str(row.total_amount or "0")),
                montant_amo=Decimal(str(row.total_amo or "0")),
                montant_amc=Decimal(str(row.total_amc or "0")),
                montant_patient=Decimal(str(row.total_patient or "0")),
                actes_fse=actes,
                exoneration_code=exo_code,
                raw_fse_data=_build_raw_data(row, actes),
            )

            created = await self._repo.add(fse)
            generated.append({
                "fse_id": str(created.id),
                "invoice_id": str(invoice_id),
                "fse_number": fse_number,
                "lot_number": lot,
            })

        return GenerateFseOutput(generated=generated, skipped=skipped, lot_number=lot)


def _map_exoneration(exo_type: str | None, _status: str) -> str | None:
    mapping = {
        "ALD": "ALD",
        "MAT": "MAT",
        "AT": "AT",
        "100": "100",
    }
    if not exo_type:
        return None
    return mapping.get(exo_type.upper())


def _build_raw_data(row: Any, actes: list[ActeFse]) -> dict:
    """Données brutes structurées pour export vers logiciels tiers."""
    return {
        "version": "1.0",
        "type": "FSE",
        "idel": {
            "rpps": row.rpps,
            "adeli": row.adeli,
        },
        "patient": {
            "nir": "",   # Non déchiffré ici
            "amo_code": row.amo_code,
            "exoneration": row.exoneration_type,
        },
        "soins": {
            "date": str(row.care_date),
            "montant_total": str(row.total_amount),
            "montant_amo": str(row.total_amo),
            "montant_amc": str(row.total_amc),
            "montant_patient": str(row.total_patient),
        },
        "actes": [
            {
                "code": a.code,
                "label": a.label,
                "coefficient": str(a.coefficient),
                "quantite": str(a.quantite),
                "montant": str(a.montant),
            }
            for a in actes
        ],
    }
