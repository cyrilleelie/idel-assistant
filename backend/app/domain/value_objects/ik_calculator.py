from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class IKCalculator:
    """Calcul des indemnites kilometriques (IK) pour les IDEL."""

    distance_km: Decimal
    zone: str = "plaine"  # plaine | montagne

    ABATTEMENT_PLAINE: int = 4
    ABATTEMENT_MONTAGNE: int = 2
    TARIF_PLAINE: Decimal = Decimal("0.35")
    TARIF_MONTAGNE: Decimal = Decimal("0.50")
    PLAFOND_PLEIN_TARIF: int = 299

    def __post_init__(self):
        if self.zone not in ("plaine", "montagne"):
            raise ValueError(f"Zone invalide: {self.zone} (attendu: plaine ou montagne)")
        if self.distance_km < 0:
            raise ValueError("La distance ne peut pas etre negative")

    @property
    def _abattement(self) -> int:
        return self.ABATTEMENT_MONTAGNE if self.zone == "montagne" else self.ABATTEMENT_PLAINE

    @property
    def _tarif_km(self) -> Decimal:
        return self.TARIF_MONTAGNE if self.zone == "montagne" else self.TARIF_PLAINE

    @property
    def distance_facturable(self) -> Decimal:
        """Distance facturable = max(0, distance_km - abattement). Par trajet."""
        result = self.distance_km - Decimal(str(self._abattement))
        return max(Decimal("0"), result)

    @property
    def montant(self) -> Decimal:
        """Montant IK. Si cumul journalier > 299km, 50% au-dela."""
        dist = self.distance_facturable
        if dist <= self.PLAFOND_PLEIN_TARIF:
            return (dist * self._tarif_km).quantize(Decimal("0.01"))

        plein = Decimal(str(self.PLAFOND_PLEIN_TARIF)) * self._tarif_km
        surplus = (dist - Decimal(str(self.PLAFOND_PLEIN_TARIF))) * self._tarif_km * Decimal("0.5")
        return (plein + surplus).quantize(Decimal("0.01"))
