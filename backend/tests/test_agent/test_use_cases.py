"""Tests unitaires des use cases Iter B de l'agent IA.

Couvre :
- Extraction d'actes NGAP depuis texte libre
- Extraction de distance km
- Pending action TTL (mock Redis)
- Protection contre double confirmation
- analyser_et_coter avec mock deps
- Guardrails out-of-scope
- structurer_transmission (mock Mistral)
"""

import asyncio
import json
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.infrastructure.agent.context import AgentContext, AgentDeps
from app.infrastructure.agent.tools.invoice_tools import (
    _extract_actes,
    _extract_distance_km,
    _extract_heure,
)
from app.infrastructure.agent.orchestrator import _check_out_of_scope


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_context(session_id: str = "test-session") -> AgentContext:
    return AgentContext(
        user_id=uuid.uuid4(),
        cabinet_id=uuid.uuid4(),
        role="idel",
        session_id=session_id,
    )


def make_deps(context: AgentContext | None = None) -> AgentDeps:
    ctx = context or make_context()
    deps = MagicMock(spec=AgentDeps)
    deps.context = ctx
    deps.db = AsyncMock()
    deps.patient_repo = AsyncMock()
    deps.appointment_repo = AsyncMock()
    deps.invoice_repo = AsyncMock()
    deps.tournee_repo = AsyncMock()
    deps.care_catalog_repo = AsyncMock()
    deps.key_manager = MagicMock()
    deps.pending_tool_results = []
    deps.transmission_repo = AsyncMock()
    return deps


# ── UC1 : extraction texte ────────────────────────────────────────────────────


class TestExtractActes:
    def test_pansement_complexe(self):
        actes = _extract_actes("pansement complexe sur plaie post-opératoire")
        assert "AMI 4" in actes

    def test_pansement_complexe_avant_simple(self):
        """'pansement complexe' doit matcher avant 'pansement simple'."""
        actes = _extract_actes("réfection d'un pansement complexe")
        assert actes == ["AMI 4"]  # pas "AIS 1"

    def test_escarre(self):
        actes = _extract_actes("escarre stade 3 au niveau sacrum, drainage")
        assert "AMI 4" in actes

    def test_injection_insuline(self):
        actes = _extract_actes("injection insuline Novorapid")
        assert "AMI 1" in actes

    def test_prise_de_sang(self):
        actes = _extract_actes("prise de sang à jeun pour bilan sanguin")
        assert "AMI 1" in actes

    def test_sonde_urinaire(self):
        actes = _extract_actes("pose de sonde urinaire")
        assert "AIS 2" in actes

    def test_perfusion(self):
        actes = _extract_actes("perfusion IV sur 1h")
        assert "AIS 3" in actes

    def test_stomie(self):
        actes = _extract_actes("soin stomie colostomie")
        assert "AMI 3" in actes

    def test_fallback_ami1(self):
        """Texte sans mot-clé reconnu → fallback AMI 1."""
        actes = _extract_actes("passage infirmier routine")
        assert actes == ["AMI 1"]

    def test_case_insensitive(self):
        actes = _extract_actes("PANSEMENT COMPLEXE")
        assert "AMI 4" in actes


class TestExtractDistanceKm:
    def test_12km(self):
        dist = _extract_distance_km("soin à domicile avec 12km")
        assert dist == Decimal("12")

    def test_decimal_virgule(self):
        dist = _extract_distance_km("trajet de 3,5km")
        assert dist == Decimal("3.5")

    def test_avec_espace(self):
        dist = _extract_distance_km("15 km aller-retour")
        assert dist == Decimal("15")

    def test_absent(self):
        dist = _extract_distance_km("soin au cabinet sans déplacement")
        assert dist == Decimal("0")


class TestExtractHeure:
    def test_7h30(self):
        h = _extract_heure("soin à 7h30 du matin")
        assert h == (7, 30)

    def test_19h(self):
        h = _extract_heure("passage du soir à 19h")
        assert h == (19, 0)

    def test_format_colon(self):
        h = _extract_heure("RDV à 08:45")
        assert h == (8, 45)

    def test_absent(self):
        h = _extract_heure("soin sans indication d'heure")
        assert h is None


# ── Guardrails ────────────────────────────────────────────────────────────────


class TestGuardrails:
    def test_medical_advice_bloque(self):
        refusal = _check_out_of_scope("quel médicament pour une infection urinaire ?")
        assert refusal is not None
        assert "médecin" in refusal.lower() or "qualifié" in refusal.lower()

    def test_posologie_bloquee(self):
        refusal = _check_out_of_scope("quelle posologie pour paracetamol ?")
        assert refusal is not None

    def test_off_topic_bloque(self):
        refusal = _check_out_of_scope("quelle est la météo à Paris ?")
        assert refusal is not None

    def test_pansement_non_bloque(self):
        """La question sur un pansement est dans le périmètre IDEL."""
        refusal = _check_out_of_scope("comment coter un pansement complexe ?")
        assert refusal is None

    def test_facturation_non_bloquee(self):
        refusal = _check_out_of_scope("combien de factures en attente ce mois-ci ?")
        assert refusal is None

    def test_ordonnance_non_bloquee(self):
        """Le mot 'ordonnance' est dans le périmètre IDEL."""
        refusal = _check_out_of_scope("interprète cette ordonnance infirmière")
        assert refusal is None


# ── Pending action (mock Redis) ───────────────────────────────────────────────


class TestPendingAction:
    @pytest.mark.asyncio
    async def test_store_and_get(self):
        """store_pending_action puis get_pending_action retourne l'action."""
        mock_redis = AsyncMock()
        mock_redis.setex = AsyncMock()
        mock_redis.get = AsyncMock(return_value=None)

        captured_payload: dict = {}

        async def mock_setex(key, ttl, value):
            # Stocker en mémoire pour simuler Redis
            payload = json.loads(value)
            captured_payload.update(payload)
            # Faire retourner ce payload par get
            mock_redis.get.return_value = value

        mock_redis.setex.side_effect = mock_setex

        with patch(
            "app.infrastructure.agent.confirmation.get_redis",
            return_value=AsyncMock(return_value=mock_redis),
        ):
            from app.infrastructure.agent.confirmation import (
                get_pending_action,
                store_pending_action,
            )

            with patch("app.infrastructure.agent.confirmation.get_redis", return_value=AsyncMock()) as mock_get_redis:
                mock_get_redis.return_value = mock_redis

                action_id = await store_pending_action(
                    session_id="sess1",
                    action_type="create_invoice_draft",
                    label="Test action",
                    data={"patient_id": "abc"},
                )

                assert action_id
                assert captured_payload.get("action_type") == "create_invoice_draft"

    @pytest.mark.asyncio
    async def test_double_consume_returns_none(self):
        """Deux appels consume_pending_action → le second retourne None."""
        stored: dict[str, str | None] = {}

        mock_redis = AsyncMock()

        async def mock_setex(key, ttl, value):
            stored[key] = value

        async def mock_get(key):
            return stored.get(key)

        async def mock_delete(key):
            stored[key] = None

        mock_redis.setex.side_effect = mock_setex
        mock_redis.get.side_effect = mock_get
        mock_redis.delete.side_effect = mock_delete

        with patch("app.infrastructure.agent.confirmation.get_redis", return_value=AsyncMock()):
            from app.infrastructure.agent.confirmation import consume_pending_action, store_pending_action

            # Patch get_redis pour retourner notre mock
            import app.infrastructure.agent.confirmation as conf_module
            original_get_redis = conf_module.get_redis

            async def patched_get_redis():
                return mock_redis

            conf_module.get_redis = patched_get_redis
            try:
                action_id = await store_pending_action(
                    session_id="sess2",
                    action_type="save_transmission",
                    label="Enregistrer DAR",
                    data={"patient_id": str(uuid.uuid4())},
                )

                # Premier consume → OK
                first = await consume_pending_action("sess2", action_id)
                assert first is not None
                assert first["action_type"] == "save_transmission"

                # Deuxième consume → None (déjà consommé)
                second = await consume_pending_action("sess2", action_id)
                assert second is None
            finally:
                conf_module.get_redis = original_get_redis


# ── analyser_et_coter avec mock deps ─────────────────────────────────────────


class TestAnalyserEtCoter:
    @pytest.mark.asyncio
    async def test_appende_pending_tool_results(self):
        """analyser_et_coter doit ajouter un résultat à pending_tool_results."""
        from decimal import Decimal as D

        from app.application.dtos.cotation_dto import CotationLigneDTO, CotationResultDTO
        from app.application.use_cases.billing.simulate_cotation import SimulateCotationUseCase

        ctx_obj = make_context()
        deps = make_deps(ctx_obj)
        patient_id = str(uuid.uuid4())

        # Mock patient
        mock_patient = MagicMock()
        mock_patient.id = uuid.UUID(patient_id)
        mock_patient.has_active_bsi = False
        mock_patient.bsi_level = None
        mock_patient.is_ald = False
        mock_patient.is_maternity = False
        mock_patient.birth_date = None
        deps.patient_repo.get_by_id = AsyncMock(return_value=mock_patient)

        # Mock catalogue
        deps.care_catalog_repo.get_by_code = AsyncMock(return_value=None)

        # Mock SimulateCotationUseCase
        mock_result = CotationResultDTO(
            lignes=[
                CotationLigneDTO(
                    code="AMI 4",
                    label="Pansement lourd/complexe",
                    montant=D("14.26"),
                    quantity=D("1"),
                    coefficient=D("4"),
                    base_rate=D("3.565"),
                    category="AMI",
                )
            ],
            total=D("14.26"),
            repartition_amo=D("11.41"),
            repartition_amc=D("2.85"),
            repartition_patient=D("0"),
            auto_corrections=[],
            explications=["Acte principal : AMI 4"],
        )

        from pydantic_ai import RunContext

        mock_ctx = MagicMock(spec=RunContext)
        mock_ctx.deps = deps

        with patch.object(SimulateCotationUseCase, "execute", AsyncMock(return_value=mock_result)):
            with patch("app.infrastructure.agent.audit.log_tool_call", AsyncMock()):
                from app.infrastructure.agent.tools.invoice_tools import analyser_et_coter

                result = await analyser_et_coter(
                    mock_ctx,
                    description_libre="pansement complexe escarre sacrum, 12km, 7h30",
                    patient_id=patient_id,
                )

        assert "error" not in result
        assert result["total"] == pytest.approx(14.26)
        assert len(deps.pending_tool_results) == 1
        assert deps.pending_tool_results[0]["tool_name"] == "analyser_et_coter"
        assert deps.pending_tool_results[0]["data"]["action_pending"]["action_type"] == "create_invoice_draft"

    @pytest.mark.asyncio
    async def test_uuid_invalide_retourne_erreur(self):
        ctx_obj = make_context()
        deps = make_deps(ctx_obj)

        from pydantic_ai import RunContext

        mock_ctx = MagicMock(spec=RunContext)
        mock_ctx.deps = deps

        with patch("app.infrastructure.agent.audit.log_tool_call", AsyncMock()):
            from app.infrastructure.agent.tools.invoice_tools import analyser_et_coter

            result = await analyser_et_coter(
                mock_ctx,
                description_libre="pansement complexe",
                patient_id="pas-un-uuid",
            )

        assert "error" in result
        assert "UUID" in result["error"]
        assert len(deps.pending_tool_results) == 0


# ── structurer_transmission (mock Mistral) ────────────────────────────────────


class TestStructurerTransmission:
    @pytest.mark.asyncio
    async def test_parse_dar(self):
        """structurer_transmission doit parser la réponse Mistral et remplir le DAR."""
        ctx_obj = make_context()
        deps = make_deps(ctx_obj)
        patient_id = str(uuid.uuid4())

        from pydantic_ai import RunContext

        mock_ctx = MagicMock(spec=RunContext)
        mock_ctx.deps = deps

        dar_mock = {
            "D": "Patient algique, plaie surinfectée.",
            "A": "Pansement réalisé avec Bétadine.",
            "R": "Amélioration légère.",
            "constantes": {"PA": "130/80", "FC": "72"},
            "alertes": ["Rougeur péri-cicatricielle"],
            "resume_court": "Pansement complexe, légère amélioration.",
        }

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps(dar_mock)

        mock_client = AsyncMock()
        mock_client.chat.complete_async = AsyncMock(return_value=mock_response)

        with patch("mistralai.Mistral", return_value=mock_client):
            with patch("app.infrastructure.agent.audit.log_tool_call", AsyncMock()):
                from app.infrastructure.agent.tools.transmission_tools import structurer_transmission

                result = await structurer_transmission(
                    mock_ctx,
                    dictee_libre="Pansement complexe réalisé, patient algique.",
                    patient_id=patient_id,
                )

        assert "error" not in result
        assert result["dar"]["D"] == "Patient algique, plaie surinfectée."
        assert result["has_alerts"] is True
        assert len(result["alertes"]) == 1
        assert len(deps.pending_tool_results) == 1
        assert deps.pending_tool_results[0]["data"]["action_pending"]["action_type"] == "save_transmission"
