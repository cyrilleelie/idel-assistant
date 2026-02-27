"""Tests unitaires pour les règles métier des ordonnances."""

import datetime
from uuid import uuid4

import pytest

from app.domain.entities.prescription import Prescription
from app.domain.rules.prescription_rules import (
    can_bill_against_prescription,
    compute_end_date,
    compute_prescription_status,
    days_remaining,
)


def make_prescription(**kwargs) -> Prescription:
    defaults = dict(
        id=uuid4(),
        cabinet_id=uuid4(),
        patient_id=uuid4(),
        prescriber_name="Dr. Dupont",
        prescription_date=datetime.date(2026, 2, 1),
        start_date=datetime.date(2026, 2, 10),
        end_date=None,
        care_description="Pansements quotidiens",
        status="active",
    )
    defaults.update(kwargs)
    return Prescription(**defaults)


# --- compute_end_date ---

class TestComputeEndDate:
    def test_explicit_end_date_has_priority(self):
        result = compute_end_date(
            start_date=datetime.date(2026, 2, 1),
            duration_days=10,
            end_date_explicit=datetime.date(2026, 3, 15),
        )
        assert result == datetime.date(2026, 3, 15)

    def test_duration_days_without_explicit(self):
        # 15 jours à partir du 1er = du 1er au 15 (le 1er compte)
        result = compute_end_date(
            start_date=datetime.date(2026, 2, 1),
            duration_days=15,
            end_date_explicit=None,
        )
        assert result == datetime.date(2026, 2, 15)

    def test_one_day_duration(self):
        result = compute_end_date(
            start_date=datetime.date(2026, 2, 1),
            duration_days=1,
            end_date_explicit=None,
        )
        assert result == datetime.date(2026, 2, 1)

    def test_none_when_no_info(self):
        result = compute_end_date(
            start_date=datetime.date(2026, 2, 1),
            duration_days=None,
            end_date_explicit=None,
        )
        assert result is None

    def test_zero_duration_returns_none(self):
        result = compute_end_date(
            start_date=datetime.date(2026, 2, 1),
            duration_days=0,
            end_date_explicit=None,
        )
        assert result is None


# --- compute_prescription_status ---

class TestComputePrescriptionStatus:
    def test_canceled_always_canceled(self):
        p = make_prescription(status="canceled", end_date=datetime.date(2026, 1, 1))
        assert compute_prescription_status(p, datetime.date(2026, 3, 1)) == "canceled"

    def test_completed_always_completed(self):
        p = make_prescription(status="completed", end_date=datetime.date(2026, 1, 1))
        assert compute_prescription_status(p, datetime.date(2026, 3, 1)) == "completed"

    def test_active_no_end_date(self):
        p = make_prescription(status="active", end_date=None)
        assert compute_prescription_status(p, datetime.date(2026, 3, 1)) == "active"

    def test_active_date_far(self):
        p = make_prescription(status="active", end_date=datetime.date(2026, 12, 31))
        assert compute_prescription_status(p, datetime.date(2026, 2, 27)) == "active"

    def test_expiring_3_days(self):
        ref = datetime.date(2026, 2, 27)
        end = datetime.date(2026, 3, 2)  # 3 jours restants
        p = make_prescription(status="active", end_date=end)
        assert compute_prescription_status(p, ref) == "expiring"

    def test_expiring_0_days(self):
        today = datetime.date(2026, 2, 27)
        p = make_prescription(status="active", end_date=today)
        assert compute_prescription_status(p, today) == "expiring"

    def test_expired_yesterday(self):
        ref = datetime.date(2026, 2, 27)
        p = make_prescription(status="active", end_date=datetime.date(2026, 2, 26))
        assert compute_prescription_status(p, ref) == "expired"

    def test_expiring_boundary_4_days(self):
        ref = datetime.date(2026, 2, 27)
        end = datetime.date(2026, 3, 3)  # 4 jours restants → actif
        p = make_prescription(status="active", end_date=end)
        assert compute_prescription_status(p, ref) == "active"


# --- days_remaining ---

class TestDaysRemaining:
    def test_no_end_date_returns_none(self):
        p = make_prescription(end_date=None)
        assert days_remaining(p, datetime.date(2026, 2, 27)) is None

    def test_days_in_future(self):
        p = make_prescription(end_date=datetime.date(2026, 3, 10))
        result = days_remaining(p, datetime.date(2026, 2, 27))
        assert result == 11

    def test_expired_returns_zero(self):
        p = make_prescription(end_date=datetime.date(2026, 2, 20))
        result = days_remaining(p, datetime.date(2026, 2, 27))
        assert result == 0


# --- can_bill_against_prescription ---

class TestCanBillAgainstPrescription:
    def test_active_ok(self):
        p = make_prescription(
            status="active",
            start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 4, 30),
        )
        ok, reason = can_bill_against_prescription(p, datetime.date(2026, 2, 27))
        assert ok is True
        assert reason is None

    def test_canceled_ko(self):
        p = make_prescription(
            status="canceled",
            start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 4, 30),
        )
        ok, reason = can_bill_against_prescription(p, datetime.date(2026, 2, 27))
        assert ok is False
        assert "annulée" in reason

    def test_expired_ko(self):
        p = make_prescription(
            status="active",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 2, 20),
        )
        ok, reason = can_bill_against_prescription(p, datetime.date(2026, 2, 27))
        assert ok is False
        assert "expirée" in reason

    def test_completed_ko(self):
        p = make_prescription(status="completed", end_date=datetime.date(2026, 4, 30))
        ok, reason = can_bill_against_prescription(p, datetime.date(2026, 2, 27))
        assert ok is False
        assert "complétée" in reason

    def test_care_date_before_start_ko(self):
        p = make_prescription(
            status="active",
            start_date=datetime.date(2026, 3, 1),
            end_date=datetime.date(2026, 4, 30),
        )
        ok, reason = can_bill_against_prescription(p, datetime.date(2026, 2, 27))
        assert ok is False
        assert "antérieure" in reason

    def test_expiring_still_ok(self):
        # Expiring = encore valide pour facturation
        p = make_prescription(
            status="active",
            start_date=datetime.date(2026, 2, 1),
            end_date=datetime.date(2026, 2, 28),  # expire dans 1 jour
        )
        ok, reason = can_bill_against_prescription(p, datetime.date(2026, 2, 27))
        assert ok is True
