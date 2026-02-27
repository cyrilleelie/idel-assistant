import datetime
from uuid import UUID

from app.domain.entities.appointment import Appointment
from app.domain.entities.care_protocol import CareProtocol
from app.domain.entities.prescription import Prescription
from app.domain.value_objects.recurrence import RecurrenceRule


def generate_appointments_from_protocol(
    protocol: CareProtocol,
    idel_id: UUID,
    from_date: datetime.date,
    to_date: datetime.date,
    prescriptions: list[Prescription] | None = None,
) -> list[Appointment]:
    """Génère les Appointments depuis un plan de soins.

    Utilise les données de la première ordonnance (Prescription) pour la
    récurrence, l'heure et la durée. Si aucune ordonnance n'est fournie,
    utilise des valeurs par défaut (FREQ=DAILY, 9h00, 30min).
    """
    first: Prescription | None = (prescriptions or [None])[0]

    recurrence_rule_str = (first.recurrence_rule if first else None) or "FREQ=DAILY"
    recurrence = RecurrenceRule(recurrence_rule_str)
    dates = recurrence.generate_occurrences(from_date, to_date)

    # Heure par défaut selon le créneau préféré
    if first and first.preferred_time:
        default_time = first.preferred_time
    else:
        preferred_slot = (first.preferred_slot if first else "") or ""
        slot_times = {
            "morning": datetime.time(8, 0),
            "afternoon": datetime.time(14, 0),
            "evening": datetime.time(18, 0),
        }
        default_time = slot_times.get(preferred_slot, datetime.time(9, 0))

    duration = (first.duration_minutes if first else None) or 30
    act_codes = list(first.act_codes if first else [])

    appointments: list[Appointment] = []
    for date in dates:
        scheduled_at = datetime.datetime.combine(date, default_time)
        appointment = Appointment(
            cabinet_id=protocol.cabinet_id,
            idel_id=idel_id,
            patient_id=protocol.patient_id,
            scheduled_at=scheduled_at,
            duration_minutes=duration,
            care_type="",
            care_protocol_id=protocol.id,
            act_codes=list(act_codes),
            status="scheduled",
            created_by="protocol",
        )
        appointments.append(appointment)

    return appointments
