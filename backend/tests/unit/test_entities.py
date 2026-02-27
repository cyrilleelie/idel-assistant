"""Tests unitaires pour les entités domain (Patient, CareProtocol, Document, CabinetMember)."""

import datetime
from uuid import uuid4

from app.domain.entities.patient import Patient
from app.domain.entities.care_protocol import CareProtocol
from app.domain.entities.document import Document
from app.domain.entities.user import CabinetMember


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
    def test_create_minimal(self):
        cp = CareProtocol(patient_id=uuid4(), cabinet_id=uuid4())
        assert cp.label == ""
        assert cp.status == "active"
        assert cp.start_date is None
        assert cp.end_date is None
        assert cp.id is not None

    def test_create_with_label_and_dates(self):
        cp = CareProtocol(
            patient_id=uuid4(),
            cabinet_id=uuid4(),
            label="Soins post-op genou",
            start_date=datetime.date(2026, 1, 1),
            end_date=datetime.date(2026, 1, 31),
        )
        assert cp.label == "Soins post-op genou"
        assert cp.start_date == datetime.date(2026, 1, 1)
        assert cp.end_date == datetime.date(2026, 1, 31)

    def test_status_defaults_active(self):
        cp = CareProtocol(patient_id=uuid4(), cabinet_id=uuid4())
        assert cp.status == "active"

    def test_unique_ids(self):
        p = uuid4()
        c = uuid4()
        cp1 = CareProtocol(patient_id=p, cabinet_id=c)
        cp2 = CareProtocol(patient_id=p, cabinet_id=c)
        assert cp1.id != cp2.id


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


class TestCabinetMemberEntity:
    def test_create_with_color(self):
        m = CabinetMember(
            cabinet_id=uuid4(),
            user_id=uuid4(),
            role="admin",
            color="#FF5733",
        )
        assert m.role == "admin"
        assert m.color == "#FF5733"
        assert m.is_active is True
        assert m.id is not None

    def test_defaults(self):
        m = CabinetMember(cabinet_id=uuid4(), user_id=uuid4())
        assert m.role == "member"
        assert m.color == "#3B82F6"
        assert m.is_active is True
        assert m.left_at is None

    def test_deactivate(self):
        m = CabinetMember(cabinet_id=uuid4(), user_id=uuid4())
        m.is_active = False
        m.left_at = datetime.date.today()
        assert m.is_active is False
        assert m.left_at is not None
