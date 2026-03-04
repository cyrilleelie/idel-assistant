"""Gestion du tour de parole pour le secrétaire médical IA.

Détecte la fin de parole du patient (silence après activité vocale)
et gère l'interruption TTS quand le patient parle pendant la réponse.
"""

import time
from dataclasses import dataclass, field
from enum import Enum


class TurnState(str, Enum):
    AGENT_SPEAKING = "agent_speaking"
    PATIENT_SPEAKING = "patient_speaking"
    SILENCE = "silence"
    PROCESSING = "processing"


@dataclass
class TurnManager:
    """Gestionnaire de tours de parole basé sur la VAD.

    Fonctionnement :
    1. Le patient parle → accumule l'audio dans un buffer
    2. Silence détecté pendant END_OF_TURN_SILENCE_MS → fin de tour
    3. Si le patient parle pendant la réponse TTS → interruption
    """

    END_OF_TURN_SILENCE_MS: int = 800
    MAX_INACTIVITY_S: float = 30.0
    INTERRUPT_THRESHOLD_MS: int = 200

    state: TurnState = field(default=TurnState.SILENCE)
    _audio_buffer: bytearray = field(default_factory=bytearray)
    _silence_start_ms: float = 0.0
    _last_activity_time: float = field(default_factory=time.monotonic)
    _had_speech: bool = False
    _interrupt_speech_start_ms: float = 0.0

    def add_audio_chunk(self, chunk: bytes, has_voice_activity: bool) -> bool:
        """Ajoute un chunk audio et retourne True si le tour est terminé.

        Args:
            chunk: Données audio PCM 16-bit.
            has_voice_activity: True si de la parole est détectée dans ce chunk.

        Returns:
            True si le tour du patient est terminé (silence suffisant après parole).
        """
        now_ms = time.monotonic() * 1000

        if has_voice_activity:
            self._had_speech = True
            self._silence_start_ms = 0.0
            self._last_activity_time = time.monotonic()
            self._audio_buffer.extend(chunk)
            self.state = TurnState.PATIENT_SPEAKING
            return False

        # Silence
        if self._had_speech:
            self._audio_buffer.extend(chunk)
            if self._silence_start_ms == 0.0:
                self._silence_start_ms = now_ms
            elif (now_ms - self._silence_start_ms) >= self.END_OF_TURN_SILENCE_MS:
                self.state = TurnState.PROCESSING
                return True

        return False

    def check_interrupt(self, has_voice_activity: bool) -> bool:
        """Vérifie si le patient interrompt l'agent pendant la lecture TTS.

        Doit être appelé quand state == AGENT_SPEAKING.

        Returns:
            True si le patient parle depuis INTERRUPT_THRESHOLD_MS (interruption).
        """
        now_ms = time.monotonic() * 1000

        if has_voice_activity:
            if self._interrupt_speech_start_ms == 0.0:
                self._interrupt_speech_start_ms = now_ms
            elif (now_ms - self._interrupt_speech_start_ms) >= self.INTERRUPT_THRESHOLD_MS:
                self._interrupt_speech_start_ms = 0.0
                return True
        else:
            self._interrupt_speech_start_ms = 0.0

        return False

    def is_inactive(self) -> bool:
        """True si aucune activité vocale depuis MAX_INACTIVITY_S."""
        return (time.monotonic() - self._last_activity_time) > self.MAX_INACTIVITY_S

    def get_audio_buffer(self) -> bytes:
        """Retourne le buffer audio accumulé."""
        return bytes(self._audio_buffer)

    def reset_for_next_turn(self) -> None:
        """Réinitialise le buffer pour le prochain tour."""
        self._audio_buffer.clear()
        self._silence_start_ms = 0.0
        self._had_speech = False
        self._interrupt_speech_start_ms = 0.0
        self._last_activity_time = time.monotonic()
        self.state = TurnState.SILENCE

    def set_agent_speaking(self) -> None:
        """Passe en mode agent (TTS en cours)."""
        self.state = TurnState.AGENT_SPEAKING
        self._interrupt_speech_start_ms = 0.0
