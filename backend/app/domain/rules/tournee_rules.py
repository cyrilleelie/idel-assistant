import datetime

from app.domain.entities.appointment import Appointment
from app.domain.entities.tournee import TourneeStop


def validate_lunch_break(
    stops: list[tuple[TourneeStop, int]],
    lunch_start: datetime.time,
    lunch_duration: int,
) -> bool:
    """Verifie que la pause dejeuner est respectee dans la tournee.

    Aucun soin ne doit etre en cours pendant la plage de pause dejeuner.
    Retourne True si la pause est respectee.

    Args:
        stops: liste de tuples (TourneeStop, care_duration_minutes)
        lunch_start: heure de debut de la pause
        lunch_duration: duree de la pause en minutes
    """
    if not stops:
        return True

    lunch_start_min = lunch_start.hour * 60 + lunch_start.minute
    lunch_end_min = lunch_start_min + lunch_duration

    for stop, care_duration in stops:
        if stop.estimated_arrival is None:
            continue

        arrival_min = (
            stop.estimated_arrival.hour * 60 + stop.estimated_arrival.minute
        )
        care_end_min = arrival_min + care_duration

        # Le soin chevauche la pause si : debut_soin < fin_pause ET fin_soin > debut_pause
        if arrival_min < lunch_end_min and care_end_min > lunch_start_min:
            return False

    return True


def build_time_windows(
    appointments: list[Appointment],
) -> list[tuple[int, int]]:
    """Convertit les appointments en fenetres temporelles pour OR-Tools.

    Retourne une liste de tuples (start_minutes, end_minutes) depuis minuit.
    Si un appointment n'a pas de contrainte horaire stricte, utilise une fenetre large (7h-19h).
    """
    DEFAULT_START = 7 * 60  # 7h00
    DEFAULT_END = 19 * 60  # 19h00

    windows: list[tuple[int, int]] = []

    for appt in appointments:
        start_min = appt.scheduled_at.hour * 60 + appt.scheduled_at.minute

        # Fenetre : heure prevue +/- 30 minutes de tolerance
        window_start = max(DEFAULT_START, start_min - 30)
        window_end = min(DEFAULT_END, start_min + 30)

        # S'assurer que la fenetre est assez large pour le soin
        if window_end - window_start < appt.duration_minutes:
            window_end = min(DEFAULT_END, window_start + appt.duration_minutes)

        windows.append((window_start, window_end))

    return windows
