# CLAUDE.md — Instructions projet IDEL Assistant

## Contexte

Application SaaS pour infirmières libérales (IDEL) en France. Combinaison d'IA (optimisation de tournées, transcription vocale, synthèse) avec gestion de cabinet et conformité healthcare (RGPD, HDS).

## Documentation

Tous les documents de référence sont dans `docs/` :
- `docs/architecture.md` — **DOCUMENT PRINCIPAL** : architecture technique, ADR, modèle de données, structure Clean Architecture 3 couches. À lire en priorité.
- `docs/prompts-claude-code.md` — Prompts séquentiels avec patterns de code attendus et checkpoints de validation.
- `docs/prompts-review.md` — **Critères de review** détaillés pour chaque phase. À exécuter systématiquement après chaque prompt de génération.
- `docs/PRD.md` — Product Requirements Document complet (user stories, endpoints API, flows).
- `docs/cahier-des-charges.md` — Cahier des charges fonctionnel.
- `docs/etude-faisabilite.md` — Étude de faisabilité technique.
- `docs/planning.md` — Planning de réalisation itératif (44 semaines).
- `docs/business-plan.md` — Business plan et projections financières.
- `docs/architecture-update-tournees.md` — **ADDENDUM ARCHITECTURE v1.1** : refonte complète de l'optimisation de tournées. Remplace le VRPTW par un moteur de suggestion de créneaux. Contient les ADR-008/009, le nouveau modèle de données (Sector, modifications Patient/Appointment/Tournee), les contrats API révisés, et les **versions réécrites du Prompt 4 et de la Review 4** qui remplacent celles de `prompts-claude-code.md` et `prompts-review.md`.
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

- Python 3.12, **uv** (gestionnaire de dépendances et venv), FastAPI, SQLAlchemy 2.0 async (asyncpg), Alembic
- PostgreSQL 16 (PostGIS, pg_trgm, RLS), Redis 7
- OR-Tools (matrices de distances — le VRPTW est abandonné, voir `docs/architecture-update-tournees.md`)
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

## Workflow de développement

Après chaque phase de génération de code, suivre **obligatoirement** cette séquence :

1. **Lancer les tests** concernés (`uv run pytest tests/unit/ -v`, etc.)
2. **Lire le prompt de review** correspondant dans `docs/prompts-review.md` :
   - Review 0 → après setup projet (Prompt 0)
   - Review 1 → après domain layer (Prompt 1)
   - Review 2 → après persistence + sécurité (Prompt 2)
   - Review 3 → après API FastAPI (Prompt 3)
   - Review 4 → après suggestion de créneaux (Prompt 4) — **utiliser la version réécrite dans `docs/architecture-update-tournees.md`**, pas celle de `prompts-review.md`
3. **Exécuter la review** soi-même sur le code qui vient d'être généré, en suivant chaque point de contrôle du prompt de review
4. **Corriger les problèmes CRITIQUE et IMPORTANT** trouvés lors de la review
5. **Relancer les tests** pour confirmer que les corrections sont bonnes
6. **Résumer** les findings et corrections à l'utilisateur avant de passer à la phase suivante

Le fichier `docs/prompts-review.md` contient les critères de validation détaillés pour chaque phase. Toujours s'y référer — ne jamais considérer une phase comme terminée sans avoir exécuté la review correspondante.

## Pivot tournées (ADR-008/009)

Le VRPTW classique (réordonnancement de RDV) est **abandonné**. Les RDV une fois donnés aux patients sont des engagements non déplaçables. À la place :

- **Moteur de suggestion de créneaux** : quand un nouveau patient appelle, on propose les 3 meilleurs créneaux (scoring : détour 40%, secteur géo 25%, préférence horaire 20%, confort 15%).
- **Secteurs géographiques** : entité `Sector` (label + codes postaux/communes) pour regrouper les patients par zone.
- **Tournée = photo de la journée** (pas une optimisation) : ordre chronologique des RDV, métriques de trajet, détection d'allers-retours inutiles (informatif uniquement).

**Pour le Prompt 4 et la Review 4**, utiliser les versions réécrites dans `docs/architecture-update-tournees.md` — elles remplacent intégralement celles de `docs/prompts-claude-code.md` et `docs/prompts-review.md`.

## Commandes utiles

```powershell
# Lancer les services
docker compose up -d

# Installer / synchroniser les dépendances
cd backend && uv sync --dev

# Migrations
cd backend && uv run alembic upgrade head

# Tests
cd backend && uv run pytest tests/unit/ -v
cd backend && uv run pytest tests/integration/ -v
cd backend && uv run pytest tests/api/ -v
cd backend && uv run pytest --cov=app tests/

# Serveur dev
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Linting
cd backend && uv run black app/ tests/
cd backend && uv run ruff check app/ tests/
cd backend && uv run mypy app/

# Ajouter une dépendance
cd backend && uv add <package>
cd backend && uv add --dev <package>
```
