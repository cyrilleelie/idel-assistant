# IDEL Assistant

Application SaaS pour infirmieres liberales (IDEL) en France.
Gestion de cabinet, suggestion intelligente de creneaux, suivi des tournees, et conformite RGPD/HDS.

## Fonctionnalites

### Gestion des patients
- CRUD complet avec chiffrement AES-256-GCM des donnees sensibles (nom, adresse, pathologies)
- Recherche par nom via hash HMAC-SHA256 (sans dechiffrement)
- Filtrage par statut (actif / inactif) et par secteur geographique
- Tri par colonne (nom, commune, secteur, statut)
- Archivage soft-delete avec possibilite de reactivation

### Suggestion de creneaux
- Moteur de scoring intelligent pour proposer les 3 meilleurs creneaux lors d'un nouvel appel patient
- Criteres : detour kilometrique (40%), secteur geographique (25%), preference horaire (20%), confort de planning (15%)
- Reservation directe du creneau choisi

### Tournee du jour
- Vue chronologique des rendez-vous avec metriques de trajet (distance totale, temps de deplacement)
- Detection des allers-retours inefficaces (informatif)
- Carte interactive avec les stops geolocalises et les secteurs colores

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
- Audit trail sur toutes les operations
- Conforme RGPD et hebergement HDS

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
| Infrastructure | `app/infrastructure/` | FastAPI routes, SQLAlchemy models/repos, chiffrement, clients API. |

**Stack** : Python 3.12, FastAPI, SQLAlchemy 2.0 async (asyncpg), Alembic, Pydantic v2, pytest

### Frontend mobile (`frontend-mobile/`)

Application React Native pour les IDEL en deplacement.

| Ecran | Description |
|-------|-------------|
| Tournee | Carte interactive + liste chronologique des RDV du jour |
| Suggestion | Formulaire de recherche de creneau + resultats scores |
| Patients | Liste avec recherche + fiche detail + creation |
| Profil | Informations utilisateur et deconnexion |

**Stack** : Expo SDK 54, React Native 0.81, TypeScript, Expo Router, TanStack Query, Zustand, react-native-paper, react-native-maps

### Frontend web (`frontend-web/`)

Dashboard de gestion pour le cabinet.

| Page | Description |
|------|-------------|
| Dashboard | Carte des tournees + metriques du jour + planning semaine |
| Agenda | Grille semaine (lun-sam) avec blocs RDV cliquables |
| Patients | Table triable/filtrable + fiche detail + formulaire creation/edition |
| Secteurs | Carte interactive + CRUD des secteurs geographiques |

**Stack** : React 19, Vite 7, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query, Zustand, Recharts, Leaflet

## Prerequis

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (PostgreSQL 16, Redis 7)
- [Git](https://git-scm.com/)
- [uv](https://docs.astral.sh/uv/) (`pip install uv` ou `pipx install uv`)
- [Node.js](https://nodejs.org/) >= 18 (pour les frontends)

> Python 3.12 est gere automatiquement par uv — pas besoin de l'installer manuellement.

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

## Services

| Service    | URL                        | Description               |
|------------|----------------------------|---------------------------|
| API        | http://localhost:8000      | Backend FastAPI            |
| Swagger    | http://localhost:8000/docs | Documentation API          |
| Frontend web | http://localhost:5173   | Dashboard React            |
| Adminer    | http://localhost:8080      | Interface BDD              |
| PostgreSQL | localhost:5432             | Base de donnees            |
| Redis      | localhost:6379             | Cache                      |

## Commandes utiles

### Tests

```bash
cd backend
uv run pytest tests/unit/ -v         # Tests unitaires (domain + suggestion)
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

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/architecture.md`](docs/architecture.md) | Architecture technique, ADR, modele de donnees |
| [`docs/architecture-update-tournees.md`](docs/architecture-update-tournees.md) | Addendum v1.1 : moteur de suggestion de creneaux |
| [`docs/architecture-frontend.md`](docs/architecture-frontend.md) | Architecture frontend mobile + web |
| [`docs/PRD.md`](docs/PRD.md) | Product Requirements Document |
| [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md) | Cahier des charges fonctionnel |
| [`docs/prompts-claude-code.md`](docs/prompts-claude-code.md) | Prompts de generation de code |
| [`docs/prompts-review.md`](docs/prompts-review.md) | Criteres de review par phase |
| [`docs/developer-setup-guide.md`](docs/developer-setup-guide.md) | Guide setup developpeur Windows 11 |

## Structure du projet

```
idel-assistant/
  backend/
    app/
      domain/           # Entites, value objects, interfaces
      application/      # Use cases, DTOs
      infrastructure/   # API FastAPI, SQLAlchemy, chiffrement
    tests/
      unit/             # 124 tests unitaires
      integration/      # Tests avec PostgreSQL
      api/              # Tests routes HTTP
    alembic/            # Migrations BDD
  frontend-web/         # Dashboard React + Vite + Tailwind
  frontend-mobile/      # App React Native + Expo
  docs/                 # Documentation technique et fonctionnelle
  scripts/              # Scripts utilitaires (demo carte, etc.)
  docker-compose.yml    # PostgreSQL, Redis, Adminer
```
