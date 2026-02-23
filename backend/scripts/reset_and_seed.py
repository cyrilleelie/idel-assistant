"""Reset la base et la recharge avec les donnees du frontend-web-v2.

Cree 1 cabinet, 3 infirmieres (Alice, Benoit, Claire), 10 patients
et 12 RDV (aujourd'hui + demain), calques sur les mocks de defaults.js.

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

        # ===== 2. Cabinet =====
        cabinet_id = uuid4()
        session.add(CabinetModel(
            id=cabinet_id,
            name="Cabinet IDEL Paris",
            address="12 Rue de la Paix, 75002 Paris",
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

        # ===== 4. Dix patients (chiffres) =====
        cab_key = km.get_cabinet_key(cabinet_id)

        # (first, last, phone, email, address, ssn, doctor_name, doctor_contact,
        #  antecedents, notes, postal_code, city)
        patients_raw = [
            ("Jean", "DUPONT", "06 11 22 33 44", "jean.dupont@email.com",
             "12 Rue de la Paix, 75002 Paris", "1 80 12 75 123 456 78",
             "Dr. Michel Lefevre", "01 45 67 89 00",
             "Diabète de type 2 (diagnostiqué en 2018)\nHypertension artérielle sous traitement.",
             "Patient parfois anxieux lors des prises de sang. Prévoir un peu de temps pour rassurer.",
             "75002", "Paris"),

            ("Marie", "BERNARD", "06 22 33 44 55", "",
             "8 Avenue Victor Hugo, 75016 Paris", "2 55 03 75 234 567 89",
             "Dr. Sophie Garnier", "01 42 56 78 90",
             "Insuffisance cardiaque chronique.\nAnticoagulants (AVK) — INR à surveiller.",
             "Code porte : 4521B. Habite au 3e sans ascenseur.",
             "75016", "Paris"),

            ("Robert", "MOREAU", "06 33 44 55 66", "r.moreau@free.fr",
             "45 Boulevard Haussmann, 75009 Paris", "1 42 07 75 345 678 90",
             "Dr. Michel Lefevre", "01 45 67 89 00",
             "BPCO stade 3.\nOxygénothérapie à domicile.",
             "Passage infirmier matin impératif avant 9h (oxygène). Clé sous le pot de fleurs.",
             "75009", "Paris"),

            ("Françoise", "PETIT", "06 44 55 66 77", "",
             "3 Rue des Lilas, 75020 Paris", "2 38 11 75 456 789 01",
             "Dr. Anne Dubois", "01 43 78 90 12",
             "Alzheimer stade modéré (diagnostiqué 2021).\nChutes fréquentes — prothèse hanche droite 2023.",
             "Aidante principale : sa fille Nathalie (06 77 88 99 00). Patiente désorientée le matin.",
             "75020", "Paris"),

            ("Pierre", "LEROY", "06 55 66 77 88", "pierre.leroy@gmail.com",
             "22 Rue du Faubourg Saint-Antoine, 75012 Paris", "1 65 04 75 567 890 12",
             "Dr. Sophie Garnier", "01 42 56 78 90",
             "Diabète de type 1 insulino-dépendant.\nNeuropathie périphérique — soins de pieds.",
             "Insuline au réfrigérateur, 2e étagère. Patient autonome et coopérant.",
             "75012", "Paris"),

            ("Simone", "ROUX", "01 45 67 00 11", "",
             "17 Rue Monge, 75005 Paris", "2 30 09 75 678 901 23",
             "Dr. Michel Lefevre", "01 45 67 89 00",
             "AVC ischémique (2022) — hémiparésie gauche.\nPansement escarre sacrée.",
             "Lit médicalisé au salon. Mari présent mais très âgé, ne pas compter sur lui pour la mobilisation.",
             "75005", "Paris"),

            ("Ahmed", "BENALI", "06 66 77 88 99", "a.benali@outlook.fr",
             "5 Place de la République, 75003 Paris", "1 72 06 75 789 012 34",
             "Dr. Anne Dubois", "01 43 78 90 12",
             "Chirurgie genou droit (LCA) — rééducation en cours.\nPas d'allergie connue.",
             "Pansement post-opératoire à changer tous les 2 jours. Très sportif, surveiller la reprise.",
             "75003", "Paris"),

            ("Hélène", "GARCIA", "06 77 88 99 00", "",
             "60 Rue de Rivoli, 75004 Paris", "2 48 12 75 890 123 45",
             "Dr. Sophie Garnier", "01 42 56 78 90",
             "Cancer du sein — chimiothérapie en cours.\nPort-à-cath posé en janvier 2026.",
             "Rinçage PAC toutes les 4 semaines. Patiente fatiguée, prévoir passage calme.",
             "75004", "Paris"),

            ("Michel", "THOMAS", "06 88 99 00 11", "michel.thomas@wanadoo.fr",
             "33 Rue de Vaugirard, 75006 Paris", "1 50 02 75 901 234 56",
             "Dr. Michel Lefevre", "01 45 67 89 00",
             "Insuffisance rénale chronique stade 4.\nDialyse péritonéale à domicile.",
             "Matériel de dialyse dans la chambre du fond. Surveiller poids et tension à chaque passage.",
             "75006", "Paris"),

            ("Lucie", "LAMBERT", "06 99 00 11 22", "lucie.lambert@gmail.com",
             "14 Rue Oberkampf, 75011 Paris", "2 85 08 75 012 345 67",
             "Dr. Anne Dubois", "01 43 78 90 12",
             "Grossesse à risque (jumeaux) — repos strict.\nDiabète gestationnel.",
             "Glycémie capillaire + injection insuline matin et soir. Conjoint souvent présent le soir.",
             "75011", "Paris"),
        ]

        patient_models = []
        for (fn, ln, phone, email, addr, ssn, doc_name, doc_contact,
             antecedents, notes, pc, city) in patients_raw:
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

        # p[0]=Jean, p[1]=Marie, p[2]=Robert, p[3]=Françoise, p[4]=Pierre,
        # p[5]=Simone, p[6]=Ahmed, p[7]=Hélène, p[8]=Michel, p[9]=Lucie
        p = patient_models

        appts = [
            # Today — Matin
            (alice_id,  p[0], dt(TODAY, 7, 0),   30, "injection_insuline"),   # Jean DUPONT
            (alice_id,  p[3], dt(TODAY, 8, 0),   45, "soins_hygiene"),        # Françoise PETIT
            (alice_id,  p[5], dt(TODAY, 9, 0),   30, "pansement"),            # Simone ROUX
            (benoit_id, p[1], dt(TODAY, 7, 30),  30, "surveillance_tension"), # Marie BERNARD
            (benoit_id, p[4], dt(TODAY, 8, 30),  30, "injection_insuline"),   # Pierre LEROY
            (benoit_id, p[8], dt(TODAY, 9, 30),  30, "surveillance_dialyse"), # Michel THOMAS
            # Today — Soir
            (alice_id,  p[7], dt(TODAY, 17, 0),  30, "perfusion"),            # Hélène GARCIA
            (alice_id,  p[9], dt(TODAY, 18, 0),  30, "injection_insuline"),   # Lucie LAMBERT
            # Tomorrow — Matin
            (alice_id,  p[0], dt(TOMORROW, 7, 0),  30, "injection_insuline"), # Jean DUPONT
            (claire_id, p[2], dt(TOMORROW, 7, 30), 30, "soins_respiratoire"), # Robert MOREAU
            (claire_id, p[6], dt(TOMORROW, 8, 30), 30, "pansement"),          # Ahmed BENALI
            # Tomorrow — Soir
            (benoit_id, p[9], dt(TOMORROW, 18, 0), 30, "injection_insuline"), # Lucie LAMBERT
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
    print("=" * 55)
    print("  Base nettoyee et rechargee avec succes !")
    print("=" * 55)
    print()
    print("  Cabinet : Cabinet IDEL Paris")
    print()
    print("  Comptes :")
    print(f"    alice.dupont@cabinet.fr   / {PASSWORD}  (admin)")
    print(f"    benoit.martin@cabinet.fr  / {PASSWORD}  (member)")
    print(f"    claire.rousseau@cabinet.fr/ {PASSWORD}  (replacement)")
    print()
    print(f"  Patients : {len(patients_raw)}")
    print(f"  RDV      : {len(appts)} (aujourd'hui + demain)")
    print("=" * 55)


if __name__ == "__main__":
    asyncio.run(main())
