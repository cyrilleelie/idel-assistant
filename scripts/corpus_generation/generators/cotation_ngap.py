"""Générateur de données synthétiques pour la cotation NGAP.

Catégorie 1 — 5 000 exemples (25% du corpus).
Couvre les cas courants ET les cas limites identifiés sur le terrain.
"""

import random

from .base import (
    BaseGenerator,
    TrainingExample,
    build_system_prompt,
    random_patient_name,
    random_time,
)


class CotationNGAPGenerator(BaseGenerator):
    """Génère des exemples de cotation NGAP avec appels d'outils."""

    CATEGORY = "cotation_ngap"

    # Actes courants à couvrir systématiquement
    ACTES_COURANTS = [
        "pansement simple",
        "pansement complexe",
        "pansement lourd et complexe",
        "injection insuline",
        "injection sous-cutanée (Lovenox, Clexane)",
        "glycémie capillaire",
        "prise de sang (prélèvement veineux)",
        "prélèvement INR",
        "perfusion sous-cutanée",
        "perfusion intraveineuse",
        "sonde urinaire (pose)",
        "sonde urinaire (surveillance)",
        "soins de stomie",
        "surveillance des paramètres vitaux",
        "aérosolthérapie",
        "toilette complète (patient dépendant)",
        "aide à la prise de médicaments",
        "nursing (lever, coucher, habillage)",
        "ablation de fils ou agrafes",
        "vaccination (grippe, COVID)",
    ]

    # Cas limites générant des erreurs fréquentes
    CAS_LIMITES = [
        # Majorations
        "soin à 7h du matin (MAU applicable)",
        "soin à 21h (MAU applicable)",
        "soin à minuit (MAD applicable, pas MAU)",
        "soin à 3h du matin (MAD applicable)",
        "soin un dimanche matin (MCI uniquement, PAS de MAU en plus)",
        "soin un jour férié 14 juillet (MCI applicable)",
        "soin un dimanche après 20h (MCI seul — MAU et MCI ne se cumulent jamais)",
        # BSI
        "patient avec BSI actif → AMI devient AMX",
        "patient avec BSI actif → IFD devient IFI",
        "patient BSI évaluation initiale GIR 1-2 (BSC)",
        "patient BSI évaluation initiale GIR 3-4 (BSB)",
        "patient BSI évaluation initiale GIR 5-6 (BSA)",
        # Cumul article 11
        "deux actes chez le même patient (100% + 50%)",
        "trois actes chez le même patient (100% + 50% + 0%)",
        "pansement + injection même visite (cumul)",
        # IK
        "trajet 15 km aller-retour plaine (IK 0,62€/km)",
        "trajet montagne (IK majoré 0,80€/km)",
        "patient vu au cabinet (pas d'IK)",
        # Cas ambigus
        "escarre stade 2 → AMI 4 (pas AIS)",
        "pansement post-opératoire simple → AIS 1 (pas AMI)",
        "injection dans le cadre BSI → IFI (pas IFD)",
        "glycémie + injection insuline même patient (cumul art. 11)",
    ]

    def _build_generation_prompt(
        self, difficulty: str, cas_specifique: str | None = None
    ) -> str:
        patient = random_patient_name()
        heure = random_time("random")
        system_prompt = build_system_prompt()

        cas = cas_specifique or random.choice(self.ACTES_COURANTS)

        return f"""Génère un exemple d'entraînement pour un assistant IDEL qui doit coter un acte infirmier.

Difficulté : {difficulty}
Cas spécifique à couvrir : {cas}
Patient fictif : {patient}
Heure du soin : {heure}

RÈGLES DE COTATION NGAP À APPLIQUER CORRECTEMENT :
- AMI 1 (coeff 1) = 9,10€, AMI 2 = 18,20€, AMI 3 = 27,30€, AMI 4 = 36,40€
- Si patient BSI actif : AMI → AMX (même tarif), IFD → IFI
- MAU (+9,15€) : soins entre 20h-23h OU 5h-8h
- MCI (+9,15€) : soins le dimanche ou jours fériés
- MAD (+19,50€) : soins entre 23h-5h
- MAU et MCI ne se cumulent JAMAIS (MCI prioritaire le dimanche/JF)
- IK : 0,62€/km en plaine, 0,80€/km en montagne
- Cumul article 11 : 1er acte 100%, 2ème 50%, 3ème et suivants = 0%

L'exemple doit montrer :
1. L'IDEL décrit le soin en langage naturel courant (pas de termes NGAP exacts)
2. L'agent appelle l'outil analyser_et_coter avec les bons paramètres
3. L'outil retourne le résultat (simulation réaliste)
4. L'agent présente la cotation de façon concise et demande confirmation

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "cotation_simple|cotation_majoration|cotation_bsi|cotation_cumul|cotation_ik",
  "difficulty": "{difficulty}",
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "user", "content": "<description libre du soin par l'IDEL>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_001",
      "type": "function",
      "function": {{
        "name": "analyser_et_coter",
        "arguments": "<json string des arguments>"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_001", "content": "<json string du résultat outil>"}},
    {{"role": "assistant", "content": "<réponse concise de l'agent, max 5 lignes, demande confirmation>"}}
  ]
}}

IMPORTANT :
- La description de l'IDEL doit être réaliste et variée (langage parlé, abréviations)
- Utilise {patient} comme nom de patient
- Le résultat de l'outil doit être COHÉRENT avec la cotation NGAP correcte
- La réponse de l'agent doit être courte et demander confirmation
- Varie les formulations, les contextes, les heures"""

    async def generate_batch(self, n: int = 50, **kwargs) -> list[TrainingExample]:
        examples: list[TrainingExample] = []

        for i in range(n):
            difficulty = self._pick_difficulty()

            # 40% cas limites, 60% cas courants
            if random.random() < self.config.edge_case_ratio:
                cas = random.choice(self.CAS_LIMITES)
            else:
                cas = None

            prompt = self._build_generation_prompt(difficulty, cas)
            response = await self._call_claude(prompt)
            example = self._parse_response(response, self.CATEGORY)

            if example:
                examples.append(example)

        return examples
