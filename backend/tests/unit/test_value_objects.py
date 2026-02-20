import datetime

import pytest

from app.domain.value_objects.address import Address
from app.domain.value_objects.recurrence import RecurrenceRule
from app.domain.value_objects.rpps_number import RPPSNumber
from app.domain.value_objects.time_window import TimeWindow


# === RPPSNumber ===


class TestRPPSNumber:
    def test_valid_rpps(self):
        rpps = RPPSNumber("12345678901")
        assert str(rpps) == "12345678901"

    def test_rpps_too_short(self):
        with pytest.raises(ValueError, match="11 chiffres"):
            RPPSNumber("1234567890")

    def test_rpps_too_long(self):
        with pytest.raises(ValueError, match="11 chiffres"):
            RPPSNumber("123456789012")

    def test_rpps_non_numeric(self):
        with pytest.raises(ValueError, match="11 chiffres"):
            RPPSNumber("1234567890a")

    def test_rpps_empty(self):
        with pytest.raises(ValueError):
            RPPSNumber("")

    def test_rpps_is_frozen(self):
        rpps = RPPSNumber("12345678901")
        with pytest.raises(AttributeError):
            rpps.value = "99999999999"


# === Address ===


class TestAddress:
    def test_address_without_coordinates(self):
        addr = Address(street="10 rue de la Paix, Paris")
        assert addr.street == "10 rue de la Paix, Paris"
        assert not addr.has_coordinates()

    def test_address_with_coordinates(self):
        addr = Address(street="10 rue de la Paix", lat=48.8566, lon=2.3522)
        assert addr.has_coordinates()
        assert addr.lat == 48.8566

    def test_address_empty_street(self):
        with pytest.raises(ValueError, match="vide"):
            Address(street="")

    def test_address_partial_coordinates(self):
        with pytest.raises(ValueError, match="ensemble"):
            Address(street="10 rue", lat=48.8566)

    def test_address_invalid_lat(self):
        with pytest.raises(ValueError, match="Latitude"):
            Address(street="10 rue", lat=91.0, lon=2.0)

    def test_address_invalid_lon(self):
        with pytest.raises(ValueError, match="Longitude"):
            Address(street="10 rue", lat=48.0, lon=181.0)


# === TimeWindow ===


class TestTimeWindow:
    def test_valid_time_window(self):
        tw = TimeWindow(start=datetime.time(8, 0), end=datetime.time(12, 0))
        assert tw.duration_minutes() == 240

    def test_invalid_time_window_start_after_end(self):
        with pytest.raises(ValueError, match="avant"):
            TimeWindow(start=datetime.time(14, 0), end=datetime.time(8, 0))

    def test_invalid_time_window_equal(self):
        with pytest.raises(ValueError, match="avant"):
            TimeWindow(start=datetime.time(8, 0), end=datetime.time(8, 0))

    def test_contains(self):
        tw = TimeWindow(start=datetime.time(8, 0), end=datetime.time(12, 0))
        assert tw.contains(datetime.time(10, 0))
        assert tw.contains(datetime.time(8, 0))  # borne incluse
        assert tw.contains(datetime.time(12, 0))  # borne incluse
        assert not tw.contains(datetime.time(7, 59))
        assert not tw.contains(datetime.time(12, 1))

    def test_overlaps_true(self):
        tw1 = TimeWindow(start=datetime.time(8, 0), end=datetime.time(12, 0))
        tw2 = TimeWindow(start=datetime.time(11, 0), end=datetime.time(14, 0))
        assert tw1.overlaps(tw2)
        assert tw2.overlaps(tw1)

    def test_overlaps_false(self):
        tw1 = TimeWindow(start=datetime.time(8, 0), end=datetime.time(10, 0))
        tw2 = TimeWindow(start=datetime.time(10, 0), end=datetime.time(12, 0))
        assert not tw1.overlaps(tw2)  # adjacent, pas de chevauchement

    def test_overlaps_contained(self):
        tw1 = TimeWindow(start=datetime.time(8, 0), end=datetime.time(18, 0))
        tw2 = TimeWindow(start=datetime.time(10, 0), end=datetime.time(12, 0))
        assert tw1.overlaps(tw2)
        assert tw2.overlaps(tw1)  # symetrie

    def test_overlaps_disjoint(self):
        tw1 = TimeWindow(start=datetime.time(8, 0), end=datetime.time(10, 0))
        tw2 = TimeWindow(start=datetime.time(11, 0), end=datetime.time(13, 0))
        assert not tw1.overlaps(tw2)
        assert not tw2.overlaps(tw1)

    def test_duration_minutes(self):
        tw = TimeWindow(start=datetime.time(8, 30), end=datetime.time(10, 15))
        assert tw.duration_minutes() == 105


# === RecurrenceRule ===


class TestRecurrenceRule:
    def test_daily_recurrence(self):
        rule = RecurrenceRule("FREQ=DAILY")
        dates = rule.generate_occurrences(
            datetime.date(2026, 2, 1), datetime.date(2026, 2, 7)
        )
        assert len(dates) == 7
        assert dates[0] == datetime.date(2026, 2, 1)
        assert dates[-1] == datetime.date(2026, 2, 7)

    def test_weekly_mon_wed_fri(self):
        rule = RecurrenceRule("FREQ=WEEKLY;BYDAY=MO,WE,FR")
        dates = rule.generate_occurrences(
            datetime.date(2026, 2, 2), datetime.date(2026, 2, 15)
        )
        # 2/2=lun, 2/4=mer, 2/6=ven, 2/9=lun, 2/11=mer, 2/13=ven
        assert len(dates) == 6
        for d in dates:
            assert d.weekday() in [0, 2, 4]  # lundi, mercredi, vendredi

    def test_monthly_recurrence(self):
        rule = RecurrenceRule("FREQ=MONTHLY;BYMONTHDAY=15")
        dates = rule.generate_occurrences(
            datetime.date(2026, 1, 1), datetime.date(2026, 6, 30)
        )
        assert len(dates) == 6
        for d in dates:
            assert d.day == 15

    def test_daily_with_count(self):
        rule = RecurrenceRule("FREQ=DAILY;COUNT=5")
        dates = rule.generate_occurrences(
            datetime.date(2026, 3, 1), datetime.date(2026, 3, 31)
        )
        assert len(dates) == 5

    def test_invalid_rrule(self):
        with pytest.raises(ValueError, match="RRULE invalide"):
            RecurrenceRule("NOT_A_VALID_RULE")

    def test_empty_rrule(self):
        with pytest.raises(ValueError, match="vide"):
            RecurrenceRule("")

    def test_whitespace_only_rrule(self):
        with pytest.raises(ValueError, match="vide"):
            RecurrenceRule("   ")

    def test_daily_with_until(self):
        rule = RecurrenceRule("FREQ=DAILY;UNTIL=20260305T235959")
        dates = rule.generate_occurrences(
            datetime.date(2026, 3, 1), datetime.date(2026, 3, 10)
        )
        assert len(dates) == 5
        assert dates[-1] == datetime.date(2026, 3, 5)


# === Address boundary tests ===


class TestAddressBoundary:
    def test_lat_min_boundary(self):
        addr = Address(street="Pole Sud", lat=-90.0, lon=0.0)
        assert addr.lat == -90.0

    def test_lat_max_boundary(self):
        addr = Address(street="Pole Nord", lat=90.0, lon=0.0)
        assert addr.lat == 90.0

    def test_lon_min_boundary(self):
        addr = Address(street="Date Line", lat=0.0, lon=-180.0)
        assert addr.lon == -180.0

    def test_lon_max_boundary(self):
        addr = Address(street="Date Line", lat=0.0, lon=180.0)
        assert addr.lon == 180.0
