"""Tests unitaires exhaustifs du moteur de cotation NGAP.

Chaque test verifie les montants calcules a la main.
Les cas couvrent : patient standard, BSI, enfant, ALD, limites.
"""

import datetime
from decimal import Decimal

import pytest

from app.domain.entities.care_type_catalog import CareTypeCatalog
from app.domain.rules.cotation_engine import CotationEngine
from app.domain.value_objects.patient_cotation_context import PatientCotationContext


def _std_ctx(**overrides) -> PatientCotationContext:
    """Patient standard : adulte, pas de BSI, pas ALD."""
    defaults = {
        "has_active_bsi": False,
        "bsi_level": None,
        "bsi_already_billed_today": False,
        "is_ald": False,
        "is_maternity": False,
        "age": 45,
        "is_palliative": False,
    }
    defaults.update(overrides)
    return PatientCotationContext(**defaults)


def _bsi_ctx(level: str = "BSB", already_billed: bool = False, **overrides) -> PatientCotationContext:
    """Patient avec BSI actif."""
    defaults = {
        "has_active_bsi": True,
        "bsi_level": level,
        "bsi_already_billed_today": already_billed,
        "is_ald": False,
        "is_maternity": False,
        "age": 78,
        "is_palliative": False,
    }
    defaults.update(overrides)
    return PatientCotationContext(**defaults)


def _child_ctx(age: int = 5) -> PatientCotationContext:
    return _std_ctx(age=age)


def _catalog() -> dict[str, CareTypeCatalog]:
    """Catalogue de reference avec les tarifs avenant 10."""
    base = {
        "AMI_1": CareTypeCatalog(
            code="AMI_1", lettre_cle="AMI", label="AMI coefficient 1",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("1"), base_rate=Decimal("3.15"),
        ),
        "AMI_1.5": CareTypeCatalog(
            code="AMI_1.5", lettre_cle="AMI", label="Pansement simple",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("1.5"), base_rate=Decimal("3.15"),
        ),
        "AMI_2": CareTypeCatalog(
            code="AMI_2", lettre_cle="AMI", label="AMI coefficient 2",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("2"), base_rate=Decimal("3.15"),
        ),
        "AMI_4": CareTypeCatalog(
            code="AMI_4", lettre_cle="AMI", label="Pansement lourd",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("4"), base_rate=Decimal("3.15"),
        ),
        # AMX equivalents (memes tarifs, code different)
        "AMX_1": CareTypeCatalog(
            code="AMX_1", lettre_cle="AMX", label="AMX coefficient 1",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("1"), base_rate=Decimal("3.15"),
        ),
        "AMX_1.5": CareTypeCatalog(
            code="AMX_1.5", lettre_cle="AMX", label="Pansement simple (BSI)",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("1.5"), base_rate=Decimal("3.15"),
        ),
        "AMX_2": CareTypeCatalog(
            code="AMX_2", lettre_cle="AMX", label="AMX coefficient 2",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("2"), base_rate=Decimal("3.15"),
        ),
        "AMX_4": CareTypeCatalog(
            code="AMX_4", lettre_cle="AMX", label="Pansement lourd (BSI)",
            category="technique", unit="acte",
            effective_from=datetime.date(2024, 1, 28),
            coefficient=Decimal("4"), base_rate=Decimal("3.15"),
        ),
        # Forfaits BSI
        "BSA": CareTypeCatalog(
            code="BSA", lettre_cle="BSA", label="BSI soins legers (forfait A)",
            category="bsi_forfait", unit="jour",
            effective_from=datetime.date(2024, 1, 28),
            fixed_amount=Decimal("13.00"),
        ),
        "BSB": CareTypeCatalog(
            code="BSB", lettre_cle="BSB", label="BSI soins intermediaires (forfait B)",
            category="bsi_forfait", unit="jour",
            effective_from=datetime.date(2024, 1, 28),
            fixed_amount=Decimal("18.20"),
        ),
        "BSC": CareTypeCatalog(
            code="BSC", lettre_cle="BSC", label="BSI soins lourds (forfait C)",
            category="bsi_forfait", unit="jour",
            effective_from=datetime.date(2024, 1, 28),
            fixed_amount=Decimal("28.70"),
        ),
    }
    return base


engine = CotationEngine()


# =============================================================================
# CAS STANDARD (patient sans BSI, adulte)
# =============================================================================


class TestStandardPatient:
    def test_pansement_simple_lundi_9h_domicile_5km(self):
        """Lundi 9h, AMI 1.5, domicile, 5km plaine, premier soin."""
        # AMI_1.5 = 1.5 * 3.15 = 4.73 (arrondi)
        # IFD = 2.75
        # IK = (5 - 4) * 0.35 = 0.35
        # MCI = 5.00 (premier soin)
        # MAU = 1.35 (acte unique)
        # Total = 4.73 + 2.75 + 0.35 + 5.00 + 1.35 = 14.18
        result = engine.coter_passage(
            actes=["AMI_1.5"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 9, 0),  # Lundi
            distance_km=Decimal("5"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("14.18")
        codes = [l.code for l in result.lignes]
        assert "AMI_1.5" in codes
        assert "IFD" in codes
        assert "IK" in codes
        assert "MCI" in codes
        assert "MAU" in codes

    def test_injection_dimanche_8h_domicile_3km(self):
        """Dimanche 8h, AMI 1, domicile, 3km plaine, premier soin."""
        # AMI_1 = 1 * 3.15 = 3.15
        # IFD = 2.75
        # IK : 3 - 4 = negatif -> 0
        # MAJ_DIM = 8.50 (dimanche)
        # MCI = 5.00
        # MAU = 1.35
        # Total = 3.15 + 2.75 + 8.50 + 5.00 + 1.35 = 20.75
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 15, 8, 0),  # Dimanche
            distance_km=Decimal("3"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("20.75")
        codes = [l.code for l in result.lignes]
        assert "MAJ_DIM" in codes
        assert "IK" not in codes

    def test_deux_actes_mardi_7h30_domicile_10km(self):
        """Mardi 7h30 (nuit 5h-8h), AMI_4 + AMI_1, domicile, 10km plaine."""
        # Article 11 : AMI_4 a 100% (4 * 3.15 = 12.60), AMI_1 a 50% (1 * 3.15 * 0.5 = 1.58)
        # Pas de MAU (2 actes)
        # IFD = 2.75
        # IK = (10 - 4) * 0.35 = 2.10
        # MAJ_NUIT = 9.15 (tranche 5h-8h)
        # MCI = 5.00
        # Total = 12.60 + 1.58 + 2.75 + 2.10 + 9.15 + 5.00 = 33.18
        result = engine.coter_passage(
            actes=["AMI_4", "AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 17, 7, 30),  # Mardi
            distance_km=Decimal("10"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("33.18")
        codes = [l.code for l in result.lignes]
        assert "MAU" not in codes
        assert "MAJ_NUIT" in codes
        # Verifie article 11 dans les explications
        assert any("Article 11" in e for e in result.explications)

    def test_soin_au_cabinet(self):
        """Lundi 10h, AMI_2, au cabinet — pas d'IFD ni d'IK."""
        # AMI_2 = 2 * 3.15 = 6.30
        # MCI = 5.00
        # MAU = 1.35
        # Total = 6.30 + 5.00 + 1.35 = 12.65
        result = engine.coter_passage(
            actes=["AMI_2"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("12.65")
        codes = [l.code for l in result.lignes]
        assert "IFD" not in codes
        assert "IK" not in codes
        assert any("cabinet" in e for e in result.explications)

    def test_soin_23h30_dimanche_ferie(self):
        """Dimanche ferie (25 dec 2026 est un vendredi, utilisons un vrai dimanche ferie).
        Noel 2026 = vendredi. Prenons 1er janvier 2026 (jeudi) — pas dimanche.
        Utilisons Lundi de Paques (6 avril 2026) qui est ferie.
        Prenons un dimanche ferie = il faut trouver un ferie qui tombe un dimanche...
        Prenons juste un dimanche normal + testant la combinaison nuit prof + dim."""
        # Dimanche 15 mars 2026 a 23h30
        # AMI_4 = 12.60
        # IFD = 2.75
        # IK = (8 - 4) * 0.35 = 1.40
        # MAJ_NUIT_PROF = 18.30 (23h30 -> 23h-5h)
        # MAJ_DIM = 8.50 (dimanche)
        # MCI = 5.00
        # MAU = 1.35
        # Total = 12.60 + 2.75 + 1.40 + 18.30 + 8.50 + 5.00 + 1.35 = 49.90
        result = engine.coter_passage(
            actes=["AMI_4"],
            date_heure_soin=datetime.datetime(2026, 3, 15, 23, 30),  # Dimanche
            distance_km=Decimal("8"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("49.90")
        codes = [l.code for l in result.lignes]
        assert "MAJ_NUIT_PROF" in codes
        assert "MAJ_DIM" in codes
        assert "MAJ_NUIT" not in codes  # Non cumul nuit/nuit_prof

    def test_pas_premier_soin_journee(self):
        """2e passage de la journee — pas de MCI."""
        # AMI_1 = 3.15
        # IFD = 2.75
        # MAU = 1.35
        # Total = 7.25
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 14, 0),
            distance_km=Decimal("2"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=False,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("7.25")
        codes = [l.code for l in result.lignes]
        assert "MCI" not in codes

    def test_nuit_20h(self):
        """20h exactement -> tranche nuit (20h-23h)."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 20, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "MAJ_NUIT" in codes
        assert "MAJ_NUIT_PROF" not in codes

    def test_5h00_nuit(self):
        """5h00 exactement -> tranche nuit (5h-8h), pas nuit profonde."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 5, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "MAJ_NUIT" in codes
        assert "MAJ_NUIT_PROF" not in codes

    def test_3h00_nuit_profonde(self):
        """3h00 -> tranche nuit profonde (23h-5h)."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 3, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "MAJ_NUIT_PROF" in codes
        assert "MAJ_NUIT" not in codes

    def test_montagne(self):
        """Zone montagne : abattement 2km, tarif 0.50/km."""
        # AMI_1 = 3.15
        # IFD = 2.75
        # IK = (6 - 2) * 0.50 = 2.00
        # MCI = 5.00, MAU = 1.35
        # Total = 3.15 + 2.75 + 2.00 + 5.00 + 1.35 = 14.25
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("6"),
            lieu="domicile",
            zone_ik="montagne",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("14.25")


# =============================================================================
# CAS BSI (patient dependant)
# =============================================================================


class TestBSIPatient:
    def test_bsi_intermediaire_prise_sang_lundi_10h(self):
        """Patient BSI-B, AMI_1.5 -> AMX_1.5, lundi 10h, domicile 6km."""
        # AMX_1.5 = 1.5 * 3.15 = 4.73
        # BSB = 18.20
        # IFI = 2.75 (pas IFD)
        # IK = (6 - 4) * 0.35 = 0.70
        # MCI = 5.00 (premier soin technique)
        # MAU = 1.35 (acte technique unique)
        # Total = 4.73 + 18.20 + 2.75 + 0.70 + 5.00 + 1.35 = 32.73
        result = engine.coter_passage(
            actes=["AMI_1.5"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("6"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_bsi_ctx(level="BSB"),
            catalog=_catalog(),
        )
        assert result.total == Decimal("32.73")
        codes = [l.code for l in result.lignes]
        assert "AMX_1.5" in codes
        assert "AMI_1.5" not in codes
        assert "BSB" in codes
        assert "IFI" in codes
        assert "IFD" not in codes
        # Verifie auto-corrections
        assert any("AMI_1.5" in c and "AMX_1.5" in c for c in result.auto_corrections)
        assert any("IFI" in c for c in result.auto_corrections)

    def test_bsi_lourd_dimanche_9h(self):
        """Patient BSI-C, AMI_2 -> AMX_2, dimanche 9h, domicile 3km."""
        # AMX_2 = 2 * 3.15 = 6.30
        # BSC = 28.70 (pas de MAJ_DIM sur le BSI)
        # IFI = 2.75
        # IK = (3 - 4) -> 0
        # MAJ_DIM = 8.50 (s'applique sur AMX, pas sur BSC)
        # MCI = 5.00
        # MAU = 1.35
        # Total = 6.30 + 28.70 + 2.75 + 8.50 + 5.00 + 1.35 = 52.60
        result = engine.coter_passage(
            actes=["AMI_2"],
            date_heure_soin=datetime.datetime(2026, 3, 15, 9, 0),  # Dimanche
            distance_km=Decimal("3"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_bsi_ctx(level="BSC"),
            catalog=_catalog(),
        )
        assert result.total == Decimal("52.60")
        codes = [l.code for l in result.lignes]
        assert "BSC" in codes
        assert "MAJ_DIM" in codes

    def test_bsi_deja_facture_par_collegue(self):
        """bsi_already_billed_today = True -> pas de forfait BSI."""
        # AMX_1.5 = 4.73
        # IFI = 2.75
        # MCI = 5.00, MAU = 1.35
        # Total = 4.73 + 2.75 + 5.00 + 1.35 = 13.83
        result = engine.coter_passage(
            actes=["AMI_1.5"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("2"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_bsi_ctx(level="BSB", already_billed=True),
            catalog=_catalog(),
        )
        assert result.total == Decimal("13.83")
        codes = [l.code for l in result.lignes]
        assert "BSB" not in codes
        assert any("deja facture" in c for c in result.auto_corrections)

    def test_bsi_sans_acte_technique(self):
        """Patient BSI-A, pas d'acte AMI/AMX, juste le forfait."""
        # BSA = 13.00
        # IFI = 2.75
        # IK = (6 - 4) * 0.35 = 0.70
        # Pas de MCI (pas d'acte technique), pas de MAU, pas de majorations horaires
        # Total = 13.00 + 2.75 + 0.70 = 16.45
        result = engine.coter_passage(
            actes=[],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("6"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_bsi_ctx(level="BSA"),
            catalog=_catalog(),
        )
        assert result.total == Decimal("16.45")
        codes = [l.code for l in result.lignes]
        assert "BSA" in codes
        assert "IFI" in codes
        assert "MCI" not in codes
        assert "MAU" not in codes
        assert "MAJ_NUIT" not in codes


# =============================================================================
# CAS ENFANT (< 7 ANS)
# =============================================================================


class TestChildPatient:
    def test_enfant_5ans_injection(self):
        """Patient 5 ans, AMI_1, lundi 10h, domicile 5km."""
        # AMI_1 = 3.15
        # IFD = 2.75
        # IK = (5 - 4) * 0.35 = 0.35
        # MCI = 5.00, MAU = 1.35
        # MIE = 3.15 (1 acte)
        # Total = 3.15 + 2.75 + 0.35 + 5.00 + 1.35 + 3.15 = 15.75
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("5"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_child_ctx(age=5),
            catalog=_catalog(),
        )
        assert result.total == Decimal("15.75")
        codes = [l.code for l in result.lignes]
        assert "MIE" in codes
        assert codes.count("MIE") == 1

    def test_enfant_deux_actes(self):
        """Patient 3 ans, AMI_4 + AMI_1, lundi 10h, domicile."""
        # Art 11 : AMI_4 100% = 12.60, AMI_1 50% = 1.58
        # IFD = 2.75
        # MCI = 5.00
        # MIE x2 = 3.15 * 2 = 6.30
        # Pas de MAU (2 actes)
        # Total = 12.60 + 1.58 + 2.75 + 5.00 + 6.30 = 28.23
        result = engine.coter_passage(
            actes=["AMI_4", "AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("2"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_child_ctx(age=3),
            catalog=_catalog(),
        )
        assert result.total == Decimal("28.23")
        codes = [l.code for l in result.lignes]
        assert codes.count("MIE") == 2

    def test_enfant_7ans_pas_de_mie(self):
        """Patient 7 ans (exactement) → pas de MIE."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_child_ctx(age=7),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "MIE" not in codes


# =============================================================================
# CAS ALD / MATERNITE
# =============================================================================


class TestALDMaternity:
    def test_patient_ald_repartition(self):
        """Patient ALD -> 100% AMO."""
        result = engine.coter_passage(
            actes=["AMI_4"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("5"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(is_ald=True),
            catalog=_catalog(),
        )
        assert result.repartition_amo == result.total
        assert result.repartition_amc == Decimal("0.00")
        assert result.repartition_patient == Decimal("0.00")

    def test_patient_standard_repartition(self):
        """Patient normal → 60% AMO, 40% AMC."""
        result = engine.coter_passage(
            actes=["AMI_4"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("5"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.repartition_amo == (result.total * Decimal("0.6")).quantize(Decimal("0.01"))
        assert result.repartition_amc == (result.total * Decimal("0.4")).quantize(Decimal("0.01"))
        assert result.repartition_patient == Decimal("0.00")

    def test_patient_maternity_repartition(self):
        """Patient maternite -> 100% AMO."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(is_maternity=True),
            catalog=_catalog(),
        )
        assert result.repartition_amo == result.total
        assert result.repartition_amc == Decimal("0.00")


# =============================================================================
# CAS LIMITES
# =============================================================================


class TestEdgeCases:
    def test_distance_zero(self):
        """Distance 0km domicile -> pas d'IK, IFD quand meme."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "IFD" in codes
        assert "IK" not in codes

    def test_distance_inferieure_abattement(self):
        """3km plaine -> 3-4 = negatif -> IK = 0, IFD quand meme."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("3"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "IFD" in codes
        assert "IK" not in codes

    def test_lieu_cabinet_ignore_distance(self):
        """Au cabinet avec distance 10km -> pas d'IFD, pas d'IK."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("10"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "IFD" not in codes
        assert "IK" not in codes

    def test_aucun_acte_patient_standard(self):
        """Liste actes vide, patient standard -> resultat vide."""
        result = engine.coter_passage(
            actes=[],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("0.00")
        assert len(result.lignes) == 0

    def test_acte_inconnu_dans_catalogue(self):
        """Code acte non trouve dans le catalogue → erreur explicite."""
        with pytest.raises(ValueError, match="introuvable"):
            engine.coter_passage(
                actes=["AMI_99"],
                date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
                distance_km=Decimal("0"),
                lieu="cabinet",
                zone_ik="plaine",
                est_premier_soin_journee=True,
                patient_context=_std_ctx(),
                catalog=_catalog(),
            )

    def test_trois_actes_article_11(self):
        """3 actes techniques : 1er 100%, 2e 50%, 3e gratuit."""
        # AMI_4 100% = 12.60
        # AMI_2 50% = 3.15
        # AMI_1 gratuit = 0.00
        # MCI = 5.00
        # Total = 12.60 + 3.15 + 0.00 + 5.00 = 20.75
        result = engine.coter_passage(
            actes=["AMI_1", "AMI_4", "AMI_2"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert result.total == Decimal("20.75")
        # Verifie ordre : AMI_4 (coeff 4, 100%), AMI_2 (coeff 2, 50%), AMI_1 (coeff 1, gratuit)
        actes_lignes = [l for l in result.lignes if l.category == "acte"]
        assert actes_lignes[0].code == "AMI_4"
        assert actes_lignes[0].montant == Decimal("12.60")
        assert actes_lignes[1].code == "AMI_2"
        assert actes_lignes[1].montant == Decimal("3.15")
        assert actes_lignes[2].code == "AMI_1"
        assert actes_lignes[2].montant == Decimal("0.00")

    def test_ferie_non_dimanche(self):
        """1er mai 2026 (vendredi) -> MAJ_DIM appliquee."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 5, 1, 10, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "MAJ_DIM" in codes

    def test_jour_normal_pas_majoration_dim(self):
        """Lundi normal → pas de MAJ_DIM."""
        result = engine.coter_passage(
            actes=["AMI_1"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("0"),
            lieu="cabinet",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        codes = [l.code for l in result.lignes]
        assert "MAJ_DIM" not in codes

    def test_auto_corrections_present(self):
        """Verifie que les auto_corrections sont bien remplies pour un patient BSI."""
        result = engine.coter_passage(
            actes=["AMI_4"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("5"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_bsi_ctx(level="BSB"),
            catalog=_catalog(),
        )
        assert len(result.auto_corrections) >= 2  # AMI->AMX + IFD->IFI
        assert any("AMX_4" in c for c in result.auto_corrections)
        assert any("IFI" in c for c in result.auto_corrections)

    def test_explications_present(self):
        """Verifie que les explications sont remplies."""
        result = engine.coter_passage(
            actes=["AMI_4"],
            date_heure_soin=datetime.datetime(2026, 3, 16, 10, 0),
            distance_km=Decimal("5"),
            lieu="domicile",
            zone_ik="plaine",
            est_premier_soin_journee=True,
            patient_context=_std_ctx(),
            catalog=_catalog(),
        )
        assert len(result.explications) >= 2  # IK + MCI + MAU au minimum
