"""Routes de synchronisation mobile ↔ backend.

Pull: le mobile demande tous les changements depuis last_synced_at.
Push: le mobile envoie les créations/modifications locales.

Format compatible WatermelonDB synchronize() API.
"""

import datetime
import logging
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.infrastructure.api.dependencies import (
    AuthContext,
    get_appointment_repository,
    get_current_user,
    get_invoice_repository,
    get_key_manager,
    get_patient_repository,
    get_prescription_repository,
    get_transmission_repository,
)
from app.infrastructure.persistence.repositories.sqlalchemy_appointment_repo import (
    SQLAlchemyAppointmentRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_invoice_repo import (
    SQLAlchemyInvoiceRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_patient_repo import (
    SQLAlchemyPatientRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_prescription_repo import (
    SQLAlchemyPrescriptionRepo,
)
from app.infrastructure.persistence.repositories.sqlalchemy_transmission_repo import (
    SQLAlchemyTransmissionRepo,
)
from app.infrastructure.security.key_manager import KeyManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])


# ---------------------------------------------------------------------------
# Pull schemas
# ---------------------------------------------------------------------------


class SyncPullResponse(BaseModel):
    changes: dict
    timestamp: int


# ---------------------------------------------------------------------------
# Push schemas
# ---------------------------------------------------------------------------


class SyncPushRequest(BaseModel):
    changes: dict
    last_pulled_at: int | None = None


class SyncPushResponse(BaseModel):
    ok: bool
    errors: list[str] = []


# ---------------------------------------------------------------------------
# Pull endpoint
# ---------------------------------------------------------------------------


@router.get("/pull", response_model=SyncPullResponse)
async def sync_pull(
    request: Request,
    last_synced_at: int = 0,
    auth: AuthContext = Depends(get_current_user),
    patient_repo: SQLAlchemyPatientRepo = Depends(get_patient_repository),
    appt_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
    prescription_repo: SQLAlchemyPrescriptionRepo = Depends(get_prescription_repository),
    tx_repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    invoice_repo: SQLAlchemyInvoiceRepo = Depends(get_invoice_repository),
    km: KeyManager = Depends(get_key_manager),
):
    """Pull changes depuis le backend pour WatermelonDB.

    Retourne toutes les entités mises à jour depuis last_synced_at
    au format WatermelonDB sync compatible.
    """
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    # Convert ms timestamp to datetime
    if last_synced_at > 0:
        since = datetime.datetime.fromtimestamp(last_synced_at / 1000, tz=datetime.UTC)
    else:
        since = datetime.datetime(2000, 1, 1, tzinfo=datetime.UTC)

    now_ts = int(datetime.datetime.now(datetime.UTC).timestamp() * 1000)

    changes: dict = {}

    # Patients — decrypt and format for mobile
    try:
        patients_updated, _total = await patient_repo.list_by_cabinet(
            auth.cabinet_id, skip=0, limit=1000
        )
        # Filter by updated_at >= since
        patients_since = [p for p in patients_updated if p.updated_at and p.updated_at >= since]

        if patients_since:
            changes["patients"] = {
                "created": [],
                "updated": [_patient_to_sync(p) for p in patients_since],
                "deleted": [],
            }
    except Exception:
        logger.exception("Sync pull: erreur patients")

    # Appointments — fetch ±30 days around today
    try:
        today = datetime.date.today()
        date_from = today - datetime.timedelta(days=30)
        date_to = today + datetime.timedelta(days=30)

        appts, _total = await appt_repo.list_by_date(
            auth.cabinet_id,
            idel_id=auth.user_id,
            date_from=date_from,
            date_to=date_to,
            skip=0,
            limit=1000,
        )
        appts_since = [a for a in appts if a.updated_at and a.updated_at >= since]

        if appts_since:
            # Bulk-fetch prescriptions for all care protocols referenced
            # by the appointments so we can include label + description.
            protocol_ids = {
                a.care_protocol_id for a in appts_since if a.care_protocol_id
            }
            prescriptions_by_protocol: dict[str, list[dict]] = {}
            for pid in protocol_ids:
                try:
                    rxs = await prescription_repo.list_by_care_protocol(pid)
                    prescriptions_by_protocol[str(pid)] = [
                        {
                            "label": rx.label or "",
                            "description": rx.care_description or "",
                        }
                        for rx in rxs
                    ]
                except Exception:
                    pass

            # Always use "updated" bucket — the mobile uses
            # sendCreatedAsUpdated:true which handles missing records
            # by creating them. This avoids "already exists" errors
            # when the client does a full re-pull.
            changes["appointments"] = {
                "created": [],
                "updated": [
                    _appointment_to_sync(a, prescriptions_by_protocol)
                    for a in appts_since
                ],
                "deleted": [],
            }
    except Exception:
        logger.exception("Sync pull: erreur appointments")

    # Transmissions
    try:
        txs = await tx_repo.list_updated_since(auth.cabinet_id, since)
        if txs:
            changes["transmissions"] = {
                "created": [],
                "updated": [
                    _transmission_to_sync(t, auth.user_id) for t in txs
                ],
                "deleted": [],
            }
    except Exception:
        logger.exception("Sync pull: erreur transmissions")

    # Invoices
    try:
        invoices, _total = await invoice_repo.list_invoices(
            auth.cabinet_id, offset=0, limit=1000,
        )
        invoices_since = [i for i in invoices if i.updated_at and i.updated_at >= since]

        if invoices_since:
            changes["invoices"] = {
                "created": [],
                "updated": [_invoice_to_sync(i) for i in invoices_since],
                "deleted": [],
            }
    except Exception:
        logger.exception("Sync pull: erreur invoices")

    return SyncPullResponse(changes=changes, timestamp=now_ts)


# ---------------------------------------------------------------------------
# Push endpoint
# ---------------------------------------------------------------------------


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    body: SyncPushRequest,
    request: Request,
    auth: AuthContext = Depends(get_current_user),
    tx_repo: SQLAlchemyTransmissionRepo = Depends(get_transmission_repository),
    appt_repo: SQLAlchemyAppointmentRepo = Depends(get_appointment_repository),
):
    """Push changes du mobile vers le backend.

    Traite les créations et mises à jour de transmissions et appointments.
    Les conflits sont résolus par last-write-wins.
    """
    request.state.user_id = auth.user_id
    request.state.cabinet_id = auth.cabinet_id

    errors: list[str] = []

    # Process transmissions
    tx_changes = body.changes.get("transmissions", {})
    for tx_data in tx_changes.get("created", []):
        try:
            await _push_create_transmission(tx_data, auth, tx_repo)
        except Exception as e:
            errors.append(f"transmission create: {e}")
            logger.exception("Push transmission create failed")

    for tx_data in tx_changes.get("updated", []):
        try:
            await _push_update_transmission(tx_data, auth, tx_repo)
        except Exception as e:
            errors.append(f"transmission update: {e}")
            logger.exception("Push transmission update failed")

    # Process appointments (status changes only: completed, canceled)
    appt_changes = body.changes.get("appointments", {})
    for appt_data in appt_changes.get("updated", []):
        try:
            await _push_update_appointment(appt_data, auth, appt_repo)
        except Exception as e:
            errors.append(f"appointment update: {e}")
            logger.exception("Push appointment update failed")

    return SyncPushResponse(ok=len(errors) == 0, errors=errors)


# ---------------------------------------------------------------------------
# Push helpers
# ---------------------------------------------------------------------------


async def _push_create_transmission(
    data: dict,
    auth: AuthContext,
    repo: SQLAlchemyTransmissionRepo,
) -> None:
    from app.domain.entities.transmission import Transmission

    t = Transmission(
        cabinet_id=auth.cabinet_id,
        idel_id=auth.user_id,
        patient_id=UUID(data["patient_id"]) if data.get("patient_id") else auth.user_id,
        type="written",
        status=data.get("status", "draft"),
        transcription=data.get("content_text", ""),
        structured_data=_parse_json_or_empty(data.get("content_structured")),
    )
    await repo.create(t)


async def _push_update_transmission(
    data: dict,
    auth: AuthContext,
    repo: SQLAlchemyTransmissionRepo,
) -> None:
    server_id = data.get("server_id") or data.get("id")
    if not server_id:
        return

    try:
        t = await repo.get_by_id(UUID(server_id))
    except (ValueError, TypeError):
        return

    if not t or t.cabinet_id != auth.cabinet_id:
        return

    if "content_text" in data and data["content_text"]:
        t.transcription = data["content_text"]
    if "content_structured" in data and data["content_structured"]:
        t.structured_data = _parse_json_or_empty(data["content_structured"])
    if "status" in data:
        t.status = data["status"]

    await repo.update(t)


async def _push_update_appointment(
    data: dict,
    auth: AuthContext,
    repo: SQLAlchemyAppointmentRepo,
) -> None:
    server_id = data.get("server_id") or data.get("id")
    if not server_id:
        return

    try:
        appt = await repo.get_by_id(UUID(server_id))
    except (ValueError, TypeError):
        return

    if not appt or appt.cabinet_id != auth.cabinet_id:
        return

    if "status" in data and data["status"] in ("completed", "canceled"):
        appt.status = data["status"]
        await repo.update(appt)


# ---------------------------------------------------------------------------
# Sync data formatters
# ---------------------------------------------------------------------------


def _patient_to_sync(p) -> dict:
    return {
        "id": str(p.id),
        "server_id": str(p.id),
        "first_name": p.first_name,
        "last_name": p.last_name,
        "phone": p.phone or None,
        "email": p.email or None,
        "address": p.address or "",
        "lat": float(p.lat) if p.lat else None,
        "lon": float(p.lon) if p.lon else None,
        "birth_date": p.birth_date.isoformat() if p.birth_date else None,
        "status": p.status,
        "is_ald": p.is_ald,
        "has_active_bsi": p.has_active_bsi,
        "bsi_level": p.bsi_level or None,
        "bsi_end_date": p.bsi_end_date.isoformat() if p.bsi_end_date else None,
        "notes": p.notes or None,
    }


def _appointment_to_sync(
    a, prescriptions_by_protocol: dict[str, list[dict]] | None = None
) -> dict:
    import json as _json

    # Convert UTC → Europe/Paris so the mobile displays correct local times
    paris_tz = ZoneInfo("Europe/Paris")
    local_start = a.scheduled_at.astimezone(paris_tz)
    local_end = local_start + datetime.timedelta(minutes=a.duration_minutes)

    # Build care_details JSON from prescriptions if available
    care_details: str | None = None
    if prescriptions_by_protocol and a.care_protocol_id:
        rxs = prescriptions_by_protocol.get(str(a.care_protocol_id))
        if rxs:
            care_details = _json.dumps(rxs, ensure_ascii=False)

    return {
        "id": str(a.id),
        "server_id": str(a.id),
        "patient_id": str(a.patient_id),
        "user_id": str(a.idel_id),
        "date": local_start.strftime("%Y-%m-%d"),
        "start_time": local_start.strftime("%H:%M"),
        "end_time": local_end.strftime("%H:%M"),
        "care_type_code": a.care_type,
        "care_type_label": ", ".join(a.care_labels) if a.care_labels else a.care_type,
        "care_details": care_details,
        "status": a.status,
        "location_type": a.location_type or "home",
        "notes": a.cancellation_reason or None,
        "sort_order": local_start.hour * 60 + local_start.minute,
        "completed_at": int(a.updated_at.timestamp() * 1000) if a.status == "completed" else None,
    }


def _transmission_to_sync(t, current_user_id: UUID) -> dict:
    import json

    return {
        "id": str(t.id),
        "server_id": str(t.id),
        "patient_id": str(t.patient_id),
        "appointment_id": str(t.appointment_id) if t.appointment_id else None,
        "author_user_id": str(t.idel_id),
        "author_name": "",  # Resolved client-side from user cache
        "content_text": t.transcription or None,
        "content_structured": json.dumps(t.structured_data) if t.structured_data else None,
        "audio_file_path": None,  # Audio stays server-side
        "status": t.status,
        "audio_uploaded": bool(t.audio_file_path),
        "created_at": int(t.created_at.timestamp() * 1000),
    }


def _invoice_to_sync(inv) -> dict:
    return {
        "id": str(inv.id),
        "server_id": str(inv.id),
        "appointment_id": str(inv.appointment_id) if inv.appointment_id else None,
        "patient_id": str(inv.patient_id),
        "invoice_number": inv.invoice_number or "",
        "total_amount": float(inv.total_amount),
        "amount_amo": float(inv.total_amo),
        "amount_amc": float(inv.total_amc),
        "amount_patient": float(inv.total_patient),
        "status": inv.status,
        "pdf_local_path": None,
        "vitale_status": "pending",
        "created_at": int(inv.created_at.timestamp() * 1000) if inv.created_at else 0,
    }


def _parse_json_or_empty(value: str | None) -> dict:
    """Parse JSON string or return empty dict."""
    if not value:
        return {}
    try:
        import json

        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return {}
