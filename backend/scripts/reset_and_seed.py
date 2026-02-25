"""Reset la base et la recharge avec des donnees de demo.

Cree 1 cabinet a Damvix (Vendee), 3 infirmieres (Alice, Benoit, Claire),
20 patients repartis sur 4 communes du Marais Poitevin (Damvix, Le Mazeau,
Saint-Sigismond, Maille) et 12 RDV (aujourd'hui + demain).

Usage: cd backend && uv run python scripts/reset_and_seed.py
"""

import asyncio
import datetime
import json
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.infrastructure.persistence.database import async_session_factory, engine
from app.infrastructure.persistence.models.user_model import UserModel, CabinetMemberModel
from app.infrastructure.persistence.models.cabinet_model import CabinetModel
from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.persistence.models.appointment_model import AppointmentModel
from app.infrastructure.security.password_handler import hash_password
from app.infrastructure.security.encryption import encrypt, compute_search_hash
from app.infrastructure.security.key_manager import KeyManager
from sqlalchemy import text


PASSWORD = "Demo1234!"
TODAY = datetime.date.today()
TOMORROW = TODAY + datetime.timedelta(days=1)


def _enc(value: str, key: bytes) -> bytes:
    return encrypt(value, key)


def _hash(value: str, key: bytes) -> str:
    return compute_search_hash(value, key)


async def main():
    km = KeyManager(settings.encryption_master_key)

    # ===== 1. Truncate all tables =====
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE TABLE audit_logs, appointments, care_protocols, documents, "
            "patients, sectors, cabinet_members, cabinets, users "
            "CASCADE"
        ))
    print("Tables videes.")

    async with async_session_factory() as session:

        # ===== 2. Cabinet (Damvix, Marais Poitevin) =====
        cabinet_id = uuid4()
        session.add(CabinetModel(
            id=cabinet_id,
            name="Cabinet IDEL Damvix",
            address="5 Rue du Centre, 85420 Damvix",
        ))

        # ===== 3. Trois infirmieres (users + cabinet_members) =====
        pw_hash = hash_password(PASSWORD)

        alice_id = uuid4()
        benoit_id = uuid4()
        claire_id = uuid4()

        users_data = [
            (alice_id, "alice.dupont@cabinet.fr", "Alice", "Dupont", "99900000001", "06 12 34 56 78"),
            (benoit_id, "benoit.martin@cabinet.fr", "Benoît", "Martin", "99900000002", "06 98 76 54 32"),
            (claire_id, "claire.rousseau@cabinet.fr", "Claire", "Rousseau", "99900000003", "06 55 44 33 22"),
        ]
        for uid, email, fn, ln, rpps, phone in users_data:
            session.add(UserModel(
                id=uid, email=email, password_hash=pw_hash,
                first_name=fn, last_name=ln, rpps=rpps, phone=phone,
            ))

        await session.flush()  # users must exist before FK on cabinet_members

        members_data = [
            (alice_id, "admin", "#3B82F6"),     # Titulaire / bleu
            (benoit_id, "member", "#10B981"),    # Collaborateur / vert
            (claire_id, "replacement", "#8B5CF6"),  # Remplacant(e) / violet
        ]
        member_ids = {}
        for uid, role, color in members_data:
            mid = uuid4()
            member_ids[uid] = mid
            session.add(CabinetMemberModel(
                id=mid, cabinet_id=cabinet_id, user_id=uid,
                role=role, color=color,
            ))

        await session.flush()

        # ===== 4. Vingt patients (Marais Poitevin — 4 communes) =====
        cab_key = km.get_cabinet_key(cabinet_id)

        # (first, last, phone, email, address, ssn, doctor_name, doctor_contact,
        #  antecedents, notes, postal_code, city, lat, lon)
        patients_raw = [
            # --- Damvix (6 patients) ---
            ("Lucienne", "MOREAU", "06 11 11 11 11", "",
             "8 Rue de la Garnauderie, 85420 Damvix", "2 41 03 85 123 456 78",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Diabète de type 2 (diagnostiqué en 2015).\nHypertension artérielle sous traitement.",
             "Patiente autonome, vit seule. Clé sous le pot à gauche de la porte.",
             "85420", "Damvix", 46.3150, -0.7340),

            ("Marcel", "GAUTHIER", "06 11 22 22 22", "",
             "17 Rue du Centre, 85420 Damvix", "1 48 07 85 234 567 89",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Pansement chronique ulcère veineux jambe gauche.\nInsuffisance veineuse sévère.",
             "Pansement à changer tous les 2 jours. Patient coopérant.",
             "85420", "Damvix", 46.3155, -0.7335),

            ("Yvette", "ROBIN", "06 11 33 33 33", "",
             "17 Rue du Cloucq, 85420 Damvix", "2 35 11 85 345 678 90",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Alzheimer stade modéré (diagnostiqué 2022).\nChutes fréquentes.",
             "Aidante : sa fille Nathalie (06 77 88 99 00). Patiente désorientée le matin.",
             "85420", "Damvix", 46.3140, -0.7350),

            ("Henri", "BARDIN", "06 11 44 44 44", "henri.bardin@orange.fr",
             "37 Rue des Petites Cabanes, 85420 Damvix", "1 54 01 85 456 789 01",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Cancer prostate — hormonothérapie en cours.\nSurveillance PSA.",
             "Injection sous-cutanée mensuelle. Patient anxieux, prévoir du temps.",
             "85420", "Damvix", 46.3160, -0.7330),

            ("Paulette", "GUERIN", "06 11 55 55 55", "",
             "24 Chemin du Halage, 85420 Damvix", "2 38 09 85 567 890 12",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Hypertension artérielle.\nInsuffisance cardiaque chronique (NYHA II).",
             "Surveillance tension à chaque passage. Vit avec son mari (autonome).",
             "85420", "Damvix", 46.3180, -0.7360),

            ("André", "BLANCHARD", "06 11 66 66 66", "a.blanchard@free.fr",
             "12 Rue du Centre, 85420 Damvix", "1 57 05 85 678 901 23",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Post-opératoire prothèse hanche gauche (février 2026).\nAnticoagulant préventif.",
             "Injection Lovenox quotidienne. Patient mobile avec déambulateur.",
             "85420", "Damvix", 46.3148, -0.7338),

            # --- Le Mazeau (5 patients) ---
            ("Germaine", "PAILLAT", "06 22 11 11 11", "",
             "11 Rue Principale, 85420 Le Mazeau", "2 34 08 85 789 012 34",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Dépendance — toilette et habillage.\nArthrose sévère genoux + hanches.",
             "Passage matin impératif avant 9h. Auxiliaire de vie l'après-midi.",
             "85420", "Le Mazeau", 46.3360, -0.6750),

            ("Roger", "MERLET", "06 22 22 22 22", "",
             "7 Rue du Port, 85420 Le Mazeau", "1 53 11 85 890 123 45",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Pansement post-opératoire genou droit.\nDiabète de type 2.",
             "Réfection pansement + glycémie capillaire. Clé chez la voisine Mme Botton.",
             "85420", "Le Mazeau", 46.3370, -0.6745),

            ("Thérèse", "BONNIN", "06 22 33 33 33", "",
             "10 Rue Principale, 85420 Le Mazeau", "2 40 07 85 901 234 56",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Diabète de type 2 insulino-requérant.\nRétinopathie diabétique.",
             "Injection insuline matin et soir. Patiente malvoyante, préparer le pilulier.",
             "85420", "Le Mazeau", 46.3355, -0.6755),

            ("Michel", "COUTANT", "06 22 44 44 44", "m.coutant@wanadoo.fr",
             "68 Chemin de l'Ancienne Laiterie, 85420 Le Mazeau", "1 58 02 85 012 345 67",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Post-AVC ischémique (2024) — hémiparésie gauche.\nAnticoagulant (Eliquis).",
             "Lit médicalisé au rez-de-chaussée. Épouse présente mais fatiguée.",
             "85420", "Le Mazeau", 46.3375, -0.6740),

            ("Monique", "AIRAULT", "06 22 55 55 55", "",
             "4 Rue André Lucas, 85420 Le Mazeau", "2 45 06 85 123 456 01",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "BPCO stade 3.\nOxygénothérapie à domicile 16h/24.",
             "Vérifier débit O2 et saturation. Passage matin avant 9h impératif.",
             "85420", "Le Mazeau", 46.3350, -0.6740),

            # --- Saint-Sigismond (4 patients) ---
            ("Madeleine", "GIRARD", "06 33 11 11 11", "",
             "1 Rue de la Mairie, 85420 Saint-Sigismond", "2 39 04 85 234 567 01",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Alzheimer stade léger.\nHypertension artérielle.",
             "Préparation pilulier hebdomadaire. Voisine alerte si besoin (Mme Giraud, 06 33 00 00 01).",
             "85420", "Saint-Sigismond", 46.3490, -0.6890),

            ("René", "ARNAULT", "06 33 22 22 22", "rene.arnault@orange.fr",
             "3 Grande Rue, 85420 Saint-Sigismond", "1 46 10 85 345 678 01",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Diabète de type 2.\nInsuffisance rénale chronique stade 3.",
             "Glycémie + injection insuline matin. Surveiller œdèmes des membres inférieurs.",
             "85420", "Saint-Sigismond", 46.3492, -0.6885),

            ("Colette", "BAUDRY", "06 33 33 33 33", "",
             "8 Rue de l'Église, 85420 Saint-Sigismond", "2 52 03 85 456 789 01",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Cancer sein — chimiothérapie en cours.\nPort-à-cath posé en décembre 2025.",
             "Rinçage PAC toutes les 4 semaines. Patiente fatiguée, prévoir passage calme.",
             "85420", "Saint-Sigismond", 46.3500, -0.6892),

            ("Jean-Claude", "TEXIER", "06 33 44 44 44", "",
             "12 Chemin du Halage de Courdault, 85420 Saint-Sigismond", "1 50 08 85 567 890 01",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Insuffisance cardiaque chronique (NYHA III).\nAnticoagulant (AVK) — INR à surveiller.",
             "Prise de sang INR chaque semaine. Résultats à faxer au Dr. Morin.",
             "85420", "Saint-Sigismond", 46.3510, -0.6880),

            # --- Maillé (5 patients) ---
            ("Jeannine", "BOUCHET", "06 44 11 11 11", "",
             "3 Rue de la Mairie, 85420 Maillé", "2 43 02 85 678 901 01",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Diabète de type 2.\nArthrose cervicale.",
             "Injection insuline matin. Patiente sourde d'une oreille, parler fort.",
             "85420", "Maillé", 46.3420, -0.7870),

            ("Raymond", "PINEAU", "06 44 22 22 22", "",
             "15 Grand Rue, 85420 Maillé", "1 55 12 85 789 012 01",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "BPCO stade 2.\nSyndrome d'apnée du sommeil appareillé.",
             "Surveillance respiratoire. Appareil PPC à vérifier lors des passages.",
             "85420", "Maillé", 46.3430, -0.7860),

            ("Simone", "DUPUIS", "06 44 33 33 33", "",
             "9 Rue Saint Nicolas, 85420 Maillé", "2 36 06 85 890 123 01",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Escarres sacrée et talonnière gauche (stade 3).\nAlitée suite fracture col fémur.",
             "Pansements à changer tous les jours. Lit médicalisé. Mari aidant mais fatigué.",
             "85420", "Maillé", 46.3410, -0.7875),

            ("Bernard", "CHAUVEAU", "06 44 44 44 44", "b.chauveau@gmail.com",
             "6 Rue de la Mairie, 85420 Maillé", "1 49 06 85 901 234 01",
             "Dr. Isabelle Morin", "02 51 87 45 67",
             "Anticoagulant (Préviscan) — surveillance INR.\nFibrillation auriculaire permanente.",
             "Prise de sang hebdomadaire. Patient coopérant et autonome.",
             "85420", "Maillé", 46.3425, -0.7868),

            ("Odette", "VRIGNAUD", "06 44 55 55 55", "",
             "4 Rue de l'Autize, 85420 Maillé", "2 37 12 85 012 345 01",
             "Dr. Philippe Renaud", "02 51 87 12 34",
             "Hypertension artérielle sévère.\nDiabète de type 2.",
             "Surveillance tension + glycémie. Clé dans la boîte aux lettres.",
             "85420", "Maillé", 46.3415, -0.7880),
        ]

        patient_models = []
        for (fn, ln, phone, email, addr, ssn, doc_name, doc_contact,
             antecedents, notes, pc, city, lat, lon) in patients_raw:
            p = PatientModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                first_name_encrypted=_enc(fn, cab_key),
                last_name_encrypted=_enc(ln, cab_key),
                first_name_search_hash=_hash(fn, cab_key),
                last_name_search_hash=_hash(ln, cab_key),
                birth_date_encrypted=None,
                phone_encrypted=_enc(phone, cab_key) if phone else None,
                email_encrypted=_enc(email, cab_key) if email else None,
                address_encrypted=_enc(addr, cab_key) if addr else None,
                ssn_encrypted=_enc(ssn, cab_key) if ssn else None,
                ssn_search_hash=_hash(ssn, cab_key) if ssn else None,
                doctor_name_encrypted=_enc(doc_name, cab_key) if doc_name else None,
                doctor_contact_encrypted=_enc(doc_contact, cab_key) if doc_contact else None,
                pathologies_encrypted=_enc(json.dumps([line for line in antecedents.split("\n") if line.strip()]), cab_key) if antecedents else None,
                notes_encrypted=_enc(notes, cab_key) if notes else None,
                postal_code=pc,
                city=city,
                lat=lat,
                lon=lon,
                care_duration_default=30,
                status="active",
            )
            session.add(p)
            patient_models.append(p)

        await session.flush()

        # ===== 5. Douze rendez-vous (today + tomorrow) =====
        def dt(day, hour, minute):
            return datetime.datetime(day.year, day.month, day.day,
                                     hour, minute, tzinfo=datetime.UTC)

        # Damvix: 0=Lucienne 1=Marcel 2=Yvette 3=Henri 4=Paulette 5=André
        # Le Mazeau: 6=Germaine 7=Roger 8=Thérèse 9=Michel 10=Monique
        # St-Sigismond: 11=Madeleine 12=René 13=Colette 14=Jean-Claude
        # Maillé: 15=Jeannine 16=Raymond 17=Simone 18=Bernard 19=Odette
        p = patient_models

        appts = [
            # Today — Matin (secteur Damvix + Le Mazeau)
            (alice_id,  p[0],  dt(TODAY, 7, 0),   20, "injection_insuline"),   # Lucienne MOREAU (Damvix)
            (alice_id,  p[1],  dt(TODAY, 7, 30),  30, "pansement"),            # Marcel GAUTHIER (Damvix)
            (alice_id,  p[4],  dt(TODAY, 8, 15),  15, "surveillance_tension"), # Paulette GUERIN (Damvix)
            (benoit_id, p[6],  dt(TODAY, 7, 0),   30, "soins_hygiene"),        # Germaine PAILLAT (Le Mazeau)
            (benoit_id, p[8],  dt(TODAY, 7, 45),  20, "injection_insuline"),   # Thérèse BONNIN (Le Mazeau)
            (benoit_id, p[10], dt(TODAY, 8, 15),  30, "soins_respiratoire"),   # Monique AIRAULT (Le Mazeau)
            # Today — Après-midi (secteur Maillé + St-Sigismond)
            (alice_id,  p[15], dt(TODAY, 16, 30), 20, "injection_insuline"),   # Jeannine BOUCHET (Maillé)
            (alice_id,  p[17], dt(TODAY, 17, 0),  45, "pansement"),            # Simone DUPUIS (Maillé)
            # Tomorrow — Matin
            (alice_id,  p[0],  dt(TOMORROW, 7, 0),  20, "injection_insuline"), # Lucienne MOREAU (Damvix)
            (claire_id, p[12], dt(TOMORROW, 7, 30), 20, "injection_insuline"), # René ARNAULT (St-Sigismond)
            (claire_id, p[14], dt(TOMORROW, 8, 0),  15, "prise_de_sang"),      # Jean-Claude TEXIER (St-Sigismond)
            # Tomorrow — Après-midi
            (benoit_id, p[8],  dt(TOMORROW, 17, 0), 20, "injection_insuline"), # Thérèse BONNIN (Le Mazeau)
        ]

        for idel_id, patient, scheduled, dur, care in appts:
            session.add(AppointmentModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                idel_id=idel_id,
                patient_id=patient.id,
                scheduled_at=scheduled,
                duration_minutes=dur,
                care_type=care,
                location_type="home",
                status="scheduled",
                created_by="manual",
            ))

        await session.commit()

    # ===== Résumé =====
    print("=" * 60)
    print("  Base nettoyee et rechargee avec succes !")
    print("=" * 60)
    print()
    print("  Cabinet : Cabinet IDEL Damvix (5 Rue du Centre, 85420)")
    print()
    print("  Comptes :")
    print(f"    alice.dupont@cabinet.fr    / {PASSWORD}  (admin)")
    print(f"    benoit.martin@cabinet.fr   / {PASSWORD}  (member)")
    print(f"    claire.rousseau@cabinet.fr / {PASSWORD}  (replacement)")
    print()
    print(f"  Patients : {len(patients_raw)} (4 communes)")
    print("    Damvix (6), Le Mazeau (5), Saint-Sigismond (4), Maillé (5)")
    print(f"  RDV      : {len(appts)} (aujourd'hui + demain)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
