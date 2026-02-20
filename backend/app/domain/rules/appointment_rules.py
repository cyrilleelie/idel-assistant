import datetime
from uuid import UUID

from app.domain.entities.appointment import Appointment


def check_no_time_conflict(
    existing: list[Appointment],
    new_start: datetime.datetime,
    new_duration: int,
    exclude_id: UUID | None = None,
) -> bool:
    """Verifie qu'aucun RDV existant ne chevauche le nouveau creneau.

    Retourne True si pas de conflit, False si conflit detecte.
    """
    new_end = new_start + datetime.timedelta(minutes=new_duration)

    for appt in existing:
        if exclude_id and appt.id == exclude_id:
            continue
        if appt.status == "canceled":
            continue

        appt_end = appt.scheduled_at + datetime.timedelta(minutes=appt.duration_minutes)

        # Chevauchement : new_start < appt_end AND appt_start < new_end
        if new_start < appt_end and appt.scheduled_at < new_end:
            return False

    return True


def validate_within_work_hours(
    scheduled_at: datetime.datetime,
    duration: int,
    work_start: datetime.time,
    work_end: datetime.time,
) -> bool:
    """Verifie que le RDV tient dans les horaires de travail.

    Retourne True si le RDV est dans les horaires, False sinon.
    """
    appt_start_time = scheduled_at.time()
    appt_end = scheduled_at + datetime.timedelta(minutes=duration)
    appt_end_time = appt_end.time()

    return appt_start_time >= work_start and appt_end_time <= work_end
