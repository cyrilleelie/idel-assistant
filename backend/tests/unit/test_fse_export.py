"""Tests unitaires : export FSE (CSV, XML, JSON) et PDF feuille de soins."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.application.use_cases.billing.export_fse_lot import (
    _export_csv,
    _export_json,
    _export_xml,
)
from app.domain.entities.fse import ActeFse, Fse


# --- Fixtures ---

def _make_fse(
    nir: str = "199010175000012",
    status: str = "generated",
    lot: str = "LOT-20260101",
) -> Fse:
    return Fse(
        cabinet_id=uuid4(),
        nir_patient=nir,
        date_soins=datetime.date(2026, 1, 15),
        rpps_idel="12345678901",
        adeli_idel="123456789",
        organisme_amo="750100001",
        organisme_amc="54321",
        montant_total=Decimal("45.00"),
        montant_amo=Decimal("40.50"),
        montant_amc=Decimal("4.50"),
        montant_patient=Decimal("0.00"),
        actes_fse=[
            ActeFse(
                code="AMI 4",
                label="Acte médico-infirmier",
                coefficient=Decimal("4"),
                quantite=Decimal("1"),
                montant=Decimal("45.00"),
            )
        ],
        exoneration_code="ALD",
        lot_number=lot,
        status=status,
    )


# --- Tests CSV ---

def test_csv_bom_prefix():
    """CSV commence par BOM UTF-8."""
    csv_bytes = _export_csv([_make_fse()])
    assert csv_bytes[:3] == b"\xef\xbb\xbf"


def test_csv_semicolon_separator():
    """Séparateur ; (compatibilité Excel France)."""
    csv_bytes = _export_csv([_make_fse()])
    content = csv_bytes.decode("utf-8-sig")
    header_line = content.splitlines()[0]
    assert ";" in header_line


def test_csv_header_columns():
    """Colonnes attendues dans l'entête."""
    csv_bytes = _export_csv([_make_fse()])
    header = csv_bytes.decode("utf-8-sig").splitlines()[0]
    for col in ["numero_fse", "nir_patient", "rpps_idel", "montant_total", "actes"]:
        assert col in header


def test_csv_one_row_per_fse():
    """Une ligne par FSE."""
    csv_bytes = _export_csv([_make_fse(), _make_fse()])
    lines = [l for l in csv_bytes.decode("utf-8-sig").splitlines() if l.strip()]
    assert len(lines) == 3  # header + 2 data


def test_csv_empty_list():
    """Export vide → header uniquement."""
    csv_bytes = _export_csv([])
    lines = [l for l in csv_bytes.decode("utf-8-sig").splitlines() if l.strip()]
    assert len(lines) == 1


def test_csv_date_format():
    """Date au format DD/MM/YYYY."""
    csv_bytes = _export_csv([_make_fse()])
    content = csv_bytes.decode("utf-8-sig")
    assert "15/01/2026" in content


def test_csv_actes_joined():
    """Actes joints par +."""
    fse = _make_fse()
    fse.actes_fse.append(
        ActeFse(code="IFD", label="Indemnité", coefficient=Decimal("1"), quantite=Decimal("1"), montant=Decimal("3.00"))
    )
    csv_bytes = _export_csv([fse])
    content = csv_bytes.decode("utf-8-sig")
    assert "AMI 4+IFD" in content


# --- Tests XML ---

def test_xml_declaration():
    """Fichier XML commence par la déclaration XML."""
    xml_bytes = _export_xml([_make_fse()])
    assert xml_bytes.startswith(b"<?xml")


def test_xml_root_element():
    """Élément racine LotFSE."""
    import xml.etree.ElementTree as ET
    xml_bytes = _export_xml([_make_fse()])
    root = ET.fromstring(xml_bytes)
    assert root.tag == "LotFSE"


def test_xml_fse_elements():
    """Une balise FSE par feuille de soins."""
    import xml.etree.ElementTree as ET
    xml_bytes = _export_xml([_make_fse(), _make_fse()])
    root = ET.fromstring(xml_bytes)
    fse_elements = root.findall("FSE")
    assert len(fse_elements) == 2


def test_xml_actes_elements():
    """Les actes sont présents dans chaque FSE."""
    import xml.etree.ElementTree as ET
    xml_bytes = _export_xml([_make_fse()])
    root = ET.fromstring(xml_bytes)
    fse_el = root.find("FSE")
    assert fse_el is not None
    actes_el = fse_el.find("Actes")
    assert actes_el is not None
    acte_el = actes_el.find("Acte")
    assert acte_el is not None
    assert acte_el.get("code") == "AMI 4"


def test_xml_montants():
    """Montants présents et corrects."""
    import xml.etree.ElementTree as ET
    xml_bytes = _export_xml([_make_fse()])
    root = ET.fromstring(xml_bytes)
    montants = root.find("FSE/Montants")
    assert montants is not None
    assert montants.find("Total").text == "45.00"
    assert montants.find("AMO").text == "40.50"


# --- Tests JSON ---

def test_json_valid_structure():
    """JSON valide avec la clé 'fses'."""
    import json
    json_bytes = _export_json([_make_fse()])
    data = json.loads(json_bytes)
    assert "fses" in data
    assert data["version"] == "1.0"
    assert len(data["fses"]) == 1


def test_json_fse_fields():
    """Champs obligatoires présents dans chaque FSE JSON."""
    import json
    json_bytes = _export_json([_make_fse()])
    fse_data = json.loads(json_bytes)["fses"][0]
    for field in ["fse_number", "date_soins", "nir_patient", "rpps_idel", "montant_total", "actes"]:
        assert field in fse_data


def test_json_empty():
    """Export JSON avec liste vide."""
    import json
    json_bytes = _export_json([])
    data = json.loads(json_bytes)
    assert data["fses"] == []


def test_json_date_iso():
    """Date au format ISO (YYYY-MM-DD)."""
    import json
    json_bytes = _export_json([_make_fse()])
    fse_data = json.loads(json_bytes)["fses"][0]
    assert fse_data["date_soins"] == "2026-01-15"


# --- Tests entité Fse : cycle de vie ---

def test_fse_lifecycle_complete():
    """Cycle complet generated → exported → transmitted."""
    fse = _make_fse()
    assert fse.status == "generated"

    fse.mark_exported("json")
    assert fse.status == "exported"
    assert fse.exported_format == "json"

    fse.mark_transmitted()
    assert fse.status == "transmitted"
    assert fse.transmitted_at is not None


def test_fse_arl_received():
    """ARL reçu mis à jour."""
    fse = _make_fse(status="transmitted")
    fse.mark_arl_received()
    assert fse.arl_received_at is not None
