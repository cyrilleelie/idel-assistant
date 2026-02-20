import datetime
from uuid import uuid4

from app.domain.entities.appointment import Appointment
from app.domain.entities.tournee import TourneeStop
from app.domain.rules.tournee_rules import build_time_windows, validate_lunch_break

TOURNEE_ID = uuid4()
APPT_ID = uuid4()


def _make_stop(
    hour: int, minute: int = 0, care_duration: int = 30
) -> tuple[TourneeStop, int]:
    stop = TourneeStop(
        tournee_id=TOURNEE_ID,
        appointment_id=APPT_ID,
        stop_order=1,
        estimated_arrival=datetime.datetime(2026, 2, 20, hour, minute),
    )
    return (stop, care_duration)


def _make_appointment(hour: int, minute: int = 0, duration: int = 30) -> Appointment:
    return Appointment(
        cabinet_id=uuid4(),
        idel_id=uuid4(),
        patient_id=uuid4(),
        scheduled_at=datetime.datetime(2026, 2, 20, hour, minute),
        duration_minutes=duration,
        care_type="pansement",
    )


# === validate_lunch_break ===


class TestValidateLunchBreak:
    def test_no_conflict_before_lunch(self):
        stops = [_make_stop(10, 0, 30)]  # 10h00-10h30
        assert validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_no_conflict_after_lunch(self):
        stops = [_make_stop(14, 0, 30)]  # 14h00-14h30
        assert validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_conflict_arrival_during_lunch(self):
        stops = [_make_stop(12, 30, 30)]  # 12h30-13h00
        assert not validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_conflict_care_overlaps_into_lunch(self):
        # Arrive a 11h30, soin de 45 min → finit a 12h15 (pendant la pause)
        stops = [_make_stop(11, 30, 45)]
        assert not validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_care_ends_exactly_at_lunch_start(self):
        # Arrive a 11h30, soin de 30 min → finit a 12h00 exactement
        stops = [_make_stop(11, 30, 30)]
        assert validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_care_starts_exactly_at_lunch_end(self):
        # Arrive a 13h00, pause 12h-13h → pas de conflit
        stops = [_make_stop(13, 0, 30)]
        assert validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_empty_stops(self):
        assert validate_lunch_break([], datetime.time(12, 0), 60)

    def test_stop_without_arrival(self):
        stop = TourneeStop(
            tournee_id=TOURNEE_ID,
            appointment_id=APPT_ID,
            stop_order=1,
            estimated_arrival=None,
        )
        assert validate_lunch_break([(stop, 30)], datetime.time(12, 0), 60)

    def test_multiple_stops_one_conflicts(self):
        stops = [
            _make_stop(9, 0, 30),   # OK
            _make_stop(12, 15, 30), # Conflit
            _make_stop(15, 0, 30),  # OK
        ]
        assert not validate_lunch_break(stops, datetime.time(12, 0), 60)


# === build_time_windows ===


class TestBuildTimeWindows:
    def test_single_appointment(self):
        appointments = [_make_appointment(10, 0, 30)]
        windows = build_time_windows(appointments)
        assert len(windows) == 1
        # 10h00 = 600 min, fenetre 570-630 (+/- 30 min)
        assert windows[0] == (570, 630)

    def test_early_morning_appointment(self):
        appointments = [_make_appointment(7, 15, 30)]
        windows = build_time_windows(appointments)
        # 7h15 = 435 min, fenetre max(420, 405)-min(1140, 465) = (420, 465)
        assert windows[0][0] == 420  # borne a 7h00 minimum

    def test_window_expanded_for_long_care(self):
        # Soin de 90 min, fenetre +/-30 = 60 min → trop petit → elargi
        appointments = [_make_appointment(10, 0, 90)]
        windows = build_time_windows(appointments)
        start, end = windows[0]
        assert end - start >= 90

    def test_multiple_appointments(self):
        appointments = [
            _make_appointment(8, 0, 30),
            _make_appointment(10, 0, 45),
            _make_appointment(14, 0, 20),
        ]
        windows = build_time_windows(appointments)
        assert len(windows) == 3

    def test_empty_appointments(self):
        windows = build_time_windows([])
        assert windows == []

    def test_late_evening_appointment(self):
        appointments = [_make_appointment(18, 30, 30)]
        windows = build_time_windows(appointments)
        # 18h30 = 1110, fenetre 1080-1140 (18h-19h)
        assert windows[0][1] <= 19 * 60  # ne depasse pas 19h
