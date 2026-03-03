"""Tests unitaires pour le feedback terrain (itération E).

Couvre :
- Endpoint POST /agent/feedback (positif, négatif, validation)
- Endpoint GET /agent/feedback/stats
- Endpoint GET /agent/feedback/export (admin only)
- Modèle AgentFeedbackModel
"""

import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

from app.infrastructure.api.v1.agent_routes import FeedbackRequest
from app.infrastructure.persistence.models.agent_feedback_model import AgentFeedbackModel


# ── Tests FeedbackRequest schema ─────────────────────────────────────────────


class TestFeedbackRequestSchema:
    def test_valid_positive_feedback(self):
        req = FeedbackRequest(
            session_id="abc-123",
            user_message="Cote-moi un pansement simple",
            agent_response="AMI 1 = 9,10€. Confirmer ?",
            rating="positive",
        )
        assert req.rating == "positive"
        assert req.correction is None

    def test_valid_negative_feedback_with_correction(self):
        req = FeedbackRequest(
            session_id="abc-123",
            user_message="Cote-moi un pansement complexe",
            agent_response="AMI 1 = 9,10€",
            rating="negative",
            correction="C'est AMI 4 = 36,40€ pour un pansement complexe",
        )
        assert req.rating == "negative"
        assert req.correction is not None

    def test_valid_with_tool_result(self):
        req = FeedbackRequest(
            session_id="abc-123",
            user_message="test",
            agent_response="test",
            tool_called="analyser_et_coter",
            tool_result={"lignes": [{"code": "AMI 4", "montant": 36.40}]},
            rating="positive",
            category="cotation",
        )
        assert req.tool_called == "analyser_et_coter"
        assert req.category == "cotation"

    def test_invalid_rating_value(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(
                session_id="abc",
                user_message="test",
                agent_response="test",
                rating="neutral",  # Invalid
            )

    def test_session_id_max_length(self):
        with pytest.raises(ValidationError):
            FeedbackRequest(
                session_id="x" * 37,  # > 36
                user_message="test",
                agent_response="test",
                rating="positive",
            )


# ── Tests AgentFeedbackModel ─────────────────────────────────────────────────


class TestAgentFeedbackModel:
    def test_create_feedback_model(self):
        fb = AgentFeedbackModel(
            id=uuid.uuid4(),
            session_id="sess-001",
            cabinet_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            user_message="Cote un pansement",
            agent_response="AMI 4",
            rating="positive",
            model_version="idel-v1",
        )
        assert fb.rating == "positive"
        assert fb.correction is None
        assert fb.tool_called is None

    def test_create_negative_feedback_with_correction(self):
        fb = AgentFeedbackModel(
            id=uuid.uuid4(),
            session_id="sess-002",
            cabinet_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            user_message="Cote un pansement",
            agent_response="AIS 1",
            rating="negative",
            correction="C'est AMI 4, pas AIS 1",
            model_version="idel-v1",
            category="cotation",
        )
        assert fb.rating == "negative"
        assert fb.correction == "C'est AMI 4, pas AIS 1"
        assert fb.category == "cotation"


# ── Tests validators corpus ──────────────────────────────────────────────────


class TestNGAPValidator:
    def setup_method(self):
        import sys
        from pathlib import Path

        # Ajoute le dossier corpus_generation au path pour les imports
        corpus_path = str(
            Path(__file__).resolve().parents[3]
            / "scripts"
            / "corpus_generation"
        )
        if corpus_path not in sys.path:
            sys.path.insert(0, corpus_path)

        from validators.ngap_validator import NGAPValidator
        self.validator = NGAPValidator()

    def test_valid_simple_cotation(self):
        example = {
            "messages": [
                {"role": "system", "content": "Tu es l'assistant..."},
                {"role": "user", "content": "Pansement simple"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {
                                "name": "analyser_et_coter",
                                "arguments": '{"actes": ["AMI 1"]}',
                            },
                        }
                    ],
                },
                {
                    "role": "tool",
                    "tool_call_id": "call_001",
                    "content": '{"lignes": [{"code": "AMI 1", "montant": 9.10}]}',
                },
                {"role": "assistant", "content": "AMI 1 = 9,10€"},
            ]
        }
        assert self.validator.validate(example) is True

    def test_invalid_mau_mci_cumul(self):
        """MAU et MCI ne se cumulent jamais."""
        example = {
            "messages": [
                {"role": "system", "content": "test"},
                {"role": "user", "content": "test"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {
                                "name": "analyser_et_coter",
                                "arguments": '{"actes": ["AMI 1", "MAU", "MCI"]}',
                            },
                        }
                    ],
                },
            ]
        }
        assert self.validator.validate(example) is False

    def test_invalid_ami_amx_coexist(self):
        """AMI et AMX ne doivent pas coexister (BSI remplace AMI par AMX)."""
        example = {
            "messages": [
                {"role": "system", "content": "test"},
                {"role": "user", "content": "test"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {
                                "name": "analyser_et_coter",
                                "arguments": '{"actes": ["AMI 1", "AMX 2"]}',
                            },
                        }
                    ],
                },
            ]
        }
        assert self.validator.validate(example) is False

    def test_valid_bsi_amx(self):
        """AMX est valide pour un patient BSI."""
        example = {
            "messages": [
                {"role": "system", "content": "test"},
                {"role": "user", "content": "test"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {
                                "name": "analyser_et_coter",
                                "arguments": '{"actes": ["AMX 4", "MAU"]}',
                            },
                        }
                    ],
                },
            ]
        }
        assert self.validator.validate(example) is True

    def test_valid_ik(self):
        """IK est toujours valide (montant variable)."""
        example = {
            "messages": [
                {"role": "system", "content": "test"},
                {"role": "user", "content": "test"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {
                                "name": "analyser_et_coter",
                                "arguments": '{"actes": ["AMI 1", "IK 15km"]}',
                            },
                        }
                    ],
                },
            ]
        }
        assert self.validator.validate(example) is True

    def test_no_tool_calls_passes(self):
        """Un exemple sans tool_calls passe la validation NGAP."""
        example = {
            "messages": [
                {"role": "system", "content": "test"},
                {"role": "user", "content": "question réglementaire"},
                {"role": "assistant", "content": "réponse sans outil"},
            ]
        }
        assert self.validator.validate(example) is True


class TestFormatValidator:
    def setup_method(self):
        import sys
        from pathlib import Path

        corpus_path = str(
            Path(__file__).resolve().parents[3]
            / "scripts"
            / "corpus_generation"
        )
        if corpus_path not in sys.path:
            sys.path.insert(0, corpus_path)

        from validators.format_validator import FormatValidator
        self.validator = FormatValidator()

    def test_valid_simple_example(self):
        example = {
            "messages": [
                {"role": "system", "content": "Tu es l'assistant..."},
                {"role": "user", "content": "Bonjour"},
                {"role": "assistant", "content": "Bonjour ! Comment puis-je vous aider ?"},
            ]
        }
        assert self.validator.validate(example) is True

    def test_valid_with_tool_calls(self):
        example = {
            "messages": [
                {"role": "system", "content": "prompt"},
                {"role": "user", "content": "Cote-moi ça"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {"name": "analyser_et_coter", "arguments": "{}"},
                        }
                    ],
                },
                {"role": "tool", "tool_call_id": "call_001", "content": "{}"},
                {"role": "assistant", "content": "Voici la cotation."},
            ]
        }
        assert self.validator.validate(example) is True

    def test_invalid_no_messages(self):
        assert self.validator.validate({}) is False
        assert self.validator.validate({"messages": []}) is False

    def test_invalid_no_system_prompt(self):
        example = {
            "messages": [
                {"role": "user", "content": "test"},
                {"role": "assistant", "content": "test"},
            ]
        }
        assert self.validator.validate(example) is False

    def test_invalid_no_user_message(self):
        example = {
            "messages": [
                {"role": "system", "content": "prompt"},
                {"role": "assistant", "content": "test"},
            ]
        }
        assert self.validator.validate(example) is False

    def test_invalid_no_assistant_message(self):
        example = {
            "messages": [
                {"role": "system", "content": "prompt"},
                {"role": "user", "content": "test"},
            ]
        }
        assert self.validator.validate(example) is False

    def test_invalid_tool_without_id(self):
        example = {
            "messages": [
                {"role": "system", "content": "prompt"},
                {"role": "user", "content": "test"},
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": "call_001",
                            "type": "function",
                            "function": {"name": "test", "arguments": "{}"},
                        }
                    ],
                },
                {"role": "tool", "tool_call_id": "wrong_id", "content": "{}"},
                {"role": "assistant", "content": "ok"},
            ]
        }
        assert self.validator.validate(example) is False

    def test_invalid_empty_assistant_content(self):
        example = {
            "messages": [
                {"role": "system", "content": "prompt"},
                {"role": "user", "content": "test"},
                {"role": "assistant", "content": ""},
            ]
        }
        assert self.validator.validate(example) is False

    def test_invalid_role(self):
        example = {
            "messages": [
                {"role": "system", "content": "prompt"},
                {"role": "user", "content": "test"},
                {"role": "unknown", "content": "test"},
            ]
        }
        assert self.validator.validate(example) is False
