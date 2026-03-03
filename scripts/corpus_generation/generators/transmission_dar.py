"""Générateur de données synthétiques pour les transmissions DAR.

Catégorie 2 — 4 000 exemples (20% du corpus).
Couvre les pathologies courantes en IDEL et les cas où les constantes
sont absentes, incomplètes ou dans un ordre inhabituel.
"""

import random

from .base import (
    BaseGenerator,
    TrainingExample,
    build_system_prompt,
    random_patient_name,
)


class TransmissionDARGenerator(BaseGenerator):
    """Génère des exemples de dictée → structuration DAR."""

    CATEGORY = "transmission_dar"

    PATHOLOGIES_COURANTES = [
        "escarre stade 1 (rougeur non blanchissable)",
        "escarre stade 2 (phlyctène, perte partielle)",
        "escarre stade 3-4 (perte tissulaire complète)",
        "plaie chirurgicale post-opératoire propre",
        "plaie chirurgicale infectée",
        "ulcère veineux jambe",
        "ulcère artériel",
        "diabète type 2 (contrôle glycémie, insuline)",
        "diabète type 1 (pompe à insuline, glycémie)",
        "insuffisance cardiaque (surveillance oedèmes, TA)",
        "BPCO (aérosol, surveillance SpO2, dyspnée)",
        "Alzheimer stade modéré (nursing, surveillance)",
        "cancer en chimiothérapie (surveillance, nursing)",
        "soins palliatifs (douleur, confort, hydratation)",
        "AVC séquelles (rééducation, nursing)",
        "fracture col du fémur (post-opératoire, mobilisation)",
        "stomie récente (appareillage, éducation)",
        "sonde urinaire à demeure (surveillance, changement)",
        "anticoagulants AVK (INR, surveillance saignements)",
        "hypertension (surveillance TA, observance traitement)",
        "bronchiolite nourrisson (aérosol, surveillance)",
        "phlébite (injection Lovenox, surveillance)",
    ]

    CONSTANTES_POSSIBLES = [
        "tension artérielle (TA)",
        "pouls / fréquence cardiaque (FC)",
        "température",
        "saturation SpO2",
        "glycémie capillaire",
        "poids",
        "douleur EVA",
        "diurèse",
    ]

    def _build_generation_prompt(
        self, difficulty: str, pathologie: str | None = None
    ) -> str:
        patient = random_patient_name()
        patho = pathologie or random.choice(self.PATHOLOGIES_COURANTES)
        system_prompt = build_system_prompt()

        # Plus de constantes selon la difficulté
        n_constantes = {"simple": 1, "moyen": 2, "complexe": 4}.get(difficulty, 2)
        constantes = random.sample(
            self.CONSTANTES_POSSIBLES,
            min(n_constantes, len(self.CONSTANTES_POSSIBLES)),
        )
        constantes_str = ", ".join(constantes)

        return f"""Génère un exemple d'entraînement : une IDEL dicte ses observations après une visite,
et l'agent structure la dictée en transmission DAR (Données, Actions, Résultats).

Patient : {patient}
Pathologie : {patho}
Difficulté : {difficulty}
Constantes à inclure dans la dictée : {constantes_str}

La dictée de l'IDEL doit être :
- Naturelle, comme du langage parlé (répétitions, hésitations, abréviations)
- PAS structurée (elle ne dit pas "D : ..., A : ..., R : ...")
- Réaliste : mélange d'observations, d'actions et de résultats entremêlés
- Inclure des valeurs de constantes vitales ({constantes_str})
- En difficulté "complexe" : situation préoccupante nécessitant une alerte

La structuration DAR de l'agent doit :
- Extraire proprement les 3 sections D (Données), A (Actions), R (Résultats)
- Identifier les constantes vitales séparément
- Générer une alerte si situation préoccupante (ex: TA > 180, SpO2 < 90, glycémie > 3g/L)
- Être fidèle aux observations (ne rien inventer)

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "dar_simple|dar_constantes|dar_alerte|dar_complexe",
  "difficulty": "{difficulty}",
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "user", "content": "<dictée libre réaliste de l'IDEL>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_001",
      "type": "function",
      "function": {{
        "name": "structurer_transmission",
        "arguments": "{{\\"dictee_libre\\": \\"<la dictée>\\", \\"patient_id\\": \\"uuid-fictif\\"}}"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_001", "content": "<json string du DAR structuré>"}},
    {{"role": "assistant", "content": "<preview du DAR + demande de confirmation>"}}
  ]
}}

IMPORTANT :
- Utilise {patient} comme nom de patient
- Varie les formulations, le niveau de détail, le vocabulaire
- En difficulté "complexe", inclure une alerte clinique justifiée
- La réponse de l'agent montre le DAR structuré et demande confirmation"""

    async def generate_batch(self, n: int = 50, **kwargs) -> list[TrainingExample]:
        examples: list[TrainingExample] = []

        for _ in range(n):
            difficulty = self._pick_difficulty()
            pathologie = random.choice(self.PATHOLOGIES_COURANTES)

            prompt = self._build_generation_prompt(difficulty, pathologie)
            response = await self._call_claude(prompt)
            example = self._parse_response(response, self.CATEGORY)

            if example:
                examples.append(example)

        return examples
