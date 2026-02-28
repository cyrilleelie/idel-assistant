"""Tests unitaires pour le calcul de distance Haversine."""

from decimal import Decimal

import pytest

from app.domain.value_objects.haversine import haversine_distance_km


class TestHaversineDistanceKm:
    def test_meme_point(self):
        """Distance nulle si les deux points sont identiques."""
        result = haversine_distance_km(48.8566, 2.3522, 48.8566, 2.3522)
        assert result == Decimal("0")

    def test_paris_versailles(self):
        """Paris → Versailles ≈ 22-26 km avec coefficient 1.3 (vol d'oiseau ~18 km × 1.3)."""
        # Coordonnées approximatives
        result = haversine_distance_km(48.8566, 2.3522, 48.8049, 2.1204)
        assert Decimal("20") <= result <= Decimal("26"), f"Distance inattendue : {result} km"

    def test_paris_lyon(self):
        """Paris → Lyon ≈ 450-500 km vol d'oiseau × 1.3."""
        result = haversine_distance_km(48.8566, 2.3522, 45.7640, 4.8357)
        # Vol d'oiseau ≈ 392 km × 1.3 ≈ 510 km
        assert Decimal("490") <= result <= Decimal("530"), f"Distance inattendue : {result} km"

    def test_coefficient_route(self):
        """Le coefficient route amplifie la distance vol d'oiseau."""
        dist_coeff1 = haversine_distance_km(48.8566, 2.3522, 48.8049, 2.1204, route_coefficient=1.0)
        dist_coeff13 = haversine_distance_km(48.8566, 2.3522, 48.8049, 2.1204, route_coefficient=1.3)
        assert dist_coeff13 > dist_coeff1

    def test_retour_decimal(self):
        """Le résultat est bien un Decimal."""
        result = haversine_distance_km(48.8566, 2.3522, 48.8049, 2.1204)
        assert isinstance(result, Decimal)

    def test_arrondi_2_decimales(self):
        """Le résultat est arrondi à 2 décimales."""
        result = haversine_distance_km(48.8566, 2.3522, 48.8049, 2.1204)
        assert result == round(result, 2)

    def test_distance_positive(self):
        """La distance est toujours positive ou nulle."""
        result = haversine_distance_km(43.2965, 5.3698, 48.8566, 2.3522)
        assert result >= Decimal("0")
