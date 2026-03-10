"""Classe de base pour la génération de données synthétiques.

Chaque générateur appelle l'API Claude pour créer des exemples
dans le format ChatML attendu par le fine-tuning Mistral.
"""

import asyncio
import json
import random
from dataclasses import dataclass, field

from google import genai
from google.genai import types

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
        self.client = genai.Client(api_key=api_key)
        self.model = model or CORPUS_CONFIG.generation_model
        self.config = CORPUS_CONFIG

    async def generate_batch(self, n: int, **kwargs) -> list[TrainingExample]:
        """Génère un batch de N exemples pour une catégorie donnée."""
        raise NotImplementedError

    def _build_generation_prompt(self, difficulty: str, **kwargs) -> str:
        """Construit le prompt de génération pour Claude."""
        raise NotImplementedError

    def _parse_response(self, response: str, category: str) -> TrainingExample | None:
        """Parse la réponse JSON en TrainingExample."""
        if not response or not response.strip():
            print(f"    [PARSE] Reponse vide pour {category}")
            return None

        try:
            text = response.strip()

            # Nettoie les éventuels backticks markdown
            if text.startswith("```"):
                first_nl = text.find("\n")
                text = text[first_nl + 1:] if first_nl != -1 else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            data = self._safe_json_loads(text)
            messages = data.get("messages")
            if not messages or not isinstance(messages, list):
                print(f"    [PARSE] Pas de 'messages' valide pour {category}: clés={list(data.keys())}")
                return None

            # Post-processing : corrige les problèmes courants du LLM
            self._fix_messages(messages)

            return TrainingExample(
                messages=messages,
                category=category,
                subcategory=data.get("subcategory", ""),
                difficulty=data.get("difficulty", "moyen"),
                metadata=data.get("metadata", {}),
            )
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            tail = response[-150:] if len(response) > 150 else response
            print(f"    [PARSE] {e.__class__.__name__} pour {category} ({len(response)} chars) — fin: ...{tail}")
            return None

    @staticmethod
    def _safe_json_loads(text: str) -> dict:
        """Parse du JSON avec réparations légères pour les erreurs LLM courantes."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        import re

        repaired = text
        # Trailing commas avant } ou ]
        repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
        # Newlines non-échappées dans les strings JSON (entre guillemets)
        repaired = re.sub(
            r'(?<=": ")(.*?)(?="[,}\]\s])',
            lambda m: m.group(0).replace("\n", "\\n"),
            repaired,
            flags=re.DOTALL,
        )
        try:
            return json.loads(repaired)
        except json.JSONDecodeError:
            pass

        # Dernier recours : extraire le premier objet JSON valide
        brace_start = repaired.find("{")
        if brace_start >= 0:
            depth = 0
            in_string = False
            escape = False
            for i in range(brace_start, len(repaired)):
                c = repaired[i]
                if escape:
                    escape = False
                    continue
                if c == "\\":
                    escape = True
                    continue
                if c == '"' and not escape:
                    in_string = not in_string
                if not in_string:
                    if c == "{":
                        depth += 1
                    elif c == "}":
                        depth -= 1
                        if depth == 0:
                            candidate = repaired[brace_start:i + 1]
                            # Re-apply trailing comma fix on candidate
                            candidate = re.sub(r",\s*([}\]])", r"\1", candidate)
                            return json.loads(candidate)

        # Nothing worked — raise so caller logs it
        raise json.JSONDecodeError("Could not repair JSON", text, 0)

    def _fix_messages(self, messages: list[dict]) -> None:
        """Corrige les problèmes courants dans les messages générés par le LLM."""
        tool_call_ids: set[str] = set()

        for msg in messages:
            # Assure que les messages assistant avec tool_calls ont "content": null
            if msg.get("role") == "assistant" and msg.get("tool_calls") and "content" not in msg:
                msg["content"] = None

            # Collecte les tool_call_ids des appels assistant
            if msg.get("role") == "assistant" and msg.get("tool_calls"):
                for tc in msg["tool_calls"]:
                    tc_id = tc.get("id")
                    if tc_id:
                        tool_call_ids.add(tc_id)

                    # Normalise arguments string → dict si c'est du JSON valide
                    func = tc.get("function", {})
                    args = func.get("arguments")
                    if isinstance(args, str):
                        try:
                            func["arguments"] = json.loads(args)
                        except (json.JSONDecodeError, TypeError):
                            pass

                    # Normalise actes dicts → strings dans les arguments
                    if isinstance(func.get("arguments"), dict):
                        self._normalize_actes(func["arguments"])

            # Ajoute role="tool" manquant sur les messages avec tool_call_id
            if "tool_call_id" in msg and not msg.get("role"):
                msg["role"] = "tool"

            # Normalise actes dans les résultats d'outils
            if msg.get("role") == "tool":
                content = msg.get("content")
                if isinstance(content, str):
                    try:
                        parsed = json.loads(content)
                        if isinstance(parsed, dict):
                            self._normalize_actes(parsed)
                            msg["content"] = json.dumps(parsed, ensure_ascii=False)
                    except (json.JSONDecodeError, TypeError):
                        pass
                elif isinstance(content, dict):
                    self._normalize_actes(content)

    @staticmethod
    def _normalize_actes(data: dict) -> None:
        """Normalise les actes : convertit les dicts en codes NGAP strings."""
        if "actes" not in data or not isinstance(data["actes"], list):
            return

        normalized = []
        for item in data["actes"]:
            if isinstance(item, str):
                normalized.append(item)
            elif isinstance(item, dict):
                # Extraire le code NGAP depuis {"code": "AMI 4", ...}
                code = item.get("code") or item.get("code_ngap")
                if code and isinstance(code, str):
                    normalized.append(code)
        data["actes"] = normalized

    async def _call_claude(self, prompt: str) -> str:
        """Appel API Gemini avec retry exponentiel.

        Nom conservé pour compatibilité avec les générateurs existants.
        """
        system_instruction = (
            "Tu génères des données d'entraînement pour fine-tuner un LLM "
            "spécialisé dans l'assistance aux infirmières libérales (IDEL) françaises. "
            "Réponds UNIQUEMENT en JSON valide."
        )

        for attempt in range(self.config.max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        max_output_tokens=8192,
                        temperature=1.0,
                        response_mime_type="application/json",
                    ),
                )
                return response.text or ""
            except Exception as e:
                err_str = str(e).lower()
                is_rate_limit = "429" in err_str or "resource_exhausted" in err_str
                if is_rate_limit:
                    wait = self.config.retry_delay_base ** (attempt + 1)
                    print(f"    Rate limit — attente {wait:.0f}s...")
                    await asyncio.sleep(wait)
                elif attempt == self.config.max_retries - 1:
                    raise
                else:
                    wait = self.config.retry_delay_base ** attempt
                    print(f"    Erreur API ({e}) — retry dans {wait:.0f}s...")
                    await asyncio.sleep(wait)
        return ""

    async def _generate_one(self, category: str, **kwargs) -> TrainingExample | None:
        """Génère un seul exemple. À surcharger si besoin de kwargs spécifiques."""
        difficulty = self._pick_difficulty()
        prompt = self._build_generation_prompt(difficulty, **kwargs)
        response = await self._call_claude(prompt)
        return self._parse_response(response, category)

    async def _generate_parallel(
        self, n: int, category: str, build_kwargs_fn=None
    ) -> list[TrainingExample]:
        """Génère N exemples en parallèle avec concurrence limitée.

        build_kwargs_fn : callable() → dict de kwargs pour _build_generation_prompt.
        """
        semaphore = asyncio.Semaphore(self.config.concurrency)

        async def _one(idx: int) -> TrainingExample | None:
            async with semaphore:
                kwargs = build_kwargs_fn() if build_kwargs_fn else {}
                return await self._generate_one(category, **kwargs)

        tasks = [_one(i) for i in range(n)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        examples = []
        for r in results:
            if isinstance(r, TrainingExample):
                examples.append(r)
            elif isinstance(r, Exception):
                print(f"    [PARALLEL] Exception: {r}")
        return examples

    def _pick_difficulty(self) -> str:
        """Choisit une difficulté selon les poids configurés."""
        weights = self.config.difficulty_weights
        return random.choices(
            list(weights.keys()),
            weights=list(weights.values()),
            k=1,
        )[0]
