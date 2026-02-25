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

        # --- Appointments (today, 10 RDV) ---
        def make_dt(hour, minute):
            return datetime.datetime(TODAY.year, TODAY.month, TODAY.day, hour, minute, tzinfo=datetime.UTC)

        # Indices in patients_data:
        # 0=Lucienne(Damvix) 1=Marcel 2=Yvette 3=Henri 4=Paulette 5=Andre
        # 6=Jeannine(Maillé) 7=Raymond 8=Simone 9=Bernard 10=Odette
        # 11=Madeleine(St-Sigismond) 12=Rene 13=Colette 14=Jean-Claude
        # 15=Germaine(Mazeau) 16=Roger 17=Therese 18=Michel(archived) 19=Monique
        appts = [
            (patient_models[0],  make_dt(7, 30),  20, "injection_insuline"),
            (patient_models[4],  make_dt(8, 0),   15, "prise_de_sang"),
            (patient_models[1],  make_dt(8, 30),  30, "pansement"),
            (patient_models[2],  make_dt(9, 15),  30, "soins_hygiene"),
            (patient_models[6],  make_dt(10, 0),  20, "injection_insuline"),
            (patient_models[8],  make_dt(10, 30), 45, "pansement"),
            (patient_models[10], make_dt(11, 30), 15, "surveillance_tension"),
            (patient_models[3],  make_dt(13, 30), 45, "perfusion"),
            (patient_models[16], make_dt(14, 30), 30, "pansement"),
            (patient_models[11], make_dt(15, 30), 30, "soins_hygiene"),
        ]

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

        await session.commit()

        active_count = sum(1 for d in patients_data if d[-1] == "active")
        archived_count = sum(1 for d in patients_data if d[-1] == "archived")

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
        print(f"  RDV aujourd'hui ({TODAY}): {len(appts)}")
        print()
        print("  Connectez-vous avec ces identifiants dans l'app.")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
