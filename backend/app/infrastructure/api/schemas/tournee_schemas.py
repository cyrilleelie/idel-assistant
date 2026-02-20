"""Schemas Pydantic pour les tournees."""

import datetime

from pydantic import BaseModel


class TourneeStopResponse(BaseModel):
    stop_order: int
    appointment_id: str
    estimated_arrival: datetime.datetime | None = None
    distance_from_previous_km: float
    travel_time_from_previous_min: int


class MapStop(BaseModel):
    lat: float
    lon: float
    patient_name: str
    care_type: str
    time: str  # HH:MM
    sector_name: str
    sector_color: str


class MapData(BaseModel):
    stops: list[MapStop]
    center_lat: float
    center_lon: float


class TourneeMetrics(BaseModel):
    total_distance_km: float
    total_travel_minutes: float
    total_care_minutes: int
    longest_leg_km: float
    num_stops: int


class TourneeDetailResponse(BaseModel):
    tournee_id: str | None = None
    date: str
    status: str
    stops: list[TourneeStopResponse]
    metrics: TourneeMetrics
    inefficiencies: list[str]
    map_data: MapData | None = None
