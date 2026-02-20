import datetime
from dataclasses import dataclass

from dateutil.rrule import rrulestr


@dataclass(frozen=True)
class RecurrenceRule:
    """Regle de recurrence au format iCalendar RRULE."""

    rule: str

    def __post_init__(self):
        if not self.rule or not self.rule.strip():
            raise ValueError("La regle de recurrence ne peut pas etre vide")
        # Valide que la regle est parsable
        try:
            rrulestr(f"RRULE:{self.rule}", dtstart=datetime.datetime(2026, 1, 1))
        except (ValueError, TypeError) as e:
            raise ValueError(f"RRULE invalide: {self.rule} ({e})")

    def generate_occurrences(
        self, from_date: datetime.date, to_date: datetime.date
    ) -> list[datetime.date]:
        """Genere les dates d'occurrence entre from_date et to_date (inclus)."""
        dtstart = datetime.datetime.combine(from_date, datetime.time.min)
        until = datetime.datetime.combine(to_date, datetime.time.max)

        rule = rrulestr(f"RRULE:{self.rule}", dtstart=dtstart)

        dates: list[datetime.date] = []
        for dt in rule:
            if dt.date() > to_date:
                break
            if dt.date() >= from_date:
                dates.append(dt.date())
        return dates
