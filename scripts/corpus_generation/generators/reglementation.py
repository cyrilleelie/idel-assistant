"""Générateur de données synthétiques pour les Q&R réglementaires IDEL.

Catégorie 5 — 3 000 exemples (15% du corpus).
Pas d'appels d'outils — réponses directes depuis les connaissances du modèle.
Couvre : NGAP, URSSAF, CPAM, conventions, retraite, formation, installation.
"""

import random

from .base import BaseGenerator, TrainingExample, build_system_prompt


class ReglementationGenerator(BaseGenerator):
    """Génère des exemples de Q&R sur la réglementation IDEL."""

    CATEGORY = "reglementation"

    THEMES = {
        "ngap_facturation": [
            "conditions de facturation d'un acte AMI vs AIS",
            "règles de cumul des actes (article 11)",
            "facturation des majorations (MAU, MCI, MAD)",
            "cas d'application du tiers payant obligatoire",
            "facturation en ALD (exonération du ticket modérateur)",
            "indemnités de déplacement IK (calcul, conditions)",
            "facturation d'un acte hors nomenclature",
            "différence entre BSI et AMX/AMI",
            "conditions de renouvellement du BSI",
            "facturation d'un acte en urgence (sans ordonnance)",
            "règles de facturation le dimanche et jours fériés",
            "prescription infirmière autonome (liste des actes)",
            "durée de validité d'une ordonnance infirmière",
            "télésoin infirmier (conditions et facturation)",
        ],
        "administratif": [
            "démarches d'installation en libéral (CPAM, URSSAF, Ordre)",
            "cotisations URSSAF infirmière libérale (taux, échéances)",
            "cotisations CARPIMKO (retraite complémentaire)",
            "assurance RCP obligatoire (montants, couverture)",
            "conditions d'association dans un cabinet infirmier",
            "remplacement d'une IDEL (contrat, facturation)",
            "collaboration libérale vs salariat",
            "zone sous-dotée et aides à l'installation",
            "contrat CPTS (Communauté Professionnelle Territoriale)",
            "logiciels homologués SESAM-Vitale (obligations)",
        ],
        "pratique_quotidienne": [
            "refus de soins par un patient (droit et limites)",
            "secret professionnel et partage avec l'équipe soignante",
            "continuité des soins (obligation légale, astreintes)",
            "contenu obligatoire du dossier patient infirmier",
            "conservation des dossiers patients (durée légale)",
            "gardes et astreintes IDEL (organisation, rémunération)",
            "formation continue DPC (heures obligatoires, thèmes)",
            "signalement de maltraitance (procédure, protection)",
            "responsabilité en cas d'erreur médicamenteuse",
            "droit de prescription infirmière (vaccins, dispositifs)",
        ],
        "droits_obligations": [
            "RGPD et données patients (obligations IDEL)",
            "hébergement des données de santé (HDS)",
            "exercice multi-sites (conditions réglementaires)",
            "publicité pour un cabinet infirmier (ce qui est autorisé)",
            "tarifs et dépassements (convention, hors convention)",
            "ordre infirmier (inscription obligatoire, rôle)",
            "exercice pendant un arrêt maladie",
            "congé maternité IDEL (indemnités, remplacement)",
        ],
    }

    def _build_generation_prompt(
        self, difficulty: str, theme_category: str | None = None
    ) -> str:
        system_prompt = build_system_prompt()

        if theme_category:
            themes = self.THEMES[theme_category]
            subcategory = theme_category
        else:
            subcategory = random.choice(list(self.THEMES.keys()))
            themes = self.THEMES[subcategory]

        theme = random.choice(themes)

        context = ""
        if difficulty == "complexe":
            context = (
                "\nLa question implique un cas particulier ou une zone grise réglementaire. "
                "L'agent doit nuancer sa réponse et orienter vers les sources officielles."
            )

        return f"""Génère un exemple Q&R sur la réglementation pour infirmières libérales (IDEL) françaises.

Thème : {theme}
Sous-catégorie : {subcategory}
Difficulté : {difficulty}
{context}

La question doit être :
- Formulée naturellement par une IDEL (langage courant, pas juridique)
- Précise mais avec des termes courants (pas forcément le terme exact)
- Réaliste (question qu'une IDEL poserait vraiment à son assistant)

TARIFS DE RÉFÉRENCE MAJORATIONS (à utiliser dans les réponses quand pertinent) :
- MAU = 9,15€ (majoration acte unique, nuit 20h-23h et 5h-8h)
- MCI = 9,15€ (majoration dimanche et jours fériés)
- MAD = 19,50€ (majoration nuit profonde 23h-5h)
- MAU et MCI ne se cumulent JAMAIS
- Si tu n'es pas certain d'un montant ou d'une règle, ne l'invente pas — indique que l'IDEL doit vérifier auprès de sa CPAM ou de l'Ordre.

La réponse de l'agent doit :
- Être factuelle et à jour (post-avenant 10 NGAP janvier 2024)
- Être concise (max 6 lignes) avec les informations essentielles
- Citer les textes de référence quand pertinent (NGAP, Code de la santé publique)
- Orienter vers les sources officielles si la situation est complexe
- Ne JAMAIS donner de conseils médicaux
- Signaler clairement si l'information peut avoir changé
- Ne JAMAIS inventer un montant ou une règle si l'information n'est pas certaine

Retourne UNIQUEMENT ce JSON :
{{
  "subcategory": "{subcategory}",
  "difficulty": "{difficulty}",
  "messages": [
    {{"role": "system", "content": "{system_prompt}"}},
    {{"role": "user", "content": "<question naturelle de l'IDEL>"}},
    {{"role": "assistant", "content": "<réponse factuelle concise, max 6 lignes>"}}
  ]
}}

IMPORTANT : Pas d'appels d'outils pour cette catégorie — réponse directe.
Varie les formulations et les niveaux de connaissance de l'IDEL."""

    async def generate_batch(self, n: int = 50, **kwargs) -> list[TrainingExample]:
        subcategories = list(self.THEMES.keys())
        counter = {"i": 0}

        def _kwargs():
            theme_cat = subcategories[counter["i"] % len(subcategories)]
            counter["i"] += 1
            return {"theme_category": theme_cat}

        return await self._generate_parallel(n, self.CATEGORY, build_kwargs_fn=_kwargs)
