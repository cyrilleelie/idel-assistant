"""Tests unitaires pour le moteur de suggestion de creneaux."""

import datetime
from uuid import uuid4

from app.domain.entities.appointment import Appointment
from app.domain.rules.slot_suggestion_rules import (
    GapDistances,
    calculate_detour,
    check_slot_fits,
    find_available_slots,
    score_slot,
)

CABINET_ID = uuid4()
IDEL_ID = uuid4()


def _make_appt(
    hour: int, minute: int = 0, duration: int = 30, patient_id=None
) -> Appointment:
    return Appointment(
        cabinet_id=CABINET_ID,
        idel_id=IDEL_ID,
        patient_id=patient_id or uuid4(),
        scheduled_at=datetime.datetime(2026, 2, 20, hour, minute, tzinfo=datetime.UTC),
        duration_minutes=duration,
        care_type="pansement",
    )


class TestCheckSlotFits:
    def test_slot_fits(self):
        # Gap 60 min, besoin 30 min soin + 5+5 trajet + 5 buffer = 45 min
        assert check_slot_fits(480, 540, 30, 5, 5) is True

    def test_slot_too_small(self):
        # Gap 30 min, besoin 30 min soin + 5+5+5 = 45 min
        assert check_slot_fits(480, 510, 30, 5, 5) is False

    def test_exact_fit(self):
        # Gap 45 min = exactement ce qu'il faut
        assert check_slot_fits(480, 525, 30, 5, 5) is True

    def test_zero_travel(self):
        # Gap 35 min, 30 soin + 0+0+5 buffer = 35
        assert check_slot_fits(480, 515, 30, 0, 0) is True


class TestCalculateDetour:
    def test_no_detour(self):
        # prev->new + new->next = prev->next
        km, minutes = calculate_detour(5.0, 5.0, 10.0, 10.0, 10.0, 20.0)
        assert km == 0.0
        assert minutes == 0.0

    def test_positive_detour(self):
        km, minutes = calculate_detour(8.0, 7.0, 5.0, 12.0, 11.0, 8.0)
        assert km == 10.0  # 8+7-5
        assert minutes == 15.0  # 12+11-8

    def test_negative_becomes_zero(self):
        # Triangle inequality violation -> clamped to 0
        km, minutes = calculate_detour(2.0, 2.0, 10.0, 3.0, 3.0, 15.0)
        assert km == 0.0
        assert minutes == 0.0


class TestScoreSlot:
    def test_perfect_score(self):
        score = score_slot(detour_km=0, same_sector=True, time_pref_match=True, gap_comfort_min=30)
        assert score == 100.0

    def test_worst_score(self):
        score = score_slot(detour_km=20, same_sector=False, time_pref_match=False, gap_comfort_min=0)
        assert score == 0.0

    def test_detour_only(self):
        # 10 km detour -> detour_score = 50%, sector=0, time=0, comfort=0
        score = score_slot(detour_km=10, same_sector=False, time_pref_match=False, gap_comfort_min=0)
        assert score == 20.0  # 50 * 0.40

    def test_sector_bonus(self):
        score_with = score_slot(0, True, False, 0)
        score_without = score_slot(0, False, False, 0)
        assert score_with > score_without
        assert score_with - score_without == 25.0  # 100 * 0.25


class TestFindAvailableSlots:
    def test_empty_day_suggests_start(self):
        """Journee vide -> suggestion au debut de journee."""
        suggestions = find_available_slots(
            existing_appts=[],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={("start", "end"): GapDistances()},
            patient_sector_name="Nord",
            appointment_sectors={},
        )
        assert len(suggestions) == 1
        assert suggestions[0].rank == 1
        assert suggestions[0].start_time == datetime.time(7, 0)
        assert suggestions[0].end_time == datetime.time(7, 30)

    def test_insertion_between_close_appts(self):
        """Insertion entre 2 RDV proches (meme secteur) -> score eleve."""
        appt1 = _make_appt(8, 0, 30)
        appt2 = _make_appt(10, 0, 30)

        gap_dist = GapDistances(
            prev_to_new_km=2.0, prev_to_new_min=3.0,
            new_to_next_km=2.0, new_to_next_min=3.0,
            prev_to_next_km=3.0, prev_to_next_min=5.0,
        )

        suggestions = find_available_slots(
            existing_appts=[appt1, appt2],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={
                ("start", str(appt1.id)): GapDistances(),
                (str(appt1.id), str(appt2.id)): gap_dist,
                (str(appt2.id), "end"): GapDistances(),
            },
            patient_sector_name="Nord",
            appointment_sectors={
                str(appt1.id): "Nord",
                str(appt2.id): "Nord",
            },
        )
        assert len(suggestions) >= 1
        # Le slot entre les 2 RDV proches doit etre bien score
        between_slot = [s for s in suggestions if s.previous_appointment_id == appt1.id]
        assert len(between_slot) >= 1
        assert between_slot[0].same_sector is True
        assert between_slot[0].score > 50

    def test_insertion_between_far_appts(self):
        """Insertion entre 2 RDV eloignes -> detour important, score bas."""
        appt1 = _make_appt(8, 0, 30)
        appt2 = _make_appt(10, 0, 30)

        gap_dist = GapDistances(
            prev_to_new_km=15.0, prev_to_new_min=22.0,
            new_to_next_km=15.0, new_to_next_min=22.0,
            prev_to_next_km=3.0, prev_to_next_min=5.0,
        )

        suggestions = find_available_slots(
            existing_appts=[appt1, appt2],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={
                ("start", str(appt1.id)): GapDistances(),
                (str(appt1.id), str(appt2.id)): gap_dist,
                (str(appt2.id), "end"): GapDistances(),
            },
            patient_sector_name="",
            appointment_sectors={},
        )
        # Find the between-appts slot
        between = [s for s in suggestions if s.previous_appointment_id == appt1.id]
        if between:
            assert between[0].detour_km > 10

    def test_lunch_break_respected(self):
        """Aucune suggestion ne doit chevaucher la pause dejeuner."""
        appt1 = _make_appt(11, 0, 30)
        appt2 = _make_appt(13, 30, 30)

        suggestions = find_available_slots(
            existing_appts=[appt1, appt2],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={
                ("start", str(appt1.id)): GapDistances(),
                (str(appt1.id), str(appt2.id)): GapDistances(),
                (str(appt2.id), "end"): GapDistances(),
            },
            patient_sector_name="",
            appointment_sectors={},
        )
        for s in suggestions:
            start_min = s.start_time.hour * 60 + s.start_time.minute
            end_min = s.end_time.hour * 60 + s.end_time.minute
            # Ne doit pas chevaucher 12h-13h
            assert not (start_min < 13 * 60 and end_min > 12 * 60), (
                f"Slot {s.start_time}-{s.end_time} chevauche la pause dejeuner"
            )

    def test_same_sector_bonus(self):
        """Patient meme secteur -> bonus score."""
        appt1 = _make_appt(8, 0, 30)

        gap_dist = GapDistances(
            prev_to_new_km=2.0, prev_to_new_min=3.0,
        )

        suggestions_same = find_available_slots(
            existing_appts=[appt1],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={
                ("start", str(appt1.id)): GapDistances(),
                (str(appt1.id), "end"): gap_dist,
            },
            patient_sector_name="Nord",
            appointment_sectors={str(appt1.id): "Nord"},
        )

        suggestions_diff = find_available_slots(
            existing_appts=[appt1],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={
                ("start", str(appt1.id)): GapDistances(),
                (str(appt1.id), "end"): gap_dist,
            },
            patient_sector_name="Sud",
            appointment_sectors={str(appt1.id): "Nord"},
        )

        # Find the post-appt1 slots
        after_same = [s for s in suggestions_same if s.previous_appointment_id == appt1.id]
        after_diff = [s for s in suggestions_diff if s.previous_appointment_id == appt1.id]

        if after_same and after_diff:
            assert after_same[0].score > after_diff[0].score

    def test_zero_distance_gaps_still_suggest(self):
        """Gaps avec distances zero (patient sans coordonnees) -> suggestions valides."""
        appt1 = _make_appt(9, 0, 30)

        suggestions = find_available_slots(
            existing_appts=[appt1],
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances={
                ("start", str(appt1.id)): GapDistances(),  # all zeros
                (str(appt1.id), "end"): GapDistances(),  # all zeros
            },
            patient_sector_name="",
            appointment_sectors={},
        )
        # Should still produce suggestions (zero travel time = fits easily)
        assert len(suggestions) >= 1

    def test_full_day_no_suggestions(self):
        """Journee pleine -> liste vide."""
        # RDV toutes les 30 min de 7h a 19h (pas de gap)
        appts = []
        for h in range(7, 19):
            appts.append(_make_appt(h, 0, 60))

        gap_distances: dict[tuple[str, str], GapDistances] = {}
        # Gaps : start->first, between pairs, last->end
        gap_distances[("start", str(appts[0].id))] = GapDistances()
        for i in range(len(appts) - 1):
            gap_distances[(str(appts[i].id), str(appts[i+1].id))] = GapDistances()
        gap_distances[(str(appts[-1].id), "end")] = GapDistances()

        suggestions = find_available_slots(
            existing_appts=appts,
            duration=30,
            work_start=datetime.time(7, 0),
            work_end=datetime.time(19, 0),
            lunch_start=datetime.time(12, 0),
            lunch_duration=60,
            gap_distances=gap_distances,
            patient_sector_name="",
            appointment_sectors={},
        )
        assert len(suggestions) == 0
