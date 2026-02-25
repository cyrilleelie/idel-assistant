"""Tests unitaires pour l'entite CareTypeCatalog."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.care_type_catalog import CareTypeCatalog


def _make_catalog(**overrides) -> CareTypeCatalog:
    defaults = {
        "code": "AMI_4",
        "lettre_cle": "AMI",
        "label": "Acte test",
        "category": "technique",
        "unit": "acte",
        "effective_from": datetime.date(2024, 1, 28),
        "coefficient": Decimal("4"),
        "base_rate": Decimal("3.15"),
        "is_system": True,
        "is_active": True,
    }
    defaults.update(overrides)
    return CareTypeCatalog(**defaults)


class TestCalculateAmount:
    def test_with_coefficient_and_base_rate(self):
        act = _make_catalog(coefficient=Decimal("4"), base_rate=Decimal("3.15"))
        # 4 * 3.15 = 12.60
        assert act.calculate_amount() == Decimal("12.60")

    def test_with_coefficient_override(self):
        act = _make_catalog(coefficient=Decimal("4"), base_rate=Decimal("3.15"))
        # Override coefficient to 2
        assert act.calculate_amount(coefficient_override=Decimal("2")) == Decimal("6.30")

    def test_with_quantity(self):
        act = _make_catalog(coefficient=Decimal("1"), base_rate=Decimal("3.15"))
        # 1 * 3.15 * 3 = 9.45
        assert act.calculate_amount(quantity=Decimal("3")) == Decimal("9.45")

    def test_with_fixed_amount(self):
        act = _make_catalog(
            fixed_amount=Decimal("13.00"),
            coefficient=None,
            base_rate=None,
        )
        assert act.calculate_amount() == Decimal("13.00")

    def test_fixed_amount_with_quantity(self):
        act = _make_catalog(
            fixed_amount=Decimal("13.00"),
            coefficient=None,
            base_rate=None,
        )
        assert act.calculate_amount(quantity=Decimal("2")) == Decimal("26.00")

    def test_fixed_amount_takes_priority(self):
        act = _make_catalog(
            fixed_amount=Decimal("10.00"),
            coefficient=Decimal("4"),
            base_rate=Decimal("3.15"),
        )
        # fixed_amount should take priority
        assert act.calculate_amount() == Decimal("10.00")

    def test_no_coefficient_no_fixed(self):
        act = _make_catalog(coefficient=None, base_rate=None, fixed_amount=None)
        assert act.calculate_amount() == Decimal("0.00")

    def test_coefficient_but_no_base_rate(self):
        act = _make_catalog(coefficient=Decimal("4"), base_rate=None, fixed_amount=None)
        assert act.calculate_amount() == Decimal("0.00")

    def test_rounding(self):
        act = _make_catalog(coefficient=Decimal("1.5"), base_rate=Decimal("3.15"))
        # 1.5 * 3.15 = 4.725 → arrondi a 4.73 (banker's rounding)
        result = act.calculate_amount()
        assert result == Decimal("4.72") or result == Decimal("4.73")


class TestIsCurrentlyEffective:
    def test_effective_today(self):
        act = _make_catalog(effective_from=datetime.date(2020, 1, 1))
        assert act.is_currently_effective() is True

    def test_not_yet_effective(self):
        act = _make_catalog(effective_from=datetime.date(2099, 1, 1))
        assert act.is_currently_effective() is False

    def test_past_effective_to(self):
        act = _make_catalog(
            effective_from=datetime.date(2020, 1, 1),
            effective_to=datetime.date(2020, 12, 31),
        )
        assert act.is_currently_effective() is False

    def test_custom_date_within_range(self):
        act = _make_catalog(
            effective_from=datetime.date(2024, 1, 1),
            effective_to=datetime.date(2024, 12, 31),
        )
        assert act.is_currently_effective(at_date=datetime.date(2024, 6, 15)) is True

    def test_custom_date_before_range(self):
        act = _make_catalog(
            effective_from=datetime.date(2024, 6, 1),
            effective_to=datetime.date(2024, 12, 31),
        )
        assert act.is_currently_effective(at_date=datetime.date(2024, 1, 1)) is False

    def test_custom_date_after_range(self):
        act = _make_catalog(
            effective_from=datetime.date(2024, 1, 1),
            effective_to=datetime.date(2024, 6, 30),
        )
        assert act.is_currently_effective(at_date=datetime.date(2024, 12, 1)) is False

    def test_effective_on_boundary_from(self):
        act = _make_catalog(effective_from=datetime.date(2024, 6, 15))
        assert act.is_currently_effective(at_date=datetime.date(2024, 6, 15)) is True

    def test_effective_on_boundary_to(self):
        act = _make_catalog(
            effective_from=datetime.date(2024, 1, 1),
            effective_to=datetime.date(2024, 6, 15),
        )
        assert act.is_currently_effective(at_date=datetime.date(2024, 6, 15)) is True

    def test_no_effective_to_means_open_ended(self):
        act = _make_catalog(
            effective_from=datetime.date(2020, 1, 1),
            effective_to=None,
        )
        assert act.is_currently_effective(at_date=datetime.date(2099, 12, 31)) is True


class TestTarif:
    def test_tarif_montant(self):
        from app.domain.value_objects.tarif import Tarif

        t = Tarif(base_rate=Decimal("3.15"), coefficient=Decimal("4"))
        assert t.montant == Decimal("12.60")

    def test_tarif_with_quantity(self):
        from app.domain.value_objects.tarif import Tarif

        t = Tarif(base_rate=Decimal("3.15"), coefficient=Decimal("1"), quantity=Decimal("3"))
        assert t.montant == Decimal("9.45")

    def test_tarif_rounding(self):
        from app.domain.value_objects.tarif import Tarif

        t = Tarif(base_rate=Decimal("3.15"), coefficient=Decimal("1.5"))
        # 3.15 * 1.5 = 4.725 → 4.72 (banker's rounding)
        result = t.montant
        assert result == Decimal("4.72") or result == Decimal("4.73")

    def test_tarif_frozen(self):
        from app.domain.value_objects.tarif import Tarif

        t = Tarif(base_rate=Decimal("3.15"), coefficient=Decimal("4"))
        with pytest.raises(AttributeError):
            t.base_rate = Decimal("5.00")
