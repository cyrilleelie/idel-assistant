from abc import ABC, abstractmethod


class TranscriptionService(ABC):
    @abstractmethod
    async def transcribe_audio(self, audio_data: bytes, format: str = "wav") -> str:
        """Transcrit un fichier audio en texte."""
        ...
