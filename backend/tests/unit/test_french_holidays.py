"""Tests unitaires pour le module de jours feries francais."""

import datetime

from app.domain.services.french_holidays import (
    get_easter,
    get_french_holidays,
    is_french_holiday,
    is_sunday_or_holiday,
)


class TestGetEaster:
    def test_easter_2026(self):
        # Paques 2026 = 5 avril
        assert get_easter(2026) == datetime.date(2026, 4, 5)

    def test_easter_2025(self):
        # Paques 2025 = 20 avril
        assert get_easter(2025) == datetime.date(2025, 4, 20)

    def test_easter_2024(self):
        # Paques 2024 = 31 mars
        assert get_easter(2024) == datetime.date(2024, 3, 31)

    def test_easter_2023(self):
        # Paques 2023 = 9 avril
        assert get_easter(2023) == datetime.date(2023, 4, 9)

    def test_easter_2027(self):
        # Paques 2027 = 28 mars
        assert get_easter(2027) == datetime.date(2027, 3, 28)


class TestGetFrenchHolidays:
    def test_2026_fixed_holidays(self):
        holidays = get_french_holidays(2026)
        # Jours fixes
        assert datetime.date(2026, 1, 1) in holidays    # Jour de l'An
        assert datetime.date(2026, 5, 1) in holidays    # Fete du Travail
        assert datetime.date(2026, 5, 8) in holidays    # Victoire 1945
        assert datetime.date(2026, 7, 14) in holidays   # Fete nationale
        assert datetime.date(2026, 8, 15) in holidays   # Assomption
        assert datetime.date(2026, 11, 1) in holidays   # Toussaint
        assert datetime.date(2026, 11, 11) in holidays  # Armistice
        assert datetime.date(2026, 12, 25) in holidays  # Noel

    def test_2026_mobile_holidays(self):
        # Paques 2026 = 5 avril
        holidays = get_french_holidays(2026)
        assert datetime.date(2026, 4, 6) in holidays    # Lundi de Paques (5 avril + 1)
        assert datetime.date(2026, 5, 14) in holidays   # Ascension (5 avril + 39)
        assert datetime.date(2026, 5, 25) in holidays   # Lundi de Pentecote (5 avril + 50)

    def test_total_count(self):
        holidays = get_french_holidays(2026)
        assert len(holidays) == 11

    def test_normal_day_not_in_holidays(self):
        holidays = get_french_holidays(2026)
        assert datetime.date(2026, 3, 15) not in holidays
        assert datetime.date(2026, 6, 10) not in holidays


class TestIsFrenchHoliday:
    def test_noel(self):
        assert is_french_holiday(datetime.date(2026, 12, 25)) is True

    def test_normal_day(self):
        assert is_french_holiday(datetime.date(2026, 3, 16)) is False

    def test_lundi_paques_2026(self):
        assert is_french_holiday(datetime.date(2026, 4, 6)) is True


class TestIsSundayOrHoliday:
    def test_sunday(self):
        # 15 mars 2026 est un dimanche
        assert datetime.date(2026, 3, 15).weekday() == 6
        assert is_sunday_or_holiday(datetime.date(2026, 3, 15)) is True

    def test_holiday_not_sunday(self):
        # 1er mai 2026 = vendredi
        assert is_sunday_or_holiday(datetime.date(2026, 5, 1)) is True

    def test_normal_weekday(self):
        # 16 mars 2026 = lundi
        assert is_sunday_or_holiday(datetime.date(2026, 3, 16)) is False

    def test_christmas_2026(self):
        # Noel 2026 = vendredi
        assert is_sunday_or_holiday(datetime.date(2026, 12, 25)) is True
