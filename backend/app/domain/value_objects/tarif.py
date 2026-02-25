from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class Tarif:
    base_rate: Decimal
    coefficient: Decimal
    quantity: Decimal = Decimal("1")

    @property
    def montant(self) -> Decimal:
        return (self.base_rate * self.coefficient * self.quantity).quantize(Decimal("0.01"))
