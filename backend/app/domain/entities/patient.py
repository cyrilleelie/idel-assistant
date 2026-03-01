import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Patient:
    cabinet_id: UUID
    first_name: str
    last_name: str
    birth_date: datetime.date | None = None
    phone: str = ""
    email: str = ""
    address: str = ""
    lat: float | None = None
    lon: float | None = None
    sector_id: UUID | None = None
    postal_code: str = ""
    city: str = ""
    pathologies: list[str] = field(default_factory=list)
    preferred_time_slot: str = ""  # morning | afternoon | evening
    care_duration_default: int = 30
    ssn: str = ""               # N° Securite Sociale
    doctor_name: str = ""       # Medecin traitant
    doctor_rpps: str = ""       # Numéro RPPS du médecin traitant (11 chiffres)
    doctor_contact: str = ""    # Contact medecin
    notes: str = ""
    # SESAM-Vitale / assurance complémentaire
    birth_rank: int | None = None           # Rang de naissance (jumeaux etc.)
    insured_nir: str = ""                   # NIR de l'assuré (si différent du patient)
    amo_code: str = ""                      # Code organisme AMO (9 chiffres)
    amo_center: str = ""                    # Centre gestionnaire AMO
    amc_code: str = ""                      # Code organisme AMC (mutuelle)
    amc_name: str = ""                      # Nom de la mutuelle
    amc_contract: str = ""                  # Numéro de contrat AMC
    exoneration_type: str = ""              # Type d'exonération: "ALD", "MAT", "AT", ""
    is_ald: bool = False
    is_maternity: bool = False
    has_active_bsi: bool = False
    bsi_level: str | None = None
    bsi_start_date: datetime.date | None = None
    bsi_end_date: datetime.date | None = None
    status: str = "active"  # active | archived
    archived_reason: str = ""
    archived_at: datetime.datetime | None = None
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
