import datetime
from uuid import uuid4

from app.domain.entities.appointment import Appointment
from app.domain.entities.tournee import TourneeStop
from app.domain.rules.tournee_rules import (
    build_daily_schedule,
    detect_scheduling_inefficiencies,
    estimate_daily_metrics,
    validate_lunch_break,
)

TOURNEE_ID = uuid4()
APPT_ID = uuid4()
CABINET_ID = uuid4()
IDEL_ID = uuid4()


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
        cabinet_id=CABINET_ID,
        idel_id=IDEL_ID,
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
        # Arrive a 11h30, soin de 45 min -> finit a 12h15 (pendant la pause)
        stops = [_make_stop(11, 30, 45)]
        assert not validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_care_ends_exactly_at_lunch_start(self):
        # Arrive a 11h30, soin de 30 min -> finit a 12h00 exactement
        stops = [_make_stop(11, 30, 30)]
        assert validate_lunch_break(stops, datetime.time(12, 0), 60)

    def test_care_starts_exactly_at_lunch_end(self):
        # Arrive a 13h00, pause 12h-13h -> pas de conflit
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


# === build_daily_schedule ===


class TestBuildDailySchedule:
    def test_empty_appointments(self):
        stops = build_daily_schedule([], {})
        assert stops == []

    def test_single_appointment(self):
        appt = _make_appointment(9, 0, 30)
        distances = {("start", str(appt.id)): (5.0, 10.0)}
        stops = build_daily_schedule([appt], distances)
        assert len(stops) == 1
        assert stops[0].stop_order == 1
        assert stops[0].distance_from_previous_km == 5.0
        assert stops[0].travel_time_from_previous_min == 10

    def test_multiple_appointments_sorted(self):
        appt1 = _make_appointment(10, 0, 30)
        appt2 = _make_appointment(8, 0, 30)  # earlier but added second
        appt3 = _make_appointment(14, 0, 30)
        distances = {
            ("start", str(appt2.id)): (3.0, 6.0),
            (str(appt2.id), str(appt1.id)): (2.0, 4.0),
            (str(appt1.id), str(appt3.id)): (7.0, 14.0),
        }
        stops = build_daily_schedule([appt1, appt2, appt3], distances)
        assert len(stops) == 3
        # Should be sorted by scheduled_at
        assert stops[0].appointment_id == appt2.id
        assert stops[1].appointment_id == appt1.id
        assert stops[2].appointment_id == appt3.id
        assert stops[0].stop_order == 1
        assert stops[1].stop_order == 2
        assert stops[2].stop_order == 3

    def test_missing_distances_default_zero(self):
        appt = _make_appointment(9, 0)
        stops = build_daily_schedule([appt], {})
        assert stops[0].distance_from_previous_km == 0.0


# === estimate_daily_metrics ===


class TestEstimateDailyMetrics:
    def test_empty_stops(self):
        metrics = estimate_daily_metrics([], {})
        assert metrics["total_distance_km"] == 0.0
        assert metrics["total_travel_minutes"] == 0.0
        assert metrics["total_care_minutes"] == 0
        assert metrics["longest_leg_km"] == 0.0

    def test_with_stops(self):
        stop1 = TourneeStop(
            tournee_id=TOURNEE_ID,
            appointment_id=uuid4(),
            stop_order=1,
            distance_from_previous_km=5.0,
            travel_time_from_previous_min=10,
        )
        stop2 = TourneeStop(
            tournee_id=TOURNEE_ID,
            appointment_id=uuid4(),
            stop_order=2,
            distance_from_previous_km=8.0,
            travel_time_from_previous_min=16,
        )
        care_durations = {
            str(stop1.appointment_id): 30,
            str(stop2.appointment_id): 45,
        }
        metrics = estimate_daily_metrics([stop1, stop2], care_durations)
        assert metrics["total_distance_km"] == 13.0
        assert metrics["total_travel_minutes"] == 26.0
        assert metrics["total_care_minutes"] == 75
        assert metrics["longest_leg_km"] == 8.0


# === detect_scheduling_inefficiencies ===


class TestDetectSchedulingInefficiencies:
    def test_no_inefficiencies(self):
        appt_ids = [uuid4() for _ in range(3)]
        stops = [
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[0], stop_order=1),
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[1], stop_order=2),
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[2], stop_order=3),
        ]
        sectors = {
            str(appt_ids[0]): "Nord",
            str(appt_ids[1]): "Est",
            str(appt_ids[2]): "Sud",
        }
        warnings = detect_scheduling_inefficiencies(stops, sectors)
        assert len(warnings) == 0

    def test_zigzag_detected(self):
        appt_ids = [uuid4() for _ in range(3)]
        stops = [
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[0], stop_order=1),
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[1], stop_order=2),
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[2], stop_order=3),
        ]
        # Pattern A -> B -> A
        sectors = {
            str(appt_ids[0]): "Nord",
            str(appt_ids[1]): "Sud",
            str(appt_ids[2]): "Nord",
        }
        warnings = detect_scheduling_inefficiencies(stops, sectors)
        assert len(warnings) == 1
        assert "Aller-retour" in warnings[0]

    def test_less_than_3_stops(self):
        stops = [
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=uuid4(), stop_order=1),
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=uuid4(), stop_order=2),
        ]
        warnings = detect_scheduling_inefficiencies(stops, {})
        assert len(warnings) == 0

    def test_same_sector_not_zigzag(self):
        """Tous dans le meme secteur -> pas de zigzag."""
        appt_ids = [uuid4() for _ in range(3)]
        stops = [
            TourneeStop(tournee_id=TOURNEE_ID, appointment_id=appt_ids[i], stop_order=i+1)
            for i in range(3)
        ]
        sectors = {str(aid): "Nord" for aid in appt_ids}
        warnings = detect_scheduling_inefficiencies(stops, sectors)
        assert len(warnings) == 0
