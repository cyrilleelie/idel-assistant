"""Calcul de distance Haversine entre deux coordonnees GPS."""

import math
from decimal import Decimal

# Coefficient route : vol d'oiseau → distance réelle estimée (conservative)
_ROUTE_COEFFICIENT = 1.3
_EARTH_RADIUS_KM = 6371.0


def haversine_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    route_coefficient: float = _ROUTE_COEFFICIENT,
) -> Decimal:
    """
    Calcule la distance estimée en km entre deux points GPS.

    Méthode : Haversine (vol d'oiseau) × coefficient route (1.3 par défaut).
    La CPAM accepte la distance réelle par la route la plus courte.
    Le coefficient 1.3 est une estimation conservative pour le MVP.

    Returns:
        Distance arrondie à 2 décimales, en km.
        Retourne Decimal("0") si les coordonnées sont identiques.
    """
    if lat1 == lat2 and lon1 == lon2:
        return Decimal("0")

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    distance_vol_oiseau = _EARTH_RADIUS_KM * c
    distance_route = distance_vol_oiseau * route_coefficient
    return Decimal(str(round(distance_route, 2)))
