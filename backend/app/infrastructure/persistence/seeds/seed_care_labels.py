"""Seed du referentiel de libelles de soins courants IDEL.

Insere ~50 libelles systeme dans care_labels.
Chaque entree mappe un libelle de soin vers ses codes NGAP et une duree par defaut.
Idempotent : skip si des lignes systeme existent deja.
"""

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.care_label_model import CareLabelModel

logger = logging.getLogger(__name__)

CARE_LABELS = [
    # ========== Pansements ==========
    {"label": "Pansement simple", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "pansement", "display_order": 10},
    {"label": "Pansement complexe", "act_codes": ["AMI_1.5"], "default_duration_minutes": 20, "category": "pansement", "display_order": 11},
    {"label": "Pansement lourd et complexe", "act_codes": ["AMI_2"], "default_duration_minutes": 30, "category": "pansement", "display_order": 12},
    {"label": "Pansement ulcere veineux", "act_codes": ["AMI_2"], "default_duration_minutes": 30, "category": "pansement", "display_order": 13},
    {"label": "Pansement escarre", "act_codes": ["AMI_2"], "default_duration_minutes": 30, "category": "pansement", "display_order": 14},
    {"label": "Pansement brulure", "act_codes": ["AMI_2"], "default_duration_minutes": 25, "category": "pansement", "display_order": 15},
    {"label": "Ablation fils/agrafes", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "pansement", "display_order": 16},
    {"label": "Meche et drainage", "act_codes": ["AMI_2"], "default_duration_minutes": 20, "category": "pansement", "display_order": 17},

    # ========== Injections ==========
    {"label": "Injection sous-cutanee", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "injection", "display_order": 20},
    {"label": "Injection intramusculaire", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "injection", "display_order": 21},
    {"label": "Injection intraveineuse", "act_codes": ["AMI_2"], "default_duration_minutes": 15, "category": "injection", "display_order": 22},
    {"label": "Injection insuline", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "injection", "display_order": 23},
    {"label": "Injection anticoagulant (HBPM)", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "injection", "display_order": 24},
    {"label": "Vaccination", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "injection", "display_order": 25},
    {"label": "Desensibilisation", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "injection", "display_order": 26},
    {"label": "Injection hormones", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "injection", "display_order": 27},

    # ========== Perfusions ==========
    {"label": "Perfusion IV pose", "act_codes": ["AMI_4"], "default_duration_minutes": 30, "category": "perfusion", "display_order": 30},
    {"label": "Perfusion IV surveillance", "act_codes": ["AMI_3"], "default_duration_minutes": 20, "category": "perfusion", "display_order": 31},
    {"label": "Perfusion sous-cutanee (hypodermoclyse)", "act_codes": ["AMI_3"], "default_duration_minutes": 25, "category": "perfusion", "display_order": 32},
    {"label": "Nutrition parenterale", "act_codes": ["AMI_4"], "default_duration_minutes": 30, "category": "perfusion", "display_order": 33},

    # ========== Prelevements ==========
    {"label": "Prelevement sanguin", "act_codes": ["AMI_1.5"], "default_duration_minutes": 10, "category": "prelevement", "display_order": 40},
    {"label": "Prelevement urinaire (ECBU)", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "prelevement", "display_order": 41},
    {"label": "Glycemie capillaire", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "prelevement", "display_order": 42},

    # ========== BSI ==========
    {"label": "BSI leger (BSA)", "act_codes": ["BSA"], "default_duration_minutes": 30, "category": "bsi", "display_order": 50},
    {"label": "BSI intermediaire (BSB)", "act_codes": ["BSB"], "default_duration_minutes": 45, "category": "bsi", "display_order": 51},
    {"label": "BSI lourd (BSC)", "act_codes": ["BSC"], "default_duration_minutes": 60, "category": "bsi", "display_order": 52},

    # ========== Soins techniques ==========
    {"label": "Sondage urinaire", "act_codes": ["AMI_3"], "default_duration_minutes": 20, "category": "technique", "display_order": 60},
    {"label": "Sondage vesical", "act_codes": ["AMI_4"], "default_duration_minutes": 25, "category": "technique", "display_order": 61},
    {"label": "Lavement evacuateur", "act_codes": ["AMI_2"], "default_duration_minutes": 20, "category": "technique", "display_order": 62},
    {"label": "Aerosol", "act_codes": ["AMI_1.5"], "default_duration_minutes": 15, "category": "technique", "display_order": 63},
    {"label": "Aspiration tracheale", "act_codes": ["AMI_2"], "default_duration_minutes": 15, "category": "technique", "display_order": 64},
    {"label": "Soins de tracheotomie", "act_codes": ["AMI_2"], "default_duration_minutes": 20, "category": "technique", "display_order": 65},
    {"label": "Soins de stomie", "act_codes": ["AMI_2"], "default_duration_minutes": 20, "category": "technique", "display_order": 66},
    {"label": "Ablation sonde urinaire", "act_codes": ["AMI_1.5"], "default_duration_minutes": 15, "category": "technique", "display_order": 67},

    # ========== Surveillance ==========
    {"label": "Surveillance constantes", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "surveillance", "display_order": 70},
    {"label": "Surveillance glycemie + injection insuline", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "surveillance", "display_order": 71},
    {"label": "Surveillance AVK/INR", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "surveillance", "display_order": 72},
    {"label": "Dialyse peritoneale", "act_codes": ["AMI_4"], "default_duration_minutes": 45, "category": "surveillance", "display_order": 73},
    {"label": "Surveillance post-operatoire", "act_codes": ["AMI_1.5"], "default_duration_minutes": 20, "category": "surveillance", "display_order": 74},
    {"label": "Education therapeutique", "act_codes": ["AMI_1"], "default_duration_minutes": 30, "category": "surveillance", "display_order": 75},

    # ========== Soins palliatifs ==========
    {"label": "Nursing palliatif", "act_codes": ["AMI_4"], "default_duration_minutes": 45, "category": "palliatif", "display_order": 80},
    {"label": "PCA / analgesie controllee", "act_codes": ["AMI_3"], "default_duration_minutes": 20, "category": "palliatif", "display_order": 81},
    {"label": "Soins de confort", "act_codes": ["AMI_2"], "default_duration_minutes": 30, "category": "palliatif", "display_order": 82},

    # ========== Hygiene / confort ==========
    {"label": "Toilette evaluee", "act_codes": ["AIS_3"], "default_duration_minutes": 30, "category": "hygiene", "display_order": 90},
    {"label": "Aide a la prise de medicaments", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "hygiene", "display_order": 91},
    {"label": "Pose bas de contention", "act_codes": ["AMI_1"], "default_duration_minutes": 10, "category": "hygiene", "display_order": 92},
    {"label": "Soins d'hygiene", "act_codes": ["AIS_3"], "default_duration_minutes": 30, "category": "hygiene", "display_order": 93},

    # ========== Divers ==========
    {"label": "ECG (electrocardiogramme)", "act_codes": ["AMI_3"], "default_duration_minutes": 20, "category": "divers", "display_order": 100},
    {"label": "Test rapide d'orientation diagnostique (TROD)", "act_codes": ["AMI_1"], "default_duration_minutes": 15, "category": "divers", "display_order": 101},
    {"label": "Teleconsultation assistee", "act_codes": ["AMI_1"], "default_duration_minutes": 20, "category": "divers", "display_order": 102},
]


async def seed_care_labels(session: AsyncSession) -> None:
    """Insere les libelles systeme si la table est vide de lignes systeme."""
    result = await session.execute(
        select(func.count()).select_from(CareLabelModel).where(
            CareLabelModel.is_system.is_(True)
        )
    )
    count = result.scalar_one()
    if count > 0:
        logger.info("Seed care_labels: %d lignes systeme deja presentes, skip", count)
        return

    logger.info("Seed care_labels: insertion de %d libelles systeme", len(CARE_LABELS))
    for entry in CARE_LABELS:
        model = CareLabelModel(
            label=entry["label"],
            act_codes=entry["act_codes"],
            default_duration_minutes=entry["default_duration_minutes"],
            category=entry["category"],
            display_order=entry["display_order"],
            is_system=True,
            is_active=True,
            cabinet_id=None,
        )
        session.add(model)

    logger.info("Seed care_labels: OK")
