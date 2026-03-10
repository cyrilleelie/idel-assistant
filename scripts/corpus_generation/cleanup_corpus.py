#!/usr/bin/env python3
"""
Nettoyage et normalisation des fichiers JSONL du corpus d'entraînement.

Traite les fichiers dans :
  - backend/data/corpus/raw/
  - scripts/corpus_generation/data/corpus/raw/

Corrections appliquées :
  1. Génération de tool_call_id uniques (call_XXXX)
  2. Sérialisation function.arguments dict → string JSON
  3. Correction des messages sans role
  4. Ajout content: null aux assistant avec tool_calls
  5. Réparation des tool responses JSON invalides
  6. Suppression des codes AIS 1 / AIS 2 → AMI 2
  7. Correction difficulty anglaise (complex → complexe)
  8. Normalisation subcategory (list → pipe-separated, tri alphabétique)

Usage :
  python cleanup_corpus.py                          # traite les deux répertoires par défaut
  python cleanup_corpus.py /chemin/vers/repertoire   # traite un répertoire spécifique
"""

from __future__ import annotations

import argparse
import json
import os
import random
import re
import shutil
import string
import sys
from pathlib import Path
from collections import defaultdict


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _random_id() -> str:
    """Génère un ID unique format call_XXXX (4 chars alphanumériques)."""
    chars = string.ascii_lowercase + string.digits
    return "call_" + "".join(random.choices(chars, k=4))


def _generate_unique_id(existing_ids: set[str]) -> str:
    """Génère un ID qui n'existe pas encore dans le set."""
    while True:
        new_id = _random_id()
        if new_id not in existing_ids:
            existing_ids.add(new_id)
            return new_id


def _is_valid_json(s: str) -> bool:
    """Vérifie si une string est du JSON valide."""
    try:
        json.loads(s)
        return True
    except (json.JSONDecodeError, TypeError):
        return False


def _try_repair_json_string(s: str) -> str | None:
    """Tente de réparer une string JSON invalide.

    Retourne la string réparée ou None si irréparable.
    """
    if not isinstance(s, str):
        return None

    repaired = s

    # Supprimer artefacts Markdown
    repaired = re.sub(r'\*\*([^*]+)\*\*', r'\1', repaired)  # **bold**
    repaired = re.sub(r'\*([^*]+)\*', r'\1', repaired)       # *italic*
    repaired = re.sub(r'`([^`]+)`', r'\1', repaired)         # `code`
    repaired = re.sub(r'```[a-z]*\n?', '', repaired)         # ```code blocks```

    # Trailing commas dans les objets/arrays JSON
    repaired = re.sub(r',\s*}', '}', repaired)
    repaired = re.sub(r',\s*]', ']', repaired)

    # Essayer de parser
    if _is_valid_json(repaired):
        return repaired

    # Échapper les newlines non échappées dans les strings JSON
    # On fait un remplacement prudent : \n littéral dans une string JSON
    repaired = repaired.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

    if _is_valid_json(repaired):
        return repaired

    return None


# Mots anglais courants qui ne sont pas du vocabulaire médical
_ENGLISH_WORDS = re.compile(
    r'\b(the|is|are|was|were|has|have|been|will|would|could|should|'
    r'this|that|with|from|for|and|but|not|you|your|they|their|'
    r'patient\'s|however|therefore|furthermore|moreover|'
    r'assessment|evaluation|monitoring|treatment|procedure|'
    r'regarding|concerning|approximately|subsequently)\b',
    re.IGNORECASE
)

# Mots anglais acceptables en contexte médical français
_MEDICAL_ENGLISH_OK = re.compile(
    r'\b(patch|monitoring|score|stade|stage|spray|drain|nursing|'
    r'bolus|flush|switch|check|staff|scanner|pacemaker|stent|'
    r'bypass|shunt|catheter|clamp|kit|set|test)\b',
    re.IGNORECASE
)


def _has_english_hallucinations(text: str) -> bool:
    """Détecte la présence de mots anglais hors contexte médical."""
    if not isinstance(text, str):
        return False
    # Compter les mots anglais non-médicaux
    matches = _ENGLISH_WORDS.findall(text)
    # Filtrer ceux qui sont aussi des termes médicaux acceptés
    real_english = [m for m in matches if not _MEDICAL_ENGLISH_OK.match(m)]
    # Seuil : plus de 3 mots anglais isolés = hallucination probable
    return len(real_english) > 3


def _clean_english_hallucinations(text: str) -> str:
    """Supprime les phrases contenant trop de mots anglais."""
    if not isinstance(text, str):
        return text
    # Découper en phrases
    sentences = re.split(r'(?<=[.!?])\s+', text)
    cleaned = []
    for sentence in sentences:
        if not _has_english_hallucinations(sentence):
            cleaned.append(sentence)
    result = ' '.join(cleaned)
    return result if result.strip() else text  # Fallback si tout est supprimé


def _replace_ais_codes(text: str) -> tuple[str, int]:
    """Remplace AIS 1 et AIS 2 par AMI 2. Retourne (texte, nb_remplacements)."""
    if not isinstance(text, str):
        return text, 0
    count = 0
    # AIS 1 → AMI 2
    new_text, n = re.subn(r'\bAIS\s+1\b', 'AMI 2', text)
    count += n
    # AIS 2 → AMI 2
    new_text, n = re.subn(r'\bAIS\s+2\b', 'AMI 2', new_text)
    count += n
    return new_text, count


# ---------------------------------------------------------------------------
# Correcteurs par type
# ---------------------------------------------------------------------------

def fix_tool_call_ids(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 1 : Générer des tool_call_id uniques et apparier."""
    messages = line_data.get("messages", [])
    if not messages:
        return line_data

    existing_ids: set[str] = set()
    id_mapping: dict[str, str] = {}  # ancien_id → nouveau_id

    # Premier passage : collecter et remapper les IDs des tool_calls
    for msg in messages:
        tool_calls = msg.get("tool_calls", [])
        for tc in tool_calls:
            old_id = tc.get("id", "")
            if old_id not in id_mapping:
                new_id = _generate_unique_id(existing_ids)
                id_mapping[old_id] = new_id
            tc["id"] = id_mapping[old_id]
            stats["tool_call_ids_regenerated"] += 1

    # Deuxième passage : mettre à jour les tool_call_id des réponses tool
    for msg in messages:
        old_tc_id = msg.get("tool_call_id")
        if old_tc_id and old_tc_id in id_mapping:
            msg["tool_call_id"] = id_mapping[old_tc_id]

    return line_data


def fix_function_arguments(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 2 : Sérialiser function.arguments dict → string JSON."""
    messages = line_data.get("messages", [])
    for msg in messages:
        tool_calls = msg.get("tool_calls", [])
        for tc in tool_calls:
            func = tc.get("function", {})
            args = func.get("arguments")
            if isinstance(args, dict):
                func["arguments"] = json.dumps(args, ensure_ascii=False)
                stats["arguments_serialized"] += 1

    return line_data


def fix_missing_roles(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 3 : Corriger les messages sans role ou avec role null."""
    messages = line_data.get("messages", [])
    for msg in messages:
        # Clé "tool" au lieu de "tool_call_id"
        if "tool" in msg and "tool_call_id" not in msg:
            msg["tool_call_id"] = msg.pop("tool")
            stats["tool_key_renamed"] += 1

        role = msg.get("role")
        has_tool_call_id = "tool_call_id" in msg
        has_tool_calls = "tool_calls" in msg

        if role is None or "role" not in msg:
            if has_tool_call_id:
                msg["role"] = "tool"
                stats["missing_role_fixed"] += 1
            elif has_tool_calls:
                msg["role"] = "assistant"
                stats["missing_role_fixed"] += 1

    return line_data


def fix_assistant_content_null(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 4 : Ajouter content: null aux assistant avec tool_calls."""
    messages = line_data.get("messages", [])
    for msg in messages:
        if msg.get("role") == "assistant" and "tool_calls" in msg and "content" not in msg:
            msg["content"] = None
            stats["content_null_added"] += 1

    return line_data


def fix_tool_response_content(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 5 : Réparer les tool responses JSON invalides."""
    messages = line_data.get("messages", [])
    for msg in messages:
        if msg.get("role") != "tool":
            continue

        content = msg.get("content")

        # Si c'est un dict, sérialiser
        if isinstance(content, dict):
            msg["content"] = json.dumps(content, ensure_ascii=False)
            stats["tool_content_serialized"] += 1
            continue

        # Si c'est une string, vérifier si c'est du JSON valide
        if isinstance(content, str):
            if not _is_valid_json(content):
                repaired = _try_repair_json_string(content)
                if repaired is not None:
                    msg["content"] = repaired
                    stats["tool_content_repaired"] += 1
                else:
                    stats["tool_content_irreparable"] += 1

            # Nettoyer les hallucinations anglaises dans le contenu parsé
            try:
                parsed = json.loads(msg["content"])
                cleaned, was_cleaned = _clean_json_values(parsed)
                if was_cleaned:
                    msg["content"] = json.dumps(cleaned, ensure_ascii=False)
                    stats["english_hallucinations_cleaned"] += 1
            except (json.JSONDecodeError, TypeError):
                pass

    return line_data


def _clean_json_values(obj: object) -> tuple[object, bool]:
    """Nettoie récursivement les valeurs string d'un objet JSON."""
    was_cleaned = False
    if isinstance(obj, dict):
        new_dict = {}
        for k, v in obj.items():
            cleaned_v, c = _clean_json_values(v)
            new_dict[k] = cleaned_v
            was_cleaned = was_cleaned or c
        return new_dict, was_cleaned
    elif isinstance(obj, list):
        new_list = []
        for item in obj:
            cleaned_item, c = _clean_json_values(item)
            new_list.append(cleaned_item)
            was_cleaned = was_cleaned or c
        return new_list, was_cleaned
    elif isinstance(obj, str):
        if _has_english_hallucinations(obj):
            return _clean_english_hallucinations(obj), True
        return obj, False
    return obj, False


def fix_ais_codes(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 6 : Remplacer AIS 1 et AIS 2 par AMI 2."""
    messages = line_data.get("messages", [])
    for msg in messages:
        role = msg.get("role", "")

        # Corriger le content des messages assistant et tool
        if role in ("assistant", "tool"):
            content = msg.get("content")
            if isinstance(content, str):
                new_content, n = _replace_ais_codes(content)
                if n > 0:
                    msg["content"] = new_content
                    stats["ais_codes_replaced"] += n

        # Corriger aussi dans les tool_calls arguments (déjà sérialisés en string)
        if role == "assistant":
            for tc in msg.get("tool_calls", []):
                func = tc.get("function", {})
                args_str = func.get("arguments", "")
                if isinstance(args_str, str):
                    new_args, n = _replace_ais_codes(args_str)
                    if n > 0:
                        func["arguments"] = new_args
                        stats["ais_codes_replaced"] += n

        # Corriger dans le content des tool responses (JSON sérialisé)
        if role == "tool":
            content = msg.get("content")
            if isinstance(content, str):
                # Le contenu a déjà été traité ci-dessus, mais vérifier
                # aussi dans le JSON sérialisé
                try:
                    parsed = json.loads(content)
                    original = json.dumps(parsed, ensure_ascii=False)
                    cleaned_str, n = _replace_ais_codes(original)
                    if n > 0:
                        msg["content"] = cleaned_str
                        stats["ais_codes_replaced"] += n
                except (json.JSONDecodeError, TypeError):
                    pass

    return line_data


def fix_difficulty(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 7 : Corriger difficulty anglaise."""
    if line_data.get("difficulty") == "complex":
        line_data["difficulty"] = "complexe"
        stats["difficulty_fixed"] += 1

    return line_data


def fix_subcategory(line_data: dict, stats: dict[str, int]) -> dict:
    """Règle 8 : Normaliser subcategory."""
    subcat = line_data.get("subcategory")
    if subcat is None:
        return line_data

    # Si c'est une liste, joindre avec |
    if isinstance(subcat, list):
        parts = subcat
        stats["subcategory_list_joined"] += 1
    elif isinstance(subcat, str) and "|" in subcat:
        parts = [p.strip() for p in subcat.split("|")]
    else:
        return line_data

    # Trier alphabétiquement
    sorted_parts = sorted(set(parts))
    new_subcat = "|".join(sorted_parts)

    if new_subcat != subcat:
        line_data["subcategory"] = new_subcat
        if isinstance(subcat, str):
            stats["subcategory_sorted"] += 1

    return line_data


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------

ALL_FIXERS = [
    fix_missing_roles,        # 3 — avant les autres pour que role soit correct
    fix_tool_call_ids,        # 1
    fix_function_arguments,   # 2
    fix_assistant_content_null,  # 4
    fix_tool_response_content,   # 5
    fix_ais_codes,            # 6
    fix_difficulty,           # 7
    fix_subcategory,          # 8
]


def process_file(filepath: Path) -> dict:
    """Traite un fichier JSONL. Retourne les statistiques."""
    stats: dict[str, int] = defaultdict(int)
    stats["file"] = str(filepath)

    # Lire toutes les lignes
    with open(filepath, "r", encoding="utf-8") as f:
        raw_lines = f.readlines()

    stats["lines_read"] = len(raw_lines)

    # Sauvegarder le fichier original
    backup_path = filepath.with_suffix(".jsonl.bak")
    shutil.copy2(filepath, backup_path)

    output_lines: list[str] = []
    lines_dropped = 0

    for line_num, raw_line in enumerate(raw_lines, 1):
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        try:
            line_data = json.loads(raw_line)
        except json.JSONDecodeError as e:
            print(f"  ERREUR ligne {line_num}: JSON invalide ({e}) — ligne supprimée")
            lines_dropped += 1
            continue

        # Appliquer tous les correcteurs
        try:
            for fixer in ALL_FIXERS:
                line_data = fixer(line_data, stats)
        except Exception as e:
            print(f"  ERREUR ligne {line_num}: correcteur a échoué ({e}) — ligne supprimée")
            lines_dropped += 1
            continue

        output_lines.append(json.dumps(line_data, ensure_ascii=False))

    stats["lines_written"] = len(output_lines)
    stats["lines_dropped"] = lines_dropped

    # Écrire le fichier nettoyé
    with open(filepath, "w", encoding="utf-8", newline="\n") as f:
        for line in output_lines:
            f.write(line + "\n")

    return dict(stats)


def print_stats(all_stats: list[dict]) -> None:
    """Affiche les statistiques de nettoyage."""
    print("\n" + "=" * 70)
    print("STATISTIQUES DE NETTOYAGE DU CORPUS")
    print("=" * 70)

    stat_labels = {
        "tool_call_ids_regenerated": "Tool call IDs regeneres",
        "arguments_serialized": "Arguments dict -> string JSON",
        "missing_role_fixed": "Roles manquants corriges",
        "tool_key_renamed": "Cle 'tool' renommee en 'tool_call_id'",
        "content_null_added": "content: null ajoute (assistant+tool_calls)",
        "tool_content_serialized": "Tool content dict -> string JSON",
        "tool_content_repaired": "Tool content JSON repare",
        "tool_content_irreparable": "Tool content JSON irreparable",
        "english_hallucinations_cleaned": "Hallucinations anglaises nettoyees",
        "ais_codes_replaced": "Codes AIS 1/2 remplaces par AMI 2",
        "difficulty_fixed": "Difficulty 'complex' -> 'complexe'",
        "subcategory_list_joined": "Subcategory list -> pipe-separated",
        "subcategory_sorted": "Subcategory triee alphabetiquement",
    }

    total_corrections = 0

    for file_stats in all_stats:
        filepath = file_stats.get("file", "?")
        filename = Path(filepath).name
        print(f"\n--- {filename} ---")
        print(f"  Lignes lues     : {file_stats.get('lines_read', 0)}")
        print(f"  Lignes ecrites  : {file_stats.get('lines_written', 0)}")
        print(f"  Lignes supprimees: {file_stats.get('lines_dropped', 0)}")

        corrections = []
        for key, label in stat_labels.items():
            count = file_stats.get(key, 0)
            if count > 0:
                corrections.append((label, count))
                total_corrections += count

        if corrections:
            print("  Corrections :")
            for label, count in corrections:
                print(f"    - {label}: {count}")
        else:
            print("  Aucune correction necessaire.")

    print(f"\n{'=' * 70}")
    print(f"TOTAL corrections appliquees : {total_corrections}")
    print(f"Fichiers traites             : {len(all_stats)}")
    print(f"{'=' * 70}\n")


# ---------------------------------------------------------------------------
# Point d'entrée
# ---------------------------------------------------------------------------

def find_project_root() -> Path:
    """Remonte l'arborescence pour trouver la racine du projet (contient backend/)."""
    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / "backend").is_dir():
            return current
        current = current.parent
    # Fallback
    return Path(__file__).resolve().parent.parent.parent


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Nettoyage et normalisation des fichiers JSONL du corpus."
    )
    parser.add_argument(
        "directories",
        nargs="*",
        help="Repertoires contenant les fichiers JSONL a traiter. "
             "Par defaut : backend/data/corpus/raw/ et scripts/corpus_generation/data/corpus/raw/",
    )
    args = parser.parse_args()

    project_root = find_project_root()

    if args.directories:
        dirs = [Path(d) for d in args.directories]
    else:
        dirs = [
            project_root / "backend" / "data" / "corpus" / "raw",
            project_root / "scripts" / "corpus_generation" / "data" / "corpus" / "raw",
        ]

    # Collecter tous les fichiers JSONL
    jsonl_files: list[Path] = []
    for d in dirs:
        if not d.is_dir():
            print(f"ATTENTION : repertoire introuvable : {d}")
            continue
        for f in sorted(d.glob("*.jsonl")):
            jsonl_files.append(f)

    if not jsonl_files:
        print("Aucun fichier JSONL trouve.")
        sys.exit(1)

    print(f"Fichiers JSONL trouves : {len(jsonl_files)}")
    for f in jsonl_files:
        print(f"  - {f}")

    all_stats: list[dict] = []

    for filepath in jsonl_files:
        print(f"\nTraitement de {filepath.name}...")
        stats = process_file(filepath)
        all_stats.append(stats)

    print_stats(all_stats)


if __name__ == "__main__":
    main()
