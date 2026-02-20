import datetime
from dataclasses import dataclass


@dataclass(frozen=True)
class TimeWindow:
    """Fenetre temporelle (debut, fin)."""

    start: datetime.time
    end: datetime.time

    def __post_init__(self):
        if self.start >= self.end:
            raise ValueError(
                f"Le debut ({self.start}) doit etre avant la fin ({self.end})"
            )

    def contains(self, t: datetime.time) -> bool:
        """Verifie si un horaire est dans la fenetre."""
        return self.start <= t <= self.end

    def overlaps(self, other: "TimeWindow") -> bool:
        """Verifie si deux fenetres se chevauchent."""
        return self.start < other.end and other.start < self.end

    def duration_minutes(self) -> int:
        """Duree de la fenetre en minutes."""
        start_min = self.start.hour * 60 + self.start.minute
        end_min = self.end.hour * 60 + self.end.minute
        return end_min - start_min
