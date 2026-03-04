"""Implémentation du service de synthèse IA pour les transmissions.

Utilise Mistral (ou le provider LLM configuré) pour générer un résumé
structuré DAR (Données, Actions, Résultats) depuis une transcription.
"""

import json
import logging

from app.config import settings
from app.domain.services.synthesis_service import SynthesisService

logger = logging.getLogger(__name__)

_SYNTHESIS_SYSTEM_PROMPT = """Tu es un assistant spécialisé en soins infirmiers à domicile (IDEL).
À partir de la transcription d'une visite, génère un résumé structuré au format JSON avec les clés:
- "synthese": résumé en 1-2 phrases de la visite
- "soins": actes réalisés (détaillés)
- "constantes": constantes mesurées (TA, glycémie, température, pouls, SpO2...)
- "observations": observations cliniques et état du patient
- "actions": actions à suivre, points de vigilance, prochains RDV

Sois précis, factuel, utilise le vocabulaire médical NGAP approprié.
Réponds UNIQUEMENT en JSON valide, sans texte avant ou après."""


class SynthesisServiceImpl(SynthesisService):
    """Génère un résumé structuré depuis une transcription via LLM."""

    async def generate_summary(self, transcription: str) -> dict:
        if not transcription or len(transcription.strip()) < 10:
            return {
                "synthese": "",
                "soins": "",
                "constantes": "",
                "observations": "",
                "actions": "",
            }

        try:
            return await _call_llm(transcription)
        except Exception:
            logger.exception("Synthèse IA échouée")
            return {
                "synthese": "[Synthèse non disponible]",
                "soins": "",
                "constantes": "",
                "observations": transcription[:500],
                "actions": "",
            }


async def _call_llm(transcription: str) -> dict:
    """Appelle le LLM configuré pour générer la synthèse."""
    if settings.mistral_api_key:
        return await _call_mistral(transcription)
    else:
        logger.warning("Aucune clé Mistral — synthèse stub")
        return _stub_synthesis(transcription)


async def _call_mistral(transcription: str) -> dict:
    """Appel Mistral API pour la synthèse structurée."""
    from mistralai import Mistral

    client = Mistral(api_key=settings.mistral_api_key)

    response = await client.chat.complete_async(
        model="mistral-small-latest",
        messages=[
            {"role": "system", "content": _SYNTHESIS_SYSTEM_PROMPT},
            {"role": "user", "content": f"Transcription de la visite :\n\n{transcription}"},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
        max_tokens=1024,
    )

    content = response.choices[0].message.content
    result = json.loads(content)

    # Validate expected keys
    expected = {"synthese", "soins", "constantes", "observations", "actions"}
    for key in expected:
        if key not in result:
            result[key] = ""

    return result


def _stub_synthesis(transcription: str) -> dict:
    """Synthèse stub pour le développement sans clé API."""
    return {
        "synthese": f"[Stub] Transmission de {len(transcription)} caractères.",
        "soins": "",
        "constantes": "",
        "observations": transcription[:200],
        "actions": "",
    }


def create_synthesis_service() -> SynthesisServiceImpl:
    """Factory pour le service de synthèse."""
    return SynthesisServiceImpl()
