import datetime
from uuid import UUID

from app.domain.entities.appointment import Appointment
from app.domain.entities.care_protocol import CareProtocol
from app.domain.value_objects.recurrence import RecurrenceRule


def generate_appointments_from_protocol(
    protocol: CareProtocol,
    idel_id: UUID,
    from_date: datetime.date,
    to_date: datetime.date,
) -> list[Appointment]:
    """Genere les Appointments depuis un protocole de soins.

    Utilise la RecurrenceRule pour generer les dates d'occurrence,
    puis cree un Appointment pour chaque date.
    """
    recurrence = RecurrenceRule(protocol.recurrence_rule)
    dates = recurrence.generate_occurrences(from_date, to_date)

    # Heure par defaut selon le creneau prefere
    if protocol.preferred_time:
        default_time = protocol.preferred_time
    else:
        slot_times = {
            "morning": datetime.time(8, 0),
            "afternoon": datetime.time(14, 0),
            "evening": datetime.time(18, 0),
        }
        default_time = slot_times.get(protocol.preferred_slot, datetime.time(9, 0))

    appointments: list[Appointment] = []
    for date in dates:
        scheduled_at = datetime.datetime.combine(date, default_time)
        appointment = Appointment(
            cabinet_id=protocol.cabinet_id,
            idel_id=idel_id,
            patient_id=protocol.patient_id,
            scheduled_at=scheduled_at,
            duration_minutes=protocol.duration_minutes,
            care_type=protocol.care_type,
            care_protocol_id=protocol.id,
            status="scheduled",
            created_by="protocol",
        )
        appointments.append(appointment)

    return appointments
