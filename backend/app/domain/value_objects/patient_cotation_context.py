from dataclasses import dataclass


@dataclass(frozen=True)
class PatientCotationContext:
    has_active_bsi: bool
    bsi_level: str | None          # "BSA", "BSB", "BSC" (si BSI actif)
    bsi_already_billed_today: bool
    is_ald: bool
    is_maternity: bool
    age: int                       # Pour la majoration MIE (< 7 ans)
    is_palliative: bool
