"""Export d'un lot FSE en CSV, XML ou JSON."""

import csv
import io
import json
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.fse import Fse
from app.infrastructure.persistence.repositories.sqlalchemy_fse_repo import SQLAlchemyFseRepo


@dataclass
class ExportFseLotInput:
    cabinet_id: UUID
    lot_number: str | None = None        # Si None → toutes les FSE générées non exportées
    fmt: str = "csv"                      # csv | xml | json
    status_filter: str = "generated"


class ExportFseLotUseCase:
    """Exporte un lot de FSE dans le format demandé."""

    def __init__(self, session: AsyncSession):
        self._session = session
        self._repo = SQLAlchemyFseRepo(session)

    async def execute(self, inp: ExportFseLotInput) -> bytes:
        fses = await self._repo.list_by_cabinet(
            cabinet_id=inp.cabinet_id,
            status=inp.status_filter if inp.lot_number is None else None,
            lot_number=inp.lot_number,
        )

        if inp.fmt == "csv":
            content = _export_csv(fses)
        elif inp.fmt == "xml":
            content = _export_xml(fses)
        elif inp.fmt == "json":
            content = _export_json(fses)
        else:
            raise ValueError(f"Format non supporté: {inp.fmt}")

        # Marquer comme exporté
        for fse in fses:
            if fse.status == "generated":
                fse.mark_exported(inp.fmt)
                await self._repo.update(fse)

        return content


# --- Formats d'export ---

def _export_csv(fses: list[Fse]) -> bytes:
    """CSV ; UTF-8 BOM pour compatibilité Excel France."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "numero_fse", "lot", "date_soins", "nir_patient", "rang_naissance",
        "rpps_idel", "adeli_idel", "organisme_amo", "organisme_amc",
        "montant_total", "montant_amo", "montant_amc", "montant_patient",
        "actes", "exoneration", "statut",
    ])
    for f in fses:
        actes_str = "+".join(a.code for a in f.actes_fse)
        writer.writerow([
            f.fse_number,
            f.lot_number or "",
            f.date_soins.strftime("%d/%m/%Y") if f.date_soins else "",
            f.nir_patient,
            f.birth_rank or "",
            f.rpps_idel,
            f.adeli_idel or "",
            f.organisme_amo or "",
            f.organisme_amc or "",
            str(f.montant_total),
            str(f.montant_amo),
            str(f.montant_amc),
            str(f.montant_patient),
            actes_str,
            f.exoneration_code or "",
            f.status,
        ])
    return b"\xef\xbb\xbf" + buf.getvalue().encode("utf-8")


def _export_xml(fses: list[Fse]) -> bytes:
    """XML pseudo-SESAM-Vitale pour import dans logiciels tiers."""
    root = ET.Element("LotFSE", version="1.0")
    for f in fses:
        fse_el = ET.SubElement(root, "FSE", numero=f.fse_number, lot=f.lot_number or "")
        ET.SubElement(fse_el, "DateSoins").text = f.date_soins.strftime("%Y%m%d") if f.date_soins else ""
        ET.SubElement(fse_el, "NIR").text = f.nir_patient
        ET.SubElement(fse_el, "RPPS").text = f.rpps_idel
        ET.SubElement(fse_el, "ADELI").text = f.adeli_idel or ""
        montants = ET.SubElement(fse_el, "Montants")
        ET.SubElement(montants, "Total").text = str(f.montant_total)
        ET.SubElement(montants, "AMO").text = str(f.montant_amo)
        ET.SubElement(montants, "AMC").text = str(f.montant_amc)
        ET.SubElement(montants, "Patient").text = str(f.montant_patient)
        actes_el = ET.SubElement(fse_el, "Actes")
        for a in f.actes_fse:
            acte_el = ET.SubElement(actes_el, "Acte", code=a.code)
            ET.SubElement(acte_el, "Label").text = a.label
            ET.SubElement(acte_el, "Coefficient").text = str(a.coefficient)
            ET.SubElement(acte_el, "Quantite").text = str(a.quantite)
            ET.SubElement(acte_el, "Montant").text = str(a.montant)
        if f.exoneration_code:
            ET.SubElement(fse_el, "Exoneration").text = f.exoneration_code
    tree = ET.ElementTree(root)
    buf = io.BytesIO()
    tree.write(buf, encoding="utf-8", xml_declaration=True)
    return buf.getvalue()


def _export_json(fses: list[Fse]) -> bytes:
    """JSON structuré pour APIs tierces."""
    data = {
        "version": "1.0",
        "type": "LotFSE",
        "fses": [
            {
                "fse_number": f.fse_number,
                "lot_number": f.lot_number,
                "date_soins": f.date_soins.isoformat() if f.date_soins else None,
                "nir_patient": f.nir_patient,
                "birth_rank": f.birth_rank,
                "rpps_idel": f.rpps_idel,
                "adeli_idel": f.adeli_idel,
                "organisme_amo": f.organisme_amo,
                "organisme_amc": f.organisme_amc,
                "montant_total": str(f.montant_total),
                "montant_amo": str(f.montant_amo),
                "montant_amc": str(f.montant_amc),
                "montant_patient": str(f.montant_patient),
                "exoneration_code": f.exoneration_code,
                "actes": [
                    {
                        "code": a.code,
                        "label": a.label,
                        "coefficient": str(a.coefficient),
                        "quantite": str(a.quantite),
                        "montant": str(a.montant),
                    }
                    for a in f.actes_fse
                ],
                "status": f.status,
            }
            for f in fses
        ],
    }
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
