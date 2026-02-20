# CLAUDE.md — Instructions projet IDEL Assistant

## Contexte

Application SaaS pour infirmières libérales (IDEL) en France. Combinaison d'IA (optimisation de tournées, transcription vocale, synthèse) avec gestion de cabinet et conformité healthcare (RGPD, HDS).

## Documentation

Tous les documents de référence sont dans `docs/` :
- `docs/architecture.md` — **DOCUMENT PRINCIPAL** : architecture technique, ADR, modèle de données, structure Clean Architecture 3 couches. À lire en priorité.
- `docs/prompts-claude-code.md` — Prompts séquentiels avec patterns de code attendus et checkpoints de validation.
- `docs/PRD.md` — Product Requirements Document complet (user stories, endpoints API, flows).
- `docs/cahier-des-charges.md` — Cahier des charges fonctionnel.
- `docs/etude-faisabilite.md` — Étude de faisabilité technique.
- `docs/planning.md` — Planning de réalisation itératif (44 semaines).
- `docs/business-plan.md` — Business plan et projections financières.
- `docs/developer-setup-guide.md` — Guide setup développeur Windows 11.

## Architecture

Clean Architecture 3 couches. Règle absolue : **les dépendances pointent toujours vers l'intérieur**.

```
Infrastructure → Application → Domain
```

- **Domain** (`app/domain/`) : entités (dataclasses), value objects, interfaces repositories/services, règles métier. ZÉRO dépendance externe (pas de SQLAlchemy, pas de FastAPI).
- **Application** (`app/application/`) : use cases, DTOs. Importe uniquement Domain.
- **Infrastructure** (`app/infrastructure/`) : FastAPI routes, SQLAlchemy models/repos, clients API externes, chiffrement.

## Stack technique

- Python 3.12, FastAPI, SQLAlchemy 2.0 async (asyncpg), Alembic
- PostgreSQL 16 (PostGIS, pg_trgm, RLS), Redis 7
- OR-Tools (optimisation tournées VRPTW)
- Chiffrement AES-256-GCM (colonnes sensibles patients)
- Pydantic v2, python-jose (JWT), passlib (bcrypt)
- pytest, pytest-asyncio

## Conventions

- Environnement : Windows 11, VS Code, PowerShell
- Chemins : utiliser `pathlib.Path`, jamais de hardcoded Unix paths
- Types : Python modernes (`str | None`, `list[str]`, pas `Optional[str]`, pas `List[str]`)
- IDs : UUID partout (pas d'auto-increment)
- Async : tout le stack est async (asyncpg, async SQLAlchemy sessions)
- Tests : unit (domain, pas de BDD), integration (avec PostgreSQL test), api (httpx AsyncClient)
- Nommage : snake_case Python, fichiers et dossiers en minuscules avec underscores

## Sécurité — Points critiques

- Multi-tenant par `cabinet_id` avec PostgreSQL Row Level Security
- Données patients sensibles chiffrées en AES-256-GCM au niveau applicatif
- Search hash (HMAC-SHA256) pour recherche par nom sans déchiffrer
- JWT (access + refresh tokens) avec httpOnly cookies en production
- Conformité RGPD/HDS obligatoire — audit trail sur toutes les opérations

## Commandes utiles

```powershell
# Lancer les services
docker compose up -d

# Activer le venv
.venv\Scripts\Activate.ps1

# Migrations
cd backend && alembic upgrade head

# Tests
pytest tests/unit/ -v
pytest tests/integration/ -v
pytest tests/api/ -v
pytest --cov=app tests/

# Serveur dev
cd backend && uvicorn app.main:app --reload --port 8000

# Linting
black app/ tests/
ruff check app/ tests/
mypy app/
```
