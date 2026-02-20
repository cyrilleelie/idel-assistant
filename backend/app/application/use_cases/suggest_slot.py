"""Use case : suggestion de creneaux pour un nouveau RDV."""

import datetime
from uuid import UUID

from app.domain.entities.slot_suggestion import SlotSuggestion
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.repositories.sector_repository import SectorRepository
from app.domain.rules.slot_suggestion_rules import GapDistances, find_available_slots
from app.domain.services.routing_service import RoutingService


class SuggestSlotUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        patient_repo: PatientRepository,
        sector_repo: SectorRepository,
        routing_service: RoutingService,
    ):
        self._appointment_repo = appointment_repo
        self._patient_repo = patient_repo
        self._sector_repo = sector_repo
        self._routing = routing_service

    async def execute(
        self,
        cabinet_id: UUID,
        idel_id: UUID,
        patient_id: UUID,
        date: datetime.date,
        duration: int,
        work_start: datetime.time = datetime.time(7, 0),
        work_end: datetime.time = datetime.time(19, 0),
        lunch_start: datetime.time = datetime.time(12, 0),
        lunch_duration: int = 60,
    ) -> list[SlotSuggestion]:
        # 1. Fetch appointments du jour pour l'IDEL (non annules)
        appts, _ = await self._appointment_repo.list_by_date(
            cabinet_id=cabinet_id,
            idel_id=idel_id,
            date=date,
            limit=100,
        )
        active_appts = [a for a in appts if a.status not in ("canceled", "no_show")]
        sorted_appts = sorted(active_appts, key=lambda a: a.scheduled_at)

        # 2. Fetch le nouveau patient
        patient = await self._patient_repo.get_by_id(patient_id)
        if patient is None:
            return []
        new_loc = (patient.lat, patient.lon) if patient.lat and patient.lon else None

        # 3. Fetch sectors du cabinet
        sectors = await self._sector_repo.list_by_cabinet(cabinet_id)
        sector_map = {s.id: s.name for s in sectors}

        # 4. Determiner le secteur du patient
        patient_sector_name = ""
        if patient.sector_id and patient.sector_id in sector_map:
            patient_sector_name = sector_map[patient.sector_id]
        elif patient.postal_code:
            sector = await self._sector_repo.find_by_postal_code(cabinet_id, patient.postal_code)
            if sector:
                patient_sector_name = sector.name

        # 5. Charger les locations des patients des RDV existants
        patient_locations: dict[str, tuple[float, float]] = {}
        appointment_sectors: dict[str, str] = {}

        for appt in sorted_appts:
            p = await self._patient_repo.get_by_id(appt.patient_id)
            if p and p.lat and p.lon:
                patient_locations[str(appt.id)] = (p.lat, p.lon)
            if p and p.sector_id and p.sector_id in sector_map:
                appointment_sectors[str(appt.id)] = sector_map[p.sector_id]

        # 6. Pre-compute distances via RoutingService
        gap_distances: dict[tuple[str, str], GapDistances] = {}

        if not new_loc:
            # Sans coordonnees, on ne peut pas calculer les distances
            return []

        # Construire les gaps
        if not sorted_appts:
            # Journee vide
            gap_distances[("start", "end")] = GapDistances()
        else:
            # Gap avant le premier RDV
            first_id = str(sorted_appts[0].id)
            first_loc = patient_locations.get(first_id)
            gd = GapDistances()
            if first_loc:
                km, mins = await self._routing.get_distance(new_loc, first_loc)
                gd.new_to_next_km = km
                gd.new_to_next_min = mins
            gap_distances[("start", first_id)] = gd

            # Gaps entre paires consecutives
            for i in range(len(sorted_appts) - 1):
                prev = sorted_appts[i]
                nxt = sorted_appts[i + 1]
                prev_id = str(prev.id)
                nxt_id = str(nxt.id)
                prev_loc = patient_locations.get(prev_id)
                nxt_loc = patient_locations.get(nxt_id)

                gd = GapDistances()
                if prev_loc:
                    km, mins = await self._routing.get_distance(prev_loc, new_loc)
                    gd.prev_to_new_km = km
                    gd.prev_to_new_min = mins
                if nxt_loc:
                    km, mins = await self._routing.get_distance(new_loc, nxt_loc)
                    gd.new_to_next_km = km
                    gd.new_to_next_min = mins
                if prev_loc and nxt_loc:
                    km, mins = await self._routing.get_distance(prev_loc, nxt_loc)
                    gd.prev_to_next_km = km
                    gd.prev_to_next_min = mins

                gap_distances[(prev_id, nxt_id)] = gd

            # Gap apres le dernier RDV
            last_id = str(sorted_appts[-1].id)
            last_loc = patient_locations.get(last_id)
            gd = GapDistances()
            if last_loc:
                km, mins = await self._routing.get_distance(last_loc, new_loc)
                gd.prev_to_new_km = km
                gd.prev_to_new_min = mins
            gap_distances[(last_id, "end")] = gd

        # 7. Appel sync domain
        suggestions = find_available_slots(
            existing_appts=sorted_appts,
            duration=duration,
            work_start=work_start,
            work_end=work_end,
            lunch_start=lunch_start,
            lunch_duration=lunch_duration,
            gap_distances=gap_distances,
            patient_sector_name=patient_sector_name,
            appointment_sectors=appointment_sectors,
            preferred_time_slot=patient.preferred_time_slot or "",
        )

        return suggestions
