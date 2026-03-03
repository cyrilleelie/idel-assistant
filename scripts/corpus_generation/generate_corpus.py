"""Script principal de génération du corpus synthétique IDEL.

Génère 20 000 exemples au total, les valide, et les sauvegarde.

Usage :
  python generate_corpus.py --dry-run     # Génère 10 exemples par catégorie pour tester
  python generate_corpus.py               # Génération complète (~50-100€ API Claude)
  python generate_corpus.py --resume      # Reprend après interruption

Outputs :
  data/corpus/raw/              <- Exemples bruts par catégorie
  data/corpus/train.jsonl       <- Dataset final pour fine-tuning (90%)
  data/corpus/test.jsonl        <- Jeu de test pour évaluation (10%)
  data/corpus/stats.json        <- Statistiques du corpus
"""

import argparse
import asyncio
import json
import os
import random
import sys
from pathlib import Path

# Ajoute le dossier courant au path pour les imports
sys.path.insert(0, str(Path(__file__).parent))

from config import CORPUS_CONFIG
from generators.cotation_ngap import CotationNGAPGenerator
from generators.transmission_dar import TransmissionDARGenerator
from generators.rdv_planning import RDVPlanningGenerator
from generators.ordonnance import OrdonnanceGenerator
from generators.reglementation import ReglementationGenerator
from generators.general import GeneralConversationGenerator
from validators.ngap_validator import NGAPValidator
from validators.format_validator import FormatValidator

CATEGORIES: dict[str, tuple[type, int]] = {
    "cotation_ngap": (CotationNGAPGenerator, CORPUS_CONFIG.categories["cotation_ngap"]),
    "transmission_dar": (TransmissionDARGenerator, CORPUS_CONFIG.categories["transmission_dar"]),
    "rdv_planning": (RDVPlanningGenerator, CORPUS_CONFIG.categories["rdv_planning"]),
    "ordonnance": (OrdonnanceGenerator, CORPUS_CONFIG.categories["ordonnance"]),
    "reglementation": (ReglementationGenerator, CORPUS_CONFIG.categories["reglementation"]),
    "general": (GeneralConversationGenerator, CORPUS_CONFIG.categories["general"]),
}


async def generate_category(
    generator_class: type,
    target_n: int,
    category_name: str,
    output_dir: Path,
    api_key: str,
    dry_run: bool = False,
) -> list[dict]:
    """Génère les exemples pour une catégorie, avec reprise sur interruption."""
    output_file = output_dir / f"{category_name}.jsonl"
    existing: list[dict] = []

    # Reprise : charge les exemples déjà générés
    if output_file.exists():
        with open(output_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        existing.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
        print(f"  {category_name}: {len(existing)} exemples existants, reprise...")

    effective_target = CORPUS_CONFIG.dry_run_per_category if dry_run else target_n
    n_to_generate = effective_target - len(existing)

    if n_to_generate <= 0:
        print(f"  {category_name}: deja complet ({len(existing)} exemples)")
        return existing

    generator = generator_class(api_key=api_key)
    batch_size = CORPUS_CONFIG.batch_size
    new_examples: list[dict] = []

    for batch_start in range(0, n_to_generate, batch_size):
        batch_n = min(batch_size, n_to_generate - batch_start)
        total_done = len(existing) + len(new_examples)
        print(
            f"  {category_name}: batch {batch_start}-{batch_start + batch_n} "
            f"({total_done}/{effective_target})..."
        )

        batch = await generator.generate_batch(n=batch_n)
        batch_dicts = [e.__dict__ for e in batch]
        new_examples.extend(batch_dicts)

        # Sauvegarde incrémentale
        with open(output_file, "a", encoding="utf-8") as f:
            for example in batch_dicts:
                f.write(json.dumps(example, ensure_ascii=False) + "\n")

        await asyncio.sleep(CORPUS_CONFIG.rate_limit_delay)

    all_examples = existing + new_examples
    print(f"  {category_name}: {len(all_examples)} exemples generes")
    return all_examples


async def main(dry_run: bool = False) -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERREUR: Variable d'environnement ANTHROPIC_API_KEY non definie.")
        print("  export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    base_dir = Path(CORPUS_CONFIG.output_dir)
    raw_dir = base_dir / CORPUS_CONFIG.raw_subdir
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print(f"Generation du corpus IDEL {'(DRY RUN)' if dry_run else ''}")
    print("=" * 60)

    all_examples: list[dict] = []

    for category_name, (generator_class, target_n) in CATEGORIES.items():
        examples = await generate_category(
            generator_class,
            target_n,
            category_name,
            raw_dir,
            api_key,
            dry_run=dry_run,
        )
        all_examples.extend(examples)

    print(f"\nTotal exemples generes : {len(all_examples)}")

    # Validation
    print("\nValidation du corpus...")
    ngap_validator = NGAPValidator()
    format_validator = FormatValidator()

    valid_examples: list[dict] = []
    invalid_count = 0
    invalid_reasons: dict[str, int] = {"format": 0, "ngap": 0}

    for example in all_examples:
        if not format_validator.validate(example):
            invalid_count += 1
            invalid_reasons["format"] += 1
            continue

        if example.get("category") == "cotation_ngap":
            if not ngap_validator.validate(example):
                invalid_count += 1
                invalid_reasons["ngap"] += 1
                continue

        valid_examples.append(example)

    print(f"Exemples valides : {len(valid_examples)} ({invalid_count} rejetes)")
    print(f"  Format invalide : {invalid_reasons['format']}")
    print(f"  NGAP invalide   : {invalid_reasons['ngap']}")

    # Split train/test
    random.shuffle(valid_examples)
    split = int(len(valid_examples) * CORPUS_CONFIG.train_ratio)
    train_examples = valid_examples[:split]
    test_examples = valid_examples[split:]

    # Sauvegarde finale au format ChatML (messages uniquement)
    base_dir.mkdir(parents=True, exist_ok=True)

    with open(base_dir / "train.jsonl", "w", encoding="utf-8") as f:
        for ex in train_examples:
            f.write(
                json.dumps({"messages": ex["messages"]}, ensure_ascii=False) + "\n"
            )

    with open(base_dir / "test.jsonl", "w", encoding="utf-8") as f:
        for ex in test_examples:
            f.write(
                json.dumps({"messages": ex["messages"]}, ensure_ascii=False) + "\n"
            )

    # Stats
    by_category: dict[str, int] = {}
    by_subcategory: dict[str, int] = {}
    by_difficulty: dict[str, int] = {}
    for ex in valid_examples:
        cat = ex.get("category", "unknown")
        by_category[cat] = by_category.get(cat, 0) + 1
        sub = ex.get("subcategory", "unknown")
        by_subcategory[sub] = by_subcategory.get(sub, 0) + 1
        diff = ex.get("difficulty", "unknown")
        by_difficulty[diff] = by_difficulty.get(diff, 0) + 1

    stats = {
        "total": len(valid_examples),
        "train": len(train_examples),
        "test": len(test_examples),
        "rejected": invalid_count,
        "rejection_reasons": invalid_reasons,
        "by_category": by_category,
        "by_subcategory": by_subcategory,
        "by_difficulty": by_difficulty,
    }

    with open(base_dir / "stats.json", "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2, ensure_ascii=False)

    print(f"\nCorpus pret : {len(train_examples)} train, {len(test_examples)} test")
    print(f"Fichiers : {base_dir / 'train.jsonl'}, {base_dir / 'test.jsonl'}")
    print(f"Stats    : {base_dir / 'stats.json'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Genere le corpus synthetique IDEL pour fine-tuning"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=f"Genere {CORPUS_CONFIG.dry_run_per_category} exemples par categorie pour tester",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Reprend la generation la ou elle s'est arretee",
    )
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
