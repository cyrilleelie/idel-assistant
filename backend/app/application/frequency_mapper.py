"""Mapping between frontend frequency_display values and iCalendar RRULE format.

Frontend uses simple labels:
  daily, 2xday, 3xday, weekly, 2xweek, 3xweek, custom

Backend stores full RRULE strings (RFC 5545).
"""

# frequency_display → RRULE
_DISPLAY_TO_RRULE: dict[str, str] = {
    "daily": "FREQ=DAILY;INTERVAL=1",
    "2xday": "FREQ=DAILY;INTERVAL=1;BYHOUR=8,18",
    "3xday": "FREQ=DAILY;INTERVAL=1;BYHOUR=8,13,18",
    "weekly": "FREQ=WEEKLY;INTERVAL=1",
    "2xweek": "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TH",
    "3xweek": "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR",
}

# RRULE prefix → frequency_display (reverse lookup)
_RRULE_TO_DISPLAY: dict[str, str] = {v: k for k, v in _DISPLAY_TO_RRULE.items()}


def frequency_display_to_rrule(display: str) -> str | None:
    """Convert a frontend frequency_display to an RRULE string.

    Returns None if the display value is 'custom' or unknown.
    """
    if display == "custom":
        return None
    return _DISPLAY_TO_RRULE.get(display)


def rrule_to_frequency_display(rrule: str) -> str:
    """Convert an RRULE string back to a frontend frequency_display.

    Returns 'custom' if the RRULE doesn't match any known pattern.
    """
    return _RRULE_TO_DISPLAY.get(rrule, "custom")
