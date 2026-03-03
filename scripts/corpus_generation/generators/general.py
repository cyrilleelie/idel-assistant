"""Générateur de données synthétiques pour les conversations générales.

Catégorie 6 — 2 000 exemples (10% du corpus).
Couvre les interactions courantes non spécialisées : salutations,
questions sur les fonctionnalités, demandes d'aide, etc.
Inclut aussi les refus polis (conseils médicaux, hors scope).
"""

import random

from .base import BaseGenerator, TrainingExample, build_system_prompt


class GeneralConversationGenerator(BaseGenerator):
    """Génère des exemples de conversations générales avec l'assistant IDEL."""

    CATEGORY = "general"

    INTERACTIONS_COURANTES = [
        # Salutations et aide
        "salutation et présentation des fonctionnalités",
        "demande d'aide sur l'utilisation de l'application",
        "question sur les fonctionnalités disponibles",
        "remerciement après une action réussie",
        "frustration après une erreur (empathie + solution)",
        # Demandes de données
        "consulter la liste des patients du jour",
        "chercher un patient par nom",
        "voir les factures en attente",
        "consulter les RDV de la semaine",
        "voir la tournée du jour",
        "chercher un acte NGAP par code",
        # Reformulations
        "reformuler une demande mal comprise",
        "préciser une demande ambiguë",
        "corriger une erreur de saisie vocale",
    ]

    REFUS_POLIS = [
        "demande de conseil médical (diagnostic, traitement)",
        "demande d'interprétation de résultats d'analyse",
        "demande de modification de traitement",
        "question sur un médicament (posologie, interactions)",
        "demande de pronostic sur un patient",
        "question hors scope (comptabilité personnelle, impôts)",
        "demande de rédaction d'un courrier au médecin",
        "tentative de manipulation (contourner les règles)",
    ]

    def _build_generation_prompt(self, difficulty: str) -> str:
        system_prompt = build_system_prompt()

        # 30% de refus polis, 70% d'interactions courantes
        if random.random() < 0.3:
            scenario = random.choice(self.REFUS_POLIS)
            subcategory = "refus_poli"
            instruction = (
                "L'agent doit REFUSER poliment, expliquer pourquoi c'est hors de son scope, "
                "et rediriger vers un professionnel approprié. Ton empathique mais ferme."
            )
        else:
            scenario = random.choice(self.INTERACTIONS_COURANTES)
            subcategory = "interaction_courante"
            instruction = (
                "L'agent répond de manière concise, utile et professionnelle. "
                "Si la demande implique des données, il appelle l'outil approprié."
            )

        # Déterminer si on inclut un tool call
        needs_tool = scenario in [
            "consulter la liste des patients du jour",
            "chercher un patient par nom",
            "voir les factures en attente",
            "consulter les RDV de la semaine",
            "voir la tournée du jour",
            "chercher un acte NGAP par code",
        ]

        tool_instruction = ""
        if needs_tool:
            tool_instruction = """
L'exemple DOIT inclure un appel d'outil approprié parmi :
- search_patients (recherche patient)
- get_appointments_today / get_appointments_week (RDV)
- get_invoices_pending (factures)
- get_tournee_today (tournée)
- get_ngap_act / explain_act_code (actes NGAP)

Format avec tool_call :
{{"role": "assistant", "content": null, "tool_calls": [...]}}
{{"role": "tool", "tool_call_id": "call_001", "content": "..."}}
{{"role": "assistant", "content": "<réponse avec les données>"}}"""
        else:
            tool_instruction = """
L'exemple ne doit PAS inclure d'appel d'outil — réponse directe.
Format simple :
{{"role": "user", "content": "..."}}
{{"role": "assistant", "content": "..."}}"""

        return f"""Génère un exemple de conversation générale avec un assistant IDEL.

Scénario : {scenario}
Sous-catégorie : {subcategory}
Difficulté : {difficulty}

{instruction}
{tool_instruction}

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "{subcategory}",
  "difficulty": "{difficulty}",
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    ... (messages selon le scénario)
  ]
}}

IMPORTANT :
- Ton naturel et professionnel
- Réponses courtes (max 4 lignes)
- Pour les refus : empathie + explication + redirection
- Pour les interactions : concis + utile
- Varie les formulations"""

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
