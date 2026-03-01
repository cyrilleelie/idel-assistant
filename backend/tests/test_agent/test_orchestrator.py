"""Tests de l'orchestrateur agent IA."""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.infrastructure.agent.context import AgentContext, AgentDeps
from app.infrastructure.agent.orchestrator import AgentOrchestrator


def make_context() -> AgentContext:
    return AgentContext(
        user_id=uuid.uuid4(),
        cabinet_id=uuid.uuid4(),
        role="idel",
        session_id="test-orchestrator-session",
    )


def make_deps(context: AgentContext) -> AgentDeps:
    deps = MagicMock(spec=AgentDeps)
    deps.context = context
    deps.db = AsyncMock()
    deps.pending_tool_results = []  # Iter B : liste mutable attendue par l'orchestrateur
    deps.appointment_repo = AsyncMock()
    deps.invoice_repo = AsyncMock()
    return deps


class TestAgentOrchestrator:
    @pytest.mark.asyncio
    async def test_streaming_yields_tokens_then_end(self):
        """Vérifie que run_streaming génère des tokens JSON puis un message end."""
        context = make_context()
        deps = make_deps(context)

        # Mock de l'agent PydanticAI
        mock_agent = MagicMock()

        # Simuler stream_text(delta=True) qui yield des chunks
        async def fake_stream_text(delta: bool = False):
            yield "Bonjour"
            yield ", je suis"
            yield " votre assistant."

        mock_usage = MagicMock()
        mock_usage.request_tokens = 10
        mock_usage.response_tokens = 20
        mock_usage.total_tokens = 30

        mock_result = MagicMock()
        mock_result.stream_text = fake_stream_text
        mock_result.usage = MagicMock(return_value=mock_usage)

        # run_stream retourne un context manager async
        class FakeContextManager:
            async def __aenter__(self):
                return mock_result

            async def __aexit__(self, *args):
                pass

        mock_agent.run_stream = MagicMock(return_value=FakeContextManager())

        orchestrator = AgentOrchestrator(mock_agent, model_name="mistral-large-latest")

        tokens = []
        end_events = []

        with patch("app.infrastructure.agent.orchestrator.agent_memory.get_history", new=AsyncMock(return_value=[])):
            with patch("app.infrastructure.agent.orchestrator.agent_memory.save_message", new=AsyncMock()):
                async for chunk in orchestrator.run_streaming({"type": "text", "content": "Bonjour"}, deps):
                    data = json.loads(chunk)
                    if data["type"] == "token":
                        tokens.append(data["content"])
                    elif data["type"] == "end":
                        end_events.append(data)

        assert len(tokens) == 3
        assert "".join(tokens) == "Bonjour, je suis votre assistant."
        assert len(end_events) == 1
        assert end_events[0]["usage"]["total_tokens"] == 30

    @pytest.mark.asyncio
    async def test_error_yields_error_event(self):
        """Vérifie qu'une exception de l'agent produit un event error."""
        context = make_context()
        deps = make_deps(context)

        mock_agent = MagicMock()

        class FailContextManager:
            async def __aenter__(self):
                raise RuntimeError("LLM unavailable")

            async def __aexit__(self, *args):
                pass

        mock_agent.run_stream = MagicMock(return_value=FailContextManager())

        orchestrator = AgentOrchestrator(mock_agent, model_name="mistral-large-latest")

        events = []
        with patch("app.infrastructure.agent.orchestrator.agent_memory.get_history", new=AsyncMock(return_value=[])):
            with patch("app.infrastructure.agent.orchestrator.agent_memory.save_message", new=AsyncMock()):
                async for chunk in orchestrator.run_streaming({"type": "text", "content": "test"}, deps):
                    events.append(json.loads(chunk))

        assert any(e["type"] == "error" for e in events)

    @pytest.mark.asyncio
    async def test_history_saved_after_response(self):
        """Vérifie que le message user et la réponse assistant sont sauvegardés en Redis."""
        context = make_context()
        deps = make_deps(context)

        mock_agent = MagicMock()

        async def fake_stream_text(delta: bool = False):
            yield "Réponse"

        mock_usage = MagicMock()
        mock_usage.request_tokens = 5
        mock_usage.response_tokens = 5
        mock_usage.total_tokens = 10

        mock_result = MagicMock()
        mock_result.stream_text = fake_stream_text
        mock_result.usage = MagicMock(return_value=mock_usage)

        class FakeContextManager:
            async def __aenter__(self):
                return mock_result

            async def __aexit__(self, *args):
                pass

        mock_agent.run_stream = MagicMock(return_value=FakeContextManager())

        orchestrator = AgentOrchestrator(mock_agent, model_name="mistral-large-latest")

        save_calls = []

        async def mock_save(session_id, role, content):
            save_calls.append((session_id, role, content))

        with patch("app.infrastructure.agent.orchestrator.agent_memory.get_history", new=AsyncMock(return_value=[])):
            with patch("app.infrastructure.agent.orchestrator.agent_memory.save_message", side_effect=mock_save):
                async for _ in orchestrator.run_streaming({"type": "text", "content": "Ma question"}, deps):
                    pass

        assert len(save_calls) == 2
        assert save_calls[0] == (context.session_id, "user", "Ma question")  # content extrait du dict
        assert save_calls[1][1] == "assistant"
        assert "Réponse" in save_calls[1][2]
