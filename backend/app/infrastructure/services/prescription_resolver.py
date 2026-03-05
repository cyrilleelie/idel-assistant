"""Resolves prescriptions linked to a transmission via its appointment."""

import logging
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.appointment_model import AppointmentModel
from app.infrastructure.persistence.models.prescription_model import PrescriptionModel

logger = logging.getLogger(__name__)


async def resolve_prescriptions_for_transmission(
    db: AsyncSession,
    appointment_id: UUID | None,
    patient_id: UUID,
    cabinet_id: UUID,
) -> list[UUID]:
    """Find active prescriptions matching the appointment's care type codes.

    Returns a deduplicated list of prescription IDs.
    """
    if not appointment_id:
        return []

    # Get the appointment
    result = await db.execute(
        select(AppointmentModel).where(AppointmentModel.id == appointment_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        logger.warning("Prescription resolver: appointment %s not found", appointment_id)
        return []

    # Extract care type code(s) from the appointment
    care_type_code = getattr(appointment, "care_type_code", None)
    if not care_type_code:
        return []

    care_codes = [care_type_code] if isinstance(care_type_code, str) else list(care_type_code)

    # For each care code, find matching active prescriptions
    found_ids: set[UUID] = set()
    appointment_date = getattr(appointment, "date", None) or getattr(appointment, "start_time", None)

    for code in care_codes:
        stmt = (
            select(PrescriptionModel.id)
            .where(
                PrescriptionModel.patient_id == patient_id,
                PrescriptionModel.cabinet_id == cabinet_id,
                PrescriptionModel.status == "active",
                PrescriptionModel.act_codes.any(code),
            )
            .order_by(PrescriptionModel.start_date.desc())
            .limit(1)
        )

        # Date range filter if appointment has a date
        if appointment_date:
            date_val = appointment_date.date() if hasattr(appointment_date, "date") else appointment_date
            stmt = stmt.where(
                (PrescriptionModel.start_date <= date_val) | (PrescriptionModel.start_date.is_(None))
            ).where(
                (PrescriptionModel.end_date >= date_val) | (PrescriptionModel.end_date.is_(None))
            )

        result = await db.execute(stmt)
        prescription_id = result.scalar_one_or_none()
        if prescription_id:
            found_ids.add(prescription_id)

    return list(found_ids)
