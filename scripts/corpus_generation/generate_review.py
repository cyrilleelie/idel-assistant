"""Génère des fichiers Markdown lisibles pour review du corpus.

Usage (depuis backend/) :
  python ../scripts/corpus_generation/generate_review.py
"""

import json
import random
from pathlib import Path

raw_dir = Path(__file__).resolve().parent.parent.parent / "backend" / "data" / "corpus" / "raw"
review_dir = raw_dir.parent / "review"
review_dir.mkdir(parents=True, exist_ok=True)

for f in raw_dir.glob("*.jsonl"):
    examples = []
    with open(f, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    examples.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    sample = random.sample(examples, min(50, len(examples)))

    out_path = review_dir / f"{f.stem}_review.md"
    with open(out_path, "w", encoding="utf-8") as out:
        out.write(f"# Revue : {f.stem}\n\n")
        out.write(f"{len(sample)} exemples à relire. Pour chaque exemple :\n")
        out.write("- [ ] La question est réaliste (une IDEL pourrait dire ça)\n")
        out.write("- [ ] La réponse est correcte (cotation, contenu, etc.)\n")
        out.write("- [ ] Le ton est approprié (concis, professionnel)\n\n")
        out.write("---\n\n")

        for i, ex in enumerate(sample, 1):
            out.write(f"## Exemple {i}\n\n")
            for msg in ex.get("messages", []):
                role = msg.get("role", "?")
                content = msg.get("content", "")
                if role == "system":
                    out.write("**System** : _(prompt standard)_\n\n")
                elif role == "user":
                    out.write(f"**IDEL** : {content}\n\n")
                elif role == "assistant":
                    if msg.get("tool_calls"):
                        for tc in msg["tool_calls"]:
                            fn = tc.get("function", {})
                            name = fn.get("name", "?")
                            args = fn.get("arguments", "{}")
                            out.write(f"**Agent** → appel outil `{name}` :\n")
                            out.write(f"```json\n{args}\n```\n\n")
                    elif content:
                        out.write(f"**Agent** : {content}\n\n")
                elif role == "tool":
                    out.write(f"**Résultat outil** :\n```json\n{content}\n```\n\n")

            out.write("**Verdict** : OK / KO  \n")
            out.write("**Commentaire** : \n\n")
            out.write("---\n\n")

    print(f"{f.stem}: {len(sample)} exemples -> {out_path}")
