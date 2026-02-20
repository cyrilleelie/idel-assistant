from dataclasses import dataclass


@dataclass(frozen=True)
class Address:
    """Adresse postale avec coordonnees GPS optionnelles."""

    street: str
    lat: float | None = None
    lon: float | None = None

    def __post_init__(self):
        if not self.street or not self.street.strip():
            raise ValueError("L'adresse ne peut pas etre vide")
        if (self.lat is not None) != (self.lon is not None):
            raise ValueError("lat et lon doivent etre fournis ensemble ou pas du tout")
        if self.lat is not None and not (-90 <= self.lat <= 90):
            raise ValueError(f"Latitude invalide: {self.lat}")
        if self.lon is not None and not (-180 <= self.lon <= 180):
            raise ValueError(f"Longitude invalide: {self.lon}")

    def has_coordinates(self) -> bool:
        return self.lat is not None and self.lon is not None
