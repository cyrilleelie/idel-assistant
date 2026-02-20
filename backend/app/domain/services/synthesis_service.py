from abc import ABC, abstractmethod


class SynthesisService(ABC):
    @abstractmethod
    async def generate_summary(self, transcription: str) -> dict:
        """Genere un resume structure depuis une transcription de soins.

        Retourne un dict avec les cles:
        - observations: str
        - actes_realises: list[str]
        - etat_patient: str
        - points_attention: list[str]
        """
        ...
