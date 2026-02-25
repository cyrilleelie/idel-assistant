"""Tests unitaires pour le calcul des indemnites kilometriques."""

from decimal import Decimal

import pytest

from app.domain.value_objects.ik_calculator import IKCalculator


class TestIKCalculatorPlaine:
    def test_distance_facturable_basic(self):
        ik = IKCalculator(distance_km=Decimal("10"), zone="plaine")
        # 10 - 4 (abattement) = 6 km
        assert ik.distance_facturable == Decimal("6")

    def test_distance_facturable_below_abattement(self):
        ik = IKCalculator(distance_km=Decimal("3"), zone="plaine")
        # 3 - 4 = -1 → max(0, -1) = 0
        assert ik.distance_facturable == Decimal("0")

    def test_distance_facturable_equal_abattement(self):
        ik = IKCalculator(distance_km=Decimal("4"), zone="plaine")
        assert ik.distance_facturable == Decimal("0")

    def test_montant_basic(self):
        ik = IKCalculator(distance_km=Decimal("10"), zone="plaine")
        # 6 km * 0.35 = 2.10
        assert ik.montant == Decimal("2.10")

    def test_montant_zero_distance(self):
        ik = IKCalculator(distance_km=Decimal("0"), zone="plaine")
        assert ik.montant == Decimal("0.00")

    def test_montant_below_abattement(self):
        ik = IKCalculator(distance_km=Decimal("2"), zone="plaine")
        assert ik.montant == Decimal("0.00")


class TestIKCalculatorMontagne:
    def test_distance_facturable(self):
        ik = IKCalculator(distance_km=Decimal("10"), zone="montagne")
        # 10 - 2 (abattement montagne) = 8 km
        assert ik.distance_facturable == Decimal("8")

    def test_montant(self):
        ik = IKCalculator(distance_km=Decimal("10"), zone="montagne")
        # 8 km * 0.50 = 4.00
        assert ik.montant == Decimal("4.00")


class TestIKCalculatorPlafond:
    def test_below_plafond(self):
        ik = IKCalculator(distance_km=Decimal("300"), zone="plaine")
        # 300 - 4 = 296 km (< 299 plafond)
        assert ik.distance_facturable == Decimal("296")
        assert ik.montant == Decimal("103.60")  # 296 * 0.35

    def test_above_plafond(self):
        ik = IKCalculator(distance_km=Decimal("404"), zone="plaine")
        # 404 - 4 = 400 km
        # Plein tarif: 299 * 0.35 = 104.65
        # Surplus: (400 - 299) * 0.35 * 0.5 = 101 * 0.175 = 17.675 → 17.68
        # Total = 104.65 + 17.68 = 122.33
        assert ik.distance_facturable == Decimal("400")
        expected = (Decimal("299") * Decimal("0.35") + Decimal("101") * Decimal("0.35") * Decimal("0.5")).quantize(Decimal("0.01"))
        assert ik.montant == expected


class TestIKCalculatorValidation:
    def test_invalid_zone(self):
        with pytest.raises(ValueError, match="Zone invalide"):
            IKCalculator(distance_km=Decimal("10"), zone="desert")

    def test_negative_distance(self):
        with pytest.raises(ValueError, match="negative"):
            IKCalculator(distance_km=Decimal("-5"), zone="plaine")
