"""Règles métier pour les ordonnances (prescriptions médicales)."""

import datetime
from datetime import timedelta

from app.domain.entities.prescription import Prescription


def compute_end_date(
    start_date: datetime.date,
    duration_days: int | None,
    end_date_explicit: datetime.date | None,
) -> datetime.date | None:
    """
    Calcule la date de fin d'une ordonnance.
    Priorité : end_date explicite > start_date + duration_days > None.
    Si duration_days est fourni, le jour de début compte (duration_days=15 → 15 jours incluant J1).
    """
    if end_date_explicit:
        return end_date_explicit
    if duration_days and duration_days > 0:
        return start_date + timedelta(days=duration_days - 1)
    return None


def compute_prescription_status(
    prescription: Prescription,
    reference_date: datetime.date | None = None,
) -> str:
    """
    Calcule le statut effectif d'une ordonnance à la date de référence.

    Appelé à la consultation (pas en batch). Ne modifie pas l'entité.
    Statuts stockés permanents : "canceled", "completed" — retournés tels quels.
    Statuts calculés depuis la date : "active", "expiring" (≤ 3j restants), "expired".
    """
    today = reference_date or datetime.date.today()

    if prescription.status in ("canceled", "completed"):
        return prescription.status

    if prescription.end_date is None:
        return "active"

    days_remaining = (prescription.end_date - today).days

    if days_remaining < 0:
        return "expired"
    elif days_remaining <= 3:
        return "expiring"
    else:
        return "active"


def days_remaining(
    prescription: Prescription,
    reference_date: datetime.date | None = None,
) -> int | None:
    """Retourne le nombre de jours restants, ou None si pas de date de fin."""
    if prescription.end_date is None:
        return None
    today = reference_date or datetime.date.today()
    return max(0, (prescription.end_date - today).days)


def can_bill_against_prescription(
    prescription: Prescription,
    care_date: datetime.date,
) -> tuple[bool, str | None]:
    """
    Vérifie si une facture peut être rattachée à cette ordonnance pour une date de soin.
    Retourne (True, None) si OK, (False, reason) sinon.
    """
    status = compute_prescription_status(prescription, care_date)

    if status == "canceled":
        return False, "Ordonnance annulée"
    if status == "expired":
        return False, f"Ordonnance expirée depuis le {prescription.end_date}"
    if status == "completed":
        return False, "Ordonnance déjà complétée"
    if prescription.start_date and care_date < prescription.start_date:
        return False, (
            f"Date de soin ({care_date}) antérieure au début de "
            f"l'ordonnance ({prescription.start_date})"
        )

    return True, None


def is_prescription_complete_for_billing(
    prescription: Prescription,
) -> tuple[bool, str | None]:
    """
    Vérifie qu'une ordonnance est complète pour pouvoir facturer.
    Retourne (True, None) si complète, (False, première raison) sinon.
    Utiliser get_prescription_missing_fields pour obtenir toutes les raisons.
    """
    missing = get_prescription_missing_fields(prescription)
    if missing:
        return False, missing[0]
    return True, None


def get_prescription_missing_fields(
    prescription: Prescription,
) -> list[str]:
    """
    Retourne la liste de tous les champs manquants ou invalides pour facturer.
    Retourne une liste vide si l'ordonnance est complète.
    Conditions : document scanné/photo + prescripteur + date de prescription + date de début.
    """
    issues: list[str] = []
    if not (prescription.document_filename or prescription.document_url):
        issues.append("Document d'ordonnance manquant (scan ou photo requis)")
    if not prescription.prescriber_name:
        issues.append("Nom du prescripteur manquant")
    if not prescription.prescription_date:
        issues.append("Date de prescription manquante")
    if not prescription.start_date:
        issues.append("Date de début des soins manquante")
    return issues
