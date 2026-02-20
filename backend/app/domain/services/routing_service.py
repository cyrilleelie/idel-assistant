from abc import ABC, abstractmethod


class RoutingService(ABC):
    @abstractmethod
    async def get_distance_matrix(
        self,
        locations: list[tuple[float, float]],
    ) -> list[list[float]]:
        """Retourne matrice de distances en metres entre tous les points."""
        ...

    @abstractmethod
    async def get_duration_matrix(
        self,
        locations: list[tuple[float, float]],
    ) -> list[list[float]]:
        """Retourne matrice de durees en secondes entre tous les points."""
        ...

    @abstractmethod
    async def get_distance(
        self,
        origin: tuple[float, float],
        destination: tuple[float, float],
    ) -> tuple[float, float]:
        """Retourne (distance_km, duration_minutes) entre deux points."""
        ...
