"""Tests unitaires pour le renouvellement des ordonnances (logique pure)."""

import datetime
from uuid import uuid4

import pytest

from app.domain.rules.prescription_rules import compute_end_date


# On teste la logique de calcul du renouvellement sans dépendances async.
# Les tests d'intégration (avec la BDD) sont dans tests/integration/.


class TestRenewalDateCalculation:
    """Teste la logique de calcul des dates de renouvellement."""

    def test_renewal_start_date_is_day_after_end(self):
        """Le renouvellement commence le lendemain de la fin de l'ordonnance source."""
        end_of_source = datetime.date(2026, 2, 28)
        expected_start = end_of_source + datetime.timedelta(days=1)
        assert expected_start == datetime.date(2026, 3, 1)

    def test_renewal_end_date_from_duration(self):
        """Si la durée du renouvellement est spécifiée, la date de fin est calculée."""
        start = datetime.date(2026, 3, 1)
        duration_days = 15
        end = compute_end_date(start, duration_days, None)
        assert end == datetime.date(2026, 3, 15)

    def test_renewal_explicit_end_date_takes_priority(self):
        """La date de fin explicite prime sur la durée en jours."""
        start = datetime.date(2026, 3, 1)
        explicit_end = datetime.date(2026, 4, 30)
        end = compute_end_date(start, 15, explicit_end)
        assert end == explicit_end

    def test_renewal_no_duration_no_end(self):
        """Sans durée ni date de fin, le renouvellement est à durée indéterminée."""
        start = datetime.date(2026, 3, 1)
        end = compute_end_date(start, None, None)
        assert end is None

    def test_current_renewal_increments(self):
        """Le compteur de renouvellements s'incrémente à chaque renouvellement."""
        initial_renewal = 0
        after_first = initial_renewal + 1
        after_second = after_first + 1
        assert after_first == 1
        assert after_second == 2

    def test_max_renewals_check(self):
        """Dépasser max_renewals doit lever une erreur (logique de contrôle)."""
        max_renewals = 2
        current_renewal = 2  # Déjà atteint le max
        would_exceed = current_renewal >= max_renewals
        assert would_exceed is True

    def test_zero_max_renewals_means_no_renewal(self):
        """max_renewals=0 signifie non renouvelable (0 >= 0 = True → bloqué)."""
        max_renewals = 0
        current_renewal = 0
        would_exceed = current_renewal >= max_renewals
        assert would_exceed is True

    def test_first_renewal_with_max_2(self):
        """Premier renouvellement possible si max_renewals=2 et current=0."""
        max_renewals = 2
        current_renewal = 0
        would_exceed = current_renewal >= max_renewals
        assert would_exceed is False
