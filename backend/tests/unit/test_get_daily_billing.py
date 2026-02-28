"""Tests unitaires pour GetDailyBillingUseCase — notamment la gestion des factures annulées."""

import datetime
from decimal import Decimal
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.application.use_cases.billing.get_daily_billing import GetDailyBillingUseCase
from app.domain.entities.appointment import Appointment
from app.domain.entities.invoice import Invoice
from app.domain.entities.patient import Patient


def make_appointment(cabinet_id, patient_id, status="completed"):
    return Appointment(
        id=uuid4(),
        cabinet_id=cabinet_id,
        idel_id=uuid4(),
        patient_id=patient_id,
        scheduled_at=datetime.datetime(2026, 2, 28, 9, 0, tzinfo=datetime.timezone.utc),
        duration_minutes=30,
        care_type="pansement",
        status=status,
        act_codes=["AMI_1.5"],
        care_labels=["Pansement"],
    )


def make_invoice(cabinet_id, patient_id, appointment_id, status="draft"):
    return Invoice(
        id=uuid4(),
        cabinet_id=cabinet_id,
        idel_id=uuid4(),
        patient_id=patient_id,
        appointment_id=appointment_id,
        invoice_number="F2026-001",
        invoice_date=datetime.date(2026, 2, 28),
        care_date=datetime.date(2026, 2, 28),
        total_amo=Decimal("14.40"),
        total_amc=Decimal("9.60"),
        total_patient=Decimal("0"),
        total_amount=Decimal("24.00"),
        tiers_payant_type="total",
        status=status,
        lines=[],
    )


def make_patient(cabinet_id):
    return Patient(
        id=uuid4(),
        cabinet_id=cabinet_id,
        first_name="Marie",
        last_name="Dupont",
    )


def make_use_case(appointments, invoices, patients):
    appt_repo = AsyncMock()
    appt_repo.list_by_date = AsyncMock(return_value=(appointments, len(appointments)))

    invoice_repo = AsyncMock()
    invoice_repo.list_invoices = AsyncMock(return_value=(invoices, len(invoices)))

    patient_repo = AsyncMock()
    patient_map = {p.id: p for p in patients}
    patient_repo.get_by_id = AsyncMock(side_effect=lambda pid: patient_map.get(pid))

    return GetDailyBillingUseCase(
        appointment_repo=appt_repo,
        invoice_repo=invoice_repo,
        patient_repo=patient_repo,
        db_session=None,
    )


class TestGetDailyBilling:
    @pytest.mark.asyncio
    async def test_rdv_sans_facture_est_non_facture(self):
        cabinet_id = uuid4()
        patient = make_patient(cabinet_id)
        appt = make_appointment(cabinet_id, patient.id)

        uc = make_use_case([appt], [], [patient])
        result = await uc.execute(cabinet_id, datetime.date(2026, 2, 28))

        assert len(result.items) == 1
        assert result.items[0].invoice_id is None
        assert result.total_non_facture == 1
        assert result.total_facture == 0

    @pytest.mark.asyncio
    async def test_rdv_avec_facture_draft_est_facture(self):
        cabinet_id = uuid4()
        patient = make_patient(cabinet_id)
        appt = make_appointment(cabinet_id, patient.id)
        inv = make_invoice(cabinet_id, patient.id, appt.id, status="draft")

        uc = make_use_case([appt], [inv], [patient])
        result = await uc.execute(cabinet_id, datetime.date(2026, 2, 28))

        assert result.items[0].invoice_id == inv.id
        assert result.items[0].invoice_status == "draft"
        assert result.total_facture == 1
        assert result.total_non_facture == 0

    @pytest.mark.asyncio
    async def test_rdv_avec_facture_annulee_redevient_facturable(self):
        """
        Si la seule facture liée à un RDV est annulée,
        le RDV doit apparaître comme non facturé (invoice_id = None).
        """
        cabinet_id = uuid4()
        patient = make_patient(cabinet_id)
        appt = make_appointment(cabinet_id, patient.id)
        canceled_inv = make_invoice(cabinet_id, patient.id, appt.id, status="canceled")

        uc = make_use_case([appt], [canceled_inv], [patient])
        result = await uc.execute(cabinet_id, datetime.date(2026, 2, 28))

        item = result.items[0]
        assert item.invoice_id is None, "Le RDV doit être à nouveau facturable après annulation de la facture"
        assert item.invoice_status is None
        assert result.total_non_facture == 1
        assert result.total_facture == 0

    @pytest.mark.asyncio
    async def test_rdv_avec_facture_annulee_puis_nouvelle_draft(self):
        """
        Si une facture annulée et une nouvelle facture draft existent pour le même RDV,
        c'est la facture draft qui doit apparaître (pas la annulée).
        """
        cabinet_id = uuid4()
        patient = make_patient(cabinet_id)
        appt = make_appointment(cabinet_id, patient.id)
        canceled_inv = make_invoice(cabinet_id, patient.id, appt.id, status="canceled")
        new_draft_inv = make_invoice(cabinet_id, patient.id, appt.id, status="draft")

        uc = make_use_case([appt], [canceled_inv, new_draft_inv], [patient])
        result = await uc.execute(cabinet_id, datetime.date(2026, 2, 28))

        item = result.items[0]
        assert item.invoice_id == new_draft_inv.id
        assert item.invoice_status == "draft"
        assert result.total_facture == 1

    @pytest.mark.asyncio
    async def test_rdv_annule_est_exclu(self):
        """Les RDVs annulés ou absents ne doivent pas apparaître dans le résultat."""
        cabinet_id = uuid4()
        patient = make_patient(cabinet_id)
        appt_canceled = make_appointment(cabinet_id, patient.id, status="canceled")

        uc = make_use_case([appt_canceled], [], [patient])
        result = await uc.execute(cabinet_id, datetime.date(2026, 2, 28))

        assert len(result.items) == 0
