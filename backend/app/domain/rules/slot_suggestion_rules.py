import datetime
from dataclasses import dataclass
from uuid import UUID

from app.domain.entities.appointment import Appointment
from app.domain.entities.slot_suggestion import SlotSuggestion


@dataclass
class GapDistances:
    """Distances pre-calculees pour un gap entre deux RDV."""
    prev_to_new_km: float = 0.0
    prev_to_new_min: float = 0.0
    new_to_next_km: float = 0.0
    new_to_next_min: float = 0.0
    prev_to_next_km: float = 0.0
    prev_to_next_min: float = 0.0


def check_slot_fits(
    gap_start_min: int,
    gap_end_min: int,
    duration: int,
    travel_to: float,
    travel_from: float,
    buffer: int = 5,
) -> bool:
    """Verifie qu'un creneau rentre dans un gap entre deux RDV.

    Args:
        gap_start_min: minute de fin du RDV precedent (depuis minuit)
        gap_end_min: minute de debut du RDV suivant (depuis minuit)
        duration: duree du soin en minutes
        travel_to: temps de trajet vers le nouveau patient (minutes)
        travel_from: temps de trajet du nouveau patient vers le suivant (minutes)
        buffer: marge de securite en minutes

    Returns:
        True si le creneau rentre dans le gap
    """
    total_needed = travel_to + duration + travel_from + buffer
    available = gap_end_min - gap_start_min
    return available >= total_needed


def calculate_detour(
    dist_prev_new_km: float,
    dist_new_next_km: float,
    dist_prev_next_km: float,
    time_prev_new_min: float,
    time_new_next_min: float,
    time_prev_next_min: float,
) -> tuple[float, float]:
    """Calcule le detour en km et minutes.

    Detour = (trajet prev->new + new->next) - trajet direct prev->next

    Returns:
        (detour_km, detour_minutes)
    """
    detour_km = (dist_prev_new_km + dist_new_next_km) - dist_prev_next_km
    detour_min = (time_prev_new_min + time_new_next_min) - time_prev_next_min
    return max(0.0, round(detour_km, 1)), max(0.0, round(detour_min, 1))


def score_slot(
    detour_km: float,
    same_sector: bool,
    time_pref_match: bool,
    gap_comfort_min: float,
) -> float:
    """Calcule le score d'un creneau (0-100).

    Poids : detour 40%, secteur 25%, preference horaire 20%, confort 15%.
    """
    # Score detour (40%) : 100 si 0 km, 0 si >= 20 km
    if detour_km <= 0:
        detour_score = 100.0
    elif detour_km >= 20:
        detour_score = 0.0
    else:
        detour_score = 100.0 * (1.0 - detour_km / 20.0)

    # Score secteur (25%) : 100 si meme secteur, 0 sinon
    sector_score = 100.0 if same_sector else 0.0

    # Score preference horaire (20%) : 100 si correspond, 0 sinon
    time_pref_score = 100.0 if time_pref_match else 0.0

    # Score confort (15%) : base sur la marge disponible dans le gap
    if gap_comfort_min >= 30:
        comfort_score = 100.0
    elif gap_comfort_min <= 0:
        comfort_score = 0.0
    else:
        comfort_score = 100.0 * (gap_comfort_min / 30.0)

    total = (
        detour_score * 0.40
        + sector_score * 0.25
        + time_pref_score * 0.20
        + comfort_score * 0.15
    )
    return round(total, 1)


def _time_to_min(t: datetime.time) -> int:
    return t.hour * 60 + t.minute


def _min_to_time(m: int) -> datetime.time:
    return datetime.time(m // 60, m % 60)


def _get_preferred_slot(preferred: str, hour: int) -> bool:
    """Verifie si l'heure correspond au creneau prefere."""
    if not preferred:
        return True  # pas de preference = toujours OK
    if preferred == "morning":
        return hour < 12
    if preferred == "afternoon":
        return 12 <= hour < 18
    if preferred == "evening":
        return hour >= 18
    return True


def find_available_slots(
    existing_appts: list[Appointment],
    duration: int,
    work_start: datetime.time,
    work_end: datetime.time,
    lunch_start: datetime.time,
    lunch_duration: int,
    gap_distances: dict[tuple[str, str], GapDistances],
    patient_sector_name: str,
    appointment_sectors: dict[str, str],
    preferred_time_slot: str = "",
    max_results: int = 3,
) -> list[SlotSuggestion]:
    """Trouve les meilleurs creneaux disponibles pour un nouveau RDV.

    Args:
        existing_appts: RDV existants du jour (tries par heure)
        duration: duree du soin en minutes
        work_start: heure de debut de travail
        work_end: heure de fin de travail
        lunch_start: heure de debut de pause dejeuner
        lunch_duration: duree de la pause dejeuner en minutes
        gap_distances: distances pre-calculees pour chaque gap possible
            cle = (from_id, to_id) avec "start"/"end" pour debut/fin de journee
        patient_sector_name: nom du secteur du nouveau patient
        appointment_sectors: dict {str(appointment_id): sector_name}
        preferred_time_slot: preference horaire du patient (morning/afternoon/evening)
        max_results: nombre max de suggestions

    Returns:
        liste de SlotSuggestion triee par score decroissant
    """
    sorted_appts = sorted(existing_appts, key=lambda a: a.scheduled_at)

    work_start_min = _time_to_min(work_start)
    work_end_min = _time_to_min(work_end)
    lunch_start_min = _time_to_min(lunch_start)
    lunch_end_min = lunch_start_min + lunch_duration

    candidates: list[SlotSuggestion] = []

    # Construire les gaps : avant le 1er RDV, entre chaque paire, apres le dernier
    gaps: list[tuple[int, int, str, str, UUID | None, UUID | None]] = []

    if not sorted_appts:
        # Journee vide : un seul gap = toute la journee
        gaps.append((work_start_min, work_end_min, "start", "end", None, None))
    else:
        # Gap avant le premier RDV
        first = sorted_appts[0]
        first_start_min = _time_to_min(first.scheduled_at.time())
        if first_start_min > work_start_min:
            gaps.append((work_start_min, first_start_min, "start", str(first.id), None, first.id))

        # Gaps entre RDV consecutifs
        for i in range(len(sorted_appts) - 1):
            prev = sorted_appts[i]
            nxt = sorted_appts[i + 1]
            prev_end_min = _time_to_min(prev.scheduled_at.time()) + prev.duration_minutes
            nxt_start_min = _time_to_min(nxt.scheduled_at.time())
            if nxt_start_min > prev_end_min:
                gaps.append((prev_end_min, nxt_start_min, str(prev.id), str(nxt.id), prev.id, nxt.id))

        # Gap apres le dernier RDV
        last = sorted_appts[-1]
        last_end_min = _time_to_min(last.scheduled_at.time()) + last.duration_minutes
        if last_end_min < work_end_min:
            gaps.append((last_end_min, work_end_min, str(last.id), "end", last.id, None))

    for gap_start, gap_end, from_id, to_id, prev_appt_id, next_appt_id in gaps:
        dist_key = (from_id, to_id)
        gap_dist = gap_distances.get(dist_key, GapDistances())

        travel_to = gap_dist.prev_to_new_min
        travel_from = gap_dist.new_to_next_min

        if not check_slot_fits(gap_start, gap_end, duration, travel_to, travel_from):
            continue

        # Le creneau commence apres le trajet depuis le precedent
        slot_start_min = int(gap_start + travel_to)
        slot_end_min = slot_start_min + duration

        # Verifier que le creneau ne chevauche pas la pause dejeuner
        if slot_start_min < lunch_end_min and slot_end_min > lunch_start_min:
            # Essayer de placer apres la pause
            alt_start = int(lunch_end_min + travel_to)
            alt_end = alt_start + duration
            if alt_end + travel_from <= gap_end:
                slot_start_min = alt_start
                slot_end_min = alt_end
            else:
                # Essayer de placer avant la pause
                alt_end2 = int(lunch_start_min - travel_from)
                alt_start2 = alt_end2 - duration
                if alt_start2 >= gap_start + travel_to:
                    slot_start_min = alt_start2
                    slot_end_min = alt_end2
                else:
                    continue

        # Borner dans les horaires de travail
        if slot_start_min < work_start_min or slot_end_min > work_end_min:
            continue

        # Calculer le detour
        detour_km, detour_min = calculate_detour(
            gap_dist.prev_to_new_km, gap_dist.new_to_next_km, gap_dist.prev_to_next_km,
            gap_dist.prev_to_new_min, gap_dist.new_to_next_min, gap_dist.prev_to_next_min,
        )

        # Meme secteur ?
        same_sector = bool(patient_sector_name and patient_sector_name != "")
        if same_sector:
            # Verifier avec les RDV adjacents
            adjacent_sectors = set()
            if prev_appt_id:
                adjacent_sectors.add(appointment_sectors.get(str(prev_appt_id), ""))
            if next_appt_id:
                adjacent_sectors.add(appointment_sectors.get(str(next_appt_id), ""))
            same_sector = patient_sector_name in adjacent_sectors

        # Preference horaire
        time_pref_match = _get_preferred_slot(preferred_time_slot, slot_start_min // 60)

        # Confort : marge restante dans le gap
        total_used = travel_to + duration + travel_from
        gap_comfort = (gap_end - gap_start) - total_used

        slot_score = score_slot(detour_km, same_sector, time_pref_match, gap_comfort)

        start_time = _min_to_time(slot_start_min)
        end_time = _min_to_time(slot_end_min)

        explanation_parts = []
        if detour_km > 0:
            explanation_parts.append(f"detour {detour_km} km")
        else:
            explanation_parts.append("pas de detour")
        if same_sector:
            explanation_parts.append("meme secteur")
        if time_pref_match and preferred_time_slot:
            explanation_parts.append(f"creneau {preferred_time_slot}")

        candidates.append(SlotSuggestion(
            rank=0,
            start_time=start_time,
            end_time=end_time,
            previous_appointment_id=prev_appt_id,
            next_appointment_id=next_appt_id,
            detour_km=detour_km,
            detour_minutes=detour_min,
            same_sector=same_sector,
            sector_name=patient_sector_name,
            score=slot_score,
            explanation=", ".join(explanation_parts),
        ))

    # Trier par score decroissant et assigner les rangs
    candidates.sort(key=lambda s: s.score, reverse=True)
    result = candidates[:max_results]
    for i, suggestion in enumerate(result):
        suggestion.rank = i + 1

    return result
