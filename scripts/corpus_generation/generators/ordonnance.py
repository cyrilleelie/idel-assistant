"""Générateur de données synthétiques pour l'interprétation d'ordonnances.

Catégorie 4 — 3 000 exemples (15% du corpus).
Couvre les ordonnances manuscrites/dictées, les prescriptions complexes,
et les cas où l'IDEL doit interpréter pour planifier les soins.
"""

import random

from .base import (
    BaseGenerator,
    TrainingExample,
    build_system_prompt,
    random_patient_name,
)


class OrdonnanceGenerator(BaseGenerator):
    """Génère des exemples d'interprétation d'ordonnances infirmières."""

    CATEGORY = "ordonnance"

    PRESCRIPTIONS_COURANTES = [
        "pansement simple 1x/jour pendant 15 jours",
        "pansement complexe avec mèche 1x/jour pendant 21 jours",
        "injection Lovenox 0.4ml SC 1x/jour pendant 10 jours",
        "injection insuline Lantus 20UI SC 1x/jour au coucher",
        "injection insuline Novorapid 3x/jour avant les repas",
        "glycémie capillaire 3x/jour + injection insuline selon protocole",
        "prélèvement sanguin NFS + ionogramme + créatinine 1x/semaine",
        "INR 2x/semaine pendant 1 mois puis 1x/semaine",
        "perfusion sous-cutanée NaCl 500ml 1x/jour pendant 5 jours",
        "aérosolthérapie Ventoline + Pulmicort 2x/jour pendant 7 jours",
        "surveillance TA + pouls 1x/jour pendant 10 jours",
        "soins de stomie et changement appareillage 1x/2jours",
        "ablation fils J10 post-opératoire",
        "BSI évaluation initiale",
        "toilette + habillage 1x/jour patient GIR 2",
    ]

    COMPLEXITES = [
        "ordonnance avec abréviations médicales (Lx, SC, IV, IM)",
        "ordonnance manuscrite difficile à lire (interprétation)",
        "ordonnance avec protocole insuline variable selon glycémie",
        "ordonnance pour soins multiples (pansement + injection + surveillance)",
        "ordonnance de sortie d'hospitalisation (nombreux soins)",
        "renouvellement d'ordonnance avec modification de posologie",
        "ordonnance avec actes hors nomenclature (éducation thérapeutique)",
        "ordonnance pour patient ALD avec exonération",
    ]

    def _build_generation_prompt(self, difficulty: str) -> str:
        patient = random_patient_name()
        prescription = random.choice(self.PRESCRIPTIONS_COURANTES)
        system_prompt = build_system_prompt()

        complexite = ""
        if difficulty in ("moyen", "complexe"):
            complexite = f"\nComplexité supplémentaire : {random.choice(self.COMPLEXITES)}"

        if difficulty == "complexe":
            prescription = "ordonnance multi-soins : " + " + ".join(
                random.sample(self.PRESCRIPTIONS_COURANTES, 3)
            )

        return f"""Génère un exemple d'entraînement : une IDEL dicte ou décrit une ordonnance,
et l'agent l'interprète pour en extraire les actes à planifier.

Patient : {patient}
Prescription : {prescription}
Difficulté : {difficulty}
{complexite}

L'IDEL décrit l'ordonnance comme elle la lit (langage parlé, pas structuré).
L'agent appelle l'outil interpreter_ordonnance pour structurer la prescription.
L'outil retourne les actes identifiés avec codes NGAP, fréquence, durée estimée.
L'agent présente le plan de soins et demande confirmation avant de créer les RDV.

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "ordo_simple|ordo_complexe|ordo_protocole|ordo_multi_soins",
  "difficulty": "{difficulty}",
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "user", "content": "<dictée/description de l'ordonnance par l'IDEL>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_001",
      "type": "function",
      "function": {{
        "name": "interpreter_ordonnance",
        "arguments": "<json string des arguments>"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_001", "content": "<json string du résultat structuré>"}},
    {{"role": "assistant", "content": "<plan de soins résumé + demande confirmation>"}}
  ]
}}

IMPORTANT :
- La description de l'ordonnance doit être réaliste (langage parlé, hésitations)
- Les actes identifiés doivent correspondre aux codes NGAP corrects
- L'agent résume en 3-5 lignes max et demande confirmation
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
