import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Prescription:
    cabinet_id: UUID
    patient_id: UUID

    # Lien vers le plan de soins (ordonnance issue d'un plan de soins)
    care_protocol_id: UUID | None = None

    # Libellé du soin (référentiel CareLabel)
    label: str = ""
    care_label_code: str | None = None  # code CareLabel → auto-fill NGAP + durée

    # Champs scheduling (repris des soins)
    duration_minutes: int = 30
    frequency_display: str = "daily"  # daily|2xday|3xday|weekly|2xweek|3xweek|custom
    custom_frequency: str = ""        # Texte libre si frequency_display == "custom"
    preferred_time: datetime.time | None = None
    preferred_slot: str = ""          # morning | afternoon | evening
    recurrence_rule: str = ""         # RRULE format RFC 5545

    # Prescripteur (optionnel — une ordonnance issue d'un plan de soins peut ne pas avoir de prescripteur)
    prescriber_name: str | None = None
    prescriber_rpps: str | None = None  # Numéro RPPS à 11 chiffres

    # Dates
    prescription_date: datetime.date | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    duration_days: int | None = None

    # Contenu médical
    care_description: str | None = None  # Description libre par le médecin
    act_codes: list[str] = field(default_factory=list)
    frequency: str | None = None         # Fréquence libre (texte médecin)

    # Renouvellement
    max_renewals: int = 0
    current_renewal: int = 0
    parent_prescription_id: UUID | None = None

    # Statut
    status: str = "active"  # active | expiring | expired | completed | canceled

    # Document joint (scan/photo de l'ordonnance)
    document_url: str | None = None       # URL (legacy / upload externe)
    document_filename: str | None = None  # Nom du fichier uploadé via le formulaire
    document_type: str | None = None      # photo | pdf | scan

    notes: str | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
    updated_at: datetime.datetime = field(
        default_factory=lambda: datetime.datetime.now(datetime.UTC)
    )
