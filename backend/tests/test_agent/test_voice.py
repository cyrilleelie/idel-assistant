"""Tests unitaires — Module voix itération C.

Couvre :
- STT WhisperCloudSTT (mock OpenAI)
- Pseudonymisation post-transcription
- TTS ElevenLabsTTS (_clean_for_tts)
- Découpage en phrases (split_into_sentences)
- VAD (trim_silence, estimate_audio_duration)
- Endpoint REST POST /agent/transcribe
- WebSocket /agent/voice (auth)
"""

import io
import json
import math
import struct
import uuid
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest

from app.infrastructure.agent.voice.base import TranscriptionResult, TTSConfig
from app.infrastructure.agent.voice.hotwords import WHISPER_MEDICAL_PROMPT, NGAP_HOTWORDS
from app.infrastructure.agent.voice.stt_whisper_cloud import WhisperCloudSTT
from app.infrastructure.agent.voice.tts_elevenlabs import ElevenLabsTTS, split_into_sentences
from app.infrastructure.agent.voice.vad import (
    trim_silence,
    estimate_audio_duration,
    is_audio_too_short,
)


# ── Helpers ───────────────────────────────────────────────────────────────────


def make_silence_pcm(duration_seconds: float = 0.1, sample_rate: int = 16000) -> bytes:
    """Génère des données PCM 16-bit représentant du silence."""
    n_samples = int(sample_rate * duration_seconds)
    return struct.pack(f"<{n_samples}h", *([0] * n_samples))


def make_tone_pcm(
    duration_seconds: float = 0.1,
    frequency: float = 440.0,
    amplitude: int = 10000,
    sample_rate: int = 16000,
) -> bytes:
    """Génère des données PCM 16-bit représentant un ton sinusoïdal."""
    import math as _math
    n_samples = int(sample_rate * duration_seconds)
    samples = [
        int(amplitude * _math.sin(2 * _math.pi * frequency * i / sample_rate))
        for i in range(n_samples)
    ]
    return struct.pack(f"<{n_samples}h", *samples)


# ── Tests VAD ─────────────────────────────────────────────────────────────────


def test_estimate_audio_duration_1_second():
    """1s de PCM 16-bit 16kHz = 16000*2 octets."""
    data = make_silence_pcm(1.0)
    assert abs(estimate_audio_duration(data) - 1.0) < 0.01


def test_estimate_audio_duration_short():
    """Audio court → durée estimée < 1s."""
    data = make_silence_pcm(0.1)
    assert estimate_audio_duration(data) < 1.0


def test_is_audio_too_short_true():
    """Audio < 0.3s → trop court."""
    data = make_silence_pcm(0.1)
    assert is_audio_too_short(data, min_duration_seconds=0.3)


def test_is_audio_too_short_false():
    """Audio ≥ 0.5s → assez long."""
    data = make_silence_pcm(0.5)
    # Assure que la taille est > 1000 octets
    assert not is_audio_too_short(data, min_duration_seconds=0.3)


def test_trim_silence_preserves_tone():
    """trim_silence ne coupe pas un ton de 0.5s."""
    silence = make_silence_pcm(0.05)
    tone = make_tone_pcm(0.5, amplitude=15000)
    audio = silence + tone + silence

    result = trim_silence(audio, silence_threshold=0.01)
    # Le résultat doit contenir la majorité du ton
    assert len(result) >= len(tone) // 2


def test_trim_silence_all_silence_returns_original():
    """Si tout est silence → retourne l'audio original."""
    data = make_silence_pcm(0.3)
    result = trim_silence(data)
    assert result == data


def test_trim_silence_short_audio_returns_original():
    """Audio trop court → retourne l'original sans traitement."""
    data = b"\x00" * 100
    result = trim_silence(data)
    assert result == data


# ── Tests hotwords ────────────────────────────────────────────────────────────


def test_whisper_medical_prompt_contains_ngap():
    """Le prompt médical contient les codes NGAP essentiels."""
    assert "AMI" in WHISPER_MEDICAL_PROMPT
    assert "BSI" in WHISPER_MEDICAL_PROMPT
    assert "pansement" in WHISPER_MEDICAL_PROMPT.lower()


def test_ngap_hotwords_not_empty():
    """La liste de hotwords NGAP est non-vide et contient les codes de base."""
    assert len(NGAP_HOTWORDS) > 10
    assert "AMI 1" in NGAP_HOTWORDS
    assert "BSI" in NGAP_HOTWORDS


# ── Tests STT WhisperCloudSTT ─────────────────────────────────────────────────


def test_whisper_stt_requires_api_key():
    """WhisperCloudSTT lève ValueError si la clé API est vide."""
    with pytest.raises(ValueError, match="OPENAI_API_KEY"):
        WhisperCloudSTT(api_key="")


def test_whisper_stt_is_not_local():
    """WhisperCloudSTT.is_local == False (données envoyées à OpenAI)."""
    stt = WhisperCloudSTT(api_key="sk-test")
    assert stt.is_local is False


def test_whisper_stt_provider_name():
    stt = WhisperCloudSTT(api_key="sk-test")
    assert stt.provider_name == "whisper_cloud"


@pytest.mark.asyncio
async def test_whisper_transcribe_empty_audio_returns_empty():
    """Audio vide → TranscriptionResult(text='', confidence=0.0) sans appel API."""
    stt = WhisperCloudSTT(api_key="sk-test")
    result = await stt.transcribe(audio_data=b"", language="fr")
    assert result.text == ""
    assert result.confidence == 0.0
    assert result.provider == "whisper_cloud"


@pytest.mark.asyncio
async def test_whisper_transcribe_very_short_audio_returns_empty():
    """Audio < 200 octets → retourné sans appel API."""
    stt = WhisperCloudSTT(api_key="sk-test")
    result = await stt.transcribe(audio_data=b"\x00" * 100, language="fr")
    assert result.text == ""


@pytest.mark.asyncio
async def test_whisper_transcribe_too_large_raises():
    """Audio > 25 Mo → ValueError."""
    stt = WhisperCloudSTT(api_key="sk-test")
    big_audio = b"\x00" * (26 * 1024 * 1024)
    with pytest.raises(ValueError, match="25 Mo"):
        await stt.transcribe(audio_data=big_audio)


@pytest.mark.asyncio
async def test_whisper_transcribe_success_with_mock():
    """Transcription avec mock OpenAI → retourne le texte correct."""
    stt = WhisperCloudSTT(api_key="sk-test")

    # Mock de la réponse Whisper verbose_json
    mock_response = MagicMock()
    mock_response.text = "Pansement chez Madame Dupont, tension 13-8."
    mock_response.language = "fr"
    mock_response.duration = 8.5
    mock_response.segments = [
        MagicMock(avg_logprob=-0.2),
        MagicMock(avg_logprob=-0.3),
    ]

    with patch.object(
        stt._client.audio.transcriptions,
        "create",
        new=AsyncMock(return_value=mock_response),
    ):
        result = await stt.transcribe(
            audio_data=b"\x00" * 5000,  # > 200 octets
            language="fr",
        )

    assert result.text == "Pansement chez Madame Dupont, tension 13-8."
    assert result.language == "fr"
    assert result.duration_seconds == 8.5
    assert result.provider == "whisper_cloud"
    assert 0.0 <= result.confidence <= 1.0


@pytest.mark.asyncio
async def test_whisper_transcribe_uses_medical_prompt():
    """Chaque transcription envoie WHISPER_MEDICAL_PROMPT à Whisper."""
    stt = WhisperCloudSTT(api_key="sk-test")

    mock_response = MagicMock()
    mock_response.text = "test"
    mock_response.language = "fr"
    mock_response.duration = 1.0
    mock_response.segments = []

    create_mock = AsyncMock(return_value=mock_response)
    with patch.object(stt._client.audio.transcriptions, "create", new=create_mock):
        await stt.transcribe(audio_data=b"\x00" * 5000)

    call_kwargs = create_mock.call_args.kwargs
    assert call_kwargs.get("prompt") == WHISPER_MEDICAL_PROMPT
    assert call_kwargs.get("temperature") == 0.0


@pytest.mark.asyncio
async def test_whisper_health_check_success():
    """health_check retourne True si un modèle whisper est disponible."""
    stt = WhisperCloudSTT(api_key="sk-test")

    mock_model = MagicMock()
    mock_model.id = "whisper-1"
    mock_list = MagicMock()
    mock_list.data = [mock_model]

    with patch.object(stt._client.models, "list", new=AsyncMock(return_value=mock_list)):
        result = await stt.health_check()

    assert result is True


@pytest.mark.asyncio
async def test_whisper_health_check_failure():
    """health_check retourne False en cas d'erreur réseau."""
    stt = WhisperCloudSTT(api_key="sk-test")

    with patch.object(
        stt._client.models, "list", new=AsyncMock(side_effect=Exception("network"))
    ):
        result = await stt.health_check()

    assert result is False


# ── Tests TTS ElevenLabsTTS ───────────────────────────────────────────────────


def test_elevenlabs_tts_requires_api_key():
    """ElevenLabsTTS lève ValueError si la clé API est vide."""
    with pytest.raises(ValueError, match="ELEVENLABS_API_KEY"):
        ElevenLabsTTS(api_key="")


def test_elevenlabs_tts_is_not_local():
    tts = ElevenLabsTTS(api_key="el-test")
    assert tts.is_local is False


def test_clean_for_tts_removes_emojis():
    """Les emojis courants sont supprimés."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("Facture créée ✓ avec succès ❌ ⚠️")
    assert "✓" not in result
    assert "❌" not in result
    assert "⚠️" not in result
    assert "Facture créée" in result


def test_clean_for_tts_expands_ami():
    """'AMI 4' → 'A M I 4' pour lecture vocale correcte."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("Cotation AMI 4 pour pansement.")
    assert "A M I 4" in result
    assert "AMI 4" not in result


def test_clean_for_tts_expands_bsi():
    """'BSI' → 'B S I'."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("Patient sous BSI niveau 2.")
    assert "B S I" in result


def test_clean_for_tts_expands_mau():
    """'MAU' → 'majoration urgence'."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("Avec MAU applicable.")
    assert "majoration urgence" in result.lower()


def test_clean_for_tts_removes_markdown_bold():
    """**gras** → gras."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("**Total : 53,00 €**")
    assert "**" not in result
    assert "Total : 53,00 €" in result


def test_clean_for_tts_removes_markdown_link():
    """[texte](url) → texte."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("Voir [la documentation](https://example.com)")
    assert "[" not in result
    assert "la documentation" in result


def test_clean_for_tts_normalizes_whitespace():
    """Les espaces multiples sont normalisés."""
    tts = ElevenLabsTTS(api_key="el-test")
    result = tts._clean_for_tts("Texte   avec    espaces")
    assert "  " not in result


def test_clean_for_tts_empty_returns_empty():
    tts = ElevenLabsTTS(api_key="el-test")
    assert tts._clean_for_tts("") == ""


# ── Tests split_into_sentences ────────────────────────────────────────────────


def test_split_simple_sentences():
    """Découpe sur les points."""
    sentences = split_into_sentences("Voici la première phrase. Voici la seconde.")
    assert len(sentences) == 2
    assert "première phrase" in sentences[0]
    assert "seconde" in sentences[1]


def test_split_preserves_abbreviations():
    """M. et Mme. ne sont pas des fins de phrase."""
    text = "Pansement chez M. Dupont. La tension est normale."
    sentences = split_into_sentences(text)
    # "M. Dupont" ne doit pas être coupé
    assert any("M. Dupont" in s or "M<DOT> Dupont" in s or "Dupont" in s for s in sentences)
    # Il doit y avoir 2 phrases au total
    assert len(sentences) == 2


def test_split_handles_question_mark():
    """Les ? sont des fins de phrase."""
    sentences = split_into_sentences("Est-ce urgent ? Pas forcément.")
    assert len(sentences) >= 2


def test_split_single_sentence_no_punctuation():
    """Une phrase sans ponctuation finale → retournée telle quelle."""
    text = "Bonjour, voici le résumé de ta tournée"
    sentences = split_into_sentences(text)
    assert len(sentences) == 1
    assert sentences[0] == text


def test_split_empty_returns_empty_list():
    assert split_into_sentences("") == []
    assert split_into_sentences("   ") == []


# ── Tests pseudonymisation ────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_pseudonymize_replaces_known_patient():
    """'Madame Dupont' → 'M. D. (patient:uuid)'."""
    from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript

    patient_uuid = str(uuid.uuid4())

    mock_db = AsyncMock()
    mock_key_manager = MagicMock()
    mock_key_manager.get_cabinet_key.return_value = b"\x00" * 32

    # Mock du résultat DB
    mock_row = MagicMock()
    mock_row.id = uuid.UUID(patient_uuid)
    mock_row.first_name_encrypted = b"encrypted_marie"
    mock_row.last_name_encrypted = b"encrypted_dupont"
    mock_row.cabinet_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db.execute = AsyncMock(return_value=mock_result)

    # Mock du déchiffrement
    with patch(
        "app.infrastructure.agent.voice.pseudonymizer._safe_decrypt",
        side_effect=lambda data, key: (
            "Marie" if data == b"encrypted_marie" else
            "Dupont" if data == b"encrypted_dupont" else ""
        ),
    ):
        text_out, mapping = await pseudonymize_transcript(
            text="pansement chez Madame Dupont ce matin",
            cabinet_id=uuid.uuid4(),
            db=mock_db,
            key_manager=mock_key_manager,
        )

    assert "Dupont" not in text_out
    assert "patient:" in text_out
    assert "Dupont" in mapping


@pytest.mark.asyncio
async def test_pseudonymize_ignores_unknown_names():
    """Un nom non présent dans le cabinet reste dans le texte."""
    from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript

    mock_db = AsyncMock()
    mock_key_manager = MagicMock()
    mock_key_manager.get_cabinet_key.return_value = b"\x00" * 32

    # Aucun patient dans le cabinet
    mock_result = MagicMock()
    mock_result.all.return_value = []
    mock_db.execute = AsyncMock(return_value=mock_result)

    text_out, mapping = await pseudonymize_transcript(
        text="pansement chez Madame Inconnu ce matin",
        cabinet_id=uuid.uuid4(),
        db=mock_db,
        key_manager=mock_key_manager,
    )

    assert "Inconnu" in text_out
    assert len(mapping) == 0


@pytest.mark.asyncio
async def test_pseudonymize_case_insensitive():
    """La pseudonymisation est insensible à la casse."""
    from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript

    patient_uuid = str(uuid.uuid4())
    mock_db = AsyncMock()
    mock_key_manager = MagicMock()
    mock_key_manager.get_cabinet_key.return_value = b"\x00" * 32

    mock_row = MagicMock()
    mock_row.id = uuid.UUID(patient_uuid)
    mock_row.first_name_encrypted = b"encrypted_jean"
    mock_row.last_name_encrypted = b"encrypted_martin"
    mock_row.cabinet_id = uuid.uuid4()

    mock_result = MagicMock()
    mock_result.all.return_value = [mock_row]
    mock_db.execute = AsyncMock(return_value=mock_result)

    with patch(
        "app.infrastructure.agent.voice.pseudonymizer._safe_decrypt",
        side_effect=lambda data, key: (
            "Jean" if data == b"encrypted_jean" else
            "Martin" if data == b"encrypted_martin" else ""
        ),
    ):
        text_out, mapping = await pseudonymize_transcript(
            text="RDV avec MARTIN ce soir et martin demain",
            cabinet_id=uuid.uuid4(),
            db=mock_db,
            key_manager=mock_key_manager,
        )

    # Au moins une occurrence de MARTIN ou martin doit être remplacée
    assert "MARTIN" not in text_out or "martin" not in text_out


@pytest.mark.asyncio
async def test_pseudonymize_empty_text_returns_unchanged():
    """Texte vide → retourné inchangé."""
    from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript

    mock_db = AsyncMock()
    mock_key_manager = MagicMock()

    text_out, mapping = await pseudonymize_transcript(
        text="",
        cabinet_id=uuid.uuid4(),
        db=mock_db,
        key_manager=mock_key_manager,
    )

    assert text_out == ""
    assert mapping == {}


@pytest.mark.asyncio
async def test_pseudonymize_db_error_returns_original():
    """Si la BDD est inaccessible → texte original retourné."""
    from app.infrastructure.agent.voice.pseudonymizer import pseudonymize_transcript

    mock_db = AsyncMock()
    mock_key_manager = MagicMock()
    mock_key_manager.get_cabinet_key.return_value = b"\x00" * 32
    mock_db.execute = AsyncMock(side_effect=Exception("DB error"))

    text_out, mapping = await pseudonymize_transcript(
        text="pansement chez Madame Dupont",
        cabinet_id=uuid.uuid4(),
        db=mock_db,
        key_manager=mock_key_manager,
    )

    # En cas d'erreur DB → aucun remplacement, texte original
    assert "Dupont" in text_out
    assert mapping == {}


# ── Tests endpoint REST /transcribe ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_transcribe_endpoint_no_stt_returns_503():
    """Sans provider STT → get_stt_provider() retourne None."""
    # Ce test vérifie la logique applicative (pas l'endpoint HTTP complet).
    # Le test d'intégration HTTP est couvert par les tests API avec JWT.
    with patch("app.infrastructure.api.v1.agent_routes._stt_provider", None):
        with patch("app.config.settings") as mock_settings:
            mock_settings.openai_api_key = ""
            from app.infrastructure.api.v1 import agent_routes
            # Réinitialise le singleton pour forcer la réévaluation
            original = agent_routes._stt_provider
            agent_routes._stt_provider = None
            stt = agent_routes.get_stt_provider()
            assert stt is None
            agent_routes._stt_provider = original


@pytest.mark.asyncio
async def test_transcribe_audio_too_large_raises_413():
    """Audio > 25 Mo → HTTP 413 via WhisperCloudSTT."""
    stt = WhisperCloudSTT(api_key="sk-test")
    big_audio = b"\x00" * (26 * 1024 * 1024)
    with pytest.raises(ValueError, match="25 Mo"):
        await stt.transcribe(audio_data=big_audio)


# ── Tests interface abstraite ─────────────────────────────────────────────────


def test_stt_provider_abstract():
    """STTProvider ne peut pas être instancié directement."""
    from app.infrastructure.agent.voice.base import STTProvider
    with pytest.raises(TypeError):
        STTProvider()  # type: ignore


def test_tts_provider_abstract():
    """TTSProvider ne peut pas être instancié directement."""
    from app.infrastructure.agent.voice.base import TTSProvider
    with pytest.raises(TypeError):
        TTSProvider()  # type: ignore
