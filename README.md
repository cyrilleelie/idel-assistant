# IDEL Assistant

Application SaaS pour infirmieres liberales (IDEL) en France.
Gestion de cabinet, facturation NGAP, agent IA conversationnel (texte + voix), secretaire telephonique IA, suggestion intelligente de creneaux, transmissions vocales, suivi des tournees, et conformite RGPD/HDS.

## Fonctionnalites

### Gestion des patients
- CRUD complet avec chiffrement AES-256-GCM des donnees sensibles (nom, adresse, pathologies)
- Recherche par nom via hash HMAC-SHA256 (sans dechiffrement)
- Filtrage par statut (actif / inactif) et par secteur geographique
- Tri par colonne (nom, commune, secteur, statut)
- Archivage soft-delete avec possibilite de reactivation
- Champs SESAM-Vitale : AMO, AMC, exoneration, rang de naissance

### Facturation NGAP
- Facturation automatique a la completion du RDV (facture brouillon generee en arriere-plan)
- Catalogue NGAP complet avec cotation intelligente (majorations nuit/dimanche, IK, IFD)
- Detection BSI multi-IDEL (evite la double facturation)
- Workflow : brouillon -> validee -> transmise -> payee / rejetee
- Dashboard statistiques mensuelles avec KPIs, graphiques, top actes
- Comparaison de periodes et statistiques par IDEL
- Gestion des rejets avec correction et re-soumission
- Exports comptables : CSV (separateur ;, UTF-8 BOM), FEC (norme LPF 18 colonnes), recettes, recapitulatif trimestriel PDF
- Marquage en lot des factures payees

### Preparation SESAM-Vitale (FSE)
- Generation de Feuilles de Soins Electroniques a partir des factures validees
- Cycle de vie FSE : generee -> exportee -> transmise -> rejetee
- Export par lot (CSV/XML/JSON) et PDF individuel ou batch
- Champs praticien (ADELI, n° AM, zone conventionnelle) et cabinet (FINESS, SIREN/SIRET)
- Roadmap d'homologation SESAM-Vitale documentee

### Agent IA conversationnel
- Chat IA integre au dashboard web (drawer lateral droit)
- 5 modes specialises : General, Facturation, Transmission, Planning, Tournee
- 15 outils disponibles : consultation NGAP, cotation automatique, structuration de transmissions DAR, suggestion de creneaux geo-optimises, interpretation d'ordonnances, reoptimisation de tournee
- Confirmation utilisateur pour les actions sensibles (Redis TTL 60s, anti double-confirm)
- Streaming temps reel via WebSocket avec cartes de resultats riches (Tailwind)
- Contexte journalier cache (Redis 15min) : RDV, patients, tournee
- Audit trail HDS immutable (table write-only)

### Voix (STT + TTS)
- Transcription vocale : Whisper cloud (OpenAI) ou faster-whisper local (GPU)
- Synthese vocale : ElevenLabs cloud ou Kokoro local (GPU)
- Pipeline WebSocket complet : audio -> STT -> pseudonymisation -> LLM -> TTS -> audio
- Push-to-talk dans le chat web avec lecture audio automatique
- Pseudonymisation automatique post-transcription (noms patients -> initiales)
- Hotwords medicaux NGAP injectes dans les requetes Whisper
- Bandeau RGPD conditionnel (masque si providers locaux)

### Secretaire telephonique IA
- Reception automatique des appels patients via pont AGI Asterisk
- 8 outils PydanticAI : rechercher patient, consulter/creer/modifier/annuler RDV, prendre message, escalader urgence, envoyer SMS confirmation
- Gestion des tours de parole : detection fin parole (800ms), interruption TTS (200ms), inactivite 30s
- Score d'urgence 0-3 avec escalade SMS automatique
- Envoi SMS confirmation via OVH
- Transparence AI Act ("secretaire automatique"), ton adapte personnes agees
- Monitoring temps reel dans le dashboard (admin-only)
- Journaux d'appels chiffres avec transcript JSONB

### Suggestion de creneaux
- Moteur de scoring intelligent pour proposer les 3 meilleurs creneaux lors d'un nouvel appel patient
- Criteres : detour kilometrique (40%), secteur geographique (25%), preference horaire (20%), confort de planning (15%)
- Reservation directe du creneau choisi

### Tournee du jour
- Vue chronologique des rendez-vous avec metriques de trajet (distance totale, temps de deplacement)
- Detection des allers-retours inefficaces (informatif)
- Carte interactive avec les stops geolocalises et les secteurs colores

### Transmissions
- Transmissions vocales et ecrites avec pipeline IA
- Upload audio chiffre + transcription automatique (STT) + synthese DAR structuree (Mistral)
- Cycle de vie : brouillon -> en transcription -> en synthese -> transcrit -> complete -> valide
- Liaison avec ordonnances et alertes IA
- Synchronisation offline/online (protocole delta WatermelonDB)

### Secteurs geographiques
- Definition de secteurs par codes postaux et communes
- Affectation automatique des patients aux secteurs
- Visualisation carte avec decoupage colore

### Protocoles de soins
- Definition de protocoles recurrents (type de soin, frequence, duree)
- Suivi du statut (actif, termine, suspendu)

### Securite et conformite
- Authentification JWT (access + refresh tokens)
- Multi-tenant par `cabinet_id` avec Row Level Security PostgreSQL
- Chiffrement applicatif AES-256-GCM des colonnes sensibles
- Audit trail sur toutes les operations (agent IA : table immutable HDS)
- Conforme RGPD et hebergement HDS
- Pseudonymisation des donnees patients dans les flux IA

## Architecture

Clean Architecture 3 couches — les dependances pointent toujours vers l'interieur :

```
Infrastructure  ->  Application  ->  Domain
(API, BDD, ext)    (use cases)     (entites, regles metier)
```

### Backend (`backend/`)

| Couche | Dossier | Contenu |
|--------|---------|---------|
| Domain | `app/domain/` | Entites (dataclasses), value objects, interfaces repositories/services, regles metier. Zero dependance externe. |
| Application | `app/application/` | Use cases, DTOs. Importe uniquement Domain. |
| Infrastructure | `app/infrastructure/` | FastAPI routes, SQLAlchemy models/repos, chiffrement, clients API, agent IA. |

**Stack** : Python 3.12, FastAPI, SQLAlchemy 2.0 async (asyncpg), Alembic, Pydantic v2, pydantic-ai, Mistral AI, fpdf2, pytest

**Agent IA** (`app/infrastructure/agent/`) :
- `providers/` : MistralProvider (cloud), VLLMLocalProvider (GPU local)
- `voice/` : STT (Whisper cloud / faster-whisper local), TTS (ElevenLabs / Kokoro local), VAD, pseudonymisation, hotwords
- `receptionist/` : secretaire telephonique IA (orchestrateur, outils, pont Asterisk, SMS OVH)
- `tools/` : 15 outils metier (NGAP, patients, RDV, facturation, tournees, transmissions)
- `orchestrator.py` : orchestrateur principal avec guardrails et streaming
- `factory.py` : instanciation dynamique des providers (cloud/GPU) selon config

### Frontend mobile (`frontend-mobile/`)

Application React Native pour les IDEL en deplacement.

| Ecran | Description |
|-------|-------------|
| Tournee | Carte interactive + liste chronologique des RDV + marquage realise |
| Suggestion | Formulaire de recherche de creneau + resultats scores |
| Patients | Liste avec recherche + fiche detail + creation |
| Preparation | Synthese IA des transmissions 48h + alertes |
| Transmissions | Enregistrement vocal + transcription IA + synthese DAR |
| Profil | Informations utilisateur, notifications, changement PIN, deconnexion |

**Stack** : Expo SDK 54, React Native 0.81, TypeScript, Expo Router, TanStack Query, Zustand, react-native-paper, react-native-maps, WatermelonDB, expo-notifications, expo-haptics

**Fonctionnalites avancees** :
- Synchronisation offline/online (delta sync WatermelonDB)
- Notifications push (4 types : RDV annule, nouvelle transmission, sync, remote wipe)
- Skeleton screens, retour haptique, accessibilite (labels, touch targets 44px)
- Build EAS configure (dev APK, preview internal, production app-bundle)
- Prete pour tests terrain

### Frontend web (`frontend-web/`)

Dashboard de gestion pour le cabinet (v2, remplace `frontend-web/`).

| Page | Description |
|------|-------------|
| Dashboard | Carte des tournees + metriques du jour + planning semaine |
| Agenda | Grille semaine (lun-sam) avec blocs RDV cliquables |
| Patients | Table triable/filtrable + fiche detail + formulaire creation/edition + champs SESAM-Vitale |
| Secteurs | Carte interactive + CRUD des secteurs geographiques |
| Facturation | 5 onglets : Du jour / Synthese / Rejets / Exports / Transmission FSE |
| Agent IA | Chat drawer lateral avec modes specialises + commande vocale |

**Stack** : React 19, Vite 7, Tailwind CSS v4, shadcn/ui, TanStack Query, Zustand, Recharts, Leaflet

**Widgets admin** :
- AgentMonitorWidget : metriques latence LLM/STT/TTS, providers actifs (polling 30s)
- ReceptionistMonitorWidget : appels du jour, statuts, transcripts (polling 10s)

### Infrastructure GPU (`gpu/`)

Deploiement optionnel sur GPU pour hebergement HDS souverain (zero donnees cloud).

| Service | Description |
|---------|-------------|
| vLLM | Mistral Small 3.1 AWQ sur GPU A10 24Go |
| faster-whisper | STT francais optimise GPU |
| Kokoro | TTS 82M parametres, voix francaise |
| nginx | Reverse proxy + load balancing |

**Basculement** : changer 3 variables d'environnement (`LLM_PROVIDER`, `STT_PROVIDER`, `TTS_PROVIDER`) + restart.

## Prerequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (PostgreSQL 16, Redis 7)
- [Git](https://git-scm.com/)
- [uv](https://docs.astral.sh/uv/) (`pip install uv` ou `pipx install uv`)
- [Node.js](https://nodejs.org/) >= 18 (pour les frontends)

> Python 3.12 est gere automatiquement par uv — pas besoin de l'installer manuellement.

### Prerequis optionnels

- **Agent IA** : cle API Mistral (`MISTRAL_API_KEY`)
- **Voix cloud** : cles OpenAI (`OPENAI_API_KEY`) + ElevenLabs (`ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`)
- **Secretaire telephonique** : Asterisk + SIP Trunk OVH, cles SMS OVH, `CABINET_SERVICE_TOKEN`
- **GPU local** : instance OVH T1-45 A10 24Go + vRack + Docker GPU

## Installation et demarrage

### 1. Services Docker

```bash
docker compose up -d
```

Demarre PostgreSQL (port 5432), Redis (port 6379) et Adminer (port 8080).

### 2. Backend

```bash
cd backend
uv sync --dev            # Installe les dependances (cree le venv Python 3.12)
uv run alembic upgrade head   # Applique les migrations BDD
uv run uvicorn app.main:app --reload --port 8000   # Serveur de dev
```

L'API est disponible sur http://localhost:8000 et la documentation Swagger sur http://localhost:8000/docs.

### 3. Frontend web

```bash
cd frontend-web
npm install
npm run dev              # Serveur Vite sur http://localhost:5173
```

### 4. Frontend mobile

```bash
cd frontend-mobile
npm install
npx expo start           # Expo DevTools + QR code pour l'app mobile
```

### 5. Infrastructure GPU (optionnel)

```bash
cd gpu
# Telecharger les modeles
bash ../scripts/download_models.sh
# Demarrer les services GPU
docker compose -f docker-compose.gpu.yml up -d
```

Voir [`docs/runbooks/gpu-deployment.md`](docs/runbooks/gpu-deployment.md) pour le guide complet.

## Services

| Service    | URL                        | Description               |
|------------|----------------------------|---------------------------|
| API        | http://localhost:8000      | Backend FastAPI            |
| Swagger    | http://localhost:8000/docs | Documentation API          |
| Frontend web | http://localhost:5173   | Dashboard React (v2)       |
| Adminer    | http://localhost:8080      | Interface BDD              |
| PostgreSQL | localhost:5432             | Base de donnees            |
| Redis      | localhost:6379             | Cache + sessions agent     |

## Commandes utiles

### Tests

```bash
cd backend
uv run pytest tests/unit/ -v         # Tests unitaires (~680 tests)
uv run pytest tests/integration/ -v  # Tests integration (BDD)
uv run pytest tests/api/ -v          # Tests API (routes FastAPI)
uv run pytest --cov=app tests/       # Couverture de code
```

### Linting et typage

```bash
# Backend
cd backend
uv run black app/ tests/             # Formatage
uv run ruff check app/ tests/        # Linting
uv run mypy app/                     # Typage statique

# Frontend web
cd frontend-web
npx tsc --noEmit                     # Verification TypeScript
npm run build                        # Build production

# Frontend mobile
cd frontend-mobile
npx tsc --noEmit                     # Verification TypeScript
```

### Dependances

```bash
cd backend
uv add <package>           # Ajouter une dependance
uv add --dev <package>     # Ajouter une dependance de dev

cd frontend-web
npm install <package>      # Ajouter une dependance npm

cd frontend-mobile
npm install <package>      # Ajouter une dependance npm
```

### Scripts utilitaires

```bash
# Benchmark latence LLM/STT/TTS
cd backend && uv run python ../scripts/benchmark_latency.py

# Generation de corpus d'entrainement
cd scripts/corpus_generation && python generate_corpus.py
```

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | Architecture technique, ADR, modele de donnees |
| [`docs/architecture-update-tournees.md`](docs/architecture-update-tournees.md) | Addendum v1.1 : moteur de suggestion de creneaux |
| [`docs/architecture-frontend.md`](docs/architecture-frontend.md) | Architecture frontend mobile + web |
| [`docs/PRD.md`](docs/PRD.md) | Product Requirements Document |
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Cahier des charges fonctionnel |
| [`docs/regles-facturation.md`](docs/regles-facturation.md) | Regles de facturation NGAP |
| [`docs/roadmap-homologation-sesam-vitale.md`](docs/roadmap-homologation-sesam-vitale.md) | Roadmap homologation SESAM-Vitale |
| [`docs/plan-iteratif-module-facturation.md`](docs/plan-iteratif-module-facturation.md) | Plan iteratif module facturation |
| [`docs/plan-iteratif-application-mobile.md`](docs/plan-iteratif-application-mobile.md) | Plan iteratif application mobile |
| [`docs/guide-fine-tuning-idel.md`](docs/guide-fine-tuning-idel.md) | Guide fine-tuning modele IA |
| [`docs/runbooks/gpu-deployment.md`](docs/runbooks/gpu-deployment.md) | Runbook deploiement GPU |
| [`docs/prompts-claude-code.md`](docs/prompts-claude-code.md) | Prompts de generation de code |
| [`docs/prompts-review.md`](docs/prompts-review.md) | Criteres de review par phase |
| [`docs/developer-setup-guide.md`](docs/developer-setup-guide.md) | Guide setup developpeur Windows 11 |

## Structure du projet

```
idel-assistant/
  backend/
    app/
      domain/              # Entites, value objects, interfaces
      application/         # Use cases, DTOs
      infrastructure/
        api/               # Routes FastAPI (auth, patients, RDV, factures, FSE, transmissions, sync)
        persistence/       # SQLAlchemy models, repositories, migrations
        security/          # Chiffrement AES-256-GCM, JWT, RBAC
        agent/             # Agent IA conversationnel
          providers/       #   LLM providers (Mistral cloud, vLLM local)
          voice/           #   STT, TTS, VAD, pseudonymisation
          receptionist/    #   Secretaire telephonique IA
          tools/           #   15 outils metier
    tests/
      unit/                # ~680 tests unitaires
      integration/         # Tests avec PostgreSQL
      api/                 # Tests routes HTTP
    alembic/               # 28+ migrations BDD
  frontend-web/         # Dashboard React + Vite + Tailwind (v2 active)
  frontend-mobile/         # App React Native + Expo (prete pour tests terrain)
  gpu/                     # Infrastructure GPU (vLLM, faster-whisper, Kokoro)
  scripts/
    corpus_generation/     # Generation de corpus d'entrainement IA (22 000 exemples)
    finetune/              # Scripts de fine-tuning
    benchmark_latency.py   # Benchmark latence providers IA
    download_models.sh     # Telechargement modeles GPU
  docs/                    # Documentation technique et fonctionnelle
  docker-compose.yml       # PostgreSQL, Redis, Adminer
```
