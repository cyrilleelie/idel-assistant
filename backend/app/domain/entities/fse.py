"""Entité Feuille de Soins Électronique (FSE) — préparation SESAM-Vitale."""

import datetime
from dataclasses import dataclass, field
from decimal import Decimal
from uuid import UUID, uuid4


@dataclass
class ActeFse:
    """Acte inclus dans une FSE."""

    code: str
    label: str
    coefficient: Decimal
    quantite: Decimal
    montant: Decimal
    supplements: dict = field(default_factory=dict)


@dataclass
class Fse:
    """Feuille de Soins Électronique."""

    cabinet_id: UUID
    # Identité patient
    nir_patient: str           # NIR 15 chiffres (= ssn du patient)
    date_soins: datetime.date
    rpps_idel: str             # RPPS de l'IDEL ayant effectué les soins
    montant_total: Decimal
    montant_amo: Decimal
    montant_amc: Decimal
    montant_patient: Decimal
    actes_fse: list[ActeFse] = field(default_factory=list)

    # Optionnels
    invoice_id: UUID | None = None
    fse_number: str = ""
    lot_number: str | None = None
    birth_rank: int | None = None
    adeli_idel: str | None = None
    rpps_prescripteur: str | None = None
    date_prescription: datetime.date | None = None
    organisme_amo: str | None = None          # Code caisse AMO (9 chiffres)
    organisme_amc: str | None = None          # Code AMC/mutuelle (10 chiffres)
    type_fse: str = "FSE"                     # FSE | FSP | SFSE
    nature_assurance: str | None = None       # MAL | MAT | AT | INV | VIE
    exoneration_code: str | None = None       # Ex: "ALD", "100%", etc.
    raw_fse_data: dict | None = None

    # Statut du cycle de vie
    status: str = "generated"                 # generated | exported | transmitted | rejected
    exported_at: datetime.datetime | None = None
    exported_format: str | None = None        # csv | xml | json
    transmitted_at: datetime.datetime | None = None
    arl_received_at: datetime.datetime | None = None
    rejection_reason: str | None = None

    id: UUID = field(default_factory=uuid4)
    created_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))
    updated_at: datetime.datetime = field(default_factory=lambda: datetime.datetime.now(datetime.UTC))

    # --- Méthodes métier ---

    def mark_exported(self, fmt: str) -> None:
        if self.status not in ("generated",):
            raise ValueError(f"Impossible d'exporter une FSE au statut '{self.status}'")
        self.status = "exported"
        self.exported_format = fmt
        self.exported_at = datetime.datetime.now(datetime.UTC)

    def mark_transmitted(self) -> None:
        if self.status not in ("generated", "exported"):
            raise ValueError(f"Impossible de transmettre une FSE au statut '{self.status}'")
        self.status = "transmitted"
        self.transmitted_at = datetime.datetime.now(datetime.UTC)

    def mark_rejected(self, reason: str) -> None:
        self.status = "rejected"
        self.rejection_reason = reason

    def mark_arl_received(self) -> None:
        self.arl_received_at = datetime.datetime.now(datetime.UTC)
