"""Seed la base avec des donnees de demo (cabinet Damvix, Marais Poitevin).

Cree 3 secteurs, 20 patients repartis sur 4 communes (Damvix, Le Mazeau,
Saint-Sigismond, Maille) et 10 RDV aujourd'hui.
Les credentials du compte demo sont affiches a la fin.

Usage: cd backend && uv run python scripts/seed_demo.py
"""

import asyncio
import datetime
import json
import sys
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.infrastructure.persistence.database import async_session_factory
from app.infrastructure.persistence.models.user_model import UserModel, CabinetMemberModel
from app.infrastructure.persistence.models.cabinet_model import CabinetModel
from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.persistence.models.sector_model import SectorModel
from app.infrastructure.persistence.models.appointment_model import AppointmentModel
from app.infrastructure.persistence.models.prescription_model import PrescriptionModel
from app.infrastructure.persistence.models.transmission_model import TransmissionModel
from app.infrastructure.persistence.models.transmission_prescription_model import TransmissionPrescriptionModel
from app.infrastructure.security.password_handler import hash_password
from app.infrastructure.security.encryption import encrypt, compute_search_hash
from app.infrastructure.security.key_manager import KeyManager
from sqlalchemy import select


DEMO_EMAIL = "demo@idel.fr"
DEMO_PASSWORD = "Demo1234!"
DEMO_RPPS = "99900099901"

TODAY = datetime.date.today()


def _encrypt(value: str, key: bytes) -> bytes:
    return encrypt(value, key)


def _search_hash(value: str, key: bytes) -> str:
    return compute_search_hash(value, key)


async def main():
    km = KeyManager(settings.encryption_master_key)

    async with async_session_factory() as session:
        # Check if demo user already exists
        existing = await session.execute(
            select(UserModel).where(UserModel.email == DEMO_EMAIL)
        )
        if existing.scalar_one_or_none():
            print(f"Le compte demo existe deja: {DEMO_EMAIL} / {DEMO_PASSWORD}")
            print("Supprimez-le manuellement si vous voulez re-seeder.")
            return

        # --- Cabinet ---
        cabinet_id = uuid4()
        cabinet = CabinetModel(
            id=cabinet_id,
            name="Cabinet IDEL Damvix",
            address="3 place de l'Eglise, 85420 Damvix",
        )
        session.add(cabinet)

        # --- User (IDEL) ---
        user_id = uuid4()
        user = UserModel(
            id=user_id,
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            first_name="Marie",
            last_name="Dupont",
            rpps=DEMO_RPPS,
            phone="06 12 34 56 78",
        )
        session.add(user)
        await session.flush()

        member = CabinetMemberModel(
            id=uuid4(),
            cabinet_id=cabinet_id,
            user_id=user_id,
            role="admin",
        )
        session.add(member)
        await session.flush()

        # Derive encryption key for this cabinet
        cab_key = km.get_cabinet_key(cabinet_id)

        # --- Sectors (3 zones du Marais Poitevin, 4 communes) ---
        sector_damvix = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Damvix",
            postal_codes=["85420"],
            communes=["Damvix"],
            color="#10B981", display_order=0,
        )
        sector_nord = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Nord / Maillé",
            postal_codes=["85420"],
            communes=["Maillé"],
            color="#3B82F6", display_order=1,
        )
        sector_sud = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Sud / Mazeau-Sigismond",
            postal_codes=["85420"],
            communes=["Le Mazeau", "Saint-Sigismond"],
            color="#EF4444", display_order=2,
        )
        for s in [sector_damvix, sector_nord, sector_sud]:
            session.add(s)

        await session.flush()

        # --- 20 Patients (region Marais Poitevin, 4 communes) ---
        # (prenom, nom, birth_date, lat, lon, sector_id, postal_code, city,
        #  address, phone, pathologies, preferred_time_slot, care_duration, status)
        patients_data = [
            # --- Damvix (6 patients) ---
            ("Lucienne", "Moreau", "1941-03-12", 46.3150, -0.7340, sector_damvix.id,
             "85420", "Damvix", "8 Rue de la Garnauderie, 85420 Damvix",
             "06 11 11 11 11", ["diabete"], "morning", 20, "active"),
            ("Marcel", "Gauthier", "1948-07-22", 46.3155, -0.7335, sector_damvix.id,
             "85420", "Damvix", "17 Rue du Centre, 85420 Damvix",
             "06 11 22 22 22", ["pansement chronique"], "morning", 30, "active"),
            ("Yvette", "Robin", "1935-11-05", 46.3140, -0.7350, sector_damvix.id,
             "85420", "Damvix", "17 Rue du Cloucq, 85420 Damvix",
             "06 11 33 33 33", ["alzheimer"], "morning", 30, "active"),
            ("Henri", "Bardin", "1954-01-30", 46.3160, -0.7330, sector_damvix.id,
             "85420", "Damvix", "37 Rue des Petites Cabanes, 85420 Damvix",
             "06 11 44 44 44", ["cancer"], "afternoon", 45, "active"),
            ("Paulette", "Guerin", "1938-09-14", 46.3180, -0.7360, sector_damvix.id,
             "85420", "Damvix", "24 Chemin du Halage, 85420 Damvix",
             "06 11 55 55 55", ["hypertension"], "morning", 15, "active"),
            ("Andre", "Blanchard", "1957-05-08", 46.3148, -0.7338, sector_damvix.id,
             "85420", "Damvix", "12 Rue du Centre, 85420 Damvix",
             "06 11 66 66 66", ["post-operatoire"], "afternoon", 30, "active"),

            # --- Maillé (5 patients) ---
            ("Jeannine", "Bouchet", "1943-02-18", 46.3420, -0.7870, sector_nord.id,
             "85420", "Maillé", "3 Rue de la Mairie, 85420 Maillé",
             "06 44 11 11 11", ["diabete"], "morning", 20, "active"),
            ("Raymond", "Pineau", "1950-12-03", 46.3430, -0.7860, sector_nord.id,
             "85420", "Maillé", "15 Grand Rue, 85420 Maillé",
             "06 44 22 22 22", ["BPCO"], "afternoon", 30, "active"),
            ("Simone", "Dupuis", "1936-06-27", 46.3410, -0.7875, sector_nord.id,
             "85420", "Maillé", "9 Rue Saint Nicolas, 85420 Maillé",
             "06 44 33 33 33", ["escarres"], "morning", 45, "active"),
            ("Bernard", "Chauveau", "1955-08-11", 46.3425, -0.7868, sector_nord.id,
             "85420", "Maillé", "6 Rue de la Mairie, 85420 Maillé",
             "06 44 44 44 44", ["anticoagulant"], "morning", 15, "active"),
            ("Odette", "Vrignaud", "1937-12-30", 46.3415, -0.7880, sector_nord.id,
             "85420", "Maillé", "4 Rue de l'Autize, 85420 Maillé",
             "06 44 55 55 55", ["hypertension"], "morning", 15, "active"),

            # --- Saint-Sigismond (4 patients) ---
            ("Madeleine", "Girard", "1939-04-21", 46.3490, -0.6890, sector_sud.id,
             "85420", "Saint-Sigismond", "1 Rue de la Mairie, 85420 Saint-Sigismond",
             "06 33 11 11 11", ["alzheimer"], "afternoon", 30, "active"),
            ("Rene", "Arnault", "1946-10-16", 46.3492, -0.6885, sector_sud.id,
             "85420", "Saint-Sigismond", "3 Grande Rue, 85420 Saint-Sigismond",
             "06 33 22 22 22", ["diabete"], "morning", 20, "active"),
            ("Colette", "Baudry", "1952-03-09", 46.3500, -0.6892, sector_sud.id,
             "85420", "Saint-Sigismond", "8 Rue de l'Église, 85420 Saint-Sigismond",
             "06 33 33 33 33", ["cancer"], "morning", 45, "active"),
            ("Jean-Claude", "Texier", "1950-08-11", 46.3510, -0.6880, sector_sud.id,
             "85420", "Saint-Sigismond", "12 Chemin du Halage de Courdault, 85420 Saint-Sigismond",
             "06 33 44 44 44", ["anticoagulant"], "morning", 15, "active"),

            # --- Le Mazeau (5 patients, dont 1 archivé) ---
            ("Germaine", "Paillat", "1934-08-02", 46.3360, -0.6750, sector_sud.id,
             "85420", "Le Mazeau", "11 Rue Principale, 85420 Le Mazeau",
             "06 22 11 11 11", ["dependance"], "morning", 30, "active"),
            ("Roger", "Merlet", "1953-11-25", 46.3370, -0.6745, sector_sud.id,
             "85420", "Le Mazeau", "7 Rue du Port, 85420 Le Mazeau",
             "06 22 22 22 22", ["pansement post-operatoire"], "afternoon", 30, "active"),
            ("Therese", "Bonnin", "1940-07-14", 46.3355, -0.6755, sector_sud.id,
             "85420", "Le Mazeau", "10 Rue Principale, 85420 Le Mazeau",
             "06 22 33 33 33", ["diabete"], "morning", 20, "active"),
            ("Michel", "Coutant", "1958-02-19", 46.3375, -0.6740, sector_sud.id,
             "85420", "Le Mazeau", "68 Chemin de l'Ancienne Laiterie, 85420 Le Mazeau",
             "06 22 44 44 44", ["post-AVC"], "morning", 45, "archived"),
            ("Monique", "Airault", "1945-06-15", 46.3350, -0.6740, sector_sud.id,
             "85420", "Le Mazeau", "4 Rue André Lucas, 85420 Le Mazeau",
             "06 22 55 55 55", ["BPCO"], "morning", 30, "active"),
        ]

        patient_models = []
        for (fn, ln, bd, lat, lon, sid, pc, city, address, phone, patho, pref, dur, status) in patients_data:
            p = PatientModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                first_name_encrypted=_encrypt(fn, cab_key),
                last_name_encrypted=_encrypt(ln, cab_key),
                first_name_search_hash=_search_hash(fn, cab_key),
                last_name_search_hash=_search_hash(ln, cab_key),
                birth_date_encrypted=_encrypt(bd, cab_key) if bd else None,
                phone_encrypted=_encrypt(phone, cab_key),
                email_encrypted=None,
                address_encrypted=_encrypt(address, cab_key),
                pathologies_encrypted=_encrypt(json.dumps(patho), cab_key) if patho else None,
                notes_encrypted=None,
                lat=lat,
                lon=lon,
                sector_id=sid,
                postal_code=pc,
                city=city,
                preferred_time_slot=pref,
                care_duration_default=dur,
                status=status,
                archived_reason="Demenagement" if status == "archived" else None,
                archived_at=datetime.datetime(2025, 12, 1, tzinfo=datetime.UTC) if status == "archived" else None,
            )
            session.add(p)
            patient_models.append(p)

        await session.flush()

        # --- Appointments (today + tomorrow + past for transmissions) ---
        TOMORROW = TODAY + datetime.timedelta(days=1)
        YESTERDAY = TODAY - datetime.timedelta(days=1)
        TWO_DAYS_AGO = TODAY - datetime.timedelta(days=2)
        THREE_DAYS_AGO = TODAY - datetime.timedelta(days=3)

        def make_dt(day, hour, minute):
            from zoneinfo import ZoneInfo
            return datetime.datetime(day.year, day.month, day.day, hour, minute, tzinfo=ZoneInfo("Europe/Paris"))

        # Indices in patients_data:
        # 0=Lucienne(Damvix) 1=Marcel 2=Yvette 3=Henri 4=Paulette 5=Andre
        # 6=Jeannine(Maillé) 7=Raymond 8=Simone 9=Bernard 10=Odette
        # 11=Madeleine(St-Sigismond) 12=Rene 13=Colette 14=Jean-Claude
        # 15=Germaine(Mazeau) 16=Roger 17=Therese 18=Michel(archived) 19=Monique

        # Today: 10 RDV
        appts_today = [
            (patient_models[0],  make_dt(TODAY, 7, 30),  20, "injection_insuline"),
            (patient_models[4],  make_dt(TODAY, 8, 0),   15, "prise_de_sang"),
            (patient_models[1],  make_dt(TODAY, 8, 30),  30, "pansement"),
            (patient_models[2],  make_dt(TODAY, 9, 15),  30, "soins_hygiene"),
            (patient_models[6],  make_dt(TODAY, 10, 0),  20, "injection_insuline"),
            (patient_models[8],  make_dt(TODAY, 10, 30), 45, "pansement"),
            (patient_models[10], make_dt(TODAY, 11, 30), 15, "surveillance_tension"),
            (patient_models[3],  make_dt(TODAY, 13, 30), 45, "perfusion"),
            (patient_models[16], make_dt(TODAY, 14, 30), 30, "pansement"),
            (patient_models[11], make_dt(TODAY, 15, 30), 30, "soins_hygiene"),
        ]

        # Tomorrow: 7 RDV
        appts_tomorrow = [
            (patient_models[0],  make_dt(TOMORROW, 7, 30),  20, "injection_insuline"),
            (patient_models[5],  make_dt(TOMORROW, 8, 15),  30, "pansement"),
            (patient_models[7],  make_dt(TOMORROW, 9, 0),   20, "prise_de_sang"),
            (patient_models[12], make_dt(TOMORROW, 10, 0),  30, "soins_hygiene"),
            (patient_models[13], make_dt(TOMORROW, 11, 0),  15, "surveillance_tension"),
            (patient_models[15], make_dt(TOMORROW, 14, 0),  45, "perfusion"),
            (patient_models[17], make_dt(TOMORROW, 15, 30), 30, "pansement"),
        ]

        # Past appointments (completed, linked to transmissions below)
        appts_past = [
            # Tx#1: Lucienne — injection insuline yesterday
            (patient_models[0],  make_dt(YESTERDAY, 7, 30),     20, "injection_insuline", "completed"),
            # Tx#2: Marcel — pansement 2 days ago
            (patient_models[1],  make_dt(TWO_DAYS_AGO, 8, 30),  30, "pansement", "completed"),
            # Tx#3: Yvette — soins hygiene yesterday
            (patient_models[2],  make_dt(YESTERDAY, 9, 15),     30, "soins_hygiene", "completed"),
            # Tx#4: Simone — pansement yesterday
            (patient_models[8],  make_dt(YESTERDAY, 10, 30),    45, "pansement", "completed"),
            # Tx#5: Henri — perfusion 2 days ago
            (patient_models[3],  make_dt(TWO_DAYS_AGO, 13, 30), 45, "perfusion", "completed"),
            # Tx#6: Bernard — prise_de_sang 3 days ago
            (patient_models[9],  make_dt(THREE_DAYS_AGO, 10, 0), 15, "prise_de_sang", "completed"),
            # Tx#7: Germaine — soins_hygiene yesterday
            (patient_models[15], make_dt(YESTERDAY, 8, 0),      30, "soins_hygiene", "completed"),
            # Tx#8: Paulette — surveillance_tension 3 days ago
            (patient_models[4],  make_dt(THREE_DAYS_AGO, 8, 0), 15, "surveillance_tension", "completed"),
            # Tx#9: Rene — injection_insuline today
            (patient_models[12], make_dt(TODAY, 7, 45),         20, "injection_insuline", "completed"),
            # Tx#10: Roger — pansement 2 days ago
            (patient_models[16], make_dt(TWO_DAYS_AGO, 14, 30), 30, "pansement", "completed"),
        ]

        appts = appts_today + appts_tomorrow

        appt_models = []
        for (patient, scheduled, dur, care) in appts:
            a = AppointmentModel(
                id=uuid4(), cabinet_id=cabinet_id, idel_id=user_id,
                patient_id=patient.id,
                scheduled_at=scheduled,
                duration_minutes=dur,
                care_type=care,
                location_type="home",
                status="scheduled",
                created_by="manual",
            )
            session.add(a)
            appt_models.append(a)

        # Past appointments (completed)
        past_appt_models = []
        for (patient, scheduled, dur, care, status) in appts_past:
            a = AppointmentModel(
                id=uuid4(), cabinet_id=cabinet_id, idel_id=user_id,
                patient_id=patient.id,
                scheduled_at=scheduled,
                duration_minutes=dur,
                care_type=care,
                location_type="home",
                status=status,
                created_by="manual",
            )
            session.add(a)
            past_appt_models.append(a)

        await session.flush()

        # --- Prescriptions (ordonnances pour les patients qui ont des transmissions) ---
        THIRTY_DAYS_AGO = TODAY - datetime.timedelta(days=30)
        IN_SIXTY_DAYS = TODAY + datetime.timedelta(days=60)
        IN_THIRTY_DAYS = TODAY + datetime.timedelta(days=30)
        IN_TEN_DAYS = TODAY + datetime.timedelta(days=10)

        prescriptions_data = [
            # 0: Lucienne Moreau — injection insuline (diabète)
            {
                "patient": patient_models[0],
                "label": "Injection insuline Lantus quotidienne",
                "prescriber_name": "Renaud",
                "prescriber_rpps": "99900012345",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_SIXTY_DAYS,
                "duration_days": 90,
                "care_description": "Injection sous-cutanee insuline Lantus 22 UI/jour + glycemie capillaire",
                "act_codes": ["AMI", "injection_insuline"],
                "frequency": "1x/jour",
                "status": "active",
            },
            # 1: Marcel Gauthier — pansement ulcère veineux
            {
                "patient": patient_models[1],
                "label": "Pansement ulcere veineux jambe droite",
                "prescriber_name": "Renaud",
                "prescriber_rpps": "99900012345",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_THIRTY_DAYS,
                "duration_days": 60,
                "care_description": "Pansement ulcere veineux : nettoyage serum phy, Algosteril, Urgotul, contention Biflex",
                "act_codes": ["AMI", "pansement"],
                "frequency": "3x/semaine",
                "status": "active",
            },
            # 2: Yvette Robin — soins hygiene (Alzheimer)
            {
                "patient": patient_models[2],
                "label": "Toilette et aide a l'habillage",
                "prescriber_name": "Renaud",
                "prescriber_rpps": "99900012345",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_SIXTY_DAYS,
                "duration_days": 90,
                "care_description": "Soins d'hygiene quotidiens, aide a l'habillage, verification pilulier",
                "act_codes": ["AIS", "soins_hygiene"],
                "frequency": "1x/jour",
                "status": "active",
            },
            # 3: Henri Bardin — perfusion (cancer)
            {
                "patient": patient_models[3],
                "label": "Perfusion SC hydratation post-chimio",
                "prescriber_name": "Martin",
                "prescriber_rpps": "99900067890",
                "prescription_date": TODAY - datetime.timedelta(days=10),
                "start_date": TODAY - datetime.timedelta(days=10),
                "end_date": IN_TEN_DAYS,
                "duration_days": 20,
                "care_description": "Perfusion sous-cutanee NaCl 0.9% 500 mL sur 4h, quotidien post-chimio",
                "act_codes": ["AMI", "perfusion"],
                "frequency": "1x/jour",
                "status": "active",
            },
            # 4: Paulette Guerin — surveillance tension
            {
                "patient": patient_models[4],
                "label": "Surveillance tensionnelle",
                "prescriber_name": "Renaud",
                "prescriber_rpps": "99900012345",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_THIRTY_DAYS,
                "duration_days": 60,
                "care_description": "Mesure TA et pouls, 2x/semaine, sous Amlodipine 5 mg",
                "act_codes": ["AMI", "surveillance_tension", "prise_de_sang"],
                "frequency": "2x/semaine",
                "status": "active",
            },
            # 5: Simone Dupuis — pansement escarre
            {
                "patient": patient_models[8],
                "label": "Pansement escarre sacree stade 3",
                "prescriber_name": "Leblanc",
                "prescriber_rpps": "99900054321",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_SIXTY_DAYS,
                "duration_days": 90,
                "care_description": "Pansement escarre sacree : detersion, Purilon gel, Aquacel Foam, repositionnement",
                "act_codes": ["AMI", "pansement"],
                "frequency": "3x/semaine",
                "status": "active",
            },
            # 6: Bernard Chauveau — INR/anticoagulant
            {
                "patient": patient_models[9],
                "label": "Controle INR sous Previscan",
                "prescriber_name": "Leblanc",
                "prescriber_rpps": "99900054321",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_SIXTY_DAYS,
                "duration_days": 90,
                "care_description": "Prelevement capillaire INR, cible 2.0-3.0, transmission resultats labo et medecin",
                "act_codes": ["AMI", "prise_de_sang"],
                "frequency": "tous les 15 jours",
                "status": "active",
            },
            # 7: Germaine Paillat — soins dépendance
            {
                "patient": patient_models[15],
                "label": "Soins d'hygiene et mobilisation",
                "prescriber_name": "Renaud",
                "prescriber_rpps": "99900012345",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_SIXTY_DAYS,
                "duration_days": 90,
                "care_description": "Toilette, mobilisation au fauteuil, verification pilulier",
                "act_codes": ["AIS", "soins_hygiene"],
                "frequency": "1x/jour",
                "status": "active",
            },
            # 8: Rene Arnault — injection insuline (diabète)
            {
                "patient": patient_models[12],
                "label": "Injection insuline Novorapid",
                "prescriber_name": "Renaud",
                "prescriber_rpps": "99900012345",
                "prescription_date": THIRTY_DAYS_AGO,
                "start_date": THIRTY_DAYS_AGO,
                "end_date": IN_SIXTY_DAYS,
                "duration_days": 90,
                "care_description": "Injection SC insuline Novorapid 8 UI avant petit-dejeuner + glycemie capillaire",
                "act_codes": ["AMI", "injection_insuline"],
                "frequency": "1x/jour",
                "status": "active",
            },
            # 9: Roger Merlet — pansement post-op
            {
                "patient": patient_models[16],
                "label": "Pansement PTG droite post-operatoire",
                "prescriber_name": "Duval",
                "prescriber_rpps": "99900098765",
                "prescription_date": TODAY - datetime.timedelta(days=12),
                "start_date": TODAY - datetime.timedelta(days=12),
                "end_date": IN_TEN_DAYS,
                "duration_days": 22,
                "care_description": "Pansement cicatrice genou droit post-PTG : nettoyage Biseptine, compresses, Micropore",
                "act_codes": ["AMI", "pansement"],
                "frequency": "3x/semaine",
                "status": "active",
            },
        ]

        prescription_models = []
        for px in prescriptions_data:
            p = PrescriptionModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                patient_id=px["patient"].id,
                label=px["label"],
                prescriber_name=px["prescriber_name"],
                prescriber_rpps=px["prescriber_rpps"],
                prescription_date=px["prescription_date"],
                start_date=px["start_date"],
                end_date=px["end_date"],
                duration_days=px["duration_days"],
                care_description=px["care_description"],
                act_codes=px["act_codes"],
                frequency=px["frequency"],
                status=px["status"],
            )
            session.add(p)
            prescription_models.append(p)

        await session.flush()

        # --- Transmissions (exemples variés, liées aux RDV passés et ordonnances) ---
        # past_appt_models indices match transmissions 0-9
        # prescription_models indices match transmissions 0-9

        transmissions_data = [
            # 1. Transmission vocale complétée avec synthèse — Lucienne Moreau (diabète)
            {
                "patient": patient_models[0],
                "appointment": past_appt_models[0],
                "prescription": prescription_models[0],
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Passage chez Madame Moreau ce matin a 7h30. Glycemie capillaire a jeun : "
                    "1.42 g/L, un peu elevee par rapport a hier ou c'etait a 1.28. "
                    "Injection insuline Lantus 22 unites dans la cuisse gauche, bonne rotation "
                    "des points d'injection. Pas de lipodystrophie. La patiente se plaint de "
                    "picotements dans les pieds depuis quelques jours, je note pour signaler au "
                    "Dr Renaud lors du prochain passage. Etat general correct, patiente souriante. "
                    "Petit-dejeuner pris avant mon arrivee, conforme au regime."
                ),
                "structured_data": {
                    "synthese": "Suivi diabetique quotidien. Glycemie legerement elevee (1.42 g/L vs 1.28 la veille). Paresthesies des pieds a signaler au medecin traitant.",
                    "soins": "Glycemie capillaire a jeun, injection insuline Lantus 22 UI cuisse gauche",
                    "constantes": "Glycemie : 1.42 g/L (a jeun)",
                    "observations": "Bonne rotation des points d'injection, pas de lipodystrophie. Picotements des pieds depuis quelques jours.",
                    "actions": "Signaler paresthesies des pieds au Dr Renaud. Surveiller evolution glycemie.",
                    "alertes": ["Glycemie legerement elevee (1.42 g/L)", "Paresthesies des pieds a signaler au medecin"],
                },
                "recording_duration_seconds": 45,
                "generation_time_ms": 3200,
                "created_at": make_dt(YESTERDAY, 7, 52),
            },
            # 2. Transmission vocale validée — Marcel Gauthier (pansement)
            {
                "patient": patient_models[1],
                "appointment": past_appt_models[1],
                "prescription": prescription_models[1],
                "type": "vocal",
                "status": "validated",
                "transcription": (
                    "Pansement de Monsieur Gauthier. Ulcere veineux jambe droite, face interne. "
                    "Bonne evolution, le bourgeonnement progresse bien sur les berges. "
                    "Nettoyage serum physiologique, meche Algostéril au centre, interface "
                    "Urgotul, compresses, bande de contention Biflex 17. Pas de signe "
                    "d'infection, pas d'odeur. Le patient dit avoir bien porte sa contention "
                    "hier toute la journee. Prochain pansement dans 2 jours."
                ),
                "structured_data": {
                    "synthese": "Pansement ulcere veineux jambe droite en bonne evolution. Bourgeonnement actif, pas d'infection.",
                    "soins": "Refection pansement : nettoyage serum phy, meche Algosteril, interface Urgotul, compresses, bande Biflex 17",
                    "constantes": "",
                    "observations": "Bourgeonnement progressant sur les berges. Pas d'infection, pas d'odeur. Contention bien portee.",
                    "actions": "Prochain pansement dans 2 jours. Continuer contention veineuse.",
                    "alertes": [],
                },
                "recording_duration_seconds": 38,
                "generation_time_ms": 2800,
                "created_at": make_dt(TWO_DAYS_AGO, 8, 45),
            },
            # 3. Transmission écrite complétée — Yvette Robin (Alzheimer)
            {
                "patient": patient_models[2],
                "appointment": past_appt_models[2],
                "prescription": prescription_models[2],
                "type": "written",
                "status": "completed",
                "transcription": (
                    "Toilette et aide a l'habillage de Mme Robin. Patiente desorientee ce matin, "
                    "ne reconnaissait pas son domicile. Agitation moderee en debut de soins, "
                    "calmee apres quelques minutes. Peau seche au niveau des jambes, application "
                    "de creme hydratante Dexeryl. Repas du midi prepare et laisse a portee. "
                    "Pilulier du jour verifie, medications du matin prises. Fille prevenue par "
                    "telephone de l'episode de desorientation."
                ),
                "structured_data": {
                    "synthese": "Soins d'hygiene avec episode de desorientation et agitation moderee. Peau seche traitee. Famille prevenue.",
                    "soins": "Toilette complete, aide habillage, application Dexeryl jambes, verification pilulier",
                    "constantes": "",
                    "observations": "Desorientation temporospatiale ce matin (ne reconnait pas son domicile). Agitation moderee en debut de soins. Peau seche jambes.",
                    "actions": "Fille prevenue de l'episode. Surveiller frequence des episodes de desorientation. Signaler au Dr si aggravation.",
                    "alertes": ["Desorientation temporospatiale et agitation — surveiller frequence des episodes"],
                },
                "recording_duration_seconds": 0,
                "generation_time_ms": 2500,
                "created_at": make_dt(YESTERDAY, 9, 35),
            },
            # 4. Transmission vocale complétée — Simone Dupuis (escarres)
            {
                "patient": patient_models[8],
                "appointment": past_appt_models[3],
                "prescription": prescription_models[5],
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Soins d'escarre sacree chez Madame Dupuis. Escarre stade 3, "
                    "dimensions 4 cm par 3 cm, profondeur estimee 0.5 cm. Fond fibrineux "
                    "jaune sur environ 40%, le reste en bourgeonnement rouge. Legere exsudation "
                    "sereuse. Detersion mecanique douce a la curette des fibres, nettoyage "
                    "serum physiologique. Application Purilon gel sur zones fibrineuses, "
                    "Aquacel Foam en couverture. Patiente positionnee en decubitus lateral "
                    "gauche, coussin entre les jambes. Rappel a l'aide a domicile de changer "
                    "de position toutes les 2 heures."
                ),
                "structured_data": {
                    "synthese": "Pansement escarre sacree stade 3 (4x3x0.5 cm). Fond mixte fibrineux/bourgeonnement. Detersion mecanique et pansement adapte.",
                    "soins": "Detersion mecanique curette, nettoyage serum phy, Purilon gel sur fibrine, Aquacel Foam. Repositionnement decubitus lateral gauche.",
                    "constantes": "Escarre sacree : 4x3x0.5 cm, stade 3, 40% fibrine, 60% bourgeonnement",
                    "observations": "Exsudation sereuse legere. Evolution lente mais favorable (bourgeonnement en progression).",
                    "actions": "Rappel aide a domicile : repositionnement toutes les 2h. Prochain pansement dans 2 jours. Photo de suivi a faire au prochain passage.",
                    "alertes": ["Escarre stade 3 sacree — evolution lente, necessite suivi rapproche"],
                },
                "recording_duration_seconds": 52,
                "generation_time_ms": 3500,
                "created_at": make_dt(YESTERDAY, 10, 50),
            },
            # 5. Transmission écrite — Henri Bardin (cancer/perfusion)
            {
                "patient": patient_models[3],
                "appointment": past_appt_models[4],
                "prescription": prescription_models[3],
                "type": "written",
                "status": "validated",
                "transcription": (
                    "Perfusion sous-cutanee d'hydratation chez M. Bardin. 500 mL NaCl 0.9% "
                    "sur 4 heures, debit 125 mL/h. Site de ponction face anterieure cuisse "
                    "droite, pas de rougeur ni d'induration au point de ponction precedent "
                    "(cuisse gauche hier). Patient asthénique mais conscient et oriente, "
                    "apyrétique au toucher. Se plaint de nausees matinales persistantes depuis "
                    "la derniere chimio (J+5). A peu mange ce matin. Epouse presente et "
                    "informee de la surveillance du debit et du point de ponction."
                ),
                "structured_data": {
                    "synthese": "Perfusion SC hydratation 500 mL NaCl J+5 post-chimio. Patient asthenique avec nausees persistantes. Epouse formee a la surveillance.",
                    "soins": "Perfusion sous-cutanee NaCl 0.9% 500 mL en 4h (125 mL/h), cuisse droite. Retrait perfusion precedente cuisse gauche.",
                    "constantes": "Apyretique (au toucher). Etat general : asthenique, conscient, oriente.",
                    "observations": "Nausees matinales persistantes depuis chimio J+5. Alimentation reduite. Point de ponction precedent : pas de rougeur.",
                    "actions": "Signaler nausees persistantes a l'oncologue si pas d'amelioration demain. Surveiller hydratation orale.",
                    "alertes": ["Nausees persistantes J+5 post-chimio — alimentation reduite, surveiller hydratation"],
                },
                "recording_duration_seconds": 0,
                "generation_time_ms": 2900,
                "created_at": make_dt(TWO_DAYS_AGO, 14, 10),
            },
            # 6. Transmission vocale — Bernard Chauveau (anticoagulant/INR)
            {
                "patient": patient_models[9],
                "appointment": past_appt_models[5],
                "prescription": prescription_models[6],
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Prelevement INR chez Monsieur Chauveau. INR du jour : 2.8, dans la cible "
                    "therapeutique 2 a 3. Prekalicréine, pas de signe hémorragique, pas "
                    "d'hematome. Le patient prend bien son Previscan a heure fixe le soir "
                    "a 19 heures. Pas de modification alimentaire recente. Prochain controle "
                    "dans 15 jours sauf avis contraire du Dr Leblanc. Resultats transmis au "
                    "laboratoire et au medecin traitant."
                ),
                "structured_data": {
                    "synthese": "Controle INR dans la cible (2.8 pour cible 2-3). Pas de signe hemorragique. Prochain controle dans 15 jours.",
                    "soins": "Prelevement sanguin INR capillaire",
                    "constantes": "INR : 2.8 (cible 2.0 - 3.0)",
                    "observations": "Pas de signe hemorragique, pas d'hematome. Previscan pris regulierement a 19h. Pas de modification alimentaire.",
                    "actions": "Resultats transmis labo et Dr Leblanc. Prochain INR dans 15 jours.",
                    "alertes": [],
                },
                "recording_duration_seconds": 30,
                "generation_time_ms": 2200,
                "created_at": make_dt(THREE_DAYS_AGO, 10, 20),
            },
            # 7. Transmission vocale — Germaine Paillat (dépendance/toilette)
            {
                "patient": patient_models[15],
                "appointment": past_appt_models[6],
                "prescription": prescription_models[7],
                "type": "vocal",
                "status": "completed",
                "transcription": (
                    "Toilette de Madame Paillat. La patiente est de bonne humeur ce matin, "
                    "a bien dormi. Mobilisation au fauteuil apres la toilette, transfert "
                    "avec aide d'un seul soignant. Legers oedemes des chevilles, signe du "
                    "godet positif bilaterale. Peau correcte, pas de rougeur aux points "
                    "d'appui. Pilulier verifie, tous les medicaments de la veille ont ete pris. "
                    "La patiente demande si on peut lui rapporter du journal la prochaine fois."
                ),
                "structured_data": {
                    "synthese": "Soins d'hygiene et mobilisation. Oedemes des chevilles a surveiller. Etat general satisfaisant.",
                    "soins": "Toilette au lit, mobilisation au fauteuil, verification pilulier",
                    "constantes": "Oedemes chevilles bilateraux (signe du godet +)",
                    "observations": "Bonne humeur, bon sommeil. Transfert fauteuil avec 1 aide. Peau OK aux points d'appui.",
                    "actions": "Surveiller evolution oedemes. Signaler au medecin si aggravation. Penser a apporter le journal.",
                    "alertes": ["Oedemes des chevilles bilateraux (signe du godet +) — a surveiller"],
                },
                "recording_duration_seconds": 35,
                "generation_time_ms": 2600,
                "created_at": make_dt(YESTERDAY, 8, 15),
            },
            # 8. Transmission écrite courte — Paulette Guerin (tension)
            {
                "patient": patient_models[4],
                "appointment": past_appt_models[7],
                "prescription": prescription_models[4],
                "type": "written",
                "status": "completed",
                "transcription": (
                    "Surveillance tensionnelle de Mme Guerin. TA 145/82 mmHg au bras gauche, "
                    "position assise apres 5 minutes de repos. Pouls 72 bpm regulier. "
                    "Patiente asymptomatique, pas de cephalees, pas de vertiges. Traitement "
                    "antihypertenseur pris ce matin (Amlodipine 5 mg)."
                ),
                "structured_data": {
                    "synthese": "Surveillance tensionnelle. TA legerement elevee (145/82) sous traitement. Patiente asymptomatique.",
                    "soins": "Mesure tensionnelle bras gauche, prise de pouls",
                    "constantes": "TA : 145/82 mmHg (bras gauche, assise). Pouls : 72 bpm regulier.",
                    "observations": "Asymptomatique. Amlodipine 5 mg pris ce matin.",
                    "actions": "Continuer surveillance. Consulter medecin si TA > 160/95 ou symptomes.",
                    "alertes": [],
                },
                "recording_duration_seconds": 0,
                "generation_time_ms": 1800,
                "created_at": make_dt(THREE_DAYS_AGO, 8, 10),
            },
            # 9. Transmission vocale en attente de synthèse (pour tester le statut)
            {
                "patient": patient_models[12],
                "appointment": past_appt_models[8],
                "prescription": prescription_models[8],
                "type": "vocal",
                "status": "transcribed",
                "transcription": (
                    "Passage chez Monsieur Arnault pour injection insuline. Glycemie ce matin "
                    "1.15 g/L, dans la cible. Injection Novorapid 8 unites avant le petit "
                    "dejeuner, abdomen cote droit. Bon etat general, patient autonome pour "
                    "la preparation de ses repas."
                ),
                "structured_data": {},
                "recording_duration_seconds": 18,
                "generation_time_ms": 0,
                "created_at": make_dt(TODAY, 8, 5),
            },
            # 10. Transmission vocale — Roger Merlet (pansement post-op)
            {
                "patient": patient_models[16],
                "appointment": past_appt_models[9],
                "prescription": prescription_models[9],
                "type": "vocal",
                "status": "validated",
                "transcription": (
                    "Pansement post-operatoire genou droit chez Monsieur Merlet, J+12 "
                    "apres prothese totale de genou. Cicatrice propre, agrafes en place, "
                    "pas de rougeur pericicatricielle, pas d'ecoulement. Flexion du genou "
                    "a 90 degres, bonne progression par rapport a la semaine derniere. "
                    "Le kine passe 3 fois par semaine. Patient marche avec une canne, "
                    "bonne stabilite. Ablation des agrafes prevue J+15 par le chirurgien."
                ),
                "structured_data": {
                    "synthese": "Pansement PTG droite J+12. Cicatrice propre, flexion 90°. Bonne evolution. Ablation agrafes J+15.",
                    "soins": "Pansement cicatrice genou droit : nettoyage Biseptine, compresses steriles, Micropore",
                    "constantes": "Flexion genou : 90°. Cicatrice : propre, agrafes en place, pas d'ecoulement.",
                    "observations": "Bonne progression. Marche avec canne, stable. Kinesitherapie 3x/semaine.",
                    "actions": "Ablation agrafes J+15 par chirurgien. Continuer pansements jusqu'a ablation.",
                    "alertes": [],
                },
                "recording_duration_seconds": 40,
                "generation_time_ms": 3100,
                "created_at": make_dt(TWO_DAYS_AGO, 15, 0),
            },
        ]

        tx_models = []
        for tx_data in transmissions_data:
            encrypted_transcription = None
            if tx_data["transcription"]:
                encrypted_transcription = _encrypt(tx_data["transcription"], cab_key)

            tx = TransmissionModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                idel_id=user_id,
                patient_id=tx_data["patient"].id,
                appointment_id=tx_data["appointment"].id if tx_data.get("appointment") else None,
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
            tx_models.append((tx, tx_data))

        await session.flush()

        # --- Transmission ↔ Prescription links (auto-resolved from appointment) ---
        for tx, tx_data in tx_models:
            prescription = tx_data.get("prescription")
            if prescription:
                link = TransmissionPrescriptionModel(
                    id=uuid4(),
                    transmission_id=tx.id,
                    prescription_id=prescription.id,
                    is_auto_resolved=True,
                )
                session.add(link)

        await session.commit()

        active_count = sum(1 for d in patients_data if d[-1] == "active")
        archived_count = sum(1 for d in patients_data if d[-1] == "archived")

        tx_count = len(transmissions_data)
        tx_vocal = sum(1 for t in transmissions_data if t["type"] == "vocal")
        tx_written = sum(1 for t in transmissions_data if t["type"] == "written")
        tx_linked = sum(1 for t in transmissions_data if t.get("prescription"))

        print("=" * 50)
        print("  Donnees de demo inserees avec succes !")
        print("=" * 50)
        print()
        print(f"  Email:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print()
        print(f"  Cabinet:  Cabinet IDEL Damvix (5 Rue du Centre, 85420)")
        print(f"  Secteurs: 3 (Damvix, Nord/Maillé, Sud/Mazeau-Sigismond)")
        print(f"  Patients: {len(patient_models)} ({active_count} actifs, {archived_count} inactifs)")
        print(f"  Communes: Damvix (6), Maillé (5), Saint-Sigismond (4), Le Mazeau (5)")
        print(f"  Ordonnances: {len(prescriptions_data)}")
        print(f"  RDV aujourd'hui ({TODAY}): {len(appts_today)}")
        print(f"  RDV demain ({TOMORROW}): {len(appts_tomorrow)}")
        print(f"  RDV passes (completes): {len(appts_past)}")
        print(f"  Transmissions: {tx_count} ({tx_vocal} vocales, {tx_written} ecrites)")
        print(f"    → {tx_linked} liees a une ordonnance (auto-resolved)")
        print(f"    → {sum(1 for t in transmissions_data if t.get('appointment'))} liees a un RDV")
        print()
        print("  Connectez-vous avec ces identifiants dans l'app.")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
