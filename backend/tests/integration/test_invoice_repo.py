"""Tests d'integration pour les repositories Invoice et InvoiceLine."""

import datetime
from decimal import Decimal
from uuid import uuid4

import pytest

from app.domain.entities.invoice import Invoice, InvoiceLine
from app.infrastructure.persistence.models.cabinet_model import CabinetModel
from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.persistence.models.user_model import UserModel
from app.infrastructure.persistence.repositories.sqlalchemy_invoice_repo import (
    SQLAlchemyInvoiceLineRepo,
    SQLAlchemyInvoiceRepo,
)

pytestmark = pytest.mark.asyncio


async def _create_cabinet(session, cabinet_id=None):
    cid = cabinet_id or uuid4()
    cabinet = CabinetModel(id=cid, name="Cabinet Test", address="1 rue de la Paix")
    session.add(cabinet)
    await session.flush()
    return cid


async def _create_user(session, cabinet_id):
    uid = uuid4()
    user = UserModel(
        id=uid,
        email=f"test-{uid.hex[:8]}@example.fr",
        password_hash="$2b$12$fakehashfortest",
        first_name="Sophie",
        last_name="Martin",
        rpps="12345678901",
    )
    session.add(user)
    await session.flush()

    from app.infrastructure.persistence.models.user_model import CabinetMemberModel
    member = CabinetMemberModel(
        cabinet_id=cabinet_id,
        user_id=uid,
        role="admin",
        is_active=True,
    )
    session.add(member)
    await session.flush()
    return uid


async def _create_patient(session, cabinet_id):
    pid = uuid4()
    patient = PatientModel(
        id=pid,
        cabinet_id=cabinet_id,
        first_name_encrypted=b"encrypted_first",
        last_name_encrypted=b"encrypted_last",
    )
    session.add(patient)
    await session.flush()
    return pid


def _make_invoice(cabinet_id, idel_id, patient_id, **overrides) -> Invoice:
    defaults = {
        "cabinet_id": cabinet_id,
        "idel_id": idel_id,
        "patient_id": patient_id,
        "invoice_number": f"2026-02-{uuid4().int % 10000:04d}",
        "invoice_date": datetime.date(2026, 2, 26),
        "care_date": datetime.date(2026, 2, 26),
        "status": "draft",
    }
    defaults.update(overrides)
    return Invoice(**defaults)


def _make_line(invoice_id, **overrides) -> InvoiceLine:
    defaults = {
        "invoice_id": invoice_id,
        "act_code": "AMI_4",
        "act_label": "Acte medical infirmier coefficient 4",
        "coefficient": Decimal("4"),
        "base_rate": Decimal("3.15"),
        "quantity": Decimal("1"),
        "line_subtotal": Decimal("12.60"),
        "line_total": Decimal("12.60"),
        "line_order": 1,
    }
    defaults.update(overrides)
    return InvoiceLine(**defaults)


class TestInvoiceRepoCRUD:
    async def test_create_and_get(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)
        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0001")
        created = await repo.create(invoice)

        assert created.id == invoice.id
        assert created.invoice_number == "2026-02-0001"
        assert created.status == "draft"

        found = await repo.get_by_id(invoice.id, cabinet_id)
        assert found is not None
        assert found.invoice_number == "2026-02-0001"

    async def test_get_nonexistent(self, session):
        repo = SQLAlchemyInvoiceRepo(session)
        found = await repo.get_by_id(uuid4(), uuid4())
        assert found is None

    async def test_update(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)
        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0002")
        await repo.create(invoice)

        invoice.tiers_payant_type = "partiel"
        invoice.total_amount = Decimal("25.35")
        updated = await repo.update(invoice)

        assert updated.tiers_payant_type == "partiel"
        assert updated.total_amount == Decimal("25.35")

    async def test_delete_draft(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)
        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0003")
        await repo.create(invoice)

        deleted = await repo.delete(invoice.id, cabinet_id)
        assert deleted is True

        found = await repo.get_by_id(invoice.id, cabinet_id)
        assert found is None

    async def test_delete_nonexistent(self, session):
        repo = SQLAlchemyInvoiceRepo(session)
        deleted = await repo.delete(uuid4(), uuid4())
        assert deleted is False


class TestInvoiceRepoList:
    async def test_list_with_filters(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)

        # Create 3 invoices: 2 draft, 1 validated
        await repo.create(_make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0010"))
        await repo.create(_make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0011"))
        inv3 = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0012", status="validated")
        await repo.create(inv3)

        # List all
        items, total = await repo.list_invoices(cabinet_id)
        assert total == 3
        assert len(items) == 3

        # Filter by status
        items, total = await repo.list_invoices(cabinet_id, status="draft")
        assert total == 2

        items, total = await repo.list_invoices(cabinet_id, status="validated")
        assert total == 1

    async def test_list_by_patient(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient1 = await _create_patient(session, cabinet_id)
        patient2 = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)
        await repo.create(_make_invoice(cabinet_id, idel_id, patient1, invoice_number="2026-02-0020"))
        await repo.create(_make_invoice(cabinet_id, idel_id, patient2, invoice_number="2026-02-0021"))

        items, total = await repo.list_invoices(cabinet_id, patient_id=patient1)
        assert total == 1
        assert items[0].patient_id == patient1

    async def test_list_by_date_range(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)
        await repo.create(_make_invoice(
            cabinet_id, idel_id, patient_id,
            invoice_number="2026-01-0001",
            care_date=datetime.date(2026, 1, 15),
        ))
        await repo.create(_make_invoice(
            cabinet_id, idel_id, patient_id,
            invoice_number="2026-02-0030",
            care_date=datetime.date(2026, 2, 15),
        ))

        items, total = await repo.list_invoices(
            cabinet_id,
            date_from=datetime.date(2026, 2, 1),
            date_to=datetime.date(2026, 2, 28),
        )
        assert total == 1

    async def test_list_pagination(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)
        for i in range(5):
            await repo.create(_make_invoice(
                cabinet_id, idel_id, patient_id,
                invoice_number=f"2026-02-{i + 40:04d}",
            ))

        items, total = await repo.list_invoices(cabinet_id, offset=0, limit=2)
        assert total == 5
        assert len(items) == 2

        items, total = await repo.list_invoices(cabinet_id, offset=4, limit=2)
        assert len(items) == 1


class TestInvoiceRepoNextSequence:
    async def test_first_of_month(self, session):
        cabinet_id = await _create_cabinet(session)
        repo = SQLAlchemyInvoiceRepo(session)

        seq = await repo.get_next_sequence(cabinet_id, 2026, 3)
        assert seq == 1

    async def test_increments(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        repo = SQLAlchemyInvoiceRepo(session)

        # Create one invoice with sequence 1
        await repo.create(_make_invoice(
            cabinet_id, idel_id, patient_id,
            invoice_number="2026-03-0001",
        ))
        seq = await repo.get_next_sequence(cabinet_id, 2026, 3)
        assert seq == 2

        # Create another
        await repo.create(_make_invoice(
            cabinet_id, idel_id, patient_id,
            invoice_number="2026-03-0002",
        ))
        seq = await repo.get_next_sequence(cabinet_id, 2026, 3)
        assert seq == 3


class TestInvoiceLineRepo:
    async def test_create_and_list(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        invoice_repo = SQLAlchemyInvoiceRepo(session)
        line_repo = SQLAlchemyInvoiceLineRepo(session)

        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0050")
        await invoice_repo.create(invoice)

        line1 = _make_line(invoice.id, line_order=1)
        line2 = _make_line(invoice.id, line_order=2, act_code="IFD", line_total=Decimal("2.75"))

        await line_repo.create(line1)
        await line_repo.create(line2)

        lines = await line_repo.list_by_invoice(invoice.id)
        assert len(lines) == 2
        assert lines[0].line_order == 1
        assert lines[1].line_order == 2

    async def test_update_line(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        invoice_repo = SQLAlchemyInvoiceRepo(session)
        line_repo = SQLAlchemyInvoiceLineRepo(session)

        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0051")
        await invoice_repo.create(invoice)

        line = _make_line(invoice.id)
        created = await line_repo.create(line)

        created.quantity = Decimal("3")
        created.recalculate()
        updated = await line_repo.update(created)

        assert updated.quantity == Decimal("3")
        assert updated.line_subtotal == Decimal("37.80")

    async def test_delete_line(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        invoice_repo = SQLAlchemyInvoiceRepo(session)
        line_repo = SQLAlchemyInvoiceLineRepo(session)

        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0052")
        await invoice_repo.create(invoice)

        line = _make_line(invoice.id)
        await line_repo.create(line)

        deleted = await line_repo.delete(line.id)
        assert deleted is True

        found = await line_repo.get_by_id(line.id)
        assert found is None

    async def test_cascade_delete_invoice_deletes_lines(self, session):
        cabinet_id = await _create_cabinet(session)
        idel_id = await _create_user(session, cabinet_id)
        patient_id = await _create_patient(session, cabinet_id)

        invoice_repo = SQLAlchemyInvoiceRepo(session)
        line_repo = SQLAlchemyInvoiceLineRepo(session)

        invoice = _make_invoice(cabinet_id, idel_id, patient_id, invoice_number="2026-02-0053")
        await invoice_repo.create(invoice)

        line = _make_line(invoice.id)
        await line_repo.create(line)

        await invoice_repo.delete(invoice.id, cabinet_id)

        found = await line_repo.get_by_id(line.id)
        assert found is None
