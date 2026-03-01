"""Tests unitaires des outils agent IA."""

import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.infrastructure.agent.context import AgentContext, AgentDeps


def make_context(session_id: str = "test-session") -> AgentContext:
    return AgentContext(
        user_id=uuid.uuid4(),
        cabinet_id=uuid.uuid4(),
        role="idel",
        session_id=session_id,
    )


def make_deps(context: AgentContext) -> AgentDeps:
    deps = MagicMock(spec=AgentDeps)
    deps.context = context
    deps.db = AsyncMock()
    deps.patient_repo = AsyncMock()
    deps.appointment_repo = AsyncMock()
    deps.invoice_repo = AsyncMock()
    deps.tournee_repo = AsyncMock()
    deps.care_catalog_repo = AsyncMock()
    deps.key_manager = MagicMock()
    return deps


def make_run_context(deps: AgentDeps) -> MagicMock:
    ctx = MagicMock()
    ctx.deps = deps
    return ctx


# ── Tests patient_tools ───────────────────────────────────────────────────────


class TestSearchPatients:
    @pytest.mark.asyncio
    async def test_returns_matching_patients(self):
        from app.infrastructure.agent.tools.patient_tools import search_patients

        context = make_context()
        deps = make_deps(context)

        patient = MagicMock()
        patient.id = uuid.uuid4()
        patient.first_name = "Marie"
        patient.last_name = "Dupont"
        patient.phone = "0601020304"
        patient.address = "1 rue de la Paix"
        patient.status = "active"

        deps.patient_repo.list_by_cabinet = AsyncMock(return_value=([patient], 1))
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.patient_tools.log_tool_call", new=AsyncMock()):
            result = await search_patients(ctx, "Marie")

        assert result["total"] == 1
        assert result["patients"][0]["first_name"] == "Marie"

    @pytest.mark.asyncio
    async def test_filters_by_cabinet_id(self):
        from app.infrastructure.agent.tools.patient_tools import search_patients

        context = make_context()
        deps = make_deps(context)
        deps.patient_repo.list_by_cabinet = AsyncMock(return_value=([], 0))
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.patient_tools.log_tool_call", new=AsyncMock()):
            await search_patients(ctx, "test")

        # Vérifie que le cabinet_id du contexte est utilisé
        call_kwargs = deps.patient_repo.list_by_cabinet.call_args.kwargs
        assert call_kwargs["cabinet_id"] == context.cabinet_id

    @pytest.mark.asyncio
    async def test_returns_error_on_repo_exception(self):
        from app.infrastructure.agent.tools.patient_tools import search_patients

        context = make_context()
        deps = make_deps(context)
        deps.patient_repo.list_by_cabinet = AsyncMock(side_effect=Exception("DB error"))
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.patient_tools.log_tool_call", new=AsyncMock()):
            result = await search_patients(ctx, "test")

        assert "error" in result


class TestGetPatientDetails:
    @pytest.mark.asyncio
    async def test_returns_patient_details(self):
        from app.infrastructure.agent.tools.patient_tools import get_patient_details

        context = make_context()
        deps = make_deps(context)

        patient = MagicMock()
        patient.id = uuid.uuid4()
        patient.cabinet_id = context.cabinet_id
        patient.first_name = "Jean"
        patient.last_name = "Martin"
        patient.phone = ""
        patient.address = ""
        patient.notes = ""
        patient.status = "active"
        patient.doctor_name = "Dr. Dupont"

        deps.patient_repo.get_by_id = AsyncMock(return_value=patient)
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.patient_tools.log_tool_call", new=AsyncMock()):
            result = await get_patient_details(ctx, str(patient.id))

        assert result["found"] is True
        assert result["first_name"] == "Jean"
        # SSN ne doit jamais être exposé
        assert "ssn" not in result

    @pytest.mark.asyncio
    async def test_rejects_wrong_cabinet(self):
        from app.infrastructure.agent.tools.patient_tools import get_patient_details

        context = make_context()
        deps = make_deps(context)

        patient = MagicMock()
        patient.id = uuid.uuid4()
        patient.cabinet_id = uuid.uuid4()  # cabinet différent

        deps.patient_repo.get_by_id = AsyncMock(return_value=patient)
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.patient_tools.log_tool_call", new=AsyncMock()):
            result = await get_patient_details(ctx, str(patient.id))

        assert result["found"] is False

    @pytest.mark.asyncio
    async def test_invalid_uuid_returns_error(self):
        from app.infrastructure.agent.tools.patient_tools import get_patient_details

        context = make_context()
        deps = make_deps(context)
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.patient_tools.log_tool_call", new=AsyncMock()):
            result = await get_patient_details(ctx, "not-a-uuid")

        assert "error" in result


# ── Tests appointment_tools ───────────────────────────────────────────────────


class TestGetAppointmentsToday:
    @pytest.mark.asyncio
    async def test_returns_today_appointments(self):
        from app.infrastructure.agent.tools.appointment_tools import get_appointments_today

        context = make_context()
        deps = make_deps(context)

        apt = MagicMock()
        apt.id = uuid.uuid4()
        apt.patient_id = uuid.uuid4()
        apt.scheduled_at = datetime.datetime.now(datetime.UTC)
        apt.duration_minutes = 30
        apt.status = "planned"
        apt.care_label = "AMI 1"
        apt.address = "5 rue du Bac"

        deps.appointment_repo.list_by_date = AsyncMock(return_value=([apt], 1))
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.appointment_tools.log_tool_call", new=AsyncMock()):
            result = await get_appointments_today(ctx)

        assert result["total"] == 1
        assert result["appointments"][0]["status"] == "planned"

    @pytest.mark.asyncio
    async def test_filters_by_cabinet(self):
        from app.infrastructure.agent.tools.appointment_tools import get_appointments_today

        context = make_context()
        deps = make_deps(context)
        deps.appointment_repo.list_by_date = AsyncMock(return_value=([], 0))
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.appointment_tools.log_tool_call", new=AsyncMock()):
            await get_appointments_today(ctx)

        call_kwargs = deps.appointment_repo.list_by_date.call_args.kwargs
        assert call_kwargs["cabinet_id"] == context.cabinet_id


# ── Tests invoice_tools ───────────────────────────────────────────────────────


class TestGetInvoicesPending:
    @pytest.mark.asyncio
    async def test_returns_pending_invoices(self):
        from app.infrastructure.agent.tools.invoice_tools import get_invoices_pending

        context = make_context()
        deps = make_deps(context)

        inv = MagicMock()
        inv.id = uuid.uuid4()
        inv.invoice_number = "2026-001"
        inv.patient_id = uuid.uuid4()
        inv.total_amount = 35.50
        inv.status = "validated"
        inv.invoice_date = datetime.date.today()
        inv.payment_amount = None

        deps.invoice_repo.list_unpaid = AsyncMock(return_value=[inv])
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.invoice_tools.log_tool_call", new=AsyncMock()):
            result = await get_invoices_pending(ctx)

        assert result["count"] == 1
        assert result["total_amount"] == 35.50

    @pytest.mark.asyncio
    async def test_error_handling(self):
        from app.infrastructure.agent.tools.invoice_tools import get_invoices_pending

        context = make_context()
        deps = make_deps(context)
        deps.invoice_repo.list_unpaid = AsyncMock(side_effect=Exception("DB failure"))
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.invoice_tools.log_tool_call", new=AsyncMock()):
            result = await get_invoices_pending(ctx)

        assert "error" in result


# ── Tests knowledge_tools ─────────────────────────────────────────────────────


class TestGetNgapAct:
    @pytest.mark.asyncio
    async def test_found_act(self):
        from app.infrastructure.agent.tools.knowledge_tools import get_ngap_act

        context = make_context()
        deps = make_deps(context)

        act = MagicMock()
        act.code = "AMI"
        act.label = "Acte infirmier"
        act.base_price = 3.15
        act.coefficient = 1.0
        act.category = "AMI"
        act.description = ""

        deps.care_catalog_repo.get_by_code = AsyncMock(return_value=act)
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.knowledge_tools.log_tool_call", new=AsyncMock()):
            result = await get_ngap_act(ctx, "AMI")

        assert result["found"] is True
        assert result["code"] == "AMI"

    @pytest.mark.asyncio
    async def test_not_found(self):
        from app.infrastructure.agent.tools.knowledge_tools import get_ngap_act

        context = make_context()
        deps = make_deps(context)
        deps.care_catalog_repo.get_by_code = AsyncMock(return_value=None)
        ctx = make_run_context(deps)

        with patch("app.infrastructure.agent.tools.knowledge_tools.log_tool_call", new=AsyncMock()):
            result = await get_ngap_act(ctx, "ZZZ")

        assert result["found"] is False


# ── Tests memory ──────────────────────────────────────────────────────────────


class TestAgentMemory:
    @pytest.mark.asyncio
    async def test_get_empty_history(self):
        from app.infrastructure.agent import memory

        with patch("app.infrastructure.agent.memory.get_redis") as mock_get_redis:
            r = AsyncMock()
            r.get = AsyncMock(return_value=None)
            mock_get_redis.return_value = r

            result = await memory.get_history("new-session")

        assert result == []

    @pytest.mark.asyncio
    async def test_save_and_retrieve(self):
        import json
        from app.infrastructure.agent import memory

        history: list = []

        async def fake_get(key):
            return json.dumps(history) if history else None

        async def fake_setex(key, ttl, value):
            history.clear()
            history.extend(json.loads(value))

        with patch("app.infrastructure.agent.memory.get_redis") as mock_get_redis:
            r = AsyncMock()
            r.get = AsyncMock(side_effect=fake_get)
            r.setex = AsyncMock(side_effect=fake_setex)
            mock_get_redis.return_value = r

            await memory.save_message("sess1", "user", "Bonjour")
            result = await memory.get_history("sess1")

        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert result[0]["content"] == "Bonjour"

    @pytest.mark.asyncio
    async def test_sliding_window(self):
        import json
        from unittest.mock import patch
        from app.infrastructure.agent import memory

        # Simuler un historique de 20 messages
        stored: list = [{"role": "user", "content": str(i)} for i in range(20)]

        async def fake_get(key):
            return json.dumps(stored)

        async def fake_setex(key, ttl, value):
            stored.clear()
            stored.extend(json.loads(value))

        with patch("app.infrastructure.agent.memory.get_redis") as mock_get_redis:
            r = AsyncMock()
            r.get = AsyncMock(side_effect=fake_get)
            r.setex = AsyncMock(side_effect=fake_setex)
            mock_get_redis.return_value = r
            with patch("app.infrastructure.agent.memory.settings") as mock_settings:
                mock_settings.agent_max_history_messages = 20
                mock_settings.agent_session_ttl_seconds = 14400

                await memory.save_message("sess", "user", "message 21")

        # Le total ne doit pas dépasser 20
        assert len(stored) <= 20
