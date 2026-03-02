"""Benchmark de latence cloud vs GPU.

Usage :
  cd backend
  uv run python ../scripts/benchmark_latency.py --mode cloud
  uv run python ../scripts/benchmark_latency.py --mode gpu

Génère docs/benchmarks/voice-latency-{mode}-{date}.md
"""

import argparse
import asyncio
import statistics
import time
from datetime import date
from pathlib import Path

import httpx

BENCHMARK_PROMPTS = [
    "Qui sont mes patients aujourd'hui ?",
    "Calcule une cotation AMI 4 pour M. Dupont",
    "Quel est le tarif d'un BSI ?",
    "Résume ma tournée du matin",
    "Crée un RDV pour Mme Martin jeudi à 9h",
    "Combien de factures en attente ?",
    "Statistiques de facturation du mois",
    "Quels créneaux disponibles demain matin ?",
    "Quel est le tarif IK pour 15 km ?",
    "Explique la cotation AMI 2 + IFD",
]


async def benchmark_llm_ttft(base_url: str, model: str, n_runs: int = 10) -> list[float]:
    """Mesure le Time To First Token pour N requêtes via l'API OpenAI-compatible."""
    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, prompt in enumerate(BENCHMARK_PROMPTS[:n_runs]):
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
                "max_tokens": 100,
            }
            start = time.monotonic()
            try:
                async with client.stream(
                    "POST",
                    f"{base_url}/v1/chat/completions",
                    json=payload,
                    headers={"Authorization": "Bearer not-needed"},
                ) as resp:
                    async for line in resp.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            ttft = (time.monotonic() - start) * 1000
                            results.append(ttft)
                            break
            except Exception as exc:
                print(f"  [ERREUR] Requête {i+1}: {exc}")
            print(f"  Requête {i+1}/{n_runs}: TTFT = {results[-1]:.0f}ms" if results else "")
    return results


async def benchmark_stt(base_url: str, n_runs: int = 5) -> list[float]:
    """Mesure la latence de transcription avec un audio de test."""
    # Génère un audio PCM 16-bit de 5 secondes (silence)
    import struct

    sample_rate = 16000
    duration = 5.0
    n_samples = int(sample_rate * duration)
    audio_data = struct.pack(f"<{n_samples}h", *([100] * n_samples))

    results = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for i in range(n_runs):
            start = time.monotonic()
            try:
                files = {"audio": ("test.wav", audio_data, "audio/wav")}
                resp = await client.post(f"{base_url}/transcribe", files=files)
                latency = (time.monotonic() - start) * 1000
                if resp.status_code == 200:
                    results.append(latency)
                    print(f"  Run {i+1}/{n_runs}: {latency:.0f}ms")
                else:
                    print(f"  [ERREUR] Run {i+1}: HTTP {resp.status_code}")
            except Exception as exc:
                print(f"  [ERREUR] Run {i+1}: {exc}")
    return results


async def benchmark_tts(base_url: str, n_runs: int = 5) -> list[float]:
    """Mesure le TTFB de la synthèse TTS."""
    texts = [
        "Bonjour, voici vos rendez-vous du jour.",
        "La cotation est de 12 euros 50.",
        "Pansement complexe réalisé sans complication.",
        "Le prochain créneau disponible est jeudi à 9 heures.",
        "Vous avez 3 factures en attente de validation.",
    ]
    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i in range(n_runs):
            payload = {"text": texts[i % len(texts)], "speed": 1.0}
            start = time.monotonic()
            try:
                async with client.stream(
                    "POST", f"{base_url}/synthesize", json=payload
                ) as resp:
                    async for chunk in resp.aiter_bytes(chunk_size=1024):
                        ttfb = (time.monotonic() - start) * 1000
                        results.append(ttfb)
                        break
                print(f"  Run {i+1}/{n_runs}: TTFB = {results[-1]:.0f}ms")
            except Exception as exc:
                print(f"  [ERREUR] Run {i+1}: {exc}")
    return results


def compute_stats(values: list[float]) -> dict:
    if not values:
        return {"mean": None, "p50": None, "p95": None, "p99": None, "count": 0}
    s = sorted(values)
    n = len(s)
    return {
        "mean": round(statistics.mean(s), 1),
        "p50": round(s[int(n * 0.50)], 1),
        "p95": round(s[min(int(n * 0.95), n - 1)], 1),
        "p99": round(s[min(int(n * 0.99), n - 1)], 1),
        "count": n,
    }


def generate_report(
    mode: str,
    llm_stats: dict,
    stt_stats: dict,
    tts_stats: dict,
) -> str:
    today = date.today().isoformat()
    return f"""# Benchmark de latence — Mode {mode.upper()}

Date : {today}

## LLM — Time To First Token (TTFT)

| Métrique | Valeur |
|----------|--------|
| Mean     | {llm_stats['mean'] or 'N/A'} ms |
| P50      | {llm_stats['p50'] or 'N/A'} ms |
| P95      | {llm_stats['p95'] or 'N/A'} ms |
| P99      | {llm_stats['p99'] or 'N/A'} ms |
| Runs     | {llm_stats['count']} |

## STT — Latence de transcription (5s audio)

| Métrique | Valeur |
|----------|--------|
| Mean     | {stt_stats['mean'] or 'N/A'} ms |
| P50      | {stt_stats['p50'] or 'N/A'} ms |
| P95      | {stt_stats['p95'] or 'N/A'} ms |
| Runs     | {stt_stats['count']} |

## TTS — Time To First Byte

| Métrique | Valeur |
|----------|--------|
| Mean     | {tts_stats['mean'] or 'N/A'} ms |
| P50      | {tts_stats['p50'] or 'N/A'} ms |
| P95      | {tts_stats['p95'] or 'N/A'} ms |
| Runs     | {tts_stats['count']} |

## Cibles de performance

| Métrique          | Cible   | Résultat |
|-------------------|---------|----------|
| LLM TTFT          | < 200ms | {'OK' if llm_stats['mean'] and llm_stats['mean'] < 200 else 'FAIL'} |
| STT (5s audio)    | < 500ms | {'OK' if stt_stats['mean'] and stt_stats['mean'] < 500 else 'FAIL'} |
| TTS TTFB          | < 100ms | {'OK' if tts_stats['mean'] and tts_stats['mean'] < 100 else 'FAIL'} |
"""


async def main():
    parser = argparse.ArgumentParser(description="Benchmark latence cloud vs GPU")
    parser.add_argument(
        "--mode",
        choices=["cloud", "gpu"],
        required=True,
        help="Mode à benchmarker",
    )
    parser.add_argument(
        "--base-url",
        default=None,
        help="URL de base (défaut: http://10.0.0.5:9000 pour GPU, API keys pour cloud)",
    )
    parser.add_argument("--llm-runs", type=int, default=10)
    parser.add_argument("--stt-runs", type=int, default=5)
    parser.add_argument("--tts-runs", type=int, default=5)
    args = parser.parse_args()

    if args.mode == "gpu":
        base_url = args.base_url or "http://10.0.0.5:9000"
        model = "mistral-small-3.1-awq"
    else:
        base_url = args.base_url or "https://api.mistral.ai"
        model = "mistral-large-latest"

    print(f"\n{'='*60}")
    print(f"  Benchmark {args.mode.upper()} — {base_url}")
    print(f"{'='*60}\n")

    print("--- LLM TTFT ---")
    llm_results = await benchmark_llm_ttft(base_url, model, args.llm_runs)
    llm_stats = compute_stats(llm_results)

    print("\n--- STT Latence ---")
    stt_results = await benchmark_stt(base_url, args.stt_runs)
    stt_stats = compute_stats(stt_results)

    print("\n--- TTS TTFB ---")
    tts_results = await benchmark_tts(base_url, args.tts_runs)
    tts_stats = compute_stats(tts_results)

    report = generate_report(args.mode, llm_stats, stt_stats, tts_stats)

    output_dir = Path(__file__).parent.parent / "docs" / "benchmarks"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / f"voice-latency-{args.mode}-{date.today().isoformat()}.md"
    output_file.write_text(report, encoding="utf-8")

    print(f"\n{'='*60}")
    print(f"  Rapport généré : {output_file}")
    print(f"{'='*60}")
    print(report)


if __name__ == "__main__":
    asyncio.run(main())
