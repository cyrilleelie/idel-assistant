"""Endpoint de préparation de journée.

Agrège pour chaque patient du jour :
- les transmissions récentes (48h)
- la synthèse IA si disponible
- les alertes (rougeur, chute, etc.)
"""

import datetime
import logging
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_current_user,
    get_patient_repository,
    get_transmission_repository,
)
from app.infrastructure.persistence.repositories.sqlalchemy_appointment_repo import (
    SQLAlchemyAppointmentRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_patient_repo import (
    SQLAlchemyPatientRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_transmission_repo import (
    SQLAlchemyTransmissionRepo,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/preparation", tags=["preparation"])


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TransmissionSummary(BaseModel):
    id: str
    idel_id: str
    transcription: str
    structured_data: dict
    status: str
    created_at: datetime.datetime


class PatientPreparation(BaseModel):
    patient_id: str
    patient_name: str
    is_ald: bool
    has_active_bsi: bool
    bsi_level: str | None
    appointment_time: str
    care_type: str
    recent_transmissions: list[TransmissionSummary]
    ai_synthesis: dict | None
    alerts: list[str]


class PreparationResponse(BaseModel):
    date: str
    patients: list[PatientPreparation]
    total_appointments: int


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

# Keywords that trigger alerts when found in transmissions
_ALERT_KEYWORDS = [
    "rougeur",
    "infection",
    "chute",
    "fièvre",
    "douleur",
    "saignement",
    "urgence",
    "hospitalisation",
    "décompensation",
    "malaise",
    "escarr",
    "nécrose",
    "hypoglycémie",
    "hyperglycémie",
    "dyspnée",
    "hypoglycemie",
    "hyperglycemie",
    "dyspnee",
]


@router.get("/{date}", response_model=PreparationResponse)
async def get_preparation(
    date: str,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    appt_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    tx_repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
):
    """Retourne la préparation de journée pour une date donnée.

    Pour chaque patient ayant un RDV ce jour:
    - Transmissions des 48 dernières heures
    - Dernière synthèse IA si disponible
    - Alertes extraites des transmissions récentes
    """
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    target_date = datetime.date.fromisoformat(date)

    # Get appointments for the day
    appointments, total = await appt_repo.list_by_date(
        auth.cabinet_id,
        idel_id=auth.user_id,
        date=target_date,
        skip=0,
        limit=100,
    )

    # Filter out canceled
    active_appts = [a for a in appointments if a.status != "canceled"]

    # Deduplicate by patient_id (keep first appointment)
    seen_patients: set[UUID] = set()
    unique_appts = []
    for a in active_appts:
        if a.patient_id not in seen_patients:
            seen_patients.add(a.patient_id)
            unique_appts.append(a)

    since_48h = datetime.datetime.now(datetime.UTC) - datetime.timedelta(hours=48)

    patients_prep: list[PatientPreparation] = []

    for appt in unique_appts:
        # Get patient info
        patient = await patient_repo.get_by_id(appt.patient_id)
        if not patient:
            continue

        patient_name = f"{patient.first_name} {patient.last_name}"

        # Get recent transmissions
        recent_txs = await tx_repo.list_by_patient_since(
            appt.patient_id, auth.cabinet_id, since_48h
        )

        tx_summaries = [
            TransmissionSummary(
                id=str(t.id),
                idel_id=str(t.idel_id),
                transcription=t.transcription,
                structured_data=t.structured_data,
                status=t.status,
                created_at=t.created_at,
            )
            for t in recent_txs
        ]

        # Find latest AI synthesis
        ai_synthesis = None
        for t in recent_txs:
            if t.structured_data and t.structured_data.get("synthese"):
                ai_synthesis = t.structured_data
                break

        # Extract alerts from recent transmissions
        alerts = _extract_alerts(recent_txs)

        patients_prep.append(
            PatientPreparation(
                patient_id=str(appt.patient_id),
                patient_name=patient_name,
                is_ald=patient.is_ald,
                has_active_bsi=patient.has_active_bsi,
                bsi_level=patient.bsi_level,
                appointment_time=appt.scheduled_at.astimezone(ZoneInfo("Europe/Paris")).strftime("%H:%M"),
                care_type=appt.care_type,
                recent_transmissions=tx_summaries,
                ai_synthesis=ai_synthesis,
                alerts=alerts,
            )
        )

    return PreparationResponse(
        date=date,
        patients=patients_prep,
        total_appointments=total,
    )


def _extract_alerts(transmissions) -> list[str]:
    """Extrait les alertes depuis les transmissions récentes."""
    alerts: list[str] = []
    seen: set[str] = set()

    for t in transmissions:
        text = (t.transcription or "").lower()
        structured = t.structured_data or {}

        # Check structured data actions/observations
        for field in ["actions", "observations", "synthese"]:
            text += " " + (structured.get(field, "") or "").lower()

        for keyword in _ALERT_KEYWORDS:
            if keyword in text and keyword not in seen:
                seen.add(keyword)
                alerts.append(keyword)

    return alerts
