"""Tests unitaires pour la facturation automatique (iter 5)."""

import datetime
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.application.use_cases.billing.create_invoice_from_appointment import (
    CreateInvoiceFromAppointmentUseCase,
)
from app.domain.entities.appointment import Appointment
from app.domain.entities.invoice import Invoice, InvoiceLine
from app.domain.entities.patient import Patient
from app.domain.value_objects.haversine import haversine_distance_km


# ── Helpers ──────────────────────────────────────────────────────────────────


def make_appointment(
    act_codes: list[str] | None = None,
    status: str = "completed",
    care_protocol_id=None,
    distance_km: Decimal | None = None,
    location_type: str = "home",
    scheduled_at: datetime.datetime | None = None,
) -> Appointment:
    cabinet_id = uuid4()
    return Appointment(
        id=uuid4(),
        cabinet_id=cabinet_id,
        idel_id=uuid4(),
        patient_id=uuid4(),
        scheduled_at=scheduled_at or datetime.datetime(2026, 2, 28, 9, 0, tzinfo=datetime.timezone.utc),
        duration_minutes=30,
        care_type="pansement",
        location_type=location_type,
        status=status,
        act_codes=act_codes if act_codes is not None else ["AMI_1.5"],
        care_labels=["Pansement"],
        distance_km=distance_km,
        care_protocol_id=care_protocol_id,
    )


def make_patient(
    has_active_bsi: bool = False,
    bsi_level: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
) -> Patient:
    return Patient(
        id=uuid4(),
        cabinet_id=uuid4(),
        first_name="Marie",
        last_name="Dupont",
        birth_date=datetime.date(1960, 5, 15),
        has_active_bsi=has_active_bsi,
        bsi_level=bsi_level,
        is_ald=False,
        is_maternity=False,
        lat=lat,
        lon=lon,
    )


def make_invoice(
    appointment_id=None,
    status: str = "draft",
    lines: list | None = None,
) -> Invoice:
    return Invoice(
        id=uuid4(),
        cabinet_id=uuid4(),
        idel_id=uuid4(),
        patient_id=uuid4(),
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
        lines=lines or [],
    )


def _make_use_case(appt, patient, invoices=None, invoice_to_return=None):
    """Construit un use case avec repos mockés."""
    appt_repo = AsyncMock()
    appt_repo.get_by_id = AsyncMock(return_value=appt)
    appt_repo.update = AsyncMock(return_value=appt)

    patient_repo = AsyncMock()
    patient_repo.get_by_id = AsyncMock(return_value=patient)

    invoice_repo = AsyncMock()
    invoice_repo.list_invoices = AsyncMock(return_value=(invoices or [], 0))
    invoice_repo.get_next_sequence = AsyncMock(return_value=1)
    created_inv = invoice_to_return or make_invoice(appointment_id=appt.id)
    invoice_repo.create = AsyncMock(return_value=created_inv)
    invoice_repo.get_by_id = AsyncMock(return_value=created_inv)

    line_repo = AsyncMock()
    line_repo.create = AsyncMock()

    catalog_repo = AsyncMock()
    catalog_repo.get_by_code = AsyncMock(return_value=None)

    return CreateInvoiceFromAppointmentUseCase(
        appointment_repo=appt_repo,
        invoice_repo=invoice_repo,
        line_repo=line_repo,
        patient_repo=patient_repo,
        catalog_repo=catalog_repo,
        db_session=None,  # pas de session DB pour ces tests unitaires
    )


# ── Tests principaux ─────────────────────────────────────────────────────────


class TestCreateInvoiceFromAppointmentUseCase:
    @pytest.mark.asyncio
    async def test_rdv_non_complete_leve_erreur(self):
        appt = make_appointment(status="scheduled")
        patient = make_patient()
        uc = _make_use_case(appt, patient)
        with pytest.raises(ValueError, match="realise"):
            await uc.execute(appt.cabinet_id, appt.id)

    @pytest.mark.asyncio
    async def test_sans_act_codes_leve_erreur(self):
        appt = make_appointment(act_codes=[])
        patient = make_patient()
        uc = _make_use_case(appt, patient)
        with pytest.raises(ValueError, match="codes actes"):
            await uc.execute(appt.cabinet_id, appt.id)

    @pytest.mark.asyncio
    async def test_facture_deja_existante_leve_erreur(self):
        appt = make_appointment()
        patient = make_patient()
        existing_inv = make_invoice(appointment_id=appt.id, status="draft")
        uc = _make_use_case(appt, patient, invoices=[existing_inv])
        with pytest.raises(ValueError, match="facture existe deja"):
            await uc.execute(appt.cabinet_id, appt.id)

    @pytest.mark.asyncio
    async def test_facture_annulee_ne_bloque_pas(self):
        """Une facture annulée pour ce RDV ne doit pas bloquer la création d'une nouvelle."""
        appt = make_appointment()
        patient = make_patient()
        canceled_inv = make_invoice(appointment_id=appt.id, status="canceled")
        new_inv = make_invoice(appointment_id=appt.id, status="draft")
        uc = _make_use_case(appt, patient, invoices=[canceled_inv], invoice_to_return=new_inv)

        # On mocke SimulateCotationUseCase pour éviter la dépendance au catalogue DB
        fake_cotation = MagicMock()
        fake_cotation.total = Decimal("24.00")
        fake_cotation.repartition_amo = Decimal("14.40")
        fake_cotation.repartition_amc = Decimal("9.60")
        fake_cotation.repartition_patient = Decimal("0")
        fake_cotation.auto_corrections = []
        fake_cotation.explications = []
        fake_cotation.lignes = []

        with patch(
            "app.application.use_cases.billing.create_invoice_from_appointment.SimulateCotationUseCase"
        ) as MockSim, patch.object(
            uc, "_check_bsi_already_billed", new_callable=AsyncMock, return_value=False
        ):
            MockSim.return_value.execute = AsyncMock(return_value=fake_cotation)
            result = await uc.execute(appt.cabinet_id, appt.id)

        assert result is not None

    @pytest.mark.asyncio
    async def test_ordonnance_absente_ne_bloque_pas_facturation(self):
        """
        Un RDV avec care_protocol_id mais sans ordonnance liée doit quand même
        générer une facture (non-bloquant) — avec needs_review dans les metadata.
        """
        import uuid
        appt = make_appointment(care_protocol_id=uuid.uuid4())
        patient = make_patient()
        new_inv = make_invoice(appointment_id=appt.id, status="draft")
        uc = _make_use_case(appt, patient, invoice_to_return=new_inv)

        fake_cotation = MagicMock()
        fake_cotation.total = Decimal("24.00")
        fake_cotation.repartition_amo = Decimal("14.40")
        fake_cotation.repartition_amc = Decimal("9.60")
        fake_cotation.repartition_patient = Decimal("0")
        fake_cotation.auto_corrections = []
        fake_cotation.explications = []
        fake_cotation.lignes = []

        with patch(
            "app.application.use_cases.billing.create_invoice_from_appointment.SimulateCotationUseCase"
        ) as MockSim, patch.object(
            uc, "_check_bsi_already_billed", new_callable=AsyncMock, return_value=False
        ):
            MockSim.return_value.execute = AsyncMock(return_value=fake_cotation)
            # db_session=None → le bloc prescription est ignoré, la facture est créée sans ordonnance
            result = await uc.execute(appt.cabinet_id, appt.id)

        assert result is not None, "La facture doit être créée même sans ordonnance"


class TestNeedsReview:
    """Tests pour la détection de needs_review."""

    def _make_uc(self):
        uc = CreateInvoiceFromAppointmentUseCase(
            appointment_repo=MagicMock(),
            invoice_repo=MagicMock(),
            line_repo=MagicMock(),
            patient_repo=MagicMock(),
            catalog_repo=MagicMock(),
        )
        return uc

    def test_soin_standard_pas_de_review(self):
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 9, 0, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(appt, Decimal("24.00"), None)
        assert needs is False
        assert reason is None

    def test_soin_de_nuit_needs_review(self):
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 22, 0, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(appt, Decimal("24.00"), None)
        assert needs is True
        assert reason is not None and "horaire" in reason.lower()

    def test_soin_tres_tot_needs_review(self):
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 5, 30, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(appt, Decimal("24.00"), None)
        assert needs is True

    def test_montant_eleve_needs_review(self):
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 9, 0, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(appt, Decimal("95.00"), None)
        assert needs is True
        assert reason is not None and "élevé" in reason

    def test_montant_tres_faible_needs_review(self):
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 9, 0, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(appt, Decimal("1.50"), None)
        assert needs is True
        assert reason is not None and "faible" in reason

    def test_ordonnance_expirante_needs_review(self):
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 9, 0, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(
            appt, Decimal("24.00"), "Ordonnance expire dans 2 jour(s)"
        )
        assert needs is True
        assert reason is not None and "Ordonnance" in reason

    def test_cumul_raisons(self):
        """Plusieurs raisons doivent être concaténées."""
        appt = make_appointment(
            scheduled_at=datetime.datetime(2026, 2, 28, 23, 0, tzinfo=datetime.timezone.utc)
        )
        uc = self._make_uc()
        needs, reason = uc._detect_needs_review(
            appt, Decimal("90.00"), "Ordonnance expire dans 1 jour(s)"
        )
        assert needs is True
        assert " · " in reason  # plusieurs raisons séparées


class TestBsiCheckLogic:
    """Tests pour la détection BSI multi-IDEL."""

    @pytest.mark.asyncio
    async def test_pas_de_bsi_retourne_false(self):
        appt = make_appointment()
        patient = make_patient(has_active_bsi=False)
        uc = _make_use_case(appt, patient)
        result = await uc._check_bsi_already_billed(appt.patient_id, appt.cabinet_id, datetime.date(2026, 2, 28))
        assert result is False

    @pytest.mark.asyncio
    async def test_ligne_bs_detectee(self):
        """Si une facture du jour a une ligne BSA/BSB/BSC → retourne True."""
        line = InvoiceLine(
            id=uuid4(),
            invoice_id=uuid4(),
            line_order=1,
            act_code="BSA",
            act_label="Forfait BSA",
            coefficient=Decimal("1"),
            base_rate=Decimal("15.60"),
            quantity=Decimal("1"),
            line_subtotal=Decimal("15.60"),
            supplements=None,
            supplements_total=Decimal("0"),
            line_total=Decimal("15.60"),
        )
        inv_with_bsi = make_invoice(status="draft", lines=[line])

        appt = make_appointment()
        patient = make_patient(has_active_bsi=True, bsi_level="BSA")

        invoice_repo = AsyncMock()
        invoice_repo.list_invoices = AsyncMock(return_value=([inv_with_bsi], 1))

        uc = CreateInvoiceFromAppointmentUseCase(
            appointment_repo=AsyncMock(),
            invoice_repo=invoice_repo,
            line_repo=AsyncMock(),
            patient_repo=AsyncMock(),
            catalog_repo=AsyncMock(),
        )
        result = await uc._check_bsi_already_billed(
            appt.patient_id, appt.cabinet_id, datetime.date(2026, 2, 28)
        )
        assert result is True

    @pytest.mark.asyncio
    async def test_facture_annulee_ignoree_pour_bsi(self):
        """Une facture annulée ne doit pas déclencher le flag BSI."""
        line = InvoiceLine(
            id=uuid4(),
            invoice_id=uuid4(),
            line_order=1,
            act_code="BSB",
            act_label="Forfait BSB",
            coefficient=Decimal("1"),
            base_rate=Decimal("20.00"),
            quantity=Decimal("1"),
            line_subtotal=Decimal("20.00"),
            supplements=None,
            supplements_total=Decimal("0"),
            line_total=Decimal("20.00"),
        )
        inv_canceled = make_invoice(status="canceled", lines=[line])

        invoice_repo = AsyncMock()
        invoice_repo.list_invoices = AsyncMock(return_value=([inv_canceled], 1))

        uc = CreateInvoiceFromAppointmentUseCase(
            appointment_repo=AsyncMock(),
            invoice_repo=invoice_repo,
            line_repo=AsyncMock(),
            patient_repo=AsyncMock(),
            catalog_repo=AsyncMock(),
        )
        result = await uc._check_bsi_already_billed(uuid4(), uuid4(), datetime.date(2026, 2, 28))
        assert result is False
