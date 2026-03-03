"""Script de validation du corpus généré.

Vérifie la qualité des exemples et produit un rapport détaillé.

Usage :
  python validate_corpus.py                  # Valide data/corpus/raw/
  python validate_corpus.py --path data/corpus/raw/cotation_ngap.jsonl
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from validators.format_validator import FormatValidator
from validators.ngap_validator import NGAPValidator


def validate_file(path: Path, format_val: FormatValidator, ngap_val: NGAPValidator) -> dict:
    """Valide un fichier JSONL et retourne les statistiques."""
    total = 0
    valid = 0
    errors: dict[str, list[int]] = {"format": [], "ngap": [], "parse": []}

    with open(path, encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            total += 1

            try:
                example = json.loads(line)
            except json.JSONDecodeError:
                errors["parse"].append(line_num)
                continue

            if not format_val.validate(example):
                errors["format"].append(line_num)
                continue

            category = example.get("category", "")
            if category == "cotation_ngap" and not ngap_val.validate(example):
                errors["ngap"].append(line_num)
                continue

            valid += 1

    return {
        "file": path.name,
        "total": total,
        "valid": valid,
        "invalid": total - valid,
        "validity_rate": valid / total if total > 0 else 0,
        "errors": {
            k: {"count": len(v), "lines": v[:10]}  # Max 10 lignes par type
            for k, v in errors.items()
            if v
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Valide le corpus IDEL")
    parser.add_argument("--path", type=str, default=None, help="Fichier ou dossier a valider")
    args = parser.parse_args()

    format_val = FormatValidator()
    ngap_val = NGAPValidator()

    if args.path:
        target = Path(args.path)
    else:
        target = Path("data/corpus/raw")

    if not target.exists():
        print(f"ERREUR: {target} n'existe pas.")
        sys.exit(1)

    files = [target] if target.is_file() else sorted(target.glob("*.jsonl"))

    if not files:
        print(f"Aucun fichier .jsonl trouve dans {target}")
        sys.exit(1)

    print("=" * 60)
    print("Validation du corpus IDEL")
    print("=" * 60)

    total_all = 0
    valid_all = 0

    for f in files:
        result = validate_file(f, format_val, ngap_val)
        total_all += result["total"]
        valid_all += result["valid"]

        status = "OK" if result["validity_rate"] >= 0.95 else "ATTENTION"
        print(f"\n{result['file']} [{status}]")
        print(f"  Total: {result['total']}  Valides: {result['valid']}  "
              f"Invalides: {result['invalid']}  "
              f"Taux: {result['validity_rate']:.1%}")

        for error_type, info in result.get("errors", {}).items():
            print(f"  Erreurs {error_type}: {info['count']} (lignes: {info['lines']})")

    print(f"\n{'=' * 60}")
    rate = valid_all / total_all if total_all > 0 else 0
    print(f"TOTAL: {valid_all}/{total_all} valides ({rate:.1%})")

    if rate < 0.95:
        print("ATTENTION: Taux de validite < 95%. Verifier les generateurs.")
    else:
        print("Corpus OK pour le fine-tuning.")


if __name__ == "__main__":
    main()
