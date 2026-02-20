"""Demo du moteur de suggestion de creneaux (Marais Poitevin).

Usage: cd backend && uv run python scripts/demo_suggestion.py
"""

import asyncio
import datetime
import sys
from pathlib import Path
from uuid import uuid4

# Ajouter le repertoire backend au path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.domain.entities.appointment import Appointment
from app.domain.entities.patient import Patient
from app.domain.entities.sector import Sector
from app.domain.rules.slot_suggestion_rules import GapDistances, find_available_slots
from app.infrastructure.services.fake_routing_service import FakeRoutingService

# --- Donnees de demo (Marais Poitevin, Damvix 85420) ---

CABINET_ID = uuid4()
IDEL_ID = uuid4()

# 3 secteurs
sector_damvix = Sector(
    cabinet_id=CABINET_ID,
    name="Damvix",
    postal_codes=["85420"],
    communes=["Damvix"],
    color="#10B981",
)
sector_nord = Sector(
    cabinet_id=CABINET_ID,
    name="Nord / Maille",
    postal_codes=["85420"],
    communes=["Maille", "Le Coudreau"],
    color="#3B82F6",
)
sector_sud = Sector(
    cabinet_id=CABINET_ID,
    name="Sud / Mazeau-Sigismond",
    postal_codes=["85420"],
    communes=["Le Mazeau", "Saint-Sigismond"],
    color="#EF4444",
)

SECTORS = [sector_damvix, sector_nord, sector_sud]
SECTOR_MAP = {s.id: s.name for s in SECTORS}

# 8 patients avec coordonnees GPS (sous-ensemble representatif)
patients = [
    Patient(cabinet_id=CABINET_ID, first_name="Lucienne", last_name="Moreau",
            lat=46.3145, lon=-0.7110, sector_id=sector_damvix.id,
            postal_code="85420", city="Damvix"),
    Patient(cabinet_id=CABINET_ID, first_name="Marcel", last_name="Gauthier",
            lat=46.3120, lon=-0.7155, sector_id=sector_damvix.id,
            postal_code="85420", city="Damvix"),
    Patient(cabinet_id=CABINET_ID, first_name="Yvette", last_name="Robin",
            lat=46.3160, lon=-0.7098, sector_id=sector_damvix.id,
            postal_code="85420", city="Damvix"),
    Patient(cabinet_id=CABINET_ID, first_name="Jeannine", last_name="Bouchet",
            lat=46.3310, lon=-0.7260, sector_id=sector_nord.id,
            postal_code="85420", city="Maille"),
    Patient(cabinet_id=CABINET_ID, first_name="Simone", last_name="Dupuis",
            lat=46.3325, lon=-0.7230, sector_id=sector_nord.id,
            postal_code="85420", city="Maille"),
    Patient(cabinet_id=CABINET_ID, first_name="Odette", last_name="Vrignaud",
            lat=46.3240, lon=-0.7380, sector_id=sector_nord.id,
            postal_code="85420", city="Le Coudreau"),
    Patient(cabinet_id=CABINET_ID, first_name="Henri", last_name="Bardin",
            lat=46.3130, lon=-0.7180, sector_id=sector_damvix.id,
            postal_code="85420", city="Damvix"),
    Patient(cabinet_id=CABINET_ID, first_name="Madeleine", last_name="Girard",
            lat=46.2980, lon=-0.7510, sector_id=sector_sud.id,
            postal_code="85420", city="Saint-Sigismond"),
]

# RDV planifies (7h30 - 15h30)
appointments = [
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[0].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 7, 30, tzinfo=datetime.UTC),
                duration_minutes=20, care_type="injection_insuline"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[1].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 8, 30, tzinfo=datetime.UTC),
                duration_minutes=30, care_type="pansement"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[2].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 9, 15, tzinfo=datetime.UTC),
                duration_minutes=30, care_type="soins_hygiene"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[3].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 10, 0, tzinfo=datetime.UTC),
                duration_minutes=20, care_type="injection_insuline"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[4].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 10, 30, tzinfo=datetime.UTC),
                duration_minutes=45, care_type="pansement"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[5].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 11, 30, tzinfo=datetime.UTC),
                duration_minutes=15, care_type="surveillance_tension"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[6].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 13, 30, tzinfo=datetime.UTC),
                duration_minutes=45, care_type="perfusion"),
    Appointment(cabinet_id=CABINET_ID, idel_id=IDEL_ID, patient_id=patients[7].id,
                scheduled_at=datetime.datetime(2026, 2, 20, 15, 30, tzinfo=datetime.UTC),
                duration_minutes=30, care_type="soins_hygiene"),
]

# Nouveau patient au Mazeau (secteur sud)
new_patient = Patient(
    cabinet_id=CABINET_ID,
    first_name="Francoise",
    last_name="Renaud",
    lat=46.3195,
    lon=-0.6840,
    sector_id=sector_sud.id,
    postal_code="85420",
    city="Le Mazeau",
    preferred_time_slot="morning",
)


async def main():
    routing = FakeRoutingService()

    # Map appointment_id -> patient
    appt_patient_map = {}
    for i, appt in enumerate(appointments):
        appt_patient_map[str(appt.id)] = patients[i]

    # Pre-compute distances pour chaque gap
    sorted_appts = sorted(appointments, key=lambda a: a.scheduled_at)
    new_loc = (new_patient.lat, new_patient.lon)

    appointment_sectors: dict[str, str] = {}
    for appt in sorted_appts:
        p = appt_patient_map[str(appt.id)]
        if p.sector_id and p.sector_id in SECTOR_MAP:
            appointment_sectors[str(appt.id)] = SECTOR_MAP[p.sector_id]

    gap_distances: dict[tuple[str, str], GapDistances] = {}

    # Gap avant le premier RDV
    first = sorted_appts[0]
    first_p = appt_patient_map[str(first.id)]
    gd = GapDistances()
    if first_p.lat and first_p.lon:
        km, mins = await routing.get_distance(new_loc, (first_p.lat, first_p.lon))
        gd.new_to_next_km = km
        gd.new_to_next_min = mins
    gap_distances[("start", str(first.id))] = gd

    # Gaps entre paires
    for i in range(len(sorted_appts) - 1):
        prev = sorted_appts[i]
        nxt = sorted_appts[i + 1]
        prev_p = appt_patient_map[str(prev.id)]
        nxt_p = appt_patient_map[str(nxt.id)]

        gd = GapDistances()
        if prev_p.lat and prev_p.lon:
            km, mins = await routing.get_distance((prev_p.lat, prev_p.lon), new_loc)
            gd.prev_to_new_km = km
            gd.prev_to_new_min = mins
        if nxt_p.lat and nxt_p.lon:
            km, mins = await routing.get_distance(new_loc, (nxt_p.lat, nxt_p.lon))
            gd.new_to_next_km = km
            gd.new_to_next_min = mins
        if prev_p.lat and prev_p.lon and nxt_p.lat and nxt_p.lon:
            km, mins = await routing.get_distance(
                (prev_p.lat, prev_p.lon), (nxt_p.lat, nxt_p.lon)
            )
            gd.prev_to_next_km = km
            gd.prev_to_next_min = mins
        gap_distances[(str(prev.id), str(nxt.id))] = gd

    # Gap apres le dernier RDV
    last = sorted_appts[-1]
    last_p = appt_patient_map[str(last.id)]
    gd = GapDistances()
    if last_p.lat and last_p.lon:
        km, mins = await routing.get_distance((last_p.lat, last_p.lon), new_loc)
        gd.prev_to_new_km = km
        gd.prev_to_new_min = mins
    gap_distances[(str(last.id), "end")] = gd

    # Appel moteur de suggestion
    suggestions = find_available_slots(
        existing_appts=sorted_appts,
        duration=30,
        work_start=datetime.time(7, 0),
        work_end=datetime.time(19, 0),
        lunch_start=datetime.time(12, 0),
        lunch_duration=60,
        gap_distances=gap_distances,
        patient_sector_name=SECTOR_MAP.get(new_patient.sector_id, ""),
        appointment_sectors=appointment_sectors,
        preferred_time_slot=new_patient.preferred_time_slot,
    )

    # Affichage
    print("=" * 60)
    print("DEMO - Moteur de suggestion de creneaux IDEL")
    print("Region : Marais Poitevin (Damvix, 85420)")
    print("=" * 60)
    print()
    print(f"Nouveau patient : {new_patient.first_name} {new_patient.last_name}")
    print(f"  Ville : {new_patient.city} ({new_patient.postal_code})")
    print(f"  Secteur : {SECTOR_MAP.get(new_patient.sector_id, 'inconnu')}")
    print(f"  Preference : {new_patient.preferred_time_slot}")
    print(f"  Duree soin : 30 min")
    print()
    print("RDV existants :")
    for appt in sorted_appts:
        p = appt_patient_map[str(appt.id)]
        sector = SECTOR_MAP.get(p.sector_id, "?")
        print(f"  {appt.scheduled_at.strftime('%H:%M')}-"
              f"{appt.end_at.strftime('%H:%M')} "
              f"{p.first_name} {p.last_name} ({p.city}, {sector}) - {appt.care_type}")
    print()
    print(f"{'='*60}")
    print(f"  {len(suggestions)} suggestion(s) trouvee(s)")
    print(f"{'='*60}")
    print()

    for s in suggestions:
        print(f"  #{s.rank} | {s.start_time.strftime('%H:%M')}-{s.end_time.strftime('%H:%M')}"
              f" | Score: {s.score}/100")
        print(f"       Detour: {s.detour_km} km ({s.detour_minutes} min)")
        print(f"       Meme secteur: {'oui' if s.same_sector else 'non'}")
        print(f"       {s.explanation}")
        print()

    # Generation carte Folium (optionnel)
    try:
        import folium

        m = folium.Map(location=[46.312, -0.720], zoom_start=13)

        # Patients existants
        sector_colors = {s.id: s.color for s in SECTORS}
        for i, appt in enumerate(sorted_appts):
            p = appt_patient_map[str(appt.id)]
            if p.lat and p.lon:
                color_hex = sector_colors.get(p.sector_id, "#888888")
                folium.CircleMarker(
                    location=[p.lat, p.lon],
                    radius=8,
                    popup=f"{p.first_name} {p.last_name}<br>"
                          f"{p.city}<br>"
                          f"{appt.scheduled_at.strftime('%H:%M')}<br>"
                          f"{appt.care_type}",
                    color=color_hex,
                    fill=True,
                    fill_color=color_hex,
                    fill_opacity=0.7,
                ).add_to(m)

        # Nouveau patient
        folium.Marker(
            location=[new_patient.lat, new_patient.lon],
            popup=f"NOUVEAU : {new_patient.first_name} {new_patient.last_name}<br>"
                  f"{new_patient.city}",
            icon=folium.Icon(color="red", icon="star"),
        ).add_to(m)

        # Suggestions en pointilles
        for s in suggestions:
            if s.previous_appointment_id:
                prev_p = appt_patient_map.get(str(s.previous_appointment_id))
                if prev_p and prev_p.lat and prev_p.lon:
                    folium.PolyLine(
                        locations=[
                            [prev_p.lat, prev_p.lon],
                            [new_patient.lat, new_patient.lon],
                        ],
                        color="#FF6B6B",
                        weight=2,
                        dash_array="5 10",
                        popup=f"Suggestion #{s.rank}: {s.start_time.strftime('%H:%M')}",
                    ).add_to(m)

        output_path = Path(__file__).parent / "demo_carte.html"
        m.save(str(output_path))
        print(f"Carte generee : {output_path}")

    except ImportError:
        print("(folium non installe - carte non generee)")
        print("  Installez avec : uv add --dev folium")


if __name__ == "__main__":
    asyncio.run(main())
