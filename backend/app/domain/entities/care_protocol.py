import datetime
from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class CareProtocol:
    """
    Plan de soins d'un patient.

    Conteneur regroupant 1 à 5 ordonnances (Prescription) liées par care_protocol_id.
    Les détails de chaque soin (actes NGAP, fréquence, durée, document) sont portés
    par les Prescription associées, pas par le plan lui-même.
    """
    patient_id: UUID
    cabinet_id: UUID
    label: str = ""          # Nom libre du plan de soins
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    status: str = "active"   # active | paused | completed
    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
