"""Classe de base pour la génération de données synthétiques.

Chaque générateur appelle l'API Claude pour créer des exemples
dans le format ChatML attendu par le fine-tuning Mistral.
"""

import asyncio
import json
import random
from dataclasses import dataclass, field

import anthropic

from config import CORPUS_CONFIG, IDEL_NAMES, PATIENT_NAMES, SYSTEM_PROMPT_FINETUNE


@dataclass
class TrainingExample:
    """Un exemple d'entraînement au format ChatML avec tool_calls."""

    messages: list[dict]
    category: str
    subcategory: str
    difficulty: str  # "simple" | "moyen" | "complexe"
    validated: bool = False
    metadata: dict = field(default_factory=dict)


def random_idel_name() -> str:
    return random.choice(IDEL_NAMES)


def random_patient_name() -> str:
    return random.choice(PATIENT_NAMES)


def random_date() -> str:
    """Date fictive réaliste (2024-2026)."""
    year = random.choice([2024, 2025, 2026])
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return f"{year}-{month:02d}-{day:02d}"


def random_time(slot: str = "random") -> str:
    """Heure fictive réaliste selon le créneau."""
    if slot == "matin":
        h, m = random.randint(6, 11), random.choice([0, 15, 30, 45])
    elif slot == "apres_midi":
        h, m = random.randint(14, 18), random.choice([0, 15, 30, 45])
    elif slot == "soir":
        h, m = random.randint(19, 22), random.choice([0, 15, 30, 45])
    elif slot == "nuit":
        h, m = random.randint(23, 4), random.choice([0, 15, 30, 45])
    else:
        h, m = random.randint(6, 20), random.choice([0, 15, 30, 45])
    return f"{h:02d}:{m:02d}"


def build_system_prompt() -> str:
    """Construit un system prompt varié pour le fine-tuning."""
    return SYSTEM_PROMPT_FINETUNE.format(
        idel_name=random_idel_name(),
        current_date=random_date(),
    )


class BaseGenerator:
    """Classe de base pour tous les générateurs de données synthétiques.

    Utilise Claude comme modèle enseignant pour générer des exemples de qualité.
    """

    def __init__(self, api_key: str, model: str | None = None):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model or CORPUS_CONFIG.generation_model
        self.config = CORPUS_CONFIG

    async def generate_batch(self, n: int, **kwargs) -> list[TrainingExample]:
        """Génère un batch de N exemples pour une catégorie donnée."""
        raise NotImplementedError

    def _build_generation_prompt(self, difficulty: str, **kwargs) -> str:
        """Construit le prompt de génération pour Claude."""
        raise NotImplementedError

    def _parse_response(self, response: str, category: str) -> TrainingExample | None:
        """Parse la réponse de Claude en TrainingExample."""
        try:
            # Nettoie les éventuels backticks markdown
            text = response.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            data = json.loads(text)
            messages = data.get("messages")
            if not messages or not isinstance(messages, list):
                return None

            return TrainingExample(
                messages=messages,
                category=category,
                subcategory=data.get("subcategory", ""),
                difficulty=data.get("difficulty", "moyen"),
                metadata=data.get("metadata", {}),
            )
        except (json.JSONDecodeError, KeyError, TypeError):
            return None

    async def _call_claude(self, prompt: str) -> str:
        """Appel API Claude avec retry exponentiel."""
        for attempt in range(self.config.max_retries):
            try:
                response = self.client.messages.create(
                    model=self.model,
                    max_tokens=2000,
                    messages=[{"role": "user", "content": prompt}],
                    system=(
                        "Tu génères des données d'entraînement pour fine-tuner un LLM "
                        "spécialisé dans l'assistance aux infirmières libérales (IDEL) françaises. "
                        "Réponds UNIQUEMENT en JSON valide, sans aucun texte autour. "
                        "Pas de markdown, pas de backticks, pas de commentaires."
                    ),
                )
                return response.content[0].text
            except anthropic.RateLimitError:
                wait = self.config.retry_delay_base ** (attempt + 1)
                print(f"    Rate limit — attente {wait:.0f}s...")
                await asyncio.sleep(wait)
            except Exception as e:
                if attempt == self.config.max_retries - 1:
                    raise
                wait = self.config.retry_delay_base ** attempt
                print(f"    Erreur API ({e}) — retry dans {wait:.0f}s...")
                await asyncio.sleep(wait)
        return ""

    def _pick_difficulty(self) -> str:
        """Choisit une difficulté selon les poids configurés."""
        weights = self.config.difficulty_weights
        return random.choices(
            list(weights.keys()),
            weights=list(weights.values()),
            k=1,
        )[0]
