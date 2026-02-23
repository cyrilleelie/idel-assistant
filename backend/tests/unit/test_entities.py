"""Tests unitaires pour les entités domain (Patient, CareProtocol, Document)."""

import datetime
from uuid import uuid4

from app.domain.entities.patient import Patient
from app.domain.entities.care_protocol import CareProtocol
from app.domain.entities.document import Document


class TestPatientEntity:
    def test_create_with_new_fields(self):
        p = Patient(
            cabinet_id=uuid4(),
            first_name="Jean",
            last_name="DUPONT",
            ssn="1 80 12 75 123 456 78",
            doctor_name="Dr. Lefevre",
            doctor_contact="01 45 67 89 00",
        )
        assert p.ssn == "1 80 12 75 123 456 78"
        assert p.doctor_name == "Dr. Lefevre"
        assert p.doctor_contact == "01 45 67 89 00"

    def test_defaults_for_new_fields(self):
        p = Patient(cabinet_id=uuid4(), first_name="A", last_name="B")
        assert p.ssn == ""
        assert p.doctor_name == ""
        assert p.doctor_contact == ""

    def test_existing_fields_unaffected(self):
        p = Patient(
            cabinet_id=uuid4(),
            first_name="Marie",
            last_name="BERNARD",
            phone="06 00 00 00 00",
            notes="Test note",
        )
        assert p.first_name == "Marie"
        assert p.phone == "06 00 00 00 00"
        assert p.notes == "Test note"
        assert p.status == "active"


class TestCareProtocolEntity:
    def test_create_with_new_fields(self):
        cp = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            care_type="pansement",
            duration_minutes=30,
            recurrence_rule="FREQ=DAILY",
            start_date=datetime.date(2026, 1, 1),
            label="Pansement post-op genou",
            frequency_display="daily",
            custom_frequency="",
        )
        assert cp.label == "Pansement post-op genou"
        assert cp.frequency_display == "daily"
        assert cp.custom_frequency == ""

    def test_custom_frequency(self):
        cp = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            care_type="injection",
            duration_minutes=15,
            recurrence_rule="FREQ=WEEKLY;BYDAY=MO,WE",
            start_date=datetime.date(2026, 2, 1),
            frequency_display="custom",
            custom_frequency="Lundi et Mercredi",
        )
        assert cp.frequency_display == "custom"
        assert cp.custom_frequency == "Lundi et Mercredi"

    def test_defaults_for_new_fields(self):
        cp = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            care_type="bsi",
            duration_minutes=45,
            recurrence_rule="FREQ=DAILY",
            start_date=datetime.date(2026, 3, 1),
        )
        assert cp.label == ""
        assert cp.frequency_display == "daily"
        assert cp.custom_frequency == ""

    def test_existing_fields_unaffected(self):
        cp = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            care_type="injection",
            duration_minutes=20,
            recurrence_rule="FREQ=DAILY",
            start_date=datetime.date(2026, 1, 15),
            preferred_slot="morning",
            notes="Insuline Lantus 20 UI",
        )
        assert cp.preferred_slot == "morning"
        assert cp.notes == "Insuline Lantus 20 UI"
        assert cp.status == "active"


class TestDocumentEntity:
    def test_create(self):
        doc = Document(
            cabinet_id=uuid4(),
            entity_type="care_protocol",
            entity_id=uuid4(),
            original_name="ordonnance.pdf",
            mime_type="application/pdf",
            size_bytes=42000,
            storage_path="/uploads/abc/doc.enc",
            checksum_sha256="a" * 64,
            uploaded_by=uuid4(),
        )
        assert doc.original_name == "ordonnance.pdf"
        assert doc.mime_type == "application/pdf"
        assert doc.size_bytes == 42000
        assert doc.id is not None
        assert doc.created_at is not None

    def test_unique_ids(self):
        base = dict(
            cabinet_id=uuid4(),
            entity_type="patient",
            entity_id=uuid4(),
            original_name="photo.jpg",
            mime_type="image/jpeg",
            size_bytes=1000,
            storage_path="/x",
            checksum_sha256="b" * 64,
            uploaded_by=uuid4(),
        )
        d1 = Document(**base)
        d2 = Document(**base)
        assert d1.id != d2.id
