from dataclasses import dataclass


@dataclass(frozen=True)
class RPPSNumber:
    """Numero RPPS d'un professionnel de sante (11 chiffres)."""

    value: str

    def __post_init__(self):
        if not self.value.isdigit() or len(self.value) != 11:
            raise ValueError(
                f"Numero RPPS invalide: {self.value} (doit etre 11 chiffres)"
            )

    def __str__(self) -> str:
        return self.value
