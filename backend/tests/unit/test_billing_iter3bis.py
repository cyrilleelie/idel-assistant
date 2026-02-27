"""Tests unitaires pour l'iteration 3bis du module facturation."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.appointment import Appointment
from app.domain.entities.care_protocol import CareProtocol
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.rules.care_protocol_rules import generate_appointments_from_protocol
from app.domain.services.care_type_ngap_mapping import suggest_ngap_codes


# --- Tests suggest_ngap_codes ---


class TestSuggestNgapCodes:
    def test_pansement(self):
        assert suggest_ngap_codes("pansement") == ["AMI_1.5"]

    def test_injection(self):
        assert suggest_ngap_codes("injection") == ["AMI_1"]

    def test_perfusion(self):
        assert suggest_ngap_codes("perfusion") == ["AMI_4"]

    def test_bsi_empty(self):
        assert suggest_ngap_codes("bsi") == []

    def test_prelevements(self):
        assert suggest_ngap_codes("prelevements") == ["AMI_1.5"]

    def test_soins_infirmiers(self):
        assert suggest_ngap_codes("soins_infirmiers") == ["AMI_1"]

    def test_unknown_care_type(self):
        assert suggest_ngap_codes("unknown_type") == []

    def test_empty_string(self):
        assert suggest_ngap_codes("") == []

    def test_returns_new_list(self):
        """Verifie que chaque appel retourne une nouvelle liste (pas de mutation)."""
        result1 = suggest_ngap_codes("pansement")
        result2 = suggest_ngap_codes("pansement")
        assert result1 == result2
        assert result1 is not result2


# --- Tests generate_appointments_from_protocol propagates act_codes ---


class TestProtocolActCodesPropagation:
    def _make_protocol(self) -> CareProtocol:
        return CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            start_date=datetime.date(2026, 3, 1),
            end_date=datetime.date(2026, 3, 3),
        )

    def _make_prescription(self, act_codes: list[str] | None = None):
        from app.domain.entities.prescription import Prescription
        return Prescription(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            duration_minutes=30,
            recurrence_rule="FREQ=DAILY;INTERVAL=1",
            start_date=datetime.date(2026, 3, 1),
            end_date=datetime.date(2026, 3, 3),
            preferred_time=datetime.time(8, 0),
            act_codes=act_codes or [],
        )

    def test_act_codes_propagated(self):
        protocol = self._make_protocol()
        prescription = self._make_prescription(act_codes=["AMI_1.5"])
        appointments = generate_appointments_from_protocol(
            protocol=protocol,
            idel_id=uuid4(),
            from_date=datetime.date(2026, 3, 1),
            to_date=datetime.date(2026, 3, 3),
            prescriptions=[prescription],
        )
        assert len(appointments) > 0
        for appt in appointments:
            assert appt.act_codes == ["AMI_1.5"]

    def test_empty_act_codes_propagated(self):
        protocol = self._make_protocol()
        prescription = self._make_prescription(act_codes=[])
        appointments = generate_appointments_from_protocol(
            protocol=protocol,
            idel_id=uuid4(),
            from_date=datetime.date(2026, 3, 1),
            to_date=datetime.date(2026, 3, 3),
            prescriptions=[prescription],
        )
        for appt in appointments:
            assert appt.act_codes == []

    def test_multiple_act_codes_propagated(self):
        protocol = self._make_protocol()
        prescription = self._make_prescription(act_codes=["AMI_4", "AMI_1"])
        appointments = generate_appointments_from_protocol(
            protocol=protocol,
            idel_id=uuid4(),
            from_date=datetime.date(2026, 3, 1),
            to_date=datetime.date(2026, 3, 3),
            prescriptions=[prescription],
        )
        for appt in appointments:
            assert appt.act_codes == ["AMI_4", "AMI_1"]

    def test_act_codes_are_independent_copies(self):
        """Modifying one appointment's act_codes shouldn't affect others."""
        protocol = self._make_protocol()
        prescription = self._make_prescription(act_codes=["AMI_1"])
        appointments = generate_appointments_from_protocol(
            protocol=protocol,
            idel_id=uuid4(),
            from_date=datetime.date(2026, 3, 1),
            to_date=datetime.date(2026, 3, 3),
            prescriptions=[prescription],
        )
        if len(appointments) > 1:
            appointments[0].act_codes.append("AMI_4")
            assert "AMI_4" not in appointments[1].act_codes


# --- Tests entity changes (InvoiceLine no longer has appointment_id, Invoice has it) ---


class TestInvoiceEntities:
    def test_invoice_has_appointment_id(self):
        invoice = Invoice(
            cabinet_id=uuid4(),
            idel_id=uuid4(),
            patient_id=uuid4(),
            appointment_id=uuid4(),
        )
        assert invoice.appointment_id is not None

    def test_invoice_appointment_id_default_none(self):
        invoice = Invoice(
            cabinet_id=uuid4(),
            idel_id=uuid4(),
            patient_id=uuid4(),
        )
        assert invoice.appointment_id is None

    def test_invoice_line_no_appointment_id(self):
        line = InvoiceLine(
            invoice_id=uuid4(),
            act_code="AMI_4",
            act_label="Test",
        )
        assert not hasattr(line, "appointment_id") or "appointment_id" not in InvoiceLine.__dataclass_fields__


# --- Tests Appointment entity ---


class TestAppointmentEntity:
    def test_act_codes_default_empty(self):
        appt = Appointment(
            cabinet_id=uuid4(),
            idel_id=uuid4(),
            patient_id=uuid4(),
            scheduled_at=datetime.datetime.now(datetime.UTC),
            duration_minutes=30,
            care_type="pansement",
        )
        assert appt.act_codes == []

    def test_distance_km_default_none(self):
        appt = Appointment(
            cabinet_id=uuid4(),
            idel_id=uuid4(),
            patient_id=uuid4(),
            scheduled_at=datetime.datetime.now(datetime.UTC),
            duration_minutes=30,
            care_type="pansement",
        )
        assert appt.distance_km is None

    def test_act_codes_and_distance_km(self):
        appt = Appointment(
            cabinet_id=uuid4(),
            idel_id=uuid4(),
            patient_id=uuid4(),
            scheduled_at=datetime.datetime.now(datetime.UTC),
            duration_minutes=30,
            care_type="pansement",
            act_codes=["AMI_1.5"],
            distance_km=Decimal("5.50"),
        )
        assert appt.act_codes == ["AMI_1.5"]
        assert appt.distance_km == Decimal("5.50")


# --- Tests CareProtocol entity ---


class TestCareProtocolEntity:
    def test_create_minimal(self):
        protocol = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
        )
        assert protocol.status == "active"
        assert protocol.label == ""

    def test_create_with_label(self):
        protocol = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            label="Pansements post-op",
            start_date=datetime.date.today(),
        )
        assert protocol.label == "Pansements post-op"
