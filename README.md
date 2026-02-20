# IDEL Assistant

Application SaaS pour infirmieres liberales (IDEL) en France.
Optimisation de tournees, transcription vocale, gestion de cabinet, conformite RGPD/HDS.

## Prerequis

- Python 3.12 (gere automatiquement par uv)
- Docker Desktop
- Git
- uv (`pip install uv`)

## Installation

```powershell
# Cloner le projet
git clone <url-du-repo>
cd idel-assistant

# Lancer les services (PostgreSQL, Redis, Adminer)
docker compose up -d

# Installer les dependances (uv cree le venv automatiquement avec Python 3.12)
cd backend
uv sync --dev
```

## Services

| Service   | URL                    | Description              |
|-----------|------------------------|--------------------------|
| API       | http://localhost:8000  | Backend FastAPI          |
| Swagger   | http://localhost:8000/docs | Documentation API    |
| Adminer   | http://localhost:8080  | Interface BDD            |
| PostgreSQL| localhost:5432         | Base de donnees          |
| Redis     | localhost:6379         | Cache                    |

## Commandes utiles

```powershell
# Lancer le serveur de dev
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Migrations
cd backend && uv run alembic upgrade head

# Tests
cd backend && uv run pytest tests/unit/ -v
cd backend && uv run pytest tests/integration/ -v
cd backend && uv run pytest tests/api/ -v
cd backend && uv run pytest --cov=app tests/

# Linting
cd backend && uv run black app/ tests/
cd backend && uv run ruff check app/ tests/
cd backend && uv run mypy app/

# Ajouter une dependance
cd backend && uv add <package>
cd backend && uv add --dev <package>
```

## Architecture

Clean Architecture 3 couches :

```
Infrastructure -> Application -> Domain
```

Voir `docs/architecture.md` pour le detail complet.
