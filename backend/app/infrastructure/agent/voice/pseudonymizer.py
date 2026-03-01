"""Pseudonymisation post-transcription avant passage au LLM.

Stratégie HDS retenue (phase pilote) :
1. L'audio est envoyé à Whisper — transcription en clair.
2. La transcription brute (avec noms réels) ne quitte JAMAIS le backend.
3. Avant passage au LLM Mistral, les noms de patients sont remplacés
   par leurs UUID + initiales via la table patients du cabinet.
4. Le LLM ne voit jamais les noms complets.

Limite connue : cette pseudonymisation est textuelle, pas sémantique.
Elle ne détecte pas "la patiente de la rue des Lilas" comme étant Mme Dupont.
Acceptable pour la phase pilote — l'itération D (STT self-hosted) élimine
le problème à la source (l'audio ne quitte plus l'infra HDS).

Note sur le cache :
Les données déchiffrées (noms patients) ne sont PAS stockées en Redis
pour des raisons de sécurité. Le cache se fait en mémoire, par requête.
Le nombre de patients par cabinet reste raisonnable (< 500 patients actifs)
donc la requête BDD est acceptable.
"""

import logging
import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.persistence.models.patient_model import PatientModel
from app.infrastructure.security.encryption import decrypt
from app.infrastructure.security.key_manager import KeyManager

logger = logging.getLogger(__name__)


async def pseudonymize_transcript(
    text: str,
    cabinet_id: UUID,
    db: AsyncSession,
    key_manager: KeyManager,
) -> tuple[str, dict[str, str]]:
    """
    Remplace les noms de patients dans la transcription par leurs pseudonymes.

    Exemple :
        Entrée : "pansement chez Madame Dupont ce matin"
        Sortie : "pansement chez Mme D. (patient:uuid-xxx) ce matin"
               + mapping {"Dupont": "uuid-xxx"}

    Args:
        text: Transcription brute issue de Whisper.
        cabinet_id: ID du cabinet (pour le RLS et la clé de chiffrement).
        db: Session SQLAlchemy asynchrone.
        key_manager: Gestionnaire des clés de déchiffrement.

    Returns:
        Tuple (texte_pseudonymisé, mapping_nom→patient_id).
        Le mapping permet la désanonymisation ultérieure si nécessaire.

    Note :
        Cette étape est best-effort. Si un nom n'est pas reconnu (patient
        non référencé dans ce cabinet), il reste dans le texte. Les faux
        négatifs sont acceptables pour la phase pilote.
    """
    if not text.strip():
        return text, {}

    # Récupère les patients actifs du cabinet (sans cache Redis — voir module docstring)
    patients = await _get_cabinet_patients(cabinet_id, db, key_manager)

    if not patients:
        return text, {}

    mapping: dict[str, str] = {}
    result = text

    # Trie par longueur décroissante pour éviter les remplacements partiels
    # ("Jean-Pierre Dupont" avant "Dupont")
    sorted_patients = sorted(
        patients,
        key=lambda p: len(p.get("last_name", "")) + len(p.get("first_name", "")),
        reverse=True,
    )

    for patient in sorted_patients:
        last_name = patient.get("last_name", "")
        first_name = patient.get("first_name", "")
        patient_id = patient.get("id", "")

        if not last_name or not patient_id:
            continue

        # Construit le pseudonyme : initiales + UUID
        first_initial = first_name[0].upper() + "." if first_name else ""
        last_initial = last_name[0].upper() + "."
        pseudo = f"{first_initial} {last_initial}".strip() if first_initial else last_initial
        full_pseudo = f"{pseudo} (patient:{patient_id})"

        # Patterns de correspondance (par ordre de priorité : plus précis en premier)
        patterns = _build_patterns(first_name, last_name)

        for pattern in patterns:
            if re.search(pattern, result, re.IGNORECASE):
                result = re.sub(pattern, full_pseudo, result, flags=re.IGNORECASE)
                mapping[last_name] = str(patient_id)
                break  # Un patient trouvé → passe au suivant

    return result, mapping


def _build_patterns(first_name: str, last_name: str) -> list[str]:
    """Construit les patterns de recherche pour un patient (du plus précis au moins précis)."""
    patterns = []
    ln = re.escape(last_name)
    fn = re.escape(first_name) if first_name else None

    if fn:
        # Prénom + Nom et Nom + Prénom
        patterns.append(rf"\b{fn}\s+{ln}\b")
        patterns.append(rf"\b{ln}\s+{fn}\b")

    # Civilités + nom
    patterns.append(rf"\bMadame\s+{ln}\b")
    patterns.append(rf"\bMonsieur\s+{ln}\b")
    patterns.append(rf"\bMme\s+{ln}\b")
    patterns.append(rf"\bM\.\s+{ln}\b")

    # Nom seul (dernier recours, plus risqué de faux positifs)
    if len(last_name) >= 4:  # Évite les noms trop courts (Li, Ho, etc.)
        patterns.append(rf"\b{ln}\b")

    return patterns


async def _get_cabinet_patients(
    cabinet_id: UUID,
    db: AsyncSession,
    key_manager: KeyManager,
) -> list[dict]:
    """
    Récupère la liste des patients actifs du cabinet avec leurs noms déchiffrés.

    Retourne uniquement les champs nécessaires à la pseudonymisation :
    id, first_name (déchiffré), last_name (déchiffré).
    """
    try:
        result = await db.execute(
            select(
                PatientModel.id,
                PatientModel.first_name_encrypted,
                PatientModel.last_name_encrypted,
                PatientModel.cabinet_id,
            ).where(
                PatientModel.cabinet_id == cabinet_id,
                PatientModel.status == "active",
            ).limit(500)  # Limite raisonnable pour un cabinet IDEL
        )
        rows = result.all()
    except Exception as exc:
        logger.warning("Pseudonymiseur : impossible de charger les patients : %s", exc)
        return []

    cabinet_key = key_manager.get_cabinet_key(cabinet_id)
    patients = []

    for row in rows:
        try:
            first_name = _safe_decrypt(row.first_name_encrypted, cabinet_key)
            last_name = _safe_decrypt(row.last_name_encrypted, cabinet_key)
            patients.append({
                "id": str(row.id),
                "first_name": first_name,
                "last_name": last_name,
            })
        except Exception:
            # Si le déchiffrement échoue pour un patient, on ignore et continue
            continue

    return patients


def _safe_decrypt(data: bytes | None, key: bytes) -> str:
    """Déchiffre un champ encrypté, retourne '' en cas d'échec."""
    if not data:
        return ""
    try:
        return decrypt(data, key)
    except Exception:
        return ""
