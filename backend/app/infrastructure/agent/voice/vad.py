"""Voice Activity Detection — détection et suppression de silences.

Utilisé pour :
- Couper le bruit de fond avant envoi à Whisper (économise des tokens)
- Détecter si l'enregistrement push-to-talk est trop court (bruit accidentel)

Note : pour le mode push-to-talk, la VAD côté client (bouton maintenu) suffit.
Ce module est utile pour le post-traitement côté serveur.
"""

import struct
import math


def trim_silence(
    audio_data: bytes,
    silence_threshold: float = 0.02,
    frame_duration_ms: int = 20,
    sample_rate: int = 16000,
) -> bytes:
    """
    Supprime les silences en début et fin d'un enregistrement PCM 16-bit.

    Args:
        audio_data: Données PCM 16-bit little-endian.
        silence_threshold: RMS normalisé en-dessous duquel une frame est
                           considérée silencieuse (0.0 à 1.0).
        frame_duration_ms: Durée d'une frame d'analyse en ms.
        sample_rate: Fréquence d'échantillonnage (Hz).

    Returns:
        Audio tronqué (même format PCM 16-bit).
        Retourne l'audio original si trop court pour être analysé.
    """
    if len(audio_data) < 1000:
        return audio_data

    samples_per_frame = int(sample_rate * frame_duration_ms / 1000)
    bytes_per_frame = samples_per_frame * 2  # 16-bit = 2 octets

    if len(audio_data) < bytes_per_frame:
        return audio_data

    # Découpe en frames et calcule le RMS de chaque frame
    frames: list[bytes] = []
    for i in range(0, len(audio_data) - bytes_per_frame + 1, bytes_per_frame):
        frames.append(audio_data[i : i + bytes_per_frame])

    if not frames:
        return audio_data

    def frame_rms(frame: bytes) -> float:
        """Calcule le RMS normalisé d'une frame PCM 16-bit."""
        n = len(frame) // 2
        if n == 0:
            return 0.0
        samples = struct.unpack(f"<{n}h", frame[:n * 2])
        mean_sq = sum(s * s for s in samples) / n
        return math.sqrt(mean_sq) / 32768.0  # Normalise entre 0 et 1

    is_speech = [frame_rms(f) > silence_threshold for f in frames]

    # Trouve le premier et le dernier frame avec de la parole
    first = next((i for i, v in enumerate(is_speech) if v), None)
    last = next((i for i, v in enumerate(reversed(is_speech)) if v), None)

    if first is None:
        # Tout silence → retourne l'audio original (sera filtré par l'appelant)
        return audio_data

    last_idx = len(frames) - 1 - last  # type: ignore[operator]

    # Marge de sécurité : ±2 frames pour ne pas couper les débuts/fins de mots
    start_frame = max(0, first - 2)
    end_frame = min(len(frames) - 1, last_idx + 2)

    trimmed = b"".join(frames[start_frame : end_frame + 1])
    return trimmed if trimmed else audio_data


def estimate_audio_duration(audio_data: bytes, sample_rate: int = 16000) -> float:
    """
    Estime la durée en secondes depuis la taille des données PCM 16-bit.

    Args:
        audio_data: Données PCM 16-bit.
        sample_rate: Fréquence d'échantillonnage (Hz).

    Returns:
        Durée estimée en secondes.
    """
    bytes_per_sample = 2  # 16-bit
    total_samples = len(audio_data) / bytes_per_sample
    return total_samples / sample_rate


def is_audio_too_short(audio_data: bytes, min_duration_seconds: float = 0.3) -> bool:
    """Retourne True si l'audio est trop court pour être transcrit."""
    return len(audio_data) < 1000 or estimate_audio_duration(audio_data) < min_duration_seconds
