"""Seed du referentiel NGAP post-avenant 10 (date d'effet 28/01/2024).

Insere tous les actes systeme dans care_type_catalog.
Peut etre execute au demarrage (si table vide) ou via CLI.
"""

import asyncio
import datetime
import logging
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.care_type_catalog_model import CareTypeCatalogModel

logger = logging.getLogger(__name__)

AVENANT_10_DATE = datetime.date(2024, 1, 28)
AVENANT_SOURCE = "avenant_10"

# Base AMI = 3.15 EUR
BASE_AMI = Decimal("3.15")

NGAP_ACTS = [
    # ========== Actes AMI (technique, hors BSI) ==========
    {"code": "AMI_1", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 1", "category": "technique", "coefficient": Decimal("1"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 15, "is_cumulative": True, "display_order": 10},
    {"code": "AMI_1.5", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 1.5", "category": "technique", "coefficient": Decimal("1.5"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 15, "is_cumulative": True, "display_order": 11},
    {"code": "AMI_2", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 2", "category": "technique", "coefficient": Decimal("2"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 12},
    {"code": "AMI_2.4", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 2.4", "category": "technique", "coefficient": Decimal("2.4"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 121},
    {"code": "AMI_3", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 3", "category": "technique", "coefficient": Decimal("3"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 13},
    {"code": "AMI_3.05", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 3.05", "category": "technique", "coefficient": Decimal("3.05"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 131},
    {"code": "AMI_4", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 4", "category": "technique", "coefficient": Decimal("4"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 30, "is_cumulative": True, "display_order": 14},
    {"code": "AMI_4.1", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 4.1", "category": "technique", "coefficient": Decimal("4.1"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 30, "is_cumulative": True, "display_order": 15},
    {"code": "AMI_5", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 5", "category": "technique", "coefficient": Decimal("5"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 30, "is_cumulative": True, "display_order": 16},
    {"code": "AMI_5.1", "lettre_cle": "AMI", "label": "Acte medical infirmier coefficient 5.1", "category": "technique", "coefficient": Decimal("5.1"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 30, "is_cumulative": True, "display_order": 17},

    # ========== Actes AMX (technique pendant BSI) ==========
    {"code": "AMX_1", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 1", "category": "technique_bsi", "coefficient": Decimal("1"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 15, "is_cumulative": True, "display_order": 20},
    {"code": "AMX_1.5", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 1.5", "category": "technique_bsi", "coefficient": Decimal("1.5"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 15, "is_cumulative": True, "display_order": 21},
    {"code": "AMX_2", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 2", "category": "technique_bsi", "coefficient": Decimal("2"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 22},
    {"code": "AMX_2.4", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 2.4", "category": "technique_bsi", "coefficient": Decimal("2.4"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 221},
    {"code": "AMX_3", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 3", "category": "technique_bsi", "coefficient": Decimal("3"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 222},
    {"code": "AMX_3.05", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 3.05", "category": "technique_bsi", "coefficient": Decimal("3.05"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 20, "is_cumulative": True, "display_order": 223},
    {"code": "AMX_4", "lettre_cle": "AMX", "label": "Acte medical infirmier pendant BSI coefficient 4", "category": "technique_bsi", "coefficient": Decimal("4"), "base_rate": BASE_AMI, "unit": "acte", "default_duration_minutes": 30, "is_cumulative": True, "display_order": 23},

    # ========== Forfaits BSI (bsi_forfait) ==========
    {"code": "BSA", "lettre_cle": "BSA", "label": "BSI - Soins legers (forfait A)", "category": "bsi_forfait", "fixed_amount": Decimal("13.00"), "unit": "jour", "default_duration_minutes": 30, "is_cumulative": False, "display_order": 30},
    {"code": "BSB", "lettre_cle": "BSB", "label": "BSI - Soins intermediaires (forfait B)", "category": "bsi_forfait", "fixed_amount": Decimal("18.20"), "unit": "jour", "default_duration_minutes": 45, "is_cumulative": False, "display_order": 31},
    {"code": "BSC", "lettre_cle": "BSC", "label": "BSI - Soins lourds (forfait C)", "category": "bsi_forfait", "fixed_amount": Decimal("28.70"), "unit": "jour", "default_duration_minutes": 60, "is_cumulative": False, "display_order": 32},

    # ========== AIS residuel (nursing) ==========
    {"code": "AIS_3", "lettre_cle": "AIS", "label": "Acte infirmier de soins coefficient 3", "category": "nursing", "coefficient": Decimal("3"), "base_rate": Decimal("2.65"), "unit": "acte", "default_duration_minutes": 30, "is_cumulative": False, "display_order": 40},
    {"code": "AIS_4", "lettre_cle": "AIS", "label": "Acte infirmier de soins coefficient 4", "category": "nursing", "coefficient": Decimal("4"), "base_rate": Decimal("2.65"), "unit": "acte", "default_duration_minutes": 30, "is_cumulative": False, "display_order": 41},

    # ========== Indemnites de deplacement ==========
    {"code": "IFD", "lettre_cle": "IFD", "label": "Indemnite forfaitaire de deplacement", "category": "indemnite_deplacement", "fixed_amount": Decimal("2.75"), "unit": "passage", "is_cumulative": False, "display_order": 50},
    {"code": "IFI", "lettre_cle": "IFI", "label": "Indemnite forfaitaire de deplacement insulaire", "category": "indemnite_deplacement", "fixed_amount": Decimal("2.75"), "unit": "passage", "is_cumulative": False, "display_order": 51},

    # ========== Indemnites kilometriques ==========
    {"code": "IK_PLAINE", "lettre_cle": "IK", "label": "Indemnite kilometrique plaine", "category": "indemnite_km", "fixed_amount": Decimal("0.35"), "unit": "km", "is_cumulative": False, "display_order": 55, "context_rules": {"zone": "plaine", "abattement_km": 4}},
    {"code": "IK_MONTAGNE", "lettre_cle": "IK", "label": "Indemnite kilometrique montagne", "category": "indemnite_km", "fixed_amount": Decimal("0.50"), "unit": "km", "is_cumulative": False, "display_order": 56, "context_rules": {"zone": "montagne", "abattement_km": 2}},

    # ========== Majorations ==========
    {"code": "MAU", "lettre_cle": "MAU", "label": "Majoration d'acte unique", "category": "majoration", "fixed_amount": Decimal("1.35"), "unit": "acte", "is_cumulative": False, "display_order": 60, "context_rules": {"condition": "acte_unique_passage"}},
    {"code": "MCI", "lettre_cle": "MCI", "label": "Majoration de coordination infirmiere", "category": "majoration", "fixed_amount": Decimal("5.00"), "unit": "acte", "is_cumulative": False, "display_order": 61, "context_rules": {"condition": "patient_dependant"}},
    {"code": "MAJ_DIM", "lettre_cle": "MAJ", "label": "Majoration dimanche et jours feries", "category": "majoration", "fixed_amount": Decimal("8.50"), "unit": "acte", "is_cumulative": True, "display_order": 62, "context_rules": {"condition": "dimanche_ferie"}},
    {"code": "MAJ_NUIT", "lettre_cle": "MAJ", "label": "Majoration de nuit (20h-23h / 5h-8h)", "category": "majoration", "fixed_amount": Decimal("9.15"), "unit": "acte", "is_cumulative": True, "display_order": 63, "context_rules": {"condition": "nuit_20h_23h_5h_8h"}},
    {"code": "MAJ_NUIT_PROF", "lettre_cle": "MAJ", "label": "Majoration de nuit profonde (23h-5h)", "category": "majoration", "fixed_amount": Decimal("18.30"), "unit": "acte", "is_cumulative": True, "display_order": 64, "context_rules": {"condition": "nuit_profonde_23h_5h"}},
    {"code": "MIE", "lettre_cle": "MIE", "label": "Majoration IFD enfant < 7 ans", "category": "majoration", "fixed_amount": Decimal("3.15"), "unit": "acte", "is_cumulative": False, "display_order": 65, "context_rules": {"condition": "enfant_moins_7_ans"}},
    {"code": "MIEJ", "lettre_cle": "MIEJ", "label": "Majoration IFD enfant jours feries", "category": "majoration", "fixed_amount": Decimal("9.15"), "unit": "acte", "is_cumulative": False, "display_order": 66, "context_rules": {"condition": "enfant_moins_7_ans_ferie"}},

    # ========== Teleconsultation ==========
    {"code": "TLS", "lettre_cle": "TLS", "label": "Teleconsultation simple", "category": "teleconsultation", "fixed_amount": Decimal("10.00"), "unit": "acte", "default_duration_minutes": 20, "is_cumulative": False, "display_order": 70},
    {"code": "TLL", "lettre_cle": "TLL", "label": "Teleconsultation longue", "category": "teleconsultation", "fixed_amount": Decimal("12.00"), "unit": "acte", "default_duration_minutes": 30, "is_cumulative": False, "display_order": 71},
    {"code": "TLD", "lettre_cle": "TLD", "label": "Teleconsultation dediee", "category": "teleconsultation", "fixed_amount": Decimal("15.00"), "unit": "acte", "default_duration_minutes": 45, "is_cumulative": False, "display_order": 72},

    # ========== Forfait divers ==========
    {"code": "DI", "lettre_cle": "DI", "label": "Demarche de soins infirmiers (DSI)", "category": "forfait", "fixed_amount": Decimal("10.00"), "unit": "acte", "default_duration_minutes": 60, "is_cumulative": False, "display_order": 80},
]


async def seed_ngap_catalog(session: AsyncSession) -> int:
    """Insere le referentiel NGAP si la table est vide (actes systeme).

    Returns:
        Nombre d'actes inseres.
    """
    # Verifie si des actes systeme existent deja
    result = await session.execute(
        select(func.count())
        .select_from(CareTypeCatalogModel)
        .where(CareTypeCatalogModel.is_system.is_(True))
    )
    count = result.scalar_one()
    if count > 0:
        logger.info("Referentiel NGAP deja present (%d actes systeme), seed ignore.", count)
        return 0

    inserted = 0
    for act_data in NGAP_ACTS:
        model = CareTypeCatalogModel(
            cabinet_id=None,
            code=act_data["code"],
            lettre_cle=act_data["lettre_cle"],
            label=act_data["label"],
            category=act_data["category"],
            coefficient=act_data.get("coefficient"),
            base_rate=act_data.get("base_rate"),
            fixed_amount=act_data.get("fixed_amount"),
            unit=act_data.get("unit", "acte"),
            default_duration_minutes=act_data.get("default_duration_minutes"),
            is_cumulative=act_data.get("is_cumulative", False),
            cumul_rules=act_data.get("cumul_rules"),
            context_rules=act_data.get("context_rules"),
            effective_from=AVENANT_10_DATE,
            effective_to=None,
            avenant_source=AVENANT_SOURCE,
            is_system=True,
            is_active=True,
            display_order=act_data.get("display_order", 0),
        )
        session.add(model)
        inserted += 1

    await session.flush()
    logger.info("Referentiel NGAP seed: %d actes inseres.", inserted)
    return inserted


async def _run_standalone():
    """Point d'entree CLI : python -m app.infrastructure.persistence.seeds.seed_ngap_catalog"""
    from app.infrastructure.persistence.database import async_session_factory

    logging.basicConfig(level=logging.INFO)
    async with async_session_factory() as session:
        count = await seed_ngap_catalog(session)
        await session.commit()
        print(f"Seed termine: {count} actes inseres.")


if __name__ == "__main__":
    asyncio.run(_run_standalone())
