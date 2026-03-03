"""Évalue le modèle fine-tuné vs le modèle de base sur le jeu de test.

Génère un rapport comparatif avant/après pour décider du déploiement.

Usage :
  python evaluate.py --vllm-url http://10.0.0.5:9000/v1
  python evaluate.py --vllm-url http://10.0.0.5:9000/v1 --n 50   # Evaluation rapide
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from openai import AsyncOpenAI

# Tools definition pour l'évaluation (simplifié)
TOOLS_DEFINITION = [
    {
        "type": "function",
        "function": {
            "name": "analyser_et_coter",
            "description": "Analyse un soin et propose la cotation NGAP",
            "parameters": {
                "type": "object",
                "properties": {
                    "description_soin": {"type": "string"},
                    "patient_id": {"type": "string"},
                    "heure_soin": {"type": "string"},
                    "bsi_actif": {"type": "boolean"},
                    "distance_km": {"type": "number"},
                },
                "required": ["description_soin"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "structurer_transmission",
            "description": "Structure une dictée en transmission DAR",
            "parameters": {
                "type": "object",
                "properties": {
                    "dictee_libre": {"type": "string"},
                    "patient_id": {"type": "string"},
                },
                "required": ["dictee_libre"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "proposer_creneaux_geooptimises",
            "description": "Propose des créneaux optimisés géographiquement",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "type_soin": {"type": "string"},
                    "duree_minutes": {"type": "integer"},
                },
                "required": ["type_soin"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "interpreter_ordonnance",
            "description": "Interprète une ordonnance pour planifier les soins",
            "parameters": {
                "type": "object",
                "properties": {
                    "texte_ordonnance": {"type": "string"},
                    "patient_id": {"type": "string"},
                },
                "required": ["texte_ordonnance"],
            },
        },
    },
]

SYSTEM_PROMPT = """Tu es l'assistant de Sophie, infirmière libérale (IDEL) en France.
Date d'aujourd'hui : 2026-03-15.

RÔLE ET LIMITES :
- Tu aides aux tâches administratives : facturation NGAP, planification, transmissions
- Tu ne donnes JAMAIS de conseils médicaux, de diagnostic, ni d'interprétation clinique
- Toute action qui modifie des données requiert une confirmation explicite

NOMENCLATURE NGAP (post-avenant 10, janvier 2024) :
- AMI 1-4, AMX 1-4 (si BSI actif), AIS 1-4, BSA/BSB/BSC
- MAU (nuit 20h-23h et 5h-8h), MCI (dimanche/JF), MAD (nuit 23h-5h)
- IK 0,62€/km plaine, règle cumul article 11

FORMAT : Court et direct. Maximum 5 lignes. Confirme avant d'écrire."""


def load_test_cases(path: str, category: str | None, n: int) -> list[dict]:
    """Charge N cas de test, optionnellement filtrés par catégorie."""
    examples = []
    test_file = Path(path)
    if not test_file.exists():
        print(f"ERREUR: {test_file} n'existe pas.")
        sys.exit(1)

    with open(test_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                ex = json.loads(line)
                if category and ex.get("category") != category:
                    continue
                examples.append(ex)
            except json.JSONDecodeError:
                pass

    return examples[:n]


def extract_user_message(example: dict) -> str:
    """Extrait le premier message user d'un exemple."""
    for msg in example.get("messages", []):
        if msg.get("role") == "user":
            return msg.get("content", "")
    return ""


def extract_expected_tool(example: dict) -> str | None:
    """Extrait le nom de l'outil attendu."""
    for msg in example.get("messages", []):
        if msg.get("role") == "assistant" and msg.get("tool_calls"):
            for tc in msg["tool_calls"]:
                return tc.get("function", {}).get("name")
    return None


async def evaluate_tool_accuracy(
    client: AsyncOpenAI, model: str, test_cases: list[dict]
) -> dict:
    """Évalue si le modèle appelle le bon outil."""
    correct = 0
    total = 0
    details: list[dict] = []

    for case in test_cases:
        user_msg = extract_user_message(case)
        expected_tool = extract_expected_tool(case)
        if not user_msg:
            continue

        total += 1
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                tools=TOOLS_DEFINITION,
                tool_choice="auto",
                temperature=0.0,
                max_tokens=1024,
            )

            actual_tool = None
            choice = response.choices[0]
            if choice.message.tool_calls:
                actual_tool = choice.message.tool_calls[0].function.name

            match = actual_tool == expected_tool
            if match:
                correct += 1

            details.append({
                "user_msg": user_msg[:100],
                "expected": expected_tool,
                "actual": actual_tool,
                "match": match,
            })

        except Exception as e:
            details.append({
                "user_msg": user_msg[:100],
                "expected": expected_tool,
                "actual": None,
                "error": str(e),
                "match": False,
            })

    return {
        "metric": "tool_accuracy",
        "correct": correct,
        "total": total,
        "accuracy": correct / total if total > 0 else 0,
        "details": details,
    }


async def evaluate_response_quality(
    client: AsyncOpenAI,
    judge_client: AsyncOpenAI,
    model: str,
    test_cases: list[dict],
) -> dict:
    """Évalue la qualité des réponses avec un juge LLM (Claude via API)."""
    scores: list[int] = []

    for case in test_cases:
        user_msg = extract_user_message(case)
        if not user_msg:
            continue

        # Obtient la réponse du modèle
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                temperature=0.0,
                max_tokens=1024,
            )
            actual_response = response.choices[0].message.content or ""
        except Exception:
            continue

        # Juge la qualité
        try:
            judge_response = await judge_client.chat.completions.create(
                model="claude-sonnet-4-20250514",
                messages=[
                    {
                        "role": "user",
                        "content": f"""Évalue la qualité de cette réponse d'un assistant IDEL.

Question de l'IDEL : {user_msg}

Réponse de l'assistant : {actual_response}

Critères (note de 1 à 5) :
- Exactitude factuelle (NGAP, réglementation)
- Concision (max 5 lignes)
- Ton professionnel et approprié
- Pas de conseil médical

Réponds UNIQUEMENT avec un chiffre de 1 à 5.""",
                    }
                ],
                max_tokens=10,
                temperature=0.0,
            )
            score_text = (judge_response.choices[0].message.content or "").strip()
            score = int(score_text[0]) if score_text and score_text[0].isdigit() else 3
            scores.append(min(max(score, 1), 5))
        except Exception:
            continue

    return {
        "metric": "response_quality",
        "mean_score": sum(scores) / len(scores) if scores else 0,
        "count": len(scores),
        "distribution": {
            "excellent (4-5)": sum(1 for s in scores if s >= 4),
            "bon (3)": sum(1 for s in scores if s == 3),
            "insuffisant (1-2)": sum(1 for s in scores if s < 3),
        },
    }


async def main(
    vllm_url: str,
    test_path: str,
    base_model: str,
    ft_model: str,
    n: int,
) -> None:
    client = AsyncOpenAI(base_url=vllm_url, api_key="none")

    # Juge LLM (Claude via API compatible OpenAI)
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
    judge_client = AsyncOpenAI(
        base_url="https://api.anthropic.com/v1",
        api_key=anthropic_key,
    ) if anthropic_key else None

    # Charge les cas de test
    cotation_cases = load_test_cases(test_path, "cotation_ngap", n)
    general_cases = load_test_cases(test_path, None, n)

    print("=" * 60)
    print("Evaluation du modele fine-tune IDEL")
    print("=" * 60)

    results: dict[str, dict] = {}

    for model_name, label in [(base_model, "base"), (ft_model, "finetuned")]:
        print(f"\n--- Evaluation : {label} ({model_name}) ---")

        # Test 1 : Précision des appels d'outils
        print("  Test tool_accuracy...")
        tool_result = await evaluate_tool_accuracy(client, model_name, cotation_cases)
        print(f"    Accuracy: {tool_result['accuracy']:.1%}")

        # Test 2 : Qualité des réponses (si juge disponible)
        quality_result = None
        if judge_client:
            print("  Test response_quality (juge LLM)...")
            quality_result = await evaluate_response_quality(
                client, judge_client, model_name, general_cases
            )
            print(f"    Score moyen: {quality_result['mean_score']:.1f}/5")

        results[label] = {
            "model": model_name,
            "tool_accuracy": tool_result,
            "response_quality": quality_result,
        }

    # Rapport comparatif
    base_acc = results["base"]["tool_accuracy"]["accuracy"]
    ft_acc = results["finetuned"]["tool_accuracy"]["accuracy"]

    report = {
        "base_model": results["base"],
        "finetuned_model": results["finetuned"],
        "improvement": {
            "tool_accuracy": ft_acc - base_acc,
        },
        "deploy_recommendation": "GO" if ft_acc >= 0.95 else "NO-GO",
    }

    report_path = Path("evaluation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print("RESUME")
    print(f"{'=' * 60}")
    print(f"Tool accuracy - Base : {base_acc:.1%}")
    print(f"Tool accuracy - FT   : {ft_acc:.1%}")
    print(f"Amelioration         : {ft_acc - base_acc:+.1%}")
    print(f"Recommandation       : {report['deploy_recommendation']}")
    print(f"\nRapport complet : {report_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Evalue le modele fine-tune IDEL vs modele de base"
    )
    parser.add_argument(
        "--vllm-url",
        default="http://10.0.0.5:9000/v1",
        help="URL de l'API vLLM",
    )
    parser.add_argument(
        "--test-path",
        default="data/corpus/test.jsonl",
        help="Chemin du jeu de test",
    )
    parser.add_argument(
        "--base-model",
        default="mistral-small-3.1-awq",
        help="Nom du modele de base dans vLLM",
    )
    parser.add_argument(
        "--ft-model",
        default="idel-v1",
        help="Nom du modele fine-tune dans vLLM",
    )
    parser.add_argument(
        "--n",
        type=int,
        default=100,
        help="Nombre de cas de test par evaluation",
    )
    args = parser.parse_args()

    asyncio.run(
        main(args.vllm_url, args.test_path, args.base_model, args.ft_model, args.n)
    )
