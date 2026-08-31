"""Ajoute des transmissions de demo aux donnees existantes.

Usage: cd backend && uv run python scripts/seed_transmissions.py
"""

import asyncio
import datetime
import sys
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.infrastructure.persistence.database import async_session_factory
from app.infrastructure.persistence.models.user_model import UserModel, CabinetMemberModel
from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.persistence.models.prescription_model import PrescriptionModel
from app.infrastructure.persistence.models.transmission_model import TransmissionModel
from app.infrastructure.persistence.models.transmission_prescription_model import (
    TransmissionPrescriptionModel,
)
from app.infrastructure.security.encryption import encrypt
from app.infrastructure.security.key_manager import KeyManager
from sqlalchemy import select, func

TODAY = datetime.date.today()
YESTERDAY = TODAY - datetime.timedelta(days=1)
TWO_DAYS_AGO = TODAY - datetime.timedelta(days=2)
THREE_DAYS_AGO = TODAY - datetime.timedelta(days=3)


def make_dt(day, hour, minute):
    return datetime.datetime(
        day.year, day.month, day.day, hour, minute, tzinfo=ZoneInfo("Europe/Paris")
    )


async def main():
    km = KeyManager(settings.encryption_master_key)

    async with async_session_factory() as session:
        # Get demo user
        r = await session.execute(
            select(UserModel).where(UserModel.email == "demo@idel.fr")
        )
        user = r.scalar_one_or_none()
        if not user:
            print("Compte demo introuvable. Lancez seed_demo.py d'abord.")
            return

        # Get cabinet
        r = await session.execute(
            select(CabinetMemberModel).where(CabinetMemberModel.user_id == user.id)
        )
        member = r.scalar_one()
        cabinet_id = member.cabinet_id
        user_id = user.id
        cab_key = km.get_cabinet_key(cabinet_id)

        # Get patients (ordered by creation)
        r = await session.execute(
            select(PatientModel)
            .where(PatientModel.cabinet_id == cabinet_id)
            .order_by(PatientModel.created_at)
        )
        patients = list(r.scalars().all())
        print(f"  {len(patients)} patients trouves")

        # Check if seed transmissions already exist
        r = await session.execute(
            select(func.count())
            .select_from(TransmissionModel)
            .where(
                TransmissionModel.cabinet_id == cabinet_id,
                TransmissionModel.generation_time_ms == 3200,
            )
        )
        if r.scalar_one() > 0:
            print("  Les transmissions seed existent deja, rien a faire.")
            return

        # --- 10 transmissions realistes ---
        transmissions_data = [
            # 1. Vocale completed — Lucienne Moreau (diabete, Damvix)
            {
                "patient_idx": 0,
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Passage chez Madame Moreau ce matin a 7h30. Glycemie capillaire a "
                    "jeun : 1.42 g/L, un peu elevee par rapport a hier ou c'etait a 1.28. "
                    "Injection insuline Lantus 22 unites dans la cuisse gauche, bonne "
                    "rotation des points d'injection. Pas de lipodystrophie. La patiente "
                    "se plaint de picotements dans les pieds depuis quelques jours, je note "
                    "pour signaler au Dr Renaud lors du prochain passage. Etat general "
                    "correct, patiente souriante. Petit-dejeuner pris avant mon arrivee, "
                    "conforme au regime."
                ),
                "structured_data": {
                    "synthese": "Suivi diabetique quotidien. Glycemie legerement elevee (1.42 g/L vs 1.28 la veille). Paresthesies des pieds a signaler au medecin traitant.",
                    "soins": "Glycemie capillaire a jeun, injection insuline Lantus 22 UI cuisse gauche",
                    "constantes": "Glycemie : 1.42 g/L (a jeun)",
                    "observations": "Bonne rotation des points d'injection, pas de lipodystrophie. Picotements des pieds depuis quelques jours.",
                    "actions": "Signaler paresthesies des pieds au Dr Renaud. Surveiller evolution glycemie.",
                },
                "recording_duration_seconds": 45,
                "generation_time_ms": 3200,
                "created_at": make_dt(YESTERDAY, 7, 52),
            },
            # 2. Vocale validated — Marcel Gauthier (pansement, Damvix)
            {
                "patient_idx": 1,
                "type": "vocal",
                "status": "validated",
                "transcription": (
                    "Pansement de Monsieur Gauthier. Ulcere veineux jambe droite, face "
                    "interne. Bonne evolution, le bourgeonnement progresse bien sur les "
                    "berges. Nettoyage serum physiologique, meche Algosteril au centre, "
                    "interface Urgotul, compresses, bande de contention Biflex 17. Pas de "
                    "signe d'infection, pas d'odeur. Le patient dit avoir bien porte sa "
                    "contention hier toute la journee. Prochain pansement dans 2 jours."
                ),
                "structured_data": {
                    "synthese": "Pansement ulcere veineux jambe droite en bonne evolution. Bourgeonnement actif, pas d'infection.",
                    "soins": "Refection pansement : nettoyage serum phy, meche Algosteril, interface Urgotul, compresses, bande Biflex 17",
                    "constantes": "",
                    "observations": "Bourgeonnement progressant sur les berges. Pas d'infection, pas d'odeur. Contention bien portee.",
                    "actions": "Prochain pansement dans 2 jours. Continuer contention veineuse.",
                },
                "recording_duration_seconds": 38,
                "generation_time_ms": 2800,
                "created_at": make_dt(TWO_DAYS_AGO, 8, 45),
            },
            # 3. Ecrite completed — Yvette Robin (Alzheimer, Damvix)
            {
                "patient_idx": 2,
                "type": "written",
                "status": "completed",
                "transcription": (
                    "Toilette et aide a l'habillage de Mme Robin. Patiente desorientee "
                    "ce matin, ne reconnaissait pas son domicile. Agitation moderee en "
                    "debut de soins, calmee apres quelques minutes. Peau seche au niveau "
                    "des jambes, application de creme hydratante Dexeryl. Repas du midi "
                    "prepare et laisse a portee. Pilulier du jour verifie, medications du "
                    "matin prises. Fille prevenue par telephone de l'episode de desorientation."
                ),
                "structured_data": {
                    "synthese": "Soins d'hygiene avec episode de desorientation et agitation moderee. Peau seche traitee. Famille prevenue.",
                    "soins": "Toilette complete, aide habillage, application Dexeryl jambes, verification pilulier",
                    "constantes": "",
                    "observations": "Desorientation temporospatiale ce matin (ne reconnait pas son domicile). Agitation moderee en debut de soins. Peau seche jambes.",
                    "actions": "Fille prevenue de l'episode. Surveiller frequence des episodes de desorientation. Signaler au Dr si aggravation.",
                },
                "recording_duration_seconds": 0,
                "generation_time_ms": 2500,
                "created_at": make_dt(YESTERDAY, 9, 35),
            },
            # 4. Vocale completed — Simone Dupuis (escarres, Maille)
            {
                "patient_idx": 8,
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Soins d'escarre sacree chez Madame Dupuis. Escarre stade 3, "
                    "dimensions 4 cm par 3 cm, profondeur estimee 0.5 cm. Fond fibrineux "
                    "jaune sur environ 40%, le reste en bourgeonnement rouge. Legere "
                    "exsudation sereuse. Detersion mecanique douce a la curette, nettoyage "
                    "serum physiologique. Application Purilon gel sur zones fibrineuses, "
                    "Aquacel Foam en couverture. Patiente positionnee en decubitus lateral "
                    "gauche, coussin entre les jambes."
                ),
                "structured_data": {
                    "synthese": "Pansement escarre sacree stade 3 (4x3x0.5 cm). Fond mixte fibrineux/bourgeonnement. Detersion mecanique et pansement adapte.",
                    "soins": "Detersion mecanique curette, nettoyage serum phy, Purilon gel sur fibrine, Aquacel Foam. Repositionnement decubitus lateral gauche.",
                    "constantes": "Escarre sacree : 4x3x0.5 cm, stade 3, 40% fibrine, 60% bourgeonnement",
                    "observations": "Exsudation sereuse legere. Evolution lente mais favorable.",
                    "actions": "Rappel aide a domicile : repositionnement toutes les 2h. Prochain pansement dans 2 jours.",
                },
                "recording_duration_seconds": 52,
                "generation_time_ms": 3500,
                "created_at": make_dt(YESTERDAY, 10, 50),
            },
            # 5. Ecrite validated — Henri Bardin (cancer/perfusion, Damvix)
            {
                "patient_idx": 3,
                "type": "written",
                "status": "validated",
                "transcription": (
                    "Perfusion sous-cutanee d'hydratation chez M. Bardin. 500 mL NaCl "
                    "0.9% sur 4 heures, debit 125 mL/h. Site de ponction face anterieure "
                    "cuisse droite. Patient asthenique mais conscient et oriente, apyretique. "
                    "Nausees matinales persistantes depuis la derniere chimio J+5. A peu "
                    "mange ce matin. Epouse presente et informee de la surveillance du debit."
                ),
                "structured_data": {
                    "synthese": "Perfusion SC hydratation 500 mL NaCl J+5 post-chimio. Patient asthenique avec nausees persistantes.",
                    "soins": "Perfusion sous-cutanee NaCl 0.9% 500 mL en 4h (125 mL/h), cuisse droite",
                    "constantes": "Apyretique. Etat general : asthenique, conscient, oriente.",
                    "observations": "Nausees matinales persistantes depuis chimio J+5. Alimentation reduite.",
                    "actions": "Signaler nausees persistantes a l'oncologue si pas d'amelioration demain.",
                },
                "recording_duration_seconds": 0,
                "generation_time_ms": 2900,
                "created_at": make_dt(TWO_DAYS_AGO, 14, 10),
            },
            # 6. Vocale completed — Bernard Chauveau (anticoagulant/INR, Maille)
            {
                "patient_idx": 9,
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Prelevement INR chez Monsieur Chauveau. INR du jour 2.8, dans la "
                    "cible therapeutique 2 a 3. Pas de signe hemorragique, pas d'hematome. "
                    "Le patient prend bien son Previscan a heure fixe le soir a 19 heures. "
                    "Pas de modification alimentaire recente. Prochain controle dans 15 "
                    "jours. Resultats transmis au laboratoire et au medecin traitant."
                ),
                "structured_data": {
                    "synthese": "Controle INR dans la cible (2.8 pour cible 2-3). Pas de signe hemorragique. Prochain controle dans 15 jours.",
                    "soins": "Prelevement sanguin INR capillaire",
                    "constantes": "INR : 2.8 (cible 2.0 - 3.0)",
                    "observations": "Pas de signe hemorragique, pas d'hematome. Previscan pris regulierement a 19h.",
                    "actions": "Resultats transmis labo et Dr Leblanc. Prochain INR dans 15 jours.",
                },
                "recording_duration_seconds": 30,
                "generation_time_ms": 2200,
                "created_at": make_dt(THREE_DAYS_AGO, 10, 20),
            },
            # 7. Vocale completed — Germaine Paillat (dependance, Le Mazeau)
            {
                "patient_idx": 15,
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Toilette de Madame Paillat. La patiente est de bonne humeur ce matin, "
                    "a bien dormi. Mobilisation au fauteuil apres la toilette, transfert "
                    "avec aide d'un seul soignant. Legers oedemes des chevilles, signe du "
                    "godet positif bilateral. Peau correcte, pas de rougeur aux points "
                    "d'appui. Pilulier verifie, tous les medicaments de la veille ont ete pris."
                ),
                "structured_data": {
                    "synthese": "Soins d'hygiene et mobilisation. Oedemes des chevilles a surveiller. Etat general satisfaisant.",
                    "soins": "Toilette au lit, mobilisation au fauteuil, verification pilulier",
                    "constantes": "Oedemes chevilles bilateraux (signe du godet +)",
                    "observations": "Bonne humeur, bon sommeil. Transfert fauteuil avec 1 aide. Peau OK aux points d'appui.",
                    "actions": "Surveiller evolution oedemes. Signaler au medecin si aggravation.",
                },
                "recording_duration_seconds": 35,
                "generation_time_ms": 2600,
                "created_at": make_dt(YESTERDAY, 8, 15),
            },
            # 8. Ecrite completed — Paulette Guerin (hypertension, Damvix)
            {
                "patient_idx": 4,
                "type": "written",
                "status": "completed",
                "transcription": (
                    "Surveillance tensionnelle de Mme Guerin. TA 145/82 mmHg au bras "
                    "gauche, position assise apres 5 minutes de repos. Pouls 72 bpm "
                    "regulier. Patiente asymptomatique, pas de cephalees, pas de vertiges. "
                    "Traitement antihypertenseur pris ce matin (Amlodipine 5 mg)."
                ),
                "structured_data": {
                    "synthese": "Surveillance tensionnelle. TA legerement elevee (145/82) sous traitement. Patiente asymptomatique.",
                    "soins": "Mesure tensionnelle bras gauche, prise de pouls",
                    "constantes": "TA : 145/82 mmHg (bras gauche, assise). Pouls : 72 bpm regulier.",
                    "observations": "Asymptomatique. Amlodipine 5 mg pris ce matin.",
                    "actions": "Continuer surveillance. Consulter medecin si TA > 160/95 ou symptomes.",
                },
                "recording_duration_seconds": 0,
                "generation_time_ms": 1800,
                "created_at": make_dt(THREE_DAYS_AGO, 8, 10),
            },
            # 9. Vocale transcribed (synthese pas encore faite) — Rene Arnault (diabete, St-Sigismond)
            {
                "patient_idx": 12,
                "type": "vocal",
                "status": "transcribed",
                "transcription": (
                    "Passage chez Monsieur Arnault pour injection insuline. Glycemie ce "
                    "matin 1.15 g/L, dans la cible. Injection Novorapid 8 unites avant le "
                    "petit dejeuner, abdomen cote droit. Bon etat general, patient autonome "
                    "pour la preparation de ses repas."
                ),
                "structured_data": {},
                "recording_duration_seconds": 18,
                "generation_time_ms": 0,
                "created_at": make_dt(TODAY, 8, 5),
            },
            # 10. Vocale validated — Roger Merlet (pansement post-op, Le Mazeau)
            {
                "patient_idx": 16,
                "type": "vocal",
                "status": "validated",
                "transcription": (
                    "Pansement post-operatoire genou droit chez Monsieur Merlet, J+12 "
                    "apres prothese totale de genou. Cicatrice propre, agrafes en place, "
                    "pas de rougeur pericicatricielle, pas d'ecoulement. Flexion du genou "
                    "a 90 degres, bonne progression. Le kine passe 3 fois par semaine. "
                    "Patient marche avec une canne, bonne stabilite. Ablation des agrafes "
                    "prevue J+15 par le chirurgien."
                ),
                "structured_data": {
                    "synthese": "Pansement PTG droite J+12. Cicatrice propre, flexion 90 degres. Bonne evolution. Ablation agrafes J+15.",
                    "soins": "Pansement cicatrice genou droit : nettoyage Biseptine, compresses steriles, Micropore",
                    "constantes": "Flexion genou : 90 degres. Cicatrice : propre, agrafes en place, pas d'ecoulement.",
                    "observations": "Bonne progression. Marche avec canne, stable. Kinesitherapie 3x/semaine.",
                    "actions": "Ablation agrafes J+15 par chirurgien. Continuer pansements jusqu'a ablation.",
                },
                "recording_duration_seconds": 40,
                "generation_time_ms": 3100,
                "created_at": make_dt(TWO_DAYS_AGO, 15, 0),
            },
        ]

        for tx_data in transmissions_data:
            p = patients[tx_data["patient_idx"]]
            encrypted_transcription = None
            if tx_data["transcription"]:
                encrypted_transcription = encrypt(tx_data["transcription"], cab_key)

            tx = TransmissionModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                idel_id=user_id,
                patient_id=p.id,
                type=tx_data["type"],
                status=tx_data["status"],
                transcription_encrypted=encrypted_transcription,
                structured_data=tx_data.get("structured_data") or None,
                recording_duration_seconds=tx_data.get("recording_duration_seconds", 0),
                generation_time_ms=tx_data.get("generation_time_ms", 0),
                created_at=tx_data["created_at"],
                updated_at=tx_data["created_at"],
            )
            session.add(tx)

        await session.commit()

        vocal = sum(1 for t in transmissions_data if t["type"] == "vocal")
        written = sum(1 for t in transmissions_data if t["type"] == "written")
        print()
        print("=" * 50)
        print("  Transmissions de demo inserees !")
        print("=" * 50)
        print(f"  Total: {len(transmissions_data)} ({vocal} vocales, {written} ecrites)")
        print(f"  Statuts: 5 completed, 3 validated, 1 transcribed")
        print(f"  Patients concernes: 8 patients differents")
        print(f"  Dates: {THREE_DAYS_AGO} a {TODAY}")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
