import datetime
from uuid import uuid4

from app.domain.entities.appointment import Appointment
from app.domain.rules.appointment_rules import (
    check_no_time_conflict,
    validate_within_work_hours,
)

CABINET_ID = uuid4()
IDEL_ID = uuid4()
PATIENT_ID = uuid4()


def _make_appointment(
    hour: int, minute: int = 0, duration: int = 30, **kwargs
) -> Appointment:
    return Appointment(
        cabinet_id=CABINET_ID,
        idel_id=IDEL_ID,
        patient_id=PATIENT_ID,
        scheduled_at=datetime.datetime(2026, 2, 20, hour, minute),
        duration_minutes=duration,
        care_type="pansement",
        **kwargs,
    )


class TestCheckNoTimeConflict:
    def test_no_conflict(self):
        existing = [_make_appointment(8, 0, 30), _make_appointment(10, 0, 30)]
        # Nouveau RDV a 9h00, 30 min → 9h00-9h30, pas de conflit
        assert check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 9, 0), 30
        )

    def test_conflict_overlap_start(self):
        existing = [_make_appointment(8, 0, 60)]  # 8h00-9h00
        # Nouveau RDV a 8h30 → chevauche
        assert not check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 8, 30), 30
        )

    def test_conflict_overlap_end(self):
        existing = [_make_appointment(9, 0, 30)]  # 9h00-9h30
        # Nouveau RDV a 8h45 pendant 30 min → 8h45-9h15, chevauche
        assert not check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 8, 45), 30
        )

    def test_conflict_contained(self):
        existing = [_make_appointment(8, 0, 120)]  # 8h00-10h00
        # Nouveau RDV a 9h00 → contenu dans l'existant
        assert not check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 9, 0), 30
        )

    def test_adjacent_no_conflict(self):
        existing = [_make_appointment(8, 0, 30)]  # 8h00-8h30
        # Nouveau RDV a 8h30 → adjacent, pas de conflit
        assert check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 8, 30), 30
        )

    def test_exclude_id(self):
        appt = _make_appointment(8, 0, 30)
        existing = [appt]
        # Meme creneau mais on exclut l'ID → pas de conflit (cas de modification)
        assert check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 8, 0), 30, exclude_id=appt.id
        )

    def test_canceled_appointments_ignored(self):
        existing = [_make_appointment(8, 0, 60, status="canceled")]
        # L'appointment annule ne devrait pas creer de conflit
        assert check_no_time_conflict(
            existing, datetime.datetime(2026, 2, 20, 8, 0), 30
        )

    def test_empty_existing(self):
        assert check_no_time_conflict(
            [], datetime.datetime(2026, 2, 20, 8, 0), 30
        )


class TestValidateWithinWorkHours:
    def test_within_hours(self):
        assert validate_within_work_hours(
            datetime.datetime(2026, 2, 20, 9, 0),
            30,
            datetime.time(7, 0),
            datetime.time(19, 0),
        )

    def test_at_boundaries(self):
        # RDV 7h00-7h30 : exactement au debut
        assert validate_within_work_hours(
            datetime.datetime(2026, 2, 20, 7, 0),
            30,
            datetime.time(7, 0),
            datetime.time(19, 0),
        )

    def test_ends_at_boundary(self):
        # RDV 18h30-19h00 : finit exactement a la limite
        assert validate_within_work_hours(
            datetime.datetime(2026, 2, 20, 18, 30),
            30,
            datetime.time(7, 0),
            datetime.time(19, 0),
        )

    def test_before_work_hours(self):
        assert not validate_within_work_hours(
            datetime.datetime(2026, 2, 20, 6, 30),
            30,
            datetime.time(7, 0),
            datetime.time(19, 0),
        )

    def test_after_work_hours(self):
        # RDV 18h30 pendant 60 min → finit a 19h30
        assert not validate_within_work_hours(
            datetime.datetime(2026, 2, 20, 18, 30),
            60,
            datetime.time(7, 0),
            datetime.time(19, 0),
        )
