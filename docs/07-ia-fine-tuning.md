# Guide de Fine-tuning — Modèle IDEL Assistant

> De la génération du corpus au déploiement en production.
> Durée totale estimée : 5-7 jours (dont ~3 jours de génération, ~1 jour de fine-tuning, ~1-2 jours de validation humaine).

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis](#2-prérequis)
3. [Étape 1 — Génération du corpus synthétique](#3-étape-1--génération-du-corpus-synthétique)
4. [Étape 2 — Validation humaine du corpus](#4-étape-2--validation-humaine-du-corpus)
5. [Étape 3 — Fine-tuning QLoRA sur Vast.ai](#5-étape-3--fine-tuning-qlora-sur-vastai)
6. [Étape 4 — Évaluation et benchmark](#6-étape-4--évaluation-et-benchmark)
7. [Étape 5 — Déploiement en production sur OVH](#7-étape-5--déploiement-en-production-sur-ovh)
8. [Rollback](#8-rollback)
9. [Cycle de ré-entraînement (v2, v3…)](#9-cycle-de-ré-entraînement-v2-v3)
10. [FAQ / Troubleshooting](#10-faq--troubleshooting)

---

## 1. Vue d'ensemble

```
┌─────────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  ÉTAPE 1            │     │  ÉTAPE 3             │     │  ÉTAPE 5             │
│  Génération corpus  │────▶│  Fine-tuning QLoRA   │────▶│  Déploiement OVH     │
│  (PC local)         │     │  (Vast.ai A10/A100)  │     │  (instance GPU)      │
│  ~50-100€ API       │     │  ~4-8$ GPU           │     │  restart vLLM        │
│  ~3h                │     │  ~4-8h               │     │  ~5min               │
└─────────┬───────────┘     └──────────┬───────────┘     └──────────────────────┘
          │                            │
          ▼                            ▼
┌─────────────────────┐     ┌──────────────────────┐
│  ÉTAPE 2            │     │  ÉTAPE 4             │
│  Validation humaine │     │  Évaluation          │
│  (Sarah + toi)      │     │  (benchmark auto)    │
│  ~2-3h              │     │  GO si ≥ 95%         │
└─────────────────────┘     └──────────────────────┘
```

**Objectif** : passer de ~90% à ≥95% de cotation NGAP correcte, et de ~94% à ≥97% d'appels d'outils corrects, en fine-tunant Mistral Small 3.1 24B sur 20 000 exemples synthétiques générés par Claude.

**Données manipulées** : le corpus est 100% synthétique (patients fictifs, pas de données réelles). Aucune contrainte HDS pour la génération ni le fine-tuning. Seul le déploiement final est sur l'instance HDS OVH.

---

## 2. Prérequis

### Comptes et clés API

| Service | Clé nécessaire | Où la créer | Coût estimé |
|---------|---------------|-------------|-------------|
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | ~50-100€ pour 20k exemples |
| Hugging Face | `HF_TOKEN` | [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) | Gratuit (accès modèle Mistral) |
| Vast.ai | Compte créé + crédits | [vast.ai](https://vast.ai) | ~4$ (A10) ou ~8$ (A100) |
| OVH | SSH configuré vers instance GPU | Déjà en place (iter D) | — |

### Logiciels locaux (PC Windows)

- Python 3.12 (via uv — déjà installé)
- Package `anthropic` : `pip install anthropic` (ou utiliser dans un venv dédié)
- SSH client (pour Vast.ai et OVH)
- SCP ou `swift` CLI (pour uploader les adaptateurs)

### Infrastructure existante (iter D)

- Instance GPU OVH : A10 24 Go, vLLM avec Mistral Small 3.1 AWQ
- vLLM déjà configuré avec `--enable-lora` et `--lora-modules` dans `gpu/docker-compose.gpu.yml`
- Volume `/data/models/lora` monté en lecture seule dans le conteneur vLLM
- Backend config : `lora_model_name` dans `backend/app/config.py`

---

## 3. Étape 1 — Génération du corpus synthétique

### 3.1 Où ça se passe

Tous les scripts sont dans `scripts/corpus_generation/`. La génération tourne sur ton PC local — elle appelle l'API Claude pour créer les exemples.

### 3.2 Configuration

Le fichier `scripts/corpus_generation/config.py` définit la répartition du corpus :

| Catégorie | Exemples | Part | Description |
|-----------|----------|------|-------------|
| `cotation_ngap` | 5 000 | 25% | Cotation NGAP avec appels d'outils `analyser_et_coter` |
| `transmission_dar` | 4 000 | 20% | Dictée libre → structuration DAR |
| `rdv_planning` | 3 000 | 15% | Planification de rendez-vous |
| `ordonnance` | 3 000 | 15% | Interprétation d'ordonnances |
| `reglementation` | 3 000 | 15% | Q&R réglementation IDEL (pas d'outil) |
| `general` | 2 000 | 10% | Conversations générales |
| **Total** | **20 000** | **100%** | |

Le modèle utilisé pour la génération est `claude-sonnet-4-20250514` (bon rapport qualité/coût). Tu peux changer dans `config.py` si besoin.

### 3.3 Dry run — Test du pipeline (~1€)

Avant de lancer la génération complète, teste avec 10 exemples par catégorie :

```powershell
# Terminal PowerShell — depuis la racine du projet
cd "scripts/corpus_generation"

# Configure ta clé API
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."

# Dry run : 60 exemples total (10 × 6 catégories)
python generate_corpus.py --dry-run
```

**Ce que tu dois vérifier :**
- Le script tourne sans erreur
- Les fichiers apparaissent dans `data/corpus/raw/` (6 fichiers `.jsonl`)
- Le split train/test est créé dans `data/corpus/train.jsonl` et `data/corpus/test.jsonl`
- `data/corpus/stats.json` est créé avec les compteurs

**Validation rapide du dry run :**

```powershell
# Vérifie le format
python validate_corpus.py

# Regarde les stats
python stats_corpus.py
```

Le validateur doit afficher un taux ≥ 95%. Si des catégories ont des erreurs, consulte le troubleshooting en fin de guide.

### 3.4 Inspection manuelle de quelques exemples

Ouvre un des fichiers bruts pour vérifier la qualité :

```powershell
# Affiche le premier exemple de cotation NGAP (formaté)
python -c "import json; f=open('data/corpus/raw/cotation_ngap.jsonl'); print(json.dumps(json.loads(f.readline()), indent=2, ensure_ascii=False))"
```

Vérifie que :
- Le `system` prompt contient les règles NGAP
- Le message `user` est en langage naturel réaliste (pas trop formel)
- Le `tool_call` appelle le bon outil avec des arguments cohérents
- La réponse `assistant` est concise (≤ 5 lignes) et demande confirmation
- Les tarifs NGAP dans la réponse sont corrects (AMI 1 = 9,10€, MAU = 9,15€, etc.)

### 3.5 Génération complète (~50-100€, ~3h)

Une fois le dry run validé :

```powershell
# Supprime les données du dry run
Remove-Item -Recurse -Force data/corpus/raw
Remove-Item -Force data/corpus/train.jsonl, data/corpus/test.jsonl, data/corpus/stats.json

# Lance la génération complète
python generate_corpus.py
```

**Pendant la génération :**
- Le script affiche la progression par batch (50 exemples à la fois)
- Les fichiers sont sauvegardés de manière incrémentale — tu peux interrompre avec `Ctrl+C` sans perdre le travail
- Pour reprendre après interruption, relance simplement `python generate_corpus.py` — il détecte les exemples déjà générés

**À la fin :**

```
Total exemples générés : 20000
Exemples valides : 19247 (753 rejetés)
  Format invalide : 312
  NGAP invalide   : 441

Corpus prêt : 17322 train, 1925 test
```

Un taux de rejet de ~4-5% est normal. Les exemples rejetés sont ceux où Claude a mal formaté le JSON ou produit une cotation incohérente.

### 3.6 Validation automatique post-génération

```powershell
python validate_corpus.py
python stats_corpus.py
```

**Critères de GO pour passer à l'étape 2 :**

| Critère | Seuil | Comment vérifier |
|---------|-------|------------------|
| Taux de validité global | ≥ 95% | `validate_corpus.py` |
| Exemples train | ≥ 17 000 | `stats_corpus.py` |
| Exemples test | ≥ 1 800 | `stats_corpus.py` |
| Cotation NGAP : aucune erreur MAU+MCI cumulée | 0 | `validate_corpus.py` (erreurs NGAP) |
| Toutes les catégories représentées | 6/6 | `stats_corpus.py` (par catégorie) |

Si le seuil n'est pas atteint, tu peux relancer la génération — elle ne régénère que les exemples manquants.

### 3.7 Fichiers produits

```
data/corpus/
  raw/
    cotation_ngap.jsonl        # ~5 000 exemples bruts
    transmission_dar.jsonl     # ~4 000
    rdv_planning.jsonl         # ~3 000
    ordonnance.jsonl           # ~3 000
    reglementation.jsonl       # ~3 000
    general.jsonl              # ~2 000
  train.jsonl                  # ~17 000-18 000 exemples validés (90%)
  test.jsonl                   # ~1 800-2 000 exemples validés (10%)
  stats.json                   # Statistiques détaillées
```

---

## 4. Étape 2 — Validation humaine du corpus

C'est l'étape la plus importante. Les validateurs automatiques vérifient le format et les règles de base, mais ne détectent pas :
- Les formulations irréalistes qu'une IDEL ne dirait jamais
- Les cotations techniquement valides mais contextuellement inappropriées
- Le ton inadapté (trop formel, trop familier, trop long)
- Les cas limites mal gérés que seule une professionnelle connaît

### 4.1 Protocole de relecture

**Qui** : Sarah (la femme de Cyrille — IDEL en exercice)
**Durée** : ~2-3h
**Volume** : 50 exemples par catégorie = 300 exemples au total

### 4.2 Préparer les exemples à relire

Crée un fichier lisible pour chaque catégorie (copie-colle ce script) :

```powershell
# Depuis scripts/corpus_generation/
python -c "
import json, random, os
from pathlib import Path

raw_dir = Path('data/corpus/raw')
review_dir = Path('data/corpus/review')
review_dir.mkdir(exist_ok=True)

for f in raw_dir.glob('*.jsonl'):
    examples = []
    with open(f, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if line:
                try:
                    examples.append(json.loads(line))
                except:
                    pass

    # Échantillon aléatoire de 50
    sample = random.sample(examples, min(50, len(examples)))

    # Écrit un fichier lisible
    out_path = review_dir / f'{f.stem}_review.md'
    with open(out_path, 'w', encoding='utf-8') as out:
        out.write(f'# Revue : {f.stem}\n\n')
        out.write(f'50 exemples à relire. Pour chaque exemple :\n')
        out.write(f'- [ ] La question est réaliste (une IDEL pourrait dire ça)\n')
        out.write(f'- [ ] La réponse est correcte (cotation, contenu, etc.)\n')
        out.write(f'- [ ] Le ton est approprié (concis, professionnel)\n\n')
        out.write(f'---\n\n')

        for i, ex in enumerate(sample, 1):
            out.write(f'## Exemple {i}\n\n')
            for msg in ex.get('messages', []):
                role = msg.get('role', '?')
                content = msg.get('content', '')
                if role == 'system':
                    out.write(f'**System** : _(prompt standard)_\n\n')
                elif role == 'user':
                    out.write(f'**IDEL** : {content}\n\n')
                elif role == 'assistant':
                    if msg.get('tool_calls'):
                        for tc in msg['tool_calls']:
                            fn = tc.get('function', {})
                            out.write(f'**Agent** → appel outil `{fn.get(\"name\", \"?\")}` :\n')
                            out.write(f'\`\`\`json\n{fn.get(\"arguments\", \"{}\")}\n\`\`\`\n\n')
                    elif content:
                        out.write(f'**Agent** : {content}\n\n')
                elif role == 'tool':
                    out.write(f'**Résultat outil** :\n\`\`\`json\n{content}\n\`\`\`\n\n')

            out.write(f'**Verdict** : OK / KO  \n')
            out.write(f'**Commentaire** : \n\n')
            out.write(f'---\n\n')

    print(f'{f.stem}: {len(sample)} exemples -> {out_path}')
"
```

Cela crée 6 fichiers markdown dans `data/corpus/review/` :
- `cotation_ngap_review.md`
- `transmission_dar_review.md`
- `rdv_planning_review.md`
- `ordonnance_review.md`
- `reglementation_review.md`
- `general_review.md`

### 4.3 Session de relecture avec Sarah

**Déroulement** :
1. Ouvre chaque fichier `_review.md` dans un éditeur
2. Pour chaque exemple, Sarah évalue si la question est réaliste et si la réponse est correcte
3. Elle note "OK" ou "KO" + un commentaire si KO
4. L'objectif est ≥ 90% d'exemples OK (= corpus de qualité suffisante)

**Points d'attention spécifiques pour la cotation NGAP** :
- Les tarifs sont-ils à jour (post-avenant 10, janvier 2024) ?
- Les majorations sont-elles correctement appliquées (MAU jamais cumulé avec MCI) ?
- Les cas BSI (AMX au lieu d'AMI, IFI au lieu d'IFD) sont-ils corrects ?
- La règle de cumul article 11 (100% + 50% + 0%) est-elle bien appliquée ?

**Points d'attention pour les transmissions DAR** :
- La structuration D/A/R est-elle fidèle à la dictée (pas d'invention) ?
- Les constantes sont-elles correctement extraites ?
- Les alertes sont-elles pertinentes (pas de faux positifs) ?

### 4.4 Critères de GO pour passer au fine-tuning

| Critère | Seuil | Action si KO |
|---------|-------|--------------|
| Cotation NGAP : ≥ 45/50 exemples OK | 90% | Ajuster le prompt du générateur et régénérer la catégorie |
| Transmissions DAR : ≥ 45/50 OK | 90% | Idem |
| Autres catégories : ≥ 40/50 OK | 80% | Idem |
| Pas de pattern d'erreur systématique | 0 pattern | Corriger le générateur concerné |

Si une catégorie est sous le seuil, il faut :
1. Identifier le pattern d'erreur (exemples : formulation irréaliste, tarif erroné, etc.)
2. Ajuster le prompt dans le générateur correspondant (`generators/*.py`)
3. Supprimer le fichier `.jsonl` de la catégorie dans `data/corpus/raw/`
4. Relancer `python generate_corpus.py` (il ne régénère que la catégorie manquante)
5. Re-valider 50 exemples

---

## 5. Étape 3 — Fine-tuning QLoRA sur Vast.ai

### 5.1 Pourquoi Vast.ai ?

- Les données sont 100% synthétiques → pas de contrainte HDS
- Coût : ~4$ pour un A10 pendant 8h (vs ~50$/mois pour une instance dédiée)
- GPU libéré après le fine-tuning, pas de maintenance

### 5.2 Louer une instance

1. Va sur [vast.ai/console/create](https://cloud.vast.ai/create/)
2. Filtre les instances :
   - **GPU** : NVIDIA A10 (24 Go VRAM) ou A100 (40/80 Go) pour aller plus vite
   - **Image Docker** : `pytorch/pytorch:2.3.1-cuda12.1-cudnn9-devel`
   - **Disk** : ≥ 100 Go (pour le modèle + corpus + checkpoints)
   - **RAM** : ≥ 32 Go
3. Clique sur "RENT" et note l'IP + port SSH

**Coût indicatif** :
- A10 24 Go : ~0,50$/h → ~4$ pour 8h
- A100 40 Go : ~1,00$/h → ~4$ pour 4h
- A100 80 Go : ~1,50$/h → ~6$ pour 4h

### 5.3 Préparer l'instance

Connecte-toi en SSH puis installe les dépendances :

```bash
# SSH vers l'instance Vast.ai (remplace par ton IP/port)
ssh -p <PORT> root@<IP_VAST>

# Installe les packages nécessaires
pip install "unsloth[cu121-ampere]" trl datasets

# Accepte la licence Mistral sur HuggingFace (si pas déjà fait)
# → Va sur https://huggingface.co/mistralai/Mistral-Small-3.1-24B-Instruct
# → Clique "Agree and access repository"
export HF_TOKEN="hf_..."
huggingface-cli login --token $HF_TOKEN
```

### 5.4 Transférer le corpus

Depuis ton PC local (PowerShell) :

```powershell
# Crée le dossier sur l'instance Vast.ai
ssh -p <PORT> root@<IP_VAST> "mkdir -p /data/corpus"

# Copie les fichiers train et test
scp -P <PORT> data/corpus/train.jsonl root@<IP_VAST>:/data/corpus/
scp -P <PORT> data/corpus/test.jsonl root@<IP_VAST>:/data/corpus/

# Copie le script d'entraînement
scp -P <PORT> scripts/finetune/train.py root@<IP_VAST>:/root/
```

### 5.5 Vérifier le corpus sur l'instance

```bash
# Sur l'instance Vast.ai
wc -l /data/corpus/train.jsonl /data/corpus/test.jsonl
# Attendu : ~17000 train.jsonl, ~2000 test.jsonl

# Vérifie qu'un exemple est valide
head -1 /data/corpus/train.jsonl | python -m json.tool | head -20
```

### 5.6 Lancer le fine-tuning

```bash
# Sur l'instance Vast.ai
cd /root
python train.py
```

**Paramètres du script** (`scripts/finetune/train.py`) :
- Modèle de base : `mistralai/Mistral-Small-3.1-24B-Instruct`
- Quantification : 4-bit (QLoRA)
- LoRA : rang 16, alpha 32, dropout 0.05
- Targets : `q_proj, k_proj, v_proj, o_proj, gate_proj, up_proj, down_proj`
- Epochs : 3
- Batch effectif : 8 (batch_size=2 × gradient_accumulation=4)
- Learning rate : 2e-4, cosine scheduler, warmup 5%
- Packing activé (optimisation Unsloth)

**Ce que tu verras dans les logs** :

```
=== Chargement du modèle de base ===
  Downloading model files...                    ← ~5-10 min
=== Configuration LoRA ===
  Trainable params: 42M / 24B (0.17%)          ← Normal pour LoRA rang 16
=== Chargement du corpus ===
  Train : 17322 exemples
  Test  : 1925 exemples
=== Démarrage fine-tuning ===
  Step 50/6495 | Loss: 1.82 | LR: 1.9e-4      ← La loss doit descendre
  Step 100/6495 | Loss: 1.45
  Step 500/6495 | Loss: 0.98 | Eval loss: 1.12 ← Checkpoint sauvegardé
  ...
  Step 6495/6495 | Loss: 0.52 | Eval loss: 0.68
=== Sauvegarde des adaptateurs LoRA ===
  Fine-tuning terminé. Adaptateurs sauvegardés dans /outputs/idel-lora-v1/lora-adapters
```

**Durée** :
- A10 24 Go : ~6-8h
- A100 40 Go : ~3-4h
- A100 80 Go : ~2-3h

**Si la loss ne descend pas** ou erreur OOM : voir la section Troubleshooting.

### 5.7 Récupérer les adaptateurs

Les adaptateurs LoRA font ~100-200 Mo (vs 48 Go pour le modèle complet).

```bash
# Sur l'instance Vast.ai — vérifie la structure
ls -la /outputs/idel-lora-v1/lora-adapters/
# Doit contenir :
#   adapter_config.json
#   adapter_model.safetensors (ou .bin)
#   tokenizer.json
#   tokenizer_config.json
#   special_tokens_map.json

# Taille totale
du -sh /outputs/idel-lora-v1/lora-adapters/
# Attendu : ~100-200 Mo
```

Depuis ton PC local :

```powershell
# Télécharge les adaptateurs
mkdir scripts/finetune/idel-lora-v1
scp -P <PORT> -r root@<IP_VAST>:/outputs/idel-lora-v1/lora-adapters/* scripts/finetune/idel-lora-v1/
```

**Tu peux maintenant détruire l'instance Vast.ai** pour arrêter les frais.

---

## 6. Étape 4 — Évaluation et benchmark

L'évaluation compare le modèle fine-tuné au modèle de base sur le jeu de test. Elle est lancée **depuis l'instance GPU OVH** (qui fait tourner vLLM).

### 6.1 Déployer temporairement les adaptateurs pour l'évaluation

Avant d'évaluer, il faut que les adaptateurs soient chargés dans vLLM :

```bash
# SSH vers l'instance GPU OVH
ssh ubuntu@<IP_GPU_OVH>

# Copie les adaptateurs (depuis ton PC)
# Depuis PowerShell local :
scp -r scripts/finetune/idel-lora-v1 ubuntu@<IP_GPU_OVH>:/data/models/lora/idel-lora-v1

# Sur l'instance OVH, vérifie la structure
ls -la /data/models/lora/idel-lora-v1/
# Doit contenir adapter_config.json + adapter_model.safetensors

# Redémarre vLLM pour charger le LoRA
cd /opt/idel-gpu
docker compose -f docker-compose.gpu.yml restart vllm

# Attends que vLLM soit prêt (~1-2 min)
watch curl -sf http://localhost:8000/health
# Quand ça affiche {"status": "ok"}, Ctrl+C
```

### 6.2 Copier le jeu de test et le script d'évaluation

```powershell
# Depuis ton PC local
scp data/corpus/test.jsonl ubuntu@<IP_GPU_OVH>:/tmp/test.jsonl
scp scripts/finetune/evaluate.py ubuntu@<IP_GPU_OVH>:/tmp/evaluate.py
```

### 6.3 Lancer l'évaluation

```bash
# Sur l'instance GPU OVH
cd /tmp

# Installe les dépendances (dans un venv temporaire)
python3 -m venv /tmp/eval-venv
source /tmp/eval-venv/bin/activate
pip install openai

# Configure la clé Anthropic pour le juge LLM (optionnel mais recommandé)
export ANTHROPIC_API_KEY="sk-ant-api03-..."

# Lance l'évaluation (100 cas par défaut)
python evaluate.py \
  --vllm-url http://localhost:8000/v1 \
  --test-path /tmp/test.jsonl \
  --base-model mistral-small-3.1-awq \
  --ft-model idel-v1 \
  --n 100
```

**Arguments du script** :
- `--vllm-url` : URL de l'API vLLM (localhost car on est sur la même machine)
- `--test-path` : chemin vers le jeu de test
- `--base-model` : nom du modèle de base dans vLLM (celui dans `--model` de docker-compose)
- `--ft-model` : nom du modèle fine-tuné (celui dans `--lora-modules`)
- `--n` : nombre de cas de test par évaluation (100 = ~10 min, 500 = ~1h)

### 6.4 Lire le rapport

Le script produit un résumé dans le terminal et un fichier `evaluation_report.json` :

```
============================================================
RÉSUMÉ
============================================================
Tool accuracy - Base : 94.0%
Tool accuracy - FT   : 97.0%
Amélioration         : +3.0%
Recommandation       : GO

Rapport complet : evaluation_report.json
```

**Structure du rapport** :

```json
{
  "base_model": {
    "model": "mistral-small-3.1-awq",
    "tool_accuracy": {
      "correct": 94, "total": 100, "accuracy": 0.94,
      "details": [...]
    },
    "response_quality": {
      "mean_score": 3.8, "count": 100,
      "distribution": {"excellent (4-5)": 62, "bon (3)": 28, "insuffisant (1-2)": 10}
    }
  },
  "finetuned_model": { ... },
  "improvement": { "tool_accuracy": 0.03 },
  "deploy_recommendation": "GO"
}
```

### 6.5 Critères de décision

| Métrique | Seuil GO | Seuil NO-GO | Action si NO-GO |
|----------|----------|-------------|-----------------|
| Tool accuracy (FT) | ≥ 95% | < 95% | Inspecter les erreurs dans `details`, enrichir le corpus, re-fine-tuner |
| Response quality score | ≥ 4.0/5 | < 3.5/5 | Vérifier les exemples de cotation dans le corpus |
| Amélioration vs base | > 0% | ≤ 0% | Le fine-tuning a dégradé le modèle — vérifier le corpus |

**Si NO-GO** :
1. Inspecte les `details` dans le rapport pour identifier les erreurs récurrentes
2. Enrichis le corpus avec des exemples ciblés sur ces erreurs
3. Relance le fine-tuning (étape 3)
4. Re-évalue

**Si GO** → passe à l'étape 5.

---

## 7. Étape 5 — Déploiement en production sur OVH

### 7.1 Vérification pré-déploiement

Si tu as déjà chargé les adaptateurs pour l'évaluation (étape 4), ils sont déjà en place. Vérifie :

```bash
# Sur l'instance GPU OVH
ls /data/models/lora/idel-lora-v1/adapter_config.json
# Doit exister

curl -s http://localhost:8000/health
# Doit retourner ok
```

### 7.2 Option A — Script automatisé (recommandé)

Le script `scripts/finetune/deploy_lora.sh` automatise l'upload et le redémarrage. Il est surtout utile si tu as fine-tuné sur Vast.ai et que les adaptateurs sont sur ton PC local.

```bash
# Depuis ton PC (Git Bash ou WSL)
cd scripts/finetune

# Les adaptateurs doivent être dans ./idel-lora-v1/
ls idel-lora-v1/adapter_config.json  # Vérification

# Configure l'IP de l'instance GPU
export GPU_INSTANCE="ubuntu@<IP_GPU_OVH>"

# Déploie
./deploy_lora.sh v1
```

Le script :
1. Upload les adaptateurs sur OVH Object Storage (ou SCP direct si `swift` n'est pas installé)
2. Se connecte en SSH à l'instance GPU
3. Vérifie que les fichiers sont en place
4. Redémarre le conteneur vLLM
5. Attend que le health check passe
6. Confirme le déploiement

### 7.3 Option B — Déploiement manuel

```bash
# 1. Copie les adaptateurs (si pas déjà fait à l'étape 4)
scp -r scripts/finetune/idel-lora-v1 ubuntu@<IP_GPU_OVH>:/data/models/lora/idel-lora-v1

# 2. SSH sur l'instance et redémarre vLLM
ssh ubuntu@<IP_GPU_OVH>

# Vérifie le docker-compose — le LoRA doit être dans la commande vLLM
grep "lora-modules" /opt/idel-gpu/docker-compose.gpu.yml
# Doit afficher : --lora-modules idel-v1=/lora/idel-lora-v1

# Redémarre
cd /opt/idel-gpu
docker compose -f docker-compose.gpu.yml restart vllm

# Attend ~1-2 min
docker compose -f docker-compose.gpu.yml logs -f vllm
# Cherche : "INFO: Started server process" ou health OK
# Ctrl+C pour quitter les logs

# Vérifie
curl http://localhost:8000/health
```

### 7.4 Activer le LoRA côté backend

Le backend FastAPI doit utiliser le modèle fine-tuné au lieu du modèle de base. Modifie le `.env` du backend :

```env
# Dans backend/.env (sur le serveur de production)
LLM_PROVIDER=vllm_local
LORA_MODEL_NAME=idel-v1
```

Puis redémarre le backend :

```bash
# Sur le serveur backend
# (la méthode dépend de ton setup — systemd, docker, etc.)
sudo systemctl restart idel-backend
# ou
docker compose restart backend
```

### 7.5 Vérification post-déploiement

```bash
# 1. Health check de l'agent
curl -s https://<DOMAINE>/api/v1/agent/health | python -m json.tool
# Vérifier :
#   "model_version": "idel-v1"    ← Le LoRA est actif
#   "status": "ok"

# 2. Test fonctionnel rapide
# Ouvre le frontend web, ouvre le ChatPanel (bouton Assistant en bas à gauche)
# Envoie : "J'ai fait un pansement complexe ce matin à 7h30 chez Mme Martin, 5 km"
# L'agent doit appeler analyser_et_coter et proposer AMI 4 + MAU + IK
```

---

## 8. Rollback

Si le modèle fine-tuné se comporte mal en production :

### 8.1 Rollback rapide — Désactiver le LoRA

```env
# Dans backend/.env
LORA_MODEL_NAME=
```

Redémarre le backend. Il utilisera le modèle de base `mistral-small-3.1-awq` directement.

### 8.2 Rollback côté vLLM

Si vLLM ne démarre plus avec le LoRA :

```bash
# SSH sur l'instance GPU OVH
cd /opt/idel-gpu

# Édite docker-compose.gpu.yml — commente la ligne LoRA
# --lora-modules idel-v1=/lora/idel-lora-v1  ← mettre en commentaire

docker compose -f docker-compose.gpu.yml restart vllm
```

---

## 9. Cycle de ré-entraînement (v2, v3…)

Après quelques semaines d'utilisation en production, la boucle de feedback terrain accumule des corrections via les boutons 👍👎✏️ du ChatPanel.

### 9.1 Exporter les corrections

```bash
# Depuis ton PC
curl -s -H "Authorization: Bearer <TOKEN_ADMIN>" \
  https://<DOMAINE>/api/v1/agent/feedback/export \
  | python -m json.tool > data/corpus/corrections_terrain.json
```

### 9.2 Intégrer au corpus

```python
# Script rapide pour convertir les corrections en exemples d'entraînement
import json

with open("data/corpus/corrections_terrain.json") as f:
    data = json.load(f)

with open("data/corpus/train.jsonl", "a") as f:
    for example in data["examples"]:
        f.write(json.dumps({"messages": example["messages"]}, ensure_ascii=False) + "\n")

print(f"{data['count']} corrections ajoutées au corpus")
```

### 9.3 Re-fine-tuner

Répète les étapes 3 à 5, en changeant la version :
- `train.py` : modifie `OUTPUT_DIR = "/outputs/idel-lora-v2"`
- `deploy_lora.sh v2`
- `docker-compose.gpu.yml` : `--lora-modules idel-v2=/lora/idel-lora-v2`
- `backend/.env` : `LORA_MODEL_NAME=idel-v2`

---

## 10. FAQ / Troubleshooting

### La génération du corpus s'arrête avec une erreur API

```
anthropic.RateLimitError: 429
```

Le script a un retry automatique (3 tentatives avec backoff exponentiel). Si ça persiste :
- Réduis le `batch_size` dans `config.py` (de 50 à 20)
- Augmente le `rate_limit_delay` (de 1.0 à 3.0 secondes)
- Relance avec `python generate_corpus.py` — la reprise est automatique

### Le fine-tuning plante avec OOM (Out of Memory)

Sur A10 24 Go, le modèle Mistral Small 24B en 4-bit occupe ~14 Go. Si OOM :
1. Réduis `per_device_train_batch_size` de 2 à 1 (et augmente `gradient_accumulation_steps` de 4 à 8 pour compenser)
2. Vérifie que `load_in_4bit=True` est bien activé
3. Si ça persiste, passe sur A100 40 Go

### vLLM ne démarre plus après chargement du LoRA

Vérification :
```bash
docker compose -f docker-compose.gpu.yml logs vllm | tail -50
```

Causes fréquentes :
- `adapter_config.json` manquant → vérifier le contenu de `/data/models/lora/idel-lora-v1/`
- Rang LoRA incompatible → le `--max-lora-rank` dans docker-compose doit être ≥ au rang utilisé (16)
- Pas assez de VRAM → le LoRA ajoute ~200 Mo de VRAM, ça ne devrait pas poser problème avec `gpu-memory-utilization 0.85`

### Le modèle fine-tuné est pire que le base

Si `evaluate.py` montre une dégradation :
1. **Corpus contaminé** : vérifie la qualité du corpus (étape 2 bâclée)
2. **Overfitting** : réduis les epochs de 3 à 1 ou 2
3. **Learning rate trop élevé** : réduis de 2e-4 à 1e-4
4. **Corpus trop petit** : les exemples rejetés ont peut-être réduit le corpus sous le seuil efficace

### Je veux changer le modèle de base

Si Mistral sort une nouvelle version :
1. Modifie `MODEL_NAME` dans `train.py`
2. Modifie `--model` dans `docker-compose.gpu.yml`
3. Télécharge le nouveau modèle sur l'instance GPU
4. Le corpus reste valide — le format ChatML est universel

### Combien coûte un cycle complet ?

| Poste | Coût |
|-------|------|
| Génération corpus (Claude Sonnet, 20k exemples) | ~50-100€ |
| Fine-tuning (Vast.ai A10, 8h) | ~4$ |
| Évaluation (API Claude comme juge, optionnel) | ~5$ |
| **Total** | **~60-110€** |

Les cycles suivants (v2, v3…) sont moins chers car le corpus de base existe déjà — on ajoute seulement les corrections terrain (~100-500 exemples).
