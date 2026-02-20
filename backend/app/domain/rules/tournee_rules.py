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


def build_daily_schedule(
    appointments: list[Appointment],
    distances: dict[tuple[str, str], tuple[float, float]],
    start_location: tuple[float, float] | None = None,
) -> list[TourneeStop]:
    """Construit le planning journalier a partir des RDV tries par heure.

    Les RDV sont tries chronologiquement (ils ne sont pas reordonnes).
    Les distances sont un dict {(from_id, to_id): (km, minutes)}.
    from_id/to_id sont des str(UUID) ou "start" pour le point de depart.

    Retourne la liste des TourneeStop ordonnee.
    """
    if not appointments:
        return []

    sorted_appts = sorted(appointments, key=lambda a: a.scheduled_at)
    stops: list[TourneeStop] = []

    for i, appt in enumerate(sorted_appts):
        if i == 0:
            from_key = "start"
        else:
            from_key = str(sorted_appts[i - 1].id)

        to_key = str(appt.id)
        dist_km, travel_min = distances.get((from_key, to_key), (0.0, 0.0))

        stop = TourneeStop(
            tournee_id=appt.cabinet_id,  # sera ecrase par le use case
            appointment_id=appt.id,
            stop_order=i + 1,
            estimated_arrival=appt.scheduled_at,
            distance_from_previous_km=dist_km,
            travel_time_from_previous_min=int(travel_min),
        )
        stops.append(stop)

    return stops


def estimate_daily_metrics(
    stops: list[TourneeStop],
    care_durations: dict[str, int],
) -> dict:
    """Calcule les metriques de la journee.

    Args:
        stops: liste de TourneeStop
        care_durations: dict {str(appointment_id): duration_minutes}

    Returns:
        dict avec total_distance_km, total_travel_minutes, total_care_minutes, longest_leg_km
    """
    if not stops:
        return {
            "total_distance_km": 0.0,
            "total_travel_minutes": 0.0,
            "total_care_minutes": 0,
            "longest_leg_km": 0.0,
        }

    total_distance = sum(s.distance_from_previous_km for s in stops)
    total_travel = sum(s.travel_time_from_previous_min for s in stops)
    total_care = sum(care_durations.get(str(s.appointment_id), 0) for s in stops)
    longest_leg = max(s.distance_from_previous_km for s in stops)

    return {
        "total_distance_km": round(total_distance, 1),
        "total_travel_minutes": round(total_travel, 1),
        "total_care_minutes": total_care,
        "longest_leg_km": round(longest_leg, 1),
    }


def detect_scheduling_inefficiencies(
    stops: list[TourneeStop],
    patient_sectors: dict[str, str],
) -> list[str]:
    """Detecte les zigzags et allers-retours dans le planning.

    Args:
        stops: liste de TourneeStop ordonnee
        patient_sectors: dict {str(appointment_id): sector_name}

    Returns:
        liste de messages d'avertissement
    """
    warnings: list[str] = []

    if len(stops) < 3:
        return warnings

    # Detecte les patterns A -> B -> A (retour au meme secteur)
    sectors = [patient_sectors.get(str(s.appointment_id), "") for s in stops]

    for i in range(len(sectors) - 2):
        if sectors[i] and sectors[i] == sectors[i + 2] and sectors[i] != sectors[i + 1]:
            warnings.append(
                f"Aller-retour detecte : arret {i+1} ({sectors[i]}) -> "
                f"arret {i+2} ({sectors[i+1]}) -> arret {i+3} ({sectors[i+2]})"
            )

    return warnings
