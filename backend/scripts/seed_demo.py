"""Seed la base avec des donnees de demo (cabinet Damvix, Marais Poitevin).

Cree 3 secteurs, 20 patients repartis sur 5 communes et 10 RDV aujourd'hui.
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

        # --- Sectors (3 zones du Marais Poitevin) ---
        sector_damvix = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Damvix",
            postal_codes=["85420"],
            communes=["Damvix"],
            color="#10B981", display_order=0,
        )
        sector_nord = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Nord / Maille",
            postal_codes=["85420"],
            communes=["Maille", "Le Coudreau"],
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

        # --- 20 Patients (region Marais Poitevin) ---
        # (prenom, nom, birth_date, lat, lon, sector_id, postal_code, city,
        #  phone, pathologies, preferred_time_slot, care_duration, status)
        patients_data = [
            # --- Damvix (6 patients) ---
            ("Lucienne", "Moreau", "1941-03-12", 46.3145, -0.7110, sector_damvix.id,
             "85420", "Damvix", "06 11 11 11 11", ["diabete"], "morning", 20, "active"),
            ("Marcel", "Gauthier", "1948-07-22", 46.3120, -0.7155, sector_damvix.id,
             "85420", "Damvix", "06 11 22 22 22", ["pansement chronique"], "morning", 30, "active"),
            ("Yvette", "Robin", "1935-11-05", 46.3160, -0.7098, sector_damvix.id,
             "85420", "Damvix", "06 11 33 33 33", ["alzheimer"], "morning", 30, "active"),
            ("Henri", "Bardin", "1954-01-30", 46.3130, -0.7180, sector_damvix.id,
             "85420", "Damvix", "06 11 44 44 44", ["cancer"], "afternoon", 45, "active"),
            ("Paulette", "Guerin", "1938-09-14", 46.3170, -0.7125, sector_damvix.id,
             "85420", "Damvix", "06 11 55 55 55", ["hypertension"], "morning", 15, "active"),
            ("Andre", "Blanchard", "1957-05-08", 46.3105, -0.7070, sector_damvix.id,
             "85420", "Damvix", "06 11 66 66 66", ["post-operatoire"], "afternoon", 30, "active"),

            # --- Maille (4 patients) ---
            ("Jeannine", "Bouchet", "1943-02-18", 46.3310, -0.7260, sector_nord.id,
             "85420", "Maille", "06 22 11 11 11", ["diabete"], "morning", 20, "active"),
            ("Raymond", "Texier", "1950-12-03", 46.3280, -0.7295, sector_nord.id,
             "85420", "Maille", "06 22 22 22 22", ["BPCO"], "afternoon", 30, "active"),
            ("Simone", "Dupuis", "1936-06-27", 46.3325, -0.7230, sector_nord.id,
             "85420", "Maille", "06 22 33 33 33", ["escarres"], "morning", 45, "active"),
            ("Bernard", "Pineau", "1955-08-11", 46.3295, -0.7310, sector_nord.id,
             "85420", "Maille", "06 22 44 44 44", ["anticoagulant"], "morning", 15, "active"),

            # --- Saint-Sigismond (3 patients) ---
            ("Madeleine", "Girard", "1939-04-21", 46.2980, -0.7510, sector_sud.id,
             "85420", "Saint-Sigismond", "06 33 11 11 11", ["alzheimer"], "afternoon", 30, "active"),
            ("Rene", "Arnault", "1946-10-16", 46.2955, -0.7545, sector_sud.id,
             "85420", "Saint-Sigismond", "06 33 22 22 22", ["diabete"], "morning", 20, "active"),
            ("Colette", "Baudry", "1952-03-09", 46.2995, -0.7480, sector_sud.id,
             "85420", "Saint-Sigismond", "06 33 33 33 33", ["cancer"], "morning", 45, "active"),

            # --- Le Mazeau (4 patients, dont 1 archive) ---
            ("Germaine", "Paillat", "1934-08-02", 46.3200, -0.6810, sector_sud.id,
             "85420", "Le Mazeau", "06 44 11 11 11", ["dependance"], "morning", 30, "active"),
            ("Roger", "Merlet", "1953-11-25", 46.3175, -0.6855, sector_sud.id,
             "85420", "Le Mazeau", "06 44 22 22 22", ["pansement post-operatoire"], "afternoon", 30, "active"),
            ("Therese", "Bonnin", "1940-07-14", 46.3215, -0.6790, sector_sud.id,
             "85420", "Le Mazeau", "06 44 33 33 33", ["diabete"], "morning", 20, "active"),
            ("Michel", "Coutant", "1958-02-19", 46.3185, -0.6870, sector_sud.id,
             "85420", "Le Mazeau", "06 44 44 44 44", ["post-AVC"], "morning", 45, "archived"),

            # --- Le Coudreau (3 patients, dont 1 archive) ---
            ("Odette", "Vrignaud", "1937-12-30", 46.3240, -0.7380, sector_nord.id,
             "85420", "Le Coudreau", "06 55 11 11 11", ["hypertension"], "morning", 15, "active"),
            ("Pierre", "Chauveau", "1949-06-05", 46.3260, -0.7420, sector_nord.id,
             "85420", "Le Coudreau", "06 55 22 22 22", ["pansement chronique"], "afternoon", 30, "active"),
            ("Huguette", "Masson", "1942-09-17", 46.3225, -0.7360, sector_nord.id,
             "85420", "Le Coudreau", "06 55 33 33 33", ["BPCO"], "morning", 30, "archived"),
        ]

        patient_models = []
        for (fn, ln, bd, lat, lon, sid, pc, city, phone, patho, pref, dur, status) in patients_data:
            address = f"{city}, {pc}"
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
        # 6=Jeannine(Maillé) 7=Raymond 8=Simone 9=Bernard
        # 10=Madeleine(St-Sigismond) 11=Rene 12=Colette
        # 13=Germaine(Mazeau) 14=Roger 15=Therese
        # 17=Odette(Coudreau) 18=Pierre
        appts = [
            (patient_models[0],  make_dt(7, 30),  20, "injection_insuline"),
            (patient_models[4],  make_dt(8, 0),   15, "prise_de_sang"),
            (patient_models[1],  make_dt(8, 30),  30, "pansement"),
            (patient_models[2],  make_dt(9, 15),  30, "soins_hygiene"),
            (patient_models[6],  make_dt(10, 0),  20, "injection_insuline"),
            (patient_models[8],  make_dt(10, 30), 45, "pansement"),
            (patient_models[17], make_dt(11, 30), 15, "surveillance_tension"),
            (patient_models[3],  make_dt(13, 30), 45, "perfusion"),
            (patient_models[14], make_dt(14, 30), 30, "pansement"),
            (patient_models[10], make_dt(15, 30), 30, "soins_hygiene"),
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
        print(f"  Cabinet:  Cabinet IDEL Damvix")
        print(f"  Secteurs: 3 (Damvix, Nord/Maille, Sud/Mazeau-Sigismond)")
        print(f"  Patients: {len(patient_models)} ({active_count} actifs, {archived_count} inactifs)")
        print(f"  Communes: Damvix, Maille, Saint-Sigismond, Le Mazeau, Le Coudreau")
        print(f"  RDV aujourd'hui ({TODAY}): {len(appts)}")
        print()
        print("  Connectez-vous avec ces identifiants dans l'app.")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
