"""Tests unitaires pour le mapping fréquences frontend↔RRULE."""

from app.application.frequency_mapper import (
    frequency_display_to_rrule,
    rrule_to_frequency_display,
)


class TestFrequencyDisplayToRrule:
    def test_daily(self):
        assert frequency_display_to_rrule("daily") == "FREQ=DAILY;INTERVAL=1"

    def test_2xday(self):
        rrule = frequency_display_to_rrule("2xday")
        assert "FREQ=DAILY" in rrule
        assert "BYHOUR=8,18" in rrule

    def test_3xday(self):
        rrule = frequency_display_to_rrule("3xday")
        assert "BYHOUR=8,13,18" in rrule

    def test_weekly(self):
        assert frequency_display_to_rrule("weekly") == "FREQ=WEEKLY;INTERVAL=1"

    def test_2xweek(self):
        rrule = frequency_display_to_rrule("2xweek")
        assert "BYDAY=MO,TH" in rrule

    def test_3xweek(self):
        rrule = frequency_display_to_rrule("3xweek")
        assert "BYDAY=MO,WE,FR" in rrule

    def test_custom_returns_none(self):
        assert frequency_display_to_rrule("custom") is None

    def test_unknown_returns_none(self):
        assert frequency_display_to_rrule("biweekly") is None


class TestRruleToFrequencyDisplay:
    def test_daily(self):
        assert rrule_to_frequency_display("FREQ=DAILY;INTERVAL=1") == "daily"

    def test_weekly(self):
        assert rrule_to_frequency_display("FREQ=WEEKLY;INTERVAL=1") == "weekly"

    def test_2xday(self):
        assert rrule_to_frequency_display("FREQ=DAILY;INTERVAL=1;BYHOUR=8,18") == "2xday"

    def test_unknown_rrule_returns_custom(self):
        assert rrule_to_frequency_display("FREQ=MONTHLY;INTERVAL=1") == "custom"

    def test_roundtrip_all_known(self):
        for display in ["daily", "2xday", "3xday", "weekly", "2xweek", "3xweek"]:
            rrule = frequency_display_to_rrule(display)
            assert rrule is not None
            assert rrule_to_frequency_display(rrule) == display
