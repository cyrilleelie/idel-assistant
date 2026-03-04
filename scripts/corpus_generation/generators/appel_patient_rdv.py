"""Générateur de données synthétiques pour les appels patients (RDV).

Catégorie 7 — 4 000 exemples.
Remplace rdv_planning (3 000) pour couvrir les dialogues téléphoniques
multi-tours réalistes entre un patient et le secrétaire médical IA.

5 profils patients pondérés :
  - personne_agee 35%
  - aidant_familial 25%
  - autonome 20%
  - mefiant 10%
  - presse 10%
"""

import random

from .base import (
    BaseGenerator,
    TrainingExample,
    build_system_prompt,
    random_patient_name,
)

PROFILS = [
    ("personne_agee", 0.35, "Patient âgé, parle lentement, peut être confus, vouvoiement systématique"),
    ("aidant_familial", 0.25, "Aidant familial (fils/fille) qui appelle pour un parent"),
    ("autonome", 0.20, "Patient autonome, connaît bien le cabinet, demande directe"),
    ("mefiant", 0.10, "Patient méfiant envers l'IA, demande à parler à une 'vraie personne'"),
    ("presse", 0.10, "Patient pressé, impatient, veut une réponse rapide"),
]

SCENARIOS_RDV = [
    "premier_rdv",
    "renouvellement",
    "modification_urgente",
    "annulation",
    "multi_soins",
    "rdv_matin_imperativement",
    "rdv_apres_hospitalisation",
    "rdv_pour_conjoint",
    "question_horaire",
    "confirmation_rdv_existant",
]


class AppelPatientRDVGenerator(BaseGenerator):
    """Génère des exemples de dialogues téléphoniques patient ↔ secrétaire IA pour prise de RDV."""

    CATEGORY = "appel_patient_rdv"

    TYPES_SOINS_PATIENT = [
        "piqûre", "prise de sang", "pansement", "soins de stomie",
        "insuline", "perfusion", "bas de contention", "toilette",
        "surveillance tension", "aérosol", "sonde urinaire",
    ]

    def _pick_profil(self) -> tuple[str, str]:
        profil_ids, weights, descriptions = zip(*PROFILS)
        idx = random.choices(range(len(PROFILS)), weights=weights, k=1)[0]
        return profil_ids[idx], descriptions[idx]

    def _build_generation_prompt(self, difficulty: str) -> str:
        patient = random_patient_name()
        profil_id, profil_desc = self._pick_profil()
        scenario = random.choice(SCENARIOS_RDV)
        soin = random.choice(self.TYPES_SOINS_PATIENT)
        system_prompt = build_system_prompt()

        extra = ""
        if difficulty == "complexe":
            extra = """
- Le patient a du mal à comprendre qu'il parle à un robot
- Il y a plusieurs soins à planifier ou une situation ambiguë
- Le secrétaire doit reformuler plusieurs fois"""

        return f"""Génère un exemple d'entraînement : un dialogue téléphonique multi-tours
entre un patient et le secrétaire médical IA d'un cabinet infirmier.

Patient : {patient}
Profil : {profil_id} — {profil_desc}
Scénario : {scenario}
Soin demandé : {soin}
Difficulté : {difficulty}
{extra}

Le dialogue doit être RÉALISTE (oral naturel, hésitations, reformulations).
Le secrétaire IA se présente comme "secrétaire automatique" (AI Act).
Le secrétaire utilise les outils pour rechercher le patient et consulter les créneaux.

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "{scenario}",
  "difficulty": "{difficulty}",
  "metadata": {{"profil": "{profil_id}"}},
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "assistant", "content": "<salutation secrétaire automatique>"}},
    {{"role": "user", "content": "<patient se présente et exprime sa demande>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_001",
      "type": "function",
      "function": {{
        "name": "rechercher_patient",
        "arguments": "<json string>"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_001", "content": "<json string résultat>"}},
    {{"role": "assistant", "content": "<confirmation identité + question créneau>"}},
    {{"role": "user", "content": "<patient indique ses préférences>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_002",
      "type": "function",
      "function": {{
        "name": "consulter_creneaux_disponibles",
        "arguments": "<json string>"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_002", "content": "<json string créneaux>"}},
    {{"role": "assistant", "content": "<proposition de créneau>"}},
    {{"role": "user", "content": "<patient accepte/hésite>"}},
    {{"role": "assistant", "content": null, "tool_calls": [{{
      "id": "call_003",
      "type": "function",
      "function": {{
        "name": "creer_rendez_vous",
        "arguments": "<json string>"
      }}
    }}]}},
    {{"role": "tool", "tool_call_id": "call_003", "content": "<json string confirmation>"}},
    {{"role": "assistant", "content": "<récapitulatif et au revoir>"}}
  ]
}}

IMPORTANT :
- Dialogue ORAL naturel (pas de markdown, pas de listes)
- Le patient parle comme au téléphone (phrases courtes, hésitations)
- Le secrétaire est chaleureux et patient (surtout avec les personnes âgées)
- Utilise {patient} comme nom de patient
- Le secrétaire se présente TOUJOURS comme "secrétaire automatique" au début"""

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
