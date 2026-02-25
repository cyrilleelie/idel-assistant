import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation


VALID_LETTRES_CLES = frozenset({
    "AMI", "AMX", "AIS", "BSI", "BSA", "BSB", "BSC",
    "IFD", "IFI", "IK",
    "MAU", "MCI", "MAJ", "MIE", "MIEJ",
    "TLS", "TLL", "TLD",
    "DI",
})

_CODE_PATTERN = re.compile(r"^([A-Z]+)(?:_(.+))?$")


@dataclass(frozen=True)
class ActCode:
    value: str

    def __post_init__(self):
        if not self.value or not self.value.strip():
            raise ValueError("Le code acte ne peut pas etre vide")

        match = _CODE_PATTERN.match(self.value)
        if not match:
            raise ValueError(
                f"Format de code acte invalide: {self.value} "
                f"(attendu: LETTRE_CLE ou LETTRE_CLE_COEFF)"
            )

        lk = match.group(1)
        if lk not in VALID_LETTRES_CLES:
            raise ValueError(
                f"Lettre-cle inconnue: {lk} dans le code {self.value}. "
                f"Valeurs acceptees: {sorted(VALID_LETTRES_CLES)}"
            )

    @property
    def lettre_cle(self) -> str:
        match = _CODE_PATTERN.match(self.value)
        return match.group(1) if match else ""

    @property
    def coefficient(self) -> Decimal | None:
        match = _CODE_PATTERN.match(self.value)
        if match and match.group(2):
            try:
                return Decimal(match.group(2))
            except InvalidOperation:
                return None
        return None

    def __str__(self) -> str:
        return self.value
