import math

from app.domain.services.routing_service import RoutingService


class FakeRoutingService(RoutingService):
    """Service de routage basé sur la distance haversine.

    Utilise la formule haversine x 1.4 pour approximer les distances routières
    et une vitesse moyenne de 40 km/h pour les durées.
    """

    ROAD_FACTOR = 1.4
    AVERAGE_SPEED_KMH = 40.0

    @staticmethod
    def _haversine_km(
        lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        """Distance haversine en km entre deux points GPS."""
        R = 6371.0  # rayon de la Terre en km
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def _road_distance_km(
        self, lat1: float, lon1: float, lat2: float, lon2: float
    ) -> float:
        return self._haversine_km(lat1, lon1, lat2, lon2) * self.ROAD_FACTOR

    def _duration_minutes(self, distance_km: float) -> float:
        if distance_km <= 0:
            return 0.0
        return (distance_km / self.AVERAGE_SPEED_KMH) * 60.0

    async def get_distance_matrix(
        self,
        locations: list[tuple[float, float]],
    ) -> list[list[float]]:
        """Retourne matrice de distances en metres."""
        n = len(locations)
        matrix: list[list[float]] = []
        for i in range(n):
            row: list[float] = []
            for j in range(n):
                if i == j:
                    row.append(0.0)
                else:
                    km = self._road_distance_km(
                        locations[i][0], locations[i][1],
                        locations[j][0], locations[j][1],
                    )
                    row.append(km * 1000.0)  # metres
            matrix.append(row)
        return matrix

    async def get_duration_matrix(
        self,
        locations: list[tuple[float, float]],
    ) -> list[list[float]]:
        """Retourne matrice de durees en secondes."""
        n = len(locations)
        matrix: list[list[float]] = []
        for i in range(n):
            row: list[float] = []
            for j in range(n):
                if i == j:
                    row.append(0.0)
                else:
                    km = self._road_distance_km(
                        locations[i][0], locations[i][1],
                        locations[j][0], locations[j][1],
                    )
                    row.append(self._duration_minutes(km) * 60.0)  # secondes
            matrix.append(row)
        return matrix

    async def get_distance(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> tuple[float, float]:
        """Retourne (distance_km, duration_minutes)."""
        km = self._road_distance_km(
            origin[0], origin[1],
            destination[0], destination[1],
        )
        minutes = self._duration_minutes(km)
        return round(km, 2), round(minutes, 1)
