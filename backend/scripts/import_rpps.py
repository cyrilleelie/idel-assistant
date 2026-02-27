"""Script d'import du référentiel RPPS depuis l'annuaire santé data.gouv.fr.

Usage (depuis le dossier backend/) :
    uv run python scripts/import_rpps.py

Ce script :
1. Interroge l'API data.gouv.fr pour trouver l'URL de la ressource
   "ps-libreacces-personne-activite.txt" (fichier principal).
2. Télécharge le fichier texte pipe-delimited (UTF-8) en une passe.
3. Parse ligne par ligne, filtre les professions :
     10 = Médecin, 40 = Chirurgien-Dentiste, 50 = Sage-Femme
4. Bulk-upsert par batches de 2 900 dans la table rpps_doctors.
"""

import asyncio
import csv
import io
import json
import ssl
import sys
import time
import urllib.request
from pathlib import Path

# Ajouter le dossier backend/ au path pour les imports applicatifs
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.domain.entities.rpps_doctor import RppsDoctor
from app.infrastructure.persistence.repositories.sqlalchemy_rpps_doctor_repo import SQLAlchemyRppsDoctorRepo

# ── Codes profession filtrés (RPPS) ──────────────────────────────────────────
# 10 = Médecin, 40 = Chirurgien-Dentiste, 50 = Sage-Femme
TARGET_PROFESSION_CODES = {"10", "40", "50"}

# ── Dataset data.gouv.fr ──────────────────────────────────────────────────────
DATASET_SLUG = "annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps"
API_URL = f"https://www.data.gouv.fr/api/1/datasets/{DATASET_SLUG}/"

# Contexte SSL sans vérification — le Python bundlé par uv sur Windows
# n'embarque pas les certificats racine du système.
_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE


def find_resource_url() -> tuple[str, str]:
    """Retourne (url_txt, filename) de la ressource personne-activite."""
    print("Interrogation de l'API data.gouv.fr…")
    with urllib.request.urlopen(API_URL, timeout=30, context=_SSL_CTX) as resp:
        dataset = json.loads(resp.read().decode())

    resources = dataset.get("resources", [])

    # Priorité : fichier contenant "personne-activite" dans le titre
    for r in resources:
        title = r.get("title", "") or r.get("url", "")
        if "personne-activite" in title.lower() or "personne_activite" in title.lower():
            return r["url"], r.get("title", title)

    # Fallback : premier fichier .txt
    for r in resources:
        if r.get("url", "").endswith(".txt") or r.get("format", "").lower() == "txt":
            return r["url"], r.get("title", r["url"].split("/")[-1])

    raise RuntimeError(
        f"Ressource 'personne-activite' introuvable. "
        f"Ressources disponibles : {[r.get('title') for r in resources[:5]]}"
    )


def download_file(url: str) -> bytes:
    """Télécharge le fichier texte complet."""
    print(f"Téléchargement : {url}")
    start = time.time()
    with urllib.request.urlopen(url, timeout=300, context=_SSL_CTX) as resp:
        raw = resp.read()
    elapsed = time.time() - start
    print(f"  -> {len(raw) / 1_048_576:.1f} Mo en {elapsed:.1f}s")
    return raw


def _decode(raw: bytes) -> str:
    """Décode les bytes en str. Le fichier ANS est UTF-8 (avec ou sans BOM)."""
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, ValueError):
            continue
    raise RuntimeError("Impossible de décoder le fichier (UTF-8 et latin-1 ont échoué)")


def _find_col(fieldnames: list[str], *candidates: str) -> str | None:
    """Recherche souple d'une colonne : correspondance exacte d'abord, puis substring."""
    for c in candidates:
        if c in fieldnames:
            return c
    for c in candidates:
        for f in fieldnames:
            if c.lower() in f.lower():
                return f
    return None


def parse_doctors(raw: bytes) -> list[RppsDoctor]:
    """Parse le fichier pipe-delimited et retourne les praticiens filtrés."""
    text = _decode(raw)
    fh = io.StringIO(text)
    reader = csv.DictReader(fh, delimiter="|")
    fieldnames = reader.fieldnames or []
    print(f"\nColonnes détectées : {len(fieldnames)}")

    # Détection souple des colonnes (les noms exacts peuvent varier légèrement)
    col_rpps       = _find_col(fieldnames, "Identifiant PP", "IdPP", "idpp")
    col_last       = _find_col(fieldnames, "Nom d'exercice", "Nom_exercice", "nom exercice")
    col_first      = _find_col(fieldnames, "Prénom d'exercice", "Prenom d'exercice", "prenom exercice")
    col_prof_code  = _find_col(fieldnames, "Code profession", "code profession")
    col_prof_label = _find_col(fieldnames, "Libellé profession", "libelle profession", "Libelle profession")
    col_spec_code  = _find_col(fieldnames, "Code savoir-faire", "code savoir faire")
    col_spec_label = _find_col(fieldnames, "Libellé savoir-faire", "libelle savoir-faire")
    col_dept       = _find_col(fieldnames, "Code Département (structure)", "Code departement", "code dept")
    col_city       = _find_col(fieldnames, "Libellé commune (coord. structure)", "libelle commune", "commune")
    col_finess     = _find_col(fieldnames, "Numéro FINESS site", "Numero FINESS site", "finess site", "FINESS site")

    print(f"  rpps        = {col_rpps}")
    print(f"  last_name   = {col_last}")
    print(f"  first_name  = {col_first}")
    print(f"  prof_code   = {col_prof_code}")
    print(f"  prof_label  = {col_prof_label}")
    print(f"  spec_label  = {col_spec_label}")
    print(f"  department  = {col_dept}")
    print(f"  city        = {col_city}")
    print(f"  finess_site = {col_finess}")

    if not col_rpps or not col_prof_code:
        raise RuntimeError(
            f"Colonnes obligatoires introuvables (rpps={col_rpps}, prof={col_prof_code}). "
            f"15 premières colonnes : {fieldnames[:15]}"
        )

    # Un même praticien peut avoir plusieurs lignes (une par activité/spécialité).
    # On déduplique par rpps_number : on garde la ligne avec spécialité en priorité.
    seen: dict[str, RppsDoctor] = {}
    total_lines = 0
    skipped = 0

    for row in reader:
        total_lines += 1

        prof_code = (row.get(col_prof_code) or "").strip()
        if prof_code not in TARGET_PROFESSION_CODES:
            skipped += 1
            continue

        rpps = (row.get(col_rpps) or "").strip()
        last = (row.get(col_last) or "").strip() if col_last else ""
        first = (row.get(col_first) or "").strip() if col_first else ""

        if not rpps or not last:
            skipped += 1
            continue

        spec_label = (row.get(col_spec_label) or "").strip()[:200] or None if col_spec_label else None

        # Si ce RPPS est déjà vu sans spécialité et qu'on en trouve une maintenant → mise à jour
        if rpps in seen and not seen[rpps].specialty_label and spec_label:
            seen[rpps].specialty_label = spec_label
            seen[rpps].specialty_code = (row.get(col_spec_code) or "").strip()[:10] or None if col_spec_code else None
        elif rpps not in seen:
            seen[rpps] = RppsDoctor(
                rpps_number=rpps[:11],
                last_name=last[:150],
                first_name=first[:150],
                profession_code=prof_code[:3],
                profession_label=(row.get(col_prof_label) or "").strip()[:200] or None if col_prof_label else None,
                specialty_code=(row.get(col_spec_code) or "").strip()[:10] or None if col_spec_code else None,
                specialty_label=spec_label,
                department=(row.get(col_dept) or "").strip()[:3] or None if col_dept else None,
                city=(row.get(col_city) or "").strip()[:150] or None if col_city else None,
                finess_site=(row.get(col_finess) or "").strip()[:9] or None if col_finess else None,
            )

        if total_lines % 100_000 == 0:
            print(f"  Parsé : {total_lines:,} lignes — praticiens uniques : {len(seen):,}")

    doctors = list(seen.values())

    print(f"\nParsing terminé :")
    print(f"  Lignes totales      : {total_lines:,}")
    print(f"  Lignes ignorées     : {skipped:,}")
    print(f"  Praticiens uniques  : {len(doctors):,}")

    if doctors:
        print(f"\n  Exemple : {doctors[0].rpps_number} | {doctors[0].last_name} {doctors[0].first_name} | {doctors[0].profession_code}")

    return doctors


async def run_import() -> None:
    t0 = time.time()

    # 1. Découvrir l'URL
    url, title = find_resource_url()
    print(f"Ressource : {title}")

    # 2. Télécharger
    raw = download_file(url)

    # 3. Parser
    doctors = parse_doctors(raw)
    if not doctors:
        print("Aucun praticien à importer. Arrêt.")
        return

    # 4. Upsert en BDD
    print(f"\nConnexion à la base de données…")
    engine = create_async_engine(settings.database_url, echo=False)
    async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session_factory() as session:
        repo = SQLAlchemyRppsDoctorRepo(session)
        print(f"Upsert de {len(doctors):,} praticiens par batches de 2 900…")
        t_upsert = time.time()
        upserted = await repo.bulk_upsert(doctors)
        await session.commit()
        elapsed_upsert = time.time() - t_upsert
        print(f"  -> {upserted:,} lignes upsertées en {elapsed_upsert:.1f}s")

    await engine.dispose()

    total_elapsed = time.time() - t0
    print(f"\nImport terminé en {total_elapsed:.1f}s  |  Total upsertés : {upserted:,}")


if __name__ == "__main__":
    asyncio.run(run_import())
