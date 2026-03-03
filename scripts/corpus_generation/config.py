"""Configuration de la génération du corpus synthétique IDEL."""

from dataclasses import dataclass, field


@dataclass
class CorpusConfig:
    # Modèle Claude pour la génération
    generation_model: str = "claude-sonnet-4-20250514"

    # Répartition du corpus par catégorie
    categories: dict[str, int] = field(default_factory=lambda: {
        "cotation_ngap": 5000,
        "transmission_dar": 4000,
        "rdv_planning": 3000,
        "ordonnance": 3000,
        "reglementation": 3000,
        "general": 2000,
    })

    # Paramètres de génération
    batch_size: int = 50
    max_retries: int = 3
    retry_delay_base: float = 2.0
    rate_limit_delay: float = 1.0  # secondes entre batches

    # Répartition difficultés
    difficulty_weights: dict[str, float] = field(default_factory=lambda: {
        "simple": 0.4,
        "moyen": 0.4,
        "complexe": 0.2,
    })

    # Ratio cas limites / cas courants pour cotation
    edge_case_ratio: float = 0.4

    # Sortie
    output_dir: str = "data/corpus"
    raw_subdir: str = "raw"
    train_ratio: float = 0.9  # 90% train, 10% test

    # Dry run
    dry_run_per_category: int = 10


CORPUS_CONFIG = CorpusConfig()


# Tarifs NGAP post-avenant 10 (janvier 2024)
TARIFS_NGAP = {
    "AMI 1": 9.10, "AMI 2": 18.20, "AMI 3": 27.30, "AMI 4": 36.40,
    "AMX 1": 9.10, "AMX 2": 18.20, "AMX 3": 27.30, "AMX 4": 36.40,
    "AIS 1": 9.10, "AIS 2": 18.20, "AIS 3": 27.30, "AIS 4": 36.40,
    "BSA": 29.70, "BSB": 33.30, "BSC": 47.85,
    "MAU": 9.15, "MCI": 9.15, "MAD": 19.50, "MSO": 3.55,
    "IFD": 2.50, "IFI": 2.50,
}

# System prompt utilisé pour le fine-tuning (injecté dans chaque exemple)
SYSTEM_PROMPT_FINETUNE = """Tu es l'assistant de {idel_name}, infirmière libérale (IDEL) en France.
Date d'aujourd'hui : {current_date}.

RÔLE ET LIMITES :
- Tu aides aux tâches administratives : facturation NGAP, planification, transmissions
- Tu ne donnes JAMAIS de conseils médicaux, de diagnostic, ni d'interprétation clinique
- Toute action qui modifie des données requiert une confirmation explicite

NOMENCLATURE NGAP (post-avenant 10, janvier 2024) :
- AMI 1-4, AMX 1-4 (si BSI actif), AIS 1-4, BSA/BSB/BSC
- MAU (nuit 20h-23h et 5h-8h), MCI (dimanche/JF), MAD (nuit 23h-5h)
- IK 0,62€/km plaine, règle cumul article 11

FORMAT : Court et direct. Maximum 5 lignes. Confirme avant d'écrire."""


# Prénoms IDEL fictifs pour varier les exemples
IDEL_NAMES = [
    "Sophie", "Marie", "Caroline", "Isabelle", "Nathalie",
    "Sandrine", "Valérie", "Céline", "Christelle", "Aurélie",
]

# Noms de patients fictifs
PATIENT_NAMES = [
    "M. Dupont", "Mme Martin", "M. Bernard", "Mme Petit", "M. Robert",
    "Mme Moreau", "M. Laurent", "Mme Simon", "M. Michel", "Mme Lefebvre",
    "M. Leroy", "Mme Roux", "M. David", "Mme Bertrand", "M. Fontaine",
    "Mme Girard", "M. Blanc", "Mme Fournier", "M. Garcia", "Mme Thomas",
]
