"""Jours feries francais — calcul pur Python sans dependance externe.

Algorithme de Butcher/Meeus pour le calcul de Paques.
"""

import datetime


def get_easter(year: int) -> datetime.date:
    """Calcule la date de Paques pour une annee donnee (algorithme de Butcher/Meeus)."""
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1
    return datetime.date(year, month, day)


def get_french_holidays(year: int) -> set[datetime.date]:
    """Retourne l'ensemble des jours feries francais pour une annee donnee."""
    easter = get_easter(year)

    holidays = {
        # Jours fixes
        datetime.date(year, 1, 1),    # Jour de l'An
        datetime.date(year, 5, 1),    # Fete du Travail
        datetime.date(year, 5, 8),    # Victoire 1945
        datetime.date(year, 7, 14),   # Fete nationale
        datetime.date(year, 8, 15),   # Assomption
        datetime.date(year, 11, 1),   # Toussaint
        datetime.date(year, 11, 11),  # Armistice
        datetime.date(year, 12, 25),  # Noel
        # Jours mobiles (bases sur Paques)
        easter + datetime.timedelta(days=1),   # Lundi de Paques
        easter + datetime.timedelta(days=39),  # Ascension
        easter + datetime.timedelta(days=50),  # Lundi de Pentecote
    }
    return holidays


def is_french_holiday(d: datetime.date) -> bool:
    """Verifie si une date est un jour ferie francais."""
    return d in get_french_holidays(d.year)


def is_sunday_or_holiday(d: datetime.date) -> bool:
    """Verifie si une date est un dimanche ou un jour ferie francais."""
    return d.weekday() == 6 or is_french_holiday(d)
