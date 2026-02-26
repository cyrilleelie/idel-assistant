import re
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class InvoiceNumber:
    value: str

    def __post_init__(self) -> None:
        if not re.match(r"^\d{4}-\d{2}-\d{4,}$", self.value):
            raise ValueError(f"Format de numero de facture invalide : '{self.value}' (attendu: AAAA-MM-NNNN)")


def generate_next_invoice_number(
    cabinet_id: UUID,
    year: int,
    month: int,
    current_sequence: int,
) -> str:
    """Genere le prochain numero de facture.

    Format: "{ANNEE}-{MOIS:02d}-{SEQUENCE:04d}" -> "2026-02-0042"
    """
    return f"{year}-{month:02d}-{current_sequence:04d}"
