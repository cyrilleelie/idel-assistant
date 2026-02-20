"""Use case : construction de la tournee du jour."""

import datetime
from uuid import UUID

from app.domain.entities.tournee import Tournee, TourneeStop
from app.domain.repositories.appointment_repository import AppointmentRepository
from app.domain.repositories.patient_repository import PatientRepository
from app.domain.repositories.sector_repository import SectorRepository
from app.domain.repositories.tournee_repository import TourneeRepository
from app.domain.rules.tournee_rules import (
    build_daily_schedule,
    detect_scheduling_inefficiencies,
    estimate_daily_metrics,
)
from app.domain.services.routing_service import RoutingService


class BuildDailyTourneeUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        patient_repo: PatientRepository,
        sector_repo: SectorRepository,
        tournee_repo: TourneeRepository,
        routing_service: RoutingService,
    ):
        self._appointment_repo = appointment_repo
        self._patient_repo = patient_repo
        self._sector_repo = sector_repo
        self._tournee_repo = tournee_repo
        self._routing = routing_service

    async def execute(
        self,
        cabinet_id: UUID,
        idel_id: UUID,
        date: datetime.date,
        start_location: tuple[float, float] | None = None,
    ) -> dict:
        """Construit ou recupere la tournee du jour.

        Returns:
            dict avec tournee, stops, metrics, inefficiencies
        """
        # 1. Fetch appointments du jour
        appts, _ = await self._appointment_repo.list_by_date(
            cabinet_id=cabinet_id,
            idel_id=idel_id,
            date=date,
            limit=100,
        )
        active_appts = [a for a in appts if a.status not in ("canceled", "no_show")]

        if not active_appts:
            return {
                "tournee": None,
                "stops": [],
                "metrics": {
                    "total_distance_km": 0.0,
                    "total_travel_minutes": 0.0,
                    "total_care_minutes": 0,
                    "longest_leg_km": 0.0,
                },
                "inefficiencies": [],
            }

        sorted_appts = sorted(active_appts, key=lambda a: a.scheduled_at)

        # 2. Charger les patients et leurs locations
        patient_locations: dict[str, tuple[float, float]] = {}
        care_durations: dict[str, int] = {}
        patient_sectors: dict[str, str] = {}
        # Extra info for map display
        map_info: dict[str, dict] = {}

        sectors = await self._sector_repo.list_by_cabinet(cabinet_id)
        sector_map = {s.id: s.name for s in sectors}
        sector_color_map = {s.id: s.color for s in sectors}

        for appt in sorted_appts:
            p = await self._patient_repo.get_by_id(appt.patient_id)
            if p and p.lat and p.lon:
                patient_locations[str(appt.id)] = (p.lat, p.lon)
            if p and p.sector_id and p.sector_id in sector_map:
                patient_sectors[str(appt.id)] = sector_map[p.sector_id]
            care_durations[str(appt.id)] = appt.duration_minutes
            map_info[str(appt.id)] = {
                "lat": p.lat if p else None,
                "lon": p.lon if p else None,
                "patient_name": f"{p.last_name} {p.first_name}" if p else "Inconnu",
                "care_type": appt.care_type,
                "time": appt.scheduled_at.strftime("%H:%M"),
                "sector_name": sector_map.get(p.sector_id) if p and p.sector_id else "",
                "sector_color": sector_color_map.get(p.sector_id, "#3B82F6") if p and p.sector_id else "#3B82F6",
            }

        # 3. Pre-compute distances
        distances: dict[tuple[str, str], tuple[float, float]] = {}

        for i, appt in enumerate(sorted_appts):
            to_key = str(appt.id)
            if i == 0:
                from_key = "start"
                from_loc = start_location
            else:
                from_key = str(sorted_appts[i - 1].id)
                from_loc = patient_locations.get(from_key)

            to_loc = patient_locations.get(to_key)

            if from_loc and to_loc:
                km, mins = await self._routing.get_distance(from_loc, to_loc)
                distances[(from_key, to_key)] = (km, mins)
            else:
                distances[(from_key, to_key)] = (0.0, 0.0)

        # 4. Build schedule (sync domain)
        stops = build_daily_schedule(sorted_appts, distances, start_location)

        # 5. Compute metrics
        metrics = estimate_daily_metrics(stops, care_durations)

        # 6. Detect inefficiencies
        inefficiencies = detect_scheduling_inefficiencies(stops, patient_sectors)

        # 7. Save or update tournee
        existing_tournee = await self._tournee_repo.get_by_date(cabinet_id, idel_id, date)

        if existing_tournee:
            existing_tournee.total_distance_km = metrics["total_distance_km"]
            existing_tournee.total_duration_minutes = metrics["total_travel_minutes"] + metrics["total_care_minutes"]
            existing_tournee.travel_time_minutes = metrics["total_travel_minutes"]
            existing_tournee.num_stops = len(stops)
            tournee = await self._tournee_repo.update(existing_tournee)
        else:
            tournee = Tournee(
                cabinet_id=cabinet_id,
                idel_id=idel_id,
                tournee_date=date,
                start_location_lat=start_location[0] if start_location else None,
                start_location_lon=start_location[1] if start_location else None,
                total_distance_km=metrics["total_distance_km"],
                total_duration_minutes=metrics["total_travel_minutes"] + metrics["total_care_minutes"],
                travel_time_minutes=metrics["total_travel_minutes"],
                num_stops=len(stops),
            )
            # Set tournee_id on all stops
            for stop in stops:
                stop.tournee_id = tournee.id
            tournee = await self._tournee_repo.save_with_stops(tournee, stops)

        return {
            "tournee": tournee,
            "stops": stops,
            "metrics": metrics,
            "inefficiencies": inefficiencies,
            "map_info": map_info,
        }
