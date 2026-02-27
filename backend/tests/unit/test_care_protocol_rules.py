import datetime
from uuid import uuid4

from app.domain.entities.care_protocol import CareProtocol
from app.domain.entities.prescription import Prescription
from app.domain.rules.care_protocol_rules import generate_appointments_from_protocol

CABINET_ID = uuid4()
PATIENT_ID = uuid4()
IDEL_ID = uuid4()


def _make_protocol(**kwargs) -> CareProtocol:
    defaults = dict(
        patient_id=PATIENT_ID,
        cabinet_id=CABINET_ID,
        start_date=datetime.date(2026, 3, 1),
    )
    defaults.update(kwargs)
    return CareProtocol(**defaults)


def _make_prescription(**kwargs) -> Prescription:
    defaults = dict(
        patient_id=PATIENT_ID,
        cabinet_id=CABINET_ID,
        duration_minutes=20,
        recurrence_rule="FREQ=DAILY",
        start_date=datetime.date(2026, 3, 1),
        preferred_time=datetime.time(8, 0),
    )
    defaults.update(kwargs)
    return Prescription(**defaults)


class TestGenerateAppointmentsFromProtocol:
    def test_daily_protocol_one_week(self):
        protocol = _make_protocol()
        prescription = _make_prescription(recurrence_rule="FREQ=DAILY")
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 7),
            prescriptions=[prescription],
        )
        assert len(appointments) == 7
        for appt in appointments:
            assert appt.cabinet_id == CABINET_ID
            assert appt.patient_id == PATIENT_ID
            assert appt.idel_id == IDEL_ID
            assert appt.duration_minutes == 20
            assert appt.status == "scheduled"
            assert appt.created_by == "protocol"
            assert appt.care_protocol_id == protocol.id

    def test_daily_protocol_uses_preferred_time(self):
        protocol = _make_protocol()
        prescription = _make_prescription(preferred_time=datetime.time(14, 30))
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 3),
            prescriptions=[prescription],
        )
        for appt in appointments:
            assert appt.scheduled_at.hour == 14
            assert appt.scheduled_at.minute == 30

    def test_weekly_mon_wed_fri(self):
        protocol = _make_protocol()
        prescription = _make_prescription(recurrence_rule="FREQ=WEEKLY;BYDAY=MO,WE,FR")
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 2),  # lundi
            datetime.date(2026, 3, 15),  # dimanche
            prescriptions=[prescription],
        )
        # 2 semaines × 3 jours = 6 RDV
        assert len(appointments) == 6
        for appt in appointments:
            assert appt.scheduled_at.weekday() in [0, 2, 4]

    def test_protocol_with_slot_instead_of_time(self):
        protocol = _make_protocol()
        prescription = _make_prescription(
            preferred_time=None,
            preferred_slot="afternoon",
        )
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 1),
            prescriptions=[prescription],
        )
        assert len(appointments) == 1
        assert appointments[0].scheduled_at.hour == 14

    def test_protocol_default_time(self):
        protocol = _make_protocol()
        prescription = _make_prescription(preferred_time=None, preferred_slot="")
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 1),
            prescriptions=[prescription],
        )
        assert len(appointments) == 1
        assert appointments[0].scheduled_at.hour == 9  # default

    def test_empty_date_range(self):
        protocol = _make_protocol()
        prescription = _make_prescription(recurrence_rule="FREQ=WEEKLY;BYDAY=MO")
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 3),  # mardi
            datetime.date(2026, 3, 5),  # jeudi → pas de lundi
            prescriptions=[prescription],
        )
        assert len(appointments) == 0

    def test_each_appointment_has_unique_id(self):
        protocol = _make_protocol()
        prescription = _make_prescription()
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 5),
            prescriptions=[prescription],
        )
        ids = [a.id for a in appointments]
        assert len(ids) == len(set(ids))

    def test_no_prescriptions_uses_defaults(self):
        """Sans ordonnance, la fonction génère quand même des RDV avec des valeurs par défaut."""
        protocol = _make_protocol()
        appointments = generate_appointments_from_protocol(
            protocol,
            IDEL_ID,
            datetime.date(2026, 3, 1),
            datetime.date(2026, 3, 3),
        )
        assert len(appointments) == 3
        for appt in appointments:
            assert appt.duration_minutes == 30
            assert appt.scheduled_at.hour == 9  # heure par défaut
