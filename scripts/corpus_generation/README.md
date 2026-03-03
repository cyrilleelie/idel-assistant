# Génération du Corpus Synthétique IDEL

Scripts de génération de données d'entraînement pour le fine-tuning de Mistral Small 3.1 sur le domaine IDEL.

## Prérequis

- Python 3.12+
- Clé API Anthropic : `export ANTHROPIC_API_KEY=sk-ant-...`
- Package anthropic : `pip install anthropic`

## Structure

```
corpus_generation/
  config.py                    # Paramètres (nb exemples, modèle, etc.)
  generators/
    base.py                    # Classe de base
    cotation_ngap.py           # Cat 1 : cotation NGAP + tool calls (5 000)
    transmission_dar.py        # Cat 2 : transmissions DAR (4 000)
    rdv_planning.py            # Cat 3 : planification RDV (3 000)
    ordonnance.py              # Cat 4 : interprétation ordonnances (3 000)
    reglementation.py          # Cat 5 : Q&R réglementaires (3 000)
    general.py                 # Cat 6 : conversations générales (2 000)
  validators/
    ngap_validator.py          # Valide la cotation NGAP
    format_validator.py        # Valide le format ChatML
  generate_corpus.py           # Script principal
  validate_corpus.py           # Validation post-génération
  stats_corpus.py              # Statistiques du corpus
```

## Usage

### 1. Test (dry run) — ~1€

```bash
cd scripts/corpus_generation
python generate_corpus.py --dry-run
```

Génère 10 exemples par catégorie (60 total) pour valider le pipeline.

### 2. Génération complète — ~50-100€

```bash
python generate_corpus.py
```

Génère 20 000 exemples (~3h). Supporte la reprise après interruption (Ctrl+C).

### 3. Validation

```bash
python validate_corpus.py
```

Vérifie le format et la cohérence NGAP. Objectif : > 95% de validité.

### 4. Statistiques

```bash
python stats_corpus.py
```

Affiche la répartition par catégorie, difficulté, et estimation du coût en tokens.

## Sortie

```
data/corpus/
  raw/                         # Exemples bruts par catégorie
    cotation_ngap.jsonl
    transmission_dar.jsonl
    ...
  train.jsonl                  # 90% — dataset fine-tuning
  test.jsonl                   # 10% — dataset évaluation
  stats.json                   # Statistiques
```

## Validation manuelle

Après génération, 50 exemples par catégorie doivent être relus manuellement
pour détecter les erreurs que les validateurs automatiques ne voient pas :
- Formulations irréalistes
- Cotations techniquement correctes mais contextuellement inappropriées
- Ton inadapté
