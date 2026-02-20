"""Seed la base avec des donnees de demo pour tester le frontend mobile.

Cree 3 secteurs, 7 patients (region nantaise) et 6 RDV aujourd'hui.
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
            name="Cabinet Demo Nantes",
            address="12 rue de Strasbourg, 44000 Nantes",
        )
        session.add(cabinet)

        # --- User (IDEL) ---
        user_id = uuid4()
        user = UserModel(
            id=user_id,
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            first_name="Marie",
            last_name="Infirmiere",
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

        # --- Sectors ---
        sector_centre = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Centre / Nantes",
            postal_codes=["44000", "44100", "44200", "44300"],
            communes=["Nantes"],
            color="#10B981", display_order=0,
        )
        sector_nord = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Nord / Orvault",
            postal_codes=["44700", "44240"],
            communes=["Orvault", "Suce-sur-Erdre"],
            color="#EF4444", display_order=1,
        )
        sector_est = SectorModel(
            id=uuid4(), cabinet_id=cabinet_id,
            name="Est / Carquefou",
            postal_codes=["44470", "44980"],
            communes=["Carquefou", "Sainte-Luce-sur-Loire"],
            color="#3B82F6", display_order=2,
        )
        for s in [sector_centre, sector_nord, sector_est]:
            session.add(s)

        await session.flush()

        # --- Patients (with encrypted fields) ---
        patients_data = [
            ("Marie", "Dupont", 47.2814, -1.5906, sector_centre.id, "44000", "Nantes",
             "06 11 11 11 11", ["diabete"], "morning", 30),
            ("Jean", "Martin", 47.2966, -1.6383, sector_nord.id, "44700", "Orvault",
             "06 22 22 22 22", ["hypertension"], "morning", 45),
            ("Pierre", "Durand", 47.3000, -1.4933, sector_est.id, "44470", "Carquefou",
             "06 33 33 33 33", ["post-operatoire"], "afternoon", 30),
            ("Sophie", "Leroy", 47.2700, -1.5600, sector_centre.id, "44100", "Nantes",
             "06 44 44 44 44", ["diabete", "pansement chronique"], "morning", 30),
            ("Luc", "Bernard", 47.3100, -1.6200, sector_nord.id, "44700", "Orvault",
             "06 55 55 55 55", ["cancer"], "afternoon", 45),
            ("Anne", "Petit", 47.2850, -1.5200, sector_est.id, "44980", "Sainte-Luce-sur-Loire",
             "06 66 66 66 66", [], "morning", 30),
            ("Claire", "Moreau", 47.2637, -1.6730, sector_nord.id, "44880", "Sautron",
             "06 77 77 77 77", ["alzheimer"], "morning", 30),
        ]

        patient_models = []
        for (fn, ln, lat, lon, sid, pc, city, phone, patho, pref, dur) in patients_data:
            address = f"{city}, {pc}"
            p = PatientModel(
                id=uuid4(),
                cabinet_id=cabinet_id,
                first_name_encrypted=_encrypt(fn, cab_key),
                last_name_encrypted=_encrypt(ln, cab_key),
                first_name_search_hash=_search_hash(fn, cab_key),
                last_name_search_hash=_search_hash(ln, cab_key),
                birth_date_encrypted=None,
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
            )
            session.add(p)
            patient_models.append(p)

        await session.flush()

        # --- Appointments (today) ---
        def make_dt(hour, minute):
            return datetime.datetime(TODAY.year, TODAY.month, TODAY.day, hour, minute, tzinfo=datetime.UTC)

        appts = [
            (patient_models[0], make_dt(8, 0), 30, "pansement"),
            (patient_models[1], make_dt(9, 0), 45, "injection_insuline"),
            (patient_models[2], make_dt(10, 30), 30, "prise_de_sang"),
            (patient_models[3], make_dt(13, 0), 30, "pansement"),
            (patient_models[4], make_dt(14, 30), 45, "perfusion"),
            (patient_models[5], make_dt(16, 0), 30, "injection"),
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

        print("=" * 50)
        print("  Donnees de demo inserees avec succes !")
        print("=" * 50)
        print()
        print(f"  Email:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print()
        print(f"  Cabinet:  Cabinet Demo Nantes")
        print(f"  Secteurs: 3 (Centre, Nord, Est)")
        print(f"  Patients: {len(patient_models)}")
        print(f"  RDV aujourd'hui ({TODAY}): {len(appts)}")
        print()
        print("  Connectez-vous avec ces identifiants dans l'app mobile.")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
