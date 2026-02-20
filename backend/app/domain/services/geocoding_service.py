from abc import ABC, abstractmethod

from app.domain.value_objects.address import Address


class GeocodingService(ABC):
    @abstractmethod
    async def geocode_address(self, street: str) -> Address:
        """Geocode une adresse et retourne un Address avec lat/lon."""
        ...
