"""Tests unitaires — Providers GPU itération D.

Couvre :
- VLLMLocalProvider (mock HTTP vLLM)
- FasterWhisperLocalSTT (mock HTTP faster-whisper)
- KokoroLocalTTS (mock HTTP Kokoro)
- Factory de providers (create_llm_provider, create_stt_provider, create_tts_provider)
- Health endpoint enrichi (providers, métriques, hds_compliant)
- Métriques de latence (record_latency, get_latency_stats)
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.infrastructure.agent.providers.base import LLMConfig
from app.infrastructure.agent.providers.vllm_local import VLLMLocalProvider
from app.infrastructure.agent.voice.stt_local import FasterWhisperLocalSTT
from app.infrastructure.agent.voice.tts_local import KokoroLocalTTS
from app.infrastructure.agent.metrics import get_latency_stats, record_latency


# ── Helpers ───────────────────────────────────────────────────────────────────


def _make_vllm_config(**overrides) -> LLMConfig:
    defaults = {
        "model_name": "mistral-small-3.1-awq",
        "base_url": "http://10.0.0.5:9000/v1",
        "temperature": 0.1,
        "max_tokens": 2048,
    }
    defaults.update(overrides)
    return LLMConfig(**defaults)


# ── Tests VLLMLocalProvider ──────────────────────────────────────────────────


class TestVLLMLocalProvider:
    def test_is_local_true(self):
        """VLLMLocalProvider.is_local doit être True."""
        provider = VLLMLocalProvider(config=_make_vllm_config())
        assert provider.is_local is True

    def test_get_model_name(self):
        """get_model_name retourne le nom du modèle configuré."""
        provider = VLLMLocalProvider(config=_make_vllm_config(model_name="test-model"))
        assert provider.get_model_name() == "test-model"

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Mock GET /v1/models → health_check() retourne True."""
        provider = VLLMLocalProvider(config=_make_vllm_config())

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": [{"id": "mistral-small-3.1-awq"}]}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await provider.health_check()
            assert result is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """health_check retourne False si vLLM n'est pas accessible."""
        provider = VLLMLocalProvider(config=_make_vllm_config())

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=Exception("Connection refused"))
            mock_client_cls.return_value = mock_client

            result = await provider.health_check()
            assert result is False

    @pytest.mark.asyncio
    async def test_health_check_empty_models(self):
        """health_check retourne False si aucun modèle n'est chargé."""
        provider = VLLMLocalProvider(config=_make_vllm_config())

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"data": []}

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await provider.health_check()
            assert result is False

    def test_get_pydantic_ai_model(self):
        """get_pydantic_ai_model retourne un OpenAIModel configuré."""
        provider = VLLMLocalProvider(config=_make_vllm_config())
        model = provider.get_pydantic_ai_model()
        assert model is not None


# ── Tests FasterWhisperLocalSTT ──────────────────────────────────────────────


class TestFasterWhisperLocalSTT:
    def test_is_local_true(self):
        """FasterWhisperLocalSTT.is_local doit être True."""
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")
        assert stt.is_local is True

    def test_provider_name(self):
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")
        assert stt.provider_name == "faster_whisper_local"

    @pytest.mark.asyncio
    async def test_transcribe_empty_audio(self):
        """Audio vide ou trop court retourne un résultat vide."""
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")
        result = await stt.transcribe(b"")
        assert result.text == ""
        assert result.confidence == 0.0
        assert result.provider == "faster_whisper_local"

    @pytest.mark.asyncio
    async def test_transcribe_short_audio(self):
        """Audio < 200 bytes retourne un résultat vide."""
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")
        result = await stt.transcribe(b"\x00" * 100)
        assert result.text == ""

    @pytest.mark.asyncio
    async def test_transcribe_success(self):
        """Mock POST /transcribe → TranscriptionResult avec texte et confiance."""
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "text": "Pansement simple pour M. Dupont",
            "language": "fr",
            "confidence": 0.95,
            "duration_seconds": 5.2,
        }

        stt._client = AsyncMock()
        stt._client.post = AsyncMock(return_value=mock_response)

        audio_data = b"\x00" * 1000
        result = await stt.transcribe(audio_data, language="fr")

        assert result.text == "Pansement simple pour M. Dupont"
        assert result.language == "fr"
        assert result.confidence == 0.95
        assert result.duration_seconds == 5.2
        assert result.provider == "faster_whisper_local"

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Mock GET /health/whisper → True."""
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")

        mock_response = MagicMock()
        mock_response.status_code = 200

        stt._client = AsyncMock()
        stt._client.get = AsyncMock(return_value=mock_response)

        result = await stt.health_check()
        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """health_check retourne False si le service est inaccessible."""
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")

        stt._client = AsyncMock()
        stt._client.get = AsyncMock(side_effect=Exception("Connection refused"))

        result = await stt.health_check()
        assert result is False


# ── Tests KokoroLocalTTS ─────────────────────────────────────────────────────


class TestKokoroLocalTTS:
    def test_is_local_true(self):
        """KokoroLocalTTS.is_local doit être True."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        assert tts.is_local is True

    def test_provider_name(self):
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        assert tts.provider_name == "kokoro_local"

    def test_clean_for_tts_removes_emojis(self):
        """_clean_for_tts supprime les emojis et symboles."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        result = tts._clean_for_tts("Bonjour ✓ le monde ❌")
        assert "✓" not in result
        assert "❌" not in result
        assert "Bonjour" in result

    def test_clean_for_tts_expands_ngap(self):
        """_clean_for_tts développe les abréviations NGAP."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        result = tts._clean_for_tts("BSI pour le patient")
        assert "B S I" in result

    def test_clean_for_tts_removes_markdown(self):
        """_clean_for_tts supprime le markdown."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        result = tts._clean_for_tts("**gras** et *italique*")
        assert "**" not in result
        assert "gras" in result

    @pytest.mark.asyncio
    async def test_synthesize_empty_text(self):
        """Texte vide ne génère aucun chunk."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        chunks = []
        async for chunk in tts.synthesize(""):
            chunks.append(chunk)
        assert chunks == []

    @pytest.mark.asyncio
    async def test_synthesize_emoji_only_text(self):
        """Texte composé uniquement d'emojis → aucun chunk."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")
        chunks = []
        async for chunk in tts.synthesize("✓✗⚠️❌"):
            chunks.append(chunk)
        assert chunks == []

    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Mock GET /health/kokoro → True."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")

        mock_response = MagicMock()
        mock_response.status_code = 200

        tts._client = AsyncMock()
        tts._client.get = AsyncMock(return_value=mock_response)

        result = await tts.health_check()
        assert result is True

    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """health_check retourne False si le service est inaccessible."""
        tts = KokoroLocalTTS(base_url="http://10.0.0.5:9000")

        tts._client = AsyncMock()
        tts._client.get = AsyncMock(side_effect=Exception("Connection refused"))

        result = await tts.health_check()
        assert result is False


# ── Tests Factory ────────────────────────────────────────────────────────────


class TestProviderFactory:
    def test_create_llm_provider_vllm_local(self):
        """LLM_PROVIDER=vllm_local → factory retourne VLLMLocalProvider."""
        from app.infrastructure.agent.factory import create_llm_provider

        mock_settings = MagicMock()
        mock_settings.llm_provider = "vllm_local"
        mock_settings.llm_model_name = "mistral-small-3.1-awq"
        mock_settings.llm_base_url = "https://api.mistral.ai/v1"
        mock_settings.llm_temperature = 0.1
        mock_settings.llm_max_tokens = 2048
        mock_settings.gpu_base_url = "http://10.0.0.5:9000"
        mock_settings.vllm_base_url = ""

        provider = create_llm_provider(mock_settings)
        assert isinstance(provider, VLLMLocalProvider)
        assert provider.is_local is True

    def test_create_llm_provider_mistral_cloud(self):
        """LLM_PROVIDER=mistral_cloud → factory retourne MistralCloudProvider."""
        from app.infrastructure.agent.factory import create_llm_provider
        from app.infrastructure.agent.providers.mistral_cloud import MistralCloudProvider

        mock_settings = MagicMock()
        mock_settings.llm_provider = "mistral_cloud"
        mock_settings.llm_model_name = "mistral-large-latest"
        mock_settings.llm_base_url = "https://api.mistral.ai/v1"
        mock_settings.llm_temperature = 0.1
        mock_settings.llm_max_tokens = 2048
        mock_settings.mistral_api_key = "test-key"

        provider = create_llm_provider(mock_settings)
        assert isinstance(provider, MistralCloudProvider)

    def test_create_llm_provider_unknown_raises(self):
        """Provider inconnu → ValueError."""
        from app.infrastructure.agent.factory import create_llm_provider

        mock_settings = MagicMock()
        mock_settings.llm_provider = "unknown_provider"

        with pytest.raises(ValueError, match="Provider LLM inconnu"):
            create_llm_provider(mock_settings)

    def test_create_stt_provider_faster_whisper_local(self):
        """STT_PROVIDER=faster_whisper_local → factory retourne FasterWhisperLocalSTT."""
        from app.infrastructure.agent.factory import create_stt_provider

        mock_settings = MagicMock()
        mock_settings.stt_provider = "faster_whisper_local"
        mock_settings.gpu_base_url = "http://10.0.0.5:9000"
        mock_settings.whisper_local_url = ""

        provider = create_stt_provider(mock_settings)
        assert isinstance(provider, FasterWhisperLocalSTT)
        assert provider.is_local is True

    def test_create_stt_provider_whisper_cloud(self):
        """STT_PROVIDER=whisper_cloud → factory retourne WhisperCloudSTT."""
        from app.infrastructure.agent.factory import create_stt_provider
        from app.infrastructure.agent.voice.stt_whisper_cloud import WhisperCloudSTT

        mock_settings = MagicMock()
        mock_settings.stt_provider = "whisper_cloud"
        mock_settings.openai_api_key = "test-key"

        provider = create_stt_provider(mock_settings)
        assert isinstance(provider, WhisperCloudSTT)
        assert provider.is_local is False

    def test_create_tts_provider_kokoro_local(self):
        """TTS_PROVIDER=kokoro_local → factory retourne KokoroLocalTTS."""
        from app.infrastructure.agent.factory import create_tts_provider

        mock_settings = MagicMock()
        mock_settings.tts_enabled = True
        mock_settings.tts_provider = "kokoro_local"
        mock_settings.gpu_base_url = "http://10.0.0.5:9000"
        mock_settings.kokoro_local_url = ""

        provider = create_tts_provider(mock_settings)
        assert isinstance(provider, KokoroLocalTTS)
        assert provider.is_local is True

    def test_create_tts_provider_disabled(self):
        """TTS désactivé → None."""
        from app.infrastructure.agent.factory import create_tts_provider

        mock_settings = MagicMock()
        mock_settings.tts_enabled = False

        provider = create_tts_provider(mock_settings)
        assert provider is None


# ── Tests Métriques ──────────────────────────────────────────────────────────


class TestMetrics:
    @pytest.mark.asyncio
    async def test_record_latency_stores_in_redis(self):
        """record_latency stocke une entrée dans Redis."""
        mock_redis = AsyncMock()
        mock_redis.lpush = AsyncMock()
        mock_redis.ltrim = AsyncMock()
        mock_redis.expire = AsyncMock()

        await record_latency(mock_redis, "ttft_ms", 120.5)

        mock_redis.lpush.assert_called_once()
        call_args = mock_redis.lpush.call_args
        assert call_args[0][0] == "agent:metrics:ttft_ms"
        entry = json.loads(call_args[0][1])
        assert entry["value"] == 120.5

    @pytest.mark.asyncio
    async def test_get_latency_stats_computes_percentiles(self):
        """100 mesures → p95 calculé correctement."""
        mock_redis = AsyncMock()

        # Génère 100 mesures de 1 à 100
        entries = [json.dumps({"ts": 1000 + i, "value": float(i + 1)}) for i in range(100)]

        async def mock_lrange(key, start, end):
            if "ttft_ms" in key:
                return entries
            return []

        mock_redis.lrange = mock_lrange
        mock_redis.get = AsyncMock(return_value=b"42")

        stats = await get_latency_stats(mock_redis)

        assert stats["ttft_ms"]["count"] == 100
        assert stats["ttft_ms"]["mean"] == 50.5
        assert stats["ttft_ms"]["p95"] == 96.0  # index 95 → value 96
        assert stats["sessions_today"] == 42

    @pytest.mark.asyncio
    async def test_get_latency_stats_empty(self):
        """Aucune mesure → mean=None, count=0."""
        mock_redis = AsyncMock()
        mock_redis.lrange = AsyncMock(return_value=[])
        mock_redis.get = AsyncMock(return_value=None)

        stats = await get_latency_stats(mock_redis)

        assert stats["ttft_ms"]["mean"] is None
        assert stats["ttft_ms"]["count"] == 0
        assert stats["sessions_today"] == 0


# ── Tests Health Endpoint (intégration légère) ───────────────────────────────


class TestHealthEndpointGPU:
    @pytest.mark.asyncio
    async def test_hds_compliant_when_all_local(self):
        """hds_compliant=True quand LLM + STT sont is_local=True."""
        llm = VLLMLocalProvider(config=_make_vllm_config())
        stt = FasterWhisperLocalSTT(base_url="http://10.0.0.5:9000")

        assert llm.is_local is True
        assert stt.is_local is True
        # hds_compliant = llm.is_local and stt.is_local
        assert (llm.is_local and stt.is_local) is True

    @pytest.mark.asyncio
    async def test_hds_not_compliant_when_cloud_stt(self):
        """hds_compliant=False si STT_PROVIDER=whisper_cloud."""
        from app.infrastructure.agent.voice.stt_whisper_cloud import WhisperCloudSTT

        llm = VLLMLocalProvider(config=_make_vllm_config())
        # WhisperCloudSTT requiert une API key
        with patch.object(WhisperCloudSTT, "__init__", lambda self, **kwargs: None):
            stt = WhisperCloudSTT.__new__(WhisperCloudSTT)
            # is_local est une property, pas besoin de mock
            assert stt.is_local is False
            assert (llm.is_local and stt.is_local) is False
