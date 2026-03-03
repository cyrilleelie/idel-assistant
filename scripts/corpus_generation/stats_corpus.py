"""Statistiques détaillées sur le corpus généré.

Usage :
  python stats_corpus.py                     # Stats sur data/corpus/
  python stats_corpus.py --path data/corpus/raw/
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path


def analyze_corpus(corpus_dir: Path) -> None:
    """Analyse et affiche les statistiques du corpus."""
    # Cherche les fichiers JSONL
    raw_dir = corpus_dir / "raw"
    files = sorted(raw_dir.glob("*.jsonl")) if raw_dir.exists() else []
    train_file = corpus_dir / "train.jsonl"
    test_file = corpus_dir / "test.jsonl"
    stats_file = corpus_dir / "stats.json"

    print("=" * 60)
    print("Statistiques du corpus IDEL")
    print("=" * 60)

    # Stats sauvegardées
    if stats_file.exists():
        with open(stats_file, encoding="utf-8") as f:
            stats = json.load(f)
        print(f"\nStats pre-calculees ({stats_file.name}):")
        print(f"  Total: {stats.get('total', '?')}")
        print(f"  Train: {stats.get('train', '?')}")
        print(f"  Test:  {stats.get('test', '?')}")
        print(f"  Rejetes: {stats.get('rejected', '?')}")
        print()

    # Analyse détaillée des fichiers bruts
    all_examples: list[dict] = []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        all_examples.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

    if not all_examples:
        # Essaie train + test
        for fp in [train_file, test_file]:
            if fp.exists():
                with open(fp, encoding="utf-8") as fh:
                    for line in fh:
                        line = line.strip()
                        if line:
                            try:
                                all_examples.append(json.loads(line))
                            except json.JSONDecodeError:
                                pass

    if not all_examples:
        print("Aucun exemple trouve.")
        return

    print(f"Exemples analyses: {len(all_examples)}")

    # Par catégorie
    categories = Counter(ex.get("category", "?") for ex in all_examples)
    print(f"\nPar categorie:")
    for cat, count in categories.most_common():
        pct = count / len(all_examples) * 100
        bar = "#" * int(pct / 2)
        print(f"  {cat:25s} {count:5d} ({pct:5.1f}%) {bar}")

    # Par sous-catégorie
    subcategories = Counter(ex.get("subcategory", "?") for ex in all_examples)
    print(f"\nPar sous-categorie:")
    for sub, count in subcategories.most_common(20):
        print(f"  {sub:35s} {count:5d}")

    # Par difficulté
    difficulties = Counter(ex.get("difficulty", "?") for ex in all_examples)
    print(f"\nPar difficulte:")
    for diff, count in difficulties.most_common():
        pct = count / len(all_examples) * 100
        print(f"  {diff:15s} {count:5d} ({pct:5.1f}%)")

    # Longueur moyenne des messages
    msg_lengths: list[int] = []
    tool_call_count = 0
    for ex in all_examples:
        messages = ex.get("messages", [])
        for msg in messages:
            content = msg.get("content", "")
            if content:
                msg_lengths.append(len(content))
            if msg.get("tool_calls"):
                tool_call_count += 1

    if msg_lengths:
        avg_len = sum(msg_lengths) / len(msg_lengths)
        print(f"\nMessages:")
        print(f"  Longueur moyenne: {avg_len:.0f} caracteres")
        print(f"  Min: {min(msg_lengths)}, Max: {max(msg_lengths)}")
        print(f"  Exemples avec tool_calls: {tool_call_count}")

    # Estimation tokens (approximation : 1 token ~ 4 chars)
    total_chars = sum(msg_lengths)
    est_tokens = total_chars / 4
    print(f"\nEstimation tokens:")
    print(f"  Total caracteres: {total_chars:,}")
    print(f"  Tokens estimes:   {est_tokens:,.0f}")
    print(f"  Cout generation (Sonnet ~3$/M): ~{est_tokens / 1_000_000 * 3:.0f}$")


def main() -> None:
    parser = argparse.ArgumentParser(description="Stats du corpus IDEL")
    parser.add_argument("--path", type=str, default="data/corpus")
    args = parser.parse_args()

    analyze_corpus(Path(args.path))


if __name__ == "__main__":
    main()
