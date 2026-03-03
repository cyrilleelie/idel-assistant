"""Générateur de données synthétiques pour la planification de RDV.

Catégorie 3 — 3 000 exemples (15% du corpus).
Couvre les demandes de créneaux, les contraintes horaires,
les préférences patients, et les cas de planification complexe.
"""

import random

from .base import (
    BaseGenerator,
    TrainingExample,
    build_system_prompt,
    random_patient_name,
)


class RDVPlanningGenerator(BaseGenerator):
    """Génère des exemples de planification de RDV avec suggestions de créneaux."""

    CATEGORY = "rdv_planning"

    TYPES_SOINS = [
        ("pansement", 20),
        ("injection insuline", 10),
        ("injection Lovenox", 10),
        ("prise de sang", 15),
        ("perfusion", 45),
        ("toilette complète", 30),
        ("aérosol", 15),
        ("surveillance paramètres", 15),
        ("soins de stomie", 20),
        ("ablation de fils", 15),
        ("BSI évaluation", 45),
        ("sonde urinaire", 20),
    ]

    CONTRAINTES = [
        "patient disponible uniquement le matin",
        "patient qui travaille, soir uniquement",
        "insuline à faire avant le petit-déjeuner (avant 8h)",
        "pansement à faire après la douche (après 9h)",
        "patient qui fait la sieste entre 14h et 16h",
        "INR à prélever à jeun (avant 10h)",
        "patient avec aide-soignante le matin (éviter 8h-10h)",
        "patient qui reçoit le kiné à 14h",
        "perfusion à commencer avant 10h (durée 2h)",
        "patient en fin de vie, pas de contrainte horaire",
    ]

    CONTEXTES = [
        "nouveau patient, première visite à planifier",
        "patient existant, ajout d'un soin supplémentaire",
        "remplacement d'un créneau annulé",
        "patient sortant d'hospitalisation, soins à domicile à organiser",
        "passage de 3x/semaine à quotidien",
        "ordonnance renouvelée, reconduction des créneaux",
    ]

    def _build_generation_prompt(self, difficulty: str) -> str:
        patient = random_patient_name()
        soin, duree = random.choice(self.TYPES_SOINS)
        contrainte = random.choice(self.CONTRAINTES)
        contexte = random.choice(self.CONTEXTES)
        system_prompt = build_system_prompt()

        extra = ""
        if difficulty == "complexe":
            extra = """
- Le patient a plusieurs soins à planifier (2-3 soins différents)
- Il y a des contraintes de cumul ou d'espacement entre les soins
- La tournée de l'IDEL est déjà chargée ce jour-là"""

        return f"""Génère un exemple d'entraînement : une IDEL demande à planifier un RDV,
et l'agent propose des créneaux optimisés géographiquement.

Patient : {patient}
Soin : {soin} (durée estimée : {duree} min)
Contrainte : {contrainte}
Contexte : {contexte}
Difficulté : {difficulty}
{extra}

L'IDEL décrit sa demande en langage naturel.
L'agent appelle l'outil proposer_creneaux_geooptimises pour trouver les meilleurs créneaux.
L'outil retourne 3 suggestions avec score de proximité géographique.
L'agent présente les options et demande le choix de l'IDEL.

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "rdv_simple|rdv_contrainte|rdv_multi_soins|rdv_urgent",
  "difficulty": "{difficulty}",
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "user", "content": "<demande naturelle de l'IDEL>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_001",
      "type": "function",
      "function": {{
        "name": "proposer_creneaux_geooptimises",
        "arguments": "<json string des arguments>"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_001", "content": "<json string des 3 créneaux suggérés>"}},
    {{"role": "assistant", "content": "<présentation des 3 options avec recommandation>"}}
  ]
}}

IMPORTANT :
- La demande de l'IDEL est naturelle et imprécise (pas de format structuré)
- Les créneaux suggérés doivent être réalistes (pas de soins à 3h du matin)
- L'agent recommande le meilleur créneau avec justification (proximité géographique)
- Utilise {patient} comme nom de patient"""

    async def generate_batch(self, n: int = 50, **kwargs) -> list[TrainingExample]:
        examples: list[TrainingExample] = []

        for _ in range(n):
            difficulty = self._pick_difficulty()

            prompt = self._build_generation_prompt(difficulty)
            response = await self._call_claude(prompt)
            example = self._parse_response(response, self.CATEGORY)

            if example:
                examples.append(example)

        return examples
