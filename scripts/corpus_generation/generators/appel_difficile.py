"""Générateur de données synthétiques pour les appels difficiles.

Catégorie 8 — 2 000 exemples.
Couvre les appels d'urgence, patients confus, aidants stressés,
et situations nécessitant une escalade ou un transfert.

10 scénarios avec scores d'urgence :
  - chute (score 3), malaise (score 3)
  - plaie infectée (score 2), glycémie anormale (score 2)
  - patient sourd (score 0), aidant stressé (score 1)
  - patient confus (score 1), question médicale (score 0)
  - demande résultats (score 0), veut parler à l'infirmière (score 0)
"""

import random

from .base import (
    BaseGenerator,
    TrainingExample,
    build_system_prompt,
    random_patient_name,
)

SCENARIOS_DIFFICILES = [
    ("chute", 3, "Patient appelle après une chute, ne peut pas se relever"),
    ("malaise", 3, "Patient fait un malaise pendant l'appel ou décrit un malaise récent"),
    ("plaie_infectee", 2, "Patient décrit une plaie rouge, chaude, avec du pus"),
    ("glycemie_anormale", 2, "Patient diabétique avec glycémie très haute ou très basse"),
    ("patient_sourd", 0, "Patient malentendant, il faut répéter et parler fort"),
    ("aidant_stresse", 1, "Aidant familial paniqué, parle vite, est émotif"),
    ("patient_confus", 1, "Patient désorienté, ne sait plus pourquoi il appelle"),
    ("question_medicale", 0, "Patient pose une question médicale (posologie, symptôme)"),
    ("demande_resultats", 0, "Patient veut ses résultats d'analyse"),
    ("veut_infirmiere", 0, "Patient refuse de parler au robot, veut l'infirmière"),
]


class AppelDifficileGenerator(BaseGenerator):
    """Génère des exemples de dialogues téléphoniques difficiles / urgents."""

    CATEGORY = "appel_difficile"

    def _pick_scenario(self) -> tuple[str, int, str]:
        return random.choice(SCENARIOS_DIFFICILES)

    def _build_generation_prompt(self, difficulty: str) -> str:
        patient = random_patient_name()
        scenario_id, urgency_score, scenario_desc = self._pick_scenario()
        system_prompt = build_system_prompt()

        tool_usage = ""
        if urgency_score >= 3:
            tool_usage = """L'agent appelle l'outil `escalader_urgence` pour envoyer un SMS à l'IDEL.
Il conseille au patient d'appeler le 15 (SAMU) si nécessaire."""
        elif urgency_score >= 2:
            tool_usage = """L'agent propose un rappel rapide par l'infirmière.
Il peut appeler `prendre_message` avec priorité=2."""
        else:
            tool_usage = """L'agent gère la situation sans escalade.
Il peut rediriger vers un message ou expliquer ses limites."""

        extra = ""
        if difficulty == "complexe":
            extra = """
- Le patient est très émotif ou confus
- Il faut plusieurs échanges pour comprendre la situation
- L'agent doit rester calme et empathique tout au long"""

        return f"""Génère un exemple d'entraînement : un dialogue téléphonique difficile
entre un patient et le secrétaire médical IA d'un cabinet infirmier.

Patient : {patient}
Scénario : {scenario_id} — {scenario_desc}
Score urgence attendu : {urgency_score}
Difficulté : {difficulty}
{extra}

{tool_usage}

Le dialogue doit montrer comment le secrétaire IA gère la situation :
- Reste calme, empathique, patient
- Évalue le score d'urgence au fil de la conversation
- Prend les actions appropriées selon le score
- Se présente comme "secrétaire automatique" (AI Act)

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "{scenario_id}",
  "difficulty": "{difficulty}",
  "metadata": {{"urgency_score": {urgency_score}}},
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "assistant", "content": "<salutation secrétaire automatique>"}},
    {{"role": "user", "content": "<patient décrit la situation (oral naturel, potentiellement paniqué)>"}},
    {{"role": "assistant", "content": "<réponse empathique + évaluation>"}},
    {{"role": "user", "content": "<patient donne plus de détails>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_001",
      "type": "function",
      "function": {{
        "name": "{'escalader_urgence' if urgency_score >= 3 else 'prendre_message'}",
        "arguments": {{"message": "<résumé de la situation>", "priorite": {urgency_score}, "patient_nom": "{patient}"}}
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_001", "content": "<résultat en JSON string>"}},
    {{"role": "assistant", "content": "<conclusion appropriée au score d'urgence>"}}
  ]
}}

IMPORTANT :
- Dialogue ORAL naturel (hésitations, émotions, phrases incomplètes)
- Le patient peut être paniqué, confus, en colère
- L'agent NE DONNE JAMAIS de conseil médical
- Score 3 → TOUJOURS mentionner le 15/SAMU
- Score 0 → gérer poliment, rediriger si besoin
- Utilise {patient} comme nom de patient"""

    async def generate_batch(self, n: int = 50, **kwargs) -> list[TrainingExample]:
        return await self._generate_parallel(n, self.CATEGORY)
