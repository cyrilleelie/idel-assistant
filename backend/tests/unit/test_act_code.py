"""Tests unitaires pour le value object ActCode."""

from decimal import Decimal

import pytest

from app.domain.value_objects.act_code import ActCode


class TestActCodeValidation:
    def test_valid_code_with_coefficient(self):
        code = ActCode("AMI_4")
        assert code.value == "AMI_4"

    def test_valid_code_without_coefficient(self):
        code = ActCode("BSA")
        assert code.value == "BSA"

    def test_valid_code_decimal_coefficient(self):
        code = ActCode("AMI_1.5")
        assert code.value == "AMI_1.5"

    def test_all_valid_lettres_cles(self):
        for lk in ["AMI", "AMX", "AIS", "BSI", "BSA", "BSB", "BSC",
                    "IFD", "IFI", "IK", "MAU", "MCI", "MAJ", "MIE",
                    "MIEJ", "TLS", "TLL", "TLD", "DI"]:
            code = ActCode(lk)
            assert code.lettre_cle == lk

    def test_invalid_empty(self):
        with pytest.raises(ValueError, match="vide"):
            ActCode("")

    def test_invalid_whitespace(self):
        with pytest.raises(ValueError, match="vide"):
            ActCode("   ")

    def test_invalid_lettre_cle(self):
        with pytest.raises(ValueError, match="Lettre-cle inconnue"):
            ActCode("XYZ_1")

    def test_invalid_format_lowercase(self):
        with pytest.raises(ValueError, match="Format de code"):
            ActCode("ami_1")

    def test_invalid_format_numbers_only(self):
        with pytest.raises(ValueError, match="Format de code"):
            ActCode("123")


class TestActCodeProperties:
    def test_lettre_cle_simple(self):
        assert ActCode("AMI_4").lettre_cle == "AMI"

    def test_lettre_cle_no_suffix(self):
        assert ActCode("BSA").lettre_cle == "BSA"

    def test_lettre_cle_long(self):
        assert ActCode("MIEJ").lettre_cle == "MIEJ"

    def test_coefficient_integer(self):
        assert ActCode("AMI_4").coefficient == Decimal("4")

    def test_coefficient_decimal(self):
        assert ActCode("AMI_1.5").coefficient == Decimal("1.5")

    def test_coefficient_none_when_absent(self):
        assert ActCode("BSA").coefficient is None

    def test_coefficient_non_numeric_suffix(self):
        # IK_PLAINE → "PLAINE" is not a number
        # But IK_PLAINE won't match because PLAINE is not numeric
        # ActCode("IK_PLAINE") should parse: lettre_cle=IK, suffix=PLAINE → coefficient=None
        code = ActCode("IK_PLAINE")
        assert code.lettre_cle == "IK"
        assert code.coefficient is None


class TestActCodeFrozen:
    def test_is_frozen(self):
        code = ActCode("AMI_4")
        with pytest.raises(AttributeError):
            code.value = "AMI_5"

    def test_str(self):
        assert str(ActCode("AMI_4")) == "AMI_4"
