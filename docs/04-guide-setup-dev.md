# DEVELOPER SETUP GUIDE
## Assistant IA IDEL - Guide de démarrage développeur

**Version :** 1.0  
**Date :** Janvier 2026  
**Temps setup complet :** 30 minutes  

---

## 📋 TABLE DES MATIÈRES

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (5 minutes)](#2-quick-start-5-minutes)
3. [Structure du projet](#3-structure-du-projet)
4. [Configuration environnement](#4-configuration-environnement)
5. [Commandes utiles](#5-commandes-utiles)
6. [Sprint 1 - Tâches détaillées](#6-sprint-1---tâches-détaillées)
7. [Workflow développement](#7-workflow-développement)
8. [Tests](#8-tests)
9. [Troubleshooting](#9-troubleshooting)
10. [Checklist quality gates](#10-checklist-quality-gates)

---

## 1. PREREQUISITES

### 1.1 Logiciels requis

**Obligatoires :**
```bash
✅ Python 3.12+ (vérifier : python --version)
✅ Docker Desktop (vérifier : docker --version)
✅ Docker Compose (vérifier : docker-compose --version)
✅ Git (vérifier : git --version)
✅ VS Code ou éditeur texte
```

**Optionnels (recommandés) :**
```bash
📦 Node.js 18+ (pour frontend futur)
📦 Claude Code (pour coding assisté)
📦 Postman ou Insomnia (tests API)
```

### 1.2 Installation prerequisites

**macOS :**
```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Python 3.12
brew install python@3.12

# Docker Desktop
brew install --cask docker

# Ouvrir Docker Desktop une fois pour initialiser
open /Applications/Docker.app
```

**Linux (Ubuntu/Debian) :**
```bash
# Python 3.12
sudo apt update
sudo apt install python3.12 python3.12-venv python3-pip

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
# Logout/login pour appliquer groupe docker

# Docker Compose
sudo apt install docker-compose
```

**Windows :**
```powershell
# Installer WSL2 d'abord
wsl --install

# Docker Desktop for Windows
# Télécharger : https://www.docker.com/products/docker-desktop

# Python via Microsoft Store ou python.org
winget install Python.Python.3.12
```

### 1.3 Comptes & API keys

**À créer AVANT de commencer :**

| Service | Utilisation | Gratuit/Payant | URL |
|---------|-------------|----------------|-----|
| GitHub | Code repository | Gratuit | https://github.com |
| OpenRouteService | Routing API | Gratuit (2000 req/jour) | https://openrouteservice.org |
| Mistral AI | Agent vocal + Synthèse | Payant (essai gratuit) | https://console.mistral.ai |
| Twilio | Téléphonie (optionnel MVP) | Payant (essai 15€) | https://www.twilio.com |
| Sentry | Error tracking (optionnel) | Gratuit (5k events/mois) | https://sentry.io |

**API keys nécessaires MVP :**
- ✅ OpenRouteService API key (gratuit)
- ⚠️ Mistral API key (pour transcription Whisper alternative locale possible)

**API keys V1.0 uniquement :**
- Twilio Account SID + Auth Token (agent vocal)

---

## 2. QUICK START (5 MINUTES)

### 2.1 Clone et setup initial

```bash
# 1. Créer le projet
mkdir ~/projects/idel-assistant
cd ~/projects/idel-assistant

# 2. Initialiser Git
git init
git branch -M main

# 3. Créer structure de base
mkdir -p backend/{app/{api/v1,models,schemas,services,utils,tasks},tests,alembic/versions}
mkdir -p frontend-mobile
mkdir -p docs

# 4. Créer fichiers configuration
touch backend/.env
touch backend/requirements.txt
touch backend/requirements-dev.txt
touch docker-compose.yml
touch .gitignore
touch README.md
```

### 2.2 Copier configurations

**Créer `docker-compose.yml` :**

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: idel-postgres
    environment:
      POSTGRES_USER: idel_user
      POSTGRES_PASSWORD: idel_password_dev
      POSTGRES_DB: idel_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U idel_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: idel-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  # Adminer (optional - Web UI for PostgreSQL)
  adminer:
    image: adminer:latest
    container_name: idel-adminer
    ports:
      - "8080:8080"
    environment:
      ADMINER_DEFAULT_SERVER: postgres
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

**Créer `backend/requirements.txt` :**

```txt
# FastAPI
fastapi==0.109.0
uvicorn[standard]==0.27.0
python-multipart==0.0.6

# Database
sqlalchemy==2.0.25
alembic==1.13.1
psycopg2-binary==2.9.9
asyncpg==0.29.0

# Auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
bcrypt==4.1.2

# Pydantic
pydantic==2.5.3
pydantic-settings==2.1.0

# Redis
redis==5.0.1
celery==5.3.6

# HTTP client
httpx==0.26.0
requests==2.31.0

# Utilities
python-dotenv==1.0.0
orjson==3.9.13

# OR-Tools (optimisation)
ortools==9.8.3296

# Date/Time
python-dateutil==2.8.2
pytz==2023.3
```

**Créer `backend/requirements-dev.txt` :**

```txt
-r requirements.txt

# Testing
pytest==7.4.4
pytest-asyncio==0.23.3
pytest-cov==4.1.0
httpx==0.26.0

# Linting & Formatting
black==24.1.1
flake8==7.0.0
isort==5.13.2
mypy==1.8.0

# Development
ipython==8.20.0
watchfiles==0.21.0
```

**Créer `backend/.env` :**

```bash
# Database
DATABASE_URL=postgresql+asyncpg://idel_user:idel_password_dev@localhost:5432/idel_db
DATABASE_URL_SYNC=postgresql://idel_user:idel_password_dev@localhost:5432/idel_db

# Redis
REDIS_URL=redis://localhost:6379/0

# JWT Auth
SECRET_KEY=your-secret-key-change-me-in-production-min-32-chars
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# API Keys (à remplir)
OPENROUTESERVICE_API_KEY=your_api_key_here
MISTRAL_API_KEY=your_api_key_here  # Pour V1.0
TWILIO_ACCOUNT_SID=your_sid_here  # Pour V1.0
TWILIO_AUTH_TOKEN=your_token_here  # Pour V1.0

# Environment
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# CORS (frontend dev)
CORS_ORIGINS=["http://localhost:3000","http://localhost:19006"]

# Application
APP_NAME=IDEL Assistant
APP_VERSION=0.1.0
```

**Créer `.gitignore` :**

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Virtual Environment
venv/
env/
ENV/
.venv

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Environment variables
.env
.env.local
.env.*.local

# Database
*.db
*.sqlite
*.sqlite3

# Testing
.pytest_cache/
.coverage
htmlcov/
*.cover

# Logs
*.log
logs/

# Docker
docker-compose.override.yml

# OS
Thumbs.db
.DS_Store
```

### 2.3 Lancer l'environnement

```bash
# 1. Démarrer Docker Desktop (si pas déjà fait)
# Vérifier que Docker tourne
docker ps

# 2. Lancer les services
cd ~/projects/idel-assistant
docker-compose up -d

# 3. Vérifier que tout tourne
docker-compose ps
# Devrait afficher : postgres, redis, adminer (all "Up")

# 4. Tester connexion PostgreSQL
docker exec -it idel-postgres psql -U idel_user -d idel_db -c "SELECT version();"
# Devrait afficher version PostgreSQL

# 5. Tester Redis
docker exec -it idel-redis redis-cli ping
# Devrait afficher "PONG"
```

### 2.4 Setup backend Python

```bash
cd backend

# 1. Créer virtualenv
python3.12 -m venv venv

# 2. Activer virtualenv
# macOS/Linux:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# 3. Installer dépendances
pip install --upgrade pip
pip install -r requirements.txt
pip install -r requirements-dev.txt

# 4. Vérifier installation
python -c "import fastapi; print(f'FastAPI {fastapi.__version__}')"
python -c "import sqlalchemy; print(f'SQLAlchemy {sqlalchemy.__version__}')"
```

✅ **Setup terminé ! Temps écoulé : ~5 minutes**

---

## 3. STRUCTURE DU PROJET

### 3.1 Architecture finale (post-setup)

```
idel-assistant/
│
├── backend/                          # API FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app entry point
│   │   ├── config.py                 # Settings (BaseSettings)
│   │   ├── database.py               # SQLAlchemy setup + session
│   │   ├── dependencies.py           # Dependency injection
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py           # POST /login, /register
│   │   │       ├── users.py          # GET/PATCH /users/me
│   │   │       ├── patients.py       # CRUD patients
│   │   │       ├── appointments.py   # CRUD RDV
│   │   │       ├── tournees.py       # POST /optimiser
│   │   │       └── transmissions.py  # WS /transcribe
│   │   │
│   │   ├── models/                   # SQLAlchemy ORM
│   │   │   ├── __init__.py
│   │   │   ├── base.py               # Base class
│   │   │   ├── user.py
│   │   │   ├── patient.py
│   │   │   ├── appointment.py
│   │   │   └── transmission.py
│   │   │
│   │   ├── schemas/                  # Pydantic (validation)
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── patient.py
│   │   │   ├── appointment.py
│   │   │   └── token.py
│   │   │
│   │   ├── services/                 # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth.py               # Password hash, JWT
│   │   │   ├── optimization.py       # OR-Tools
│   │   │   ├── geocoding.py          # Address → lat/lon
│   │   │   └── routing.py            # OpenRouteService
│   │   │
│   │   ├── utils/                    # Helpers
│   │   │   ├── __init__.py
│   │   │   ├── security.py
│   │   │   └── logger.py
│   │   │
│   │   └── tasks/                    # Celery (async tasks)
│   │       ├── __init__.py
│   │       └── celery_app.py
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py               # Pytest fixtures
│   │   ├── test_api/
│   │   │   ├── test_auth.py
│   │   │   ├── test_patients.py
│   │   │   └── test_appointments.py
│   │   └── test_services/
│   │       └── test_optimization.py
│   │
│   ├── alembic/                      # Database migrations
│   │   ├── versions/
│   │   ├── env.py
│   │   └── script.py.mako
│   │
│   ├── .env                          # Environment variables
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   ├── alembic.ini
│   └── pytest.ini
│
├── frontend-mobile/                  # React Native (Phase 2)
│   └── (à créer plus tard)
│
├── docs/                             # Documentation
│   ├── 01-produit-specifications.md
│   ├── BUSINESS_PLAN.md
│   └── API.md
│
├── docker-compose.yml
├── .gitignore
├── README.md
└── SETUP.md                          # Ce fichier
```

### 3.2 Création structure (script)

**Créer `backend/create_structure.sh` :**

```bash
#!/bin/bash

# Script pour créer toute la structure backend
cd "$(dirname "$0")"

# Directories
mkdir -p app/{api/v1,models,schemas,services,utils,tasks}
mkdir -p tests/{test_api,test_services}
mkdir -p alembic/versions

# Root files
touch app/__init__.py
touch app/main.py
touch app/config.py
touch app/database.py
touch app/dependencies.py

# API
touch app/api/__init__.py
touch app/api/v1/__init__.py
touch app/api/v1/auth.py
touch app/api/v1/users.py
touch app/api/v1/patients.py
touch app/api/v1/appointments.py
touch app/api/v1/tournees.py
touch app/api/v1/transmissions.py

# Models
touch app/models/__init__.py
touch app/models/base.py
touch app/models/user.py
touch app/models/patient.py
touch app/models/appointment.py
touch app/models/transmission.py

# Schemas
touch app/schemas/__init__.py
touch app/schemas/user.py
touch app/schemas/patient.py
touch app/schemas/appointment.py
touch app/schemas/token.py

# Services
touch app/services/__init__.py
touch app/services/auth.py
touch app/services/optimization.py
touch app/services/geocoding.py
touch app/services/routing.py

# Utils
touch app/utils/__init__.py
touch app/utils/security.py
touch app/utils/logger.py

# Tasks
touch app/tasks/__init__.py
touch app/tasks/celery_app.py

# Tests
touch tests/__init__.py
touch tests/conftest.py
touch tests/test_api/test_auth.py
touch tests/test_api/test_patients.py
touch tests/test_api/test_appointments.py
touch tests/test_services/test_optimization.py

# Config files
cat > pytest.ini << 'EOF'
[pytest]
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
addopts = -v --tb=short --strict-markers --cov=app --cov-report=term-missing
EOF

cat > alembic.ini << 'EOF'
[alembic]
script_location = alembic
prepend_sys_path = .
version_path_separator = os

sqlalchemy.url = postgresql://idel_user:idel_password_dev@localhost:5432/idel_db

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF

echo "✅ Structure créée avec succès !"
```

**Exécuter :**

```bash
cd backend
chmod +x create_structure.sh
./create_structure.sh
```

---

## 4. CONFIGURATION ENVIRONNEMENT

### 4.1 Configuration Alembic (migrations)

```bash
cd backend

# Initialiser Alembic (si pas déjà fait)
alembic init alembic

# Éditer alembic/env.py pour utiliser notre config
```

**Modifier `alembic/env.py` :**

```python
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
from pathlib import Path

# Add app to path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.models.base import Base
# Import all models here so Alembic can detect them
from app.models.user import User
from app.models.patient import Patient
from app.models.appointment import Appointment
from app.models.transmission import Transmission

# Alembic Config object
config = context.config

# Override sqlalchemy.url with our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL_SYNC)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata object
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

### 4.2 Configuration VS Code

**Créer `.vscode/settings.json` :**

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/backend/venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.linting.pylintEnabled": false,
  "python.formatting.provider": "black",
  "python.formatting.blackArgs": ["--line-length", "100"],
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter",
    "editor.rulers": [100]
  },
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    "**/.pytest_cache": true
  }
}
```

**Créer `.vscode/launch.json` (debug FastAPI) :**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "app.main:app",
        "--reload",
        "--host",
        "0.0.0.0",
        "--port",
        "8000"
      ],
      "jinja": true,
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
      },
      "cwd": "${workspaceFolder}/backend"
    },
    {
      "name": "Pytest",
      "type": "python",
      "request": "launch",
      "module": "pytest",
      "args": ["-v", "--tb=short"],
      "cwd": "${workspaceFolder}/backend",
      "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
      }
    }
  ]
}
```

---

## 5. COMMANDES UTILES

### 5.1 Docker

```bash
# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Logs d'un service spécifique
docker-compose logs -f postgres

# Arrêter tous les services
docker-compose down

# Arrêter et supprimer volumes (⚠️ supprime données)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache

# Entrer dans container PostgreSQL
docker exec -it idel-postgres psql -U idel_user -d idel_db

# Entrer dans container Redis
docker exec -it idel-redis redis-cli
```

### 5.2 Backend (FastAPI)

```bash
cd backend
source venv/bin/activate  # Activer venv

# Lancer serveur dev
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Lancer avec logs debug
uvicorn app.main:app --reload --log-level debug

# Lancer en production (sans reload)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

**URLs utiles :**
- API : http://localhost:8000
- Docs interactive : http://localhost:8000/docs
- Docs alternative : http://localhost:8000/redoc
- Health check : http://localhost:8000/health
- Adminer (BDD) : http://localhost:8080

### 5.3 Database (Alembic)

```bash
cd backend
source venv/bin/activate

# Créer nouvelle migration (auto-détecte changements models)
alembic revision --autogenerate -m "create users table"

# Créer migration manuelle (vide)
alembic revision -m "add custom index"

# Appliquer migrations (upgrade to latest)
alembic upgrade head

# Revenir en arrière (1 migration)
alembic downgrade -1

# Revenir à version spécifique
alembic downgrade <revision_id>

# Voir historique migrations
alembic history

# Voir migration SQL sans appliquer
alembic upgrade head --sql
```

### 5.4 Tests

```bash
cd backend
source venv/bin/activate

# Lancer tous les tests
pytest

# Tests avec coverage
pytest --cov=app --cov-report=html

# Tests spécifiques
pytest tests/test_api/test_auth.py

# Tests avec output verbeux
pytest -v -s

# Tests en parallèle (plus rapide)
pytest -n auto
```

### 5.5 Linting & Formatting

```bash
cd backend
source venv/bin/activate

# Black (formatter)
black app tests

# Black check only (no changes)
black --check app tests

# Flake8 (linter)
flake8 app tests

# isort (import sorting)
isort app tests

# mypy (type checking)
mypy app

# Tout en une commande
black app tests && isort app tests && flake8 app tests
```

---

## 6. SPRINT 1 - TÂCHES DÉTAILLÉES

### 6.1 Vue d'ensemble Sprint 1

**Durée :** 2 semaines (10 jours ouvrés)  
**Objectif :** Backend API avec Auth + CRUD Patients + Tests  
**Délivrables :**
- ✅ FastAPI app fonctionnelle
- ✅ Endpoints `/auth` (register, login, refresh)
- ✅ Endpoints `/patients` (CRUD)
- ✅ Tests unitaires + intégration
- ✅ Documentation API (Swagger)

### 6.2 Tâches jour par jour

#### **Jour 1 : Setup & Configuration (4h)**

**Task 1.1 : Configuration FastAPI app** (2h)
- [ ] Créer `app/config.py` (BaseSettings avec .env)
- [ ] Créer `app/main.py` (FastAPI instance)
- [ ] Ajouter CORS middleware
- [ ] Ajouter endpoint `/health`
- [ ] Tester : `curl http://localhost:8000/health`

**Code `app/config.py` :**
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # App
    APP_NAME: str = "IDEL Assistant"
    APP_VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str
    DATABASE_URL_SYNC: str
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    
    # API Keys
    OPENROUTESERVICE_API_KEY: str = ""
    
    class Config:
        env_file = ".env"
        case_sensitive = True

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

**Code `app/main.py` :**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "IDEL Assistant API", "version": settings.APP_VERSION}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

**Task 1.2 : Setup Database connection** (2h)
- [ ] Créer `app/database.py` (SQLAlchemy async engine)
- [ ] Créer `app/models/base.py` (Base class)
- [ ] Tester connexion BDD
- [ ] Initialiser Alembic

**Code `app/database.py` :**
```python
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
)

# Session factory
AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()

# Dependency
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

**Code `app/models/base.py` :**
```python
from sqlalchemy import Column, DateTime, func
from sqlalchemy.ext.declarative import declared_attr
from app.database import Base
import uuid
from sqlalchemy.dialects.postgresql import UUID

class BaseModel(Base):
    __abstract__ = True
    
    @declared_attr
    def __tablename__(cls):
        return cls.__name__.lower()
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

---

#### **Jour 2 : Auth Models & Schemas** (6h)

**Task 2.1 : User model** (2h)
- [ ] Créer `app/models/user.py` (SQLAlchemy)
- [ ] Définir champs (email, password_hash, rpps, etc.)
- [ ] Créer migration Alembic
- [ ] Appliquer migration

**Code `app/models/user.py` :**
```python
from sqlalchemy import Column, String, Boolean, Time, Integer, DateTime
from app.models.base import BaseModel

class User(BaseModel):
    __tablename__ = "users"
    
    # Identity
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    rpps = Column(String(11), unique=True, nullable=False, index=True)
    phone = Column(String(20))
    photo_url = Column(String)
    
    # Config
    work_zone_radius_km = Column(Integer, default=20)
    work_hours_start = Column(Time, default="08:00")
    work_hours_end = Column(Time, default="18:00")
    lunch_break_start = Column(Time, default="12:00")
    lunch_break_duration_minutes = Column(Integer, default=60)
    
    # Agent vocal
    vocal_agent_enabled = Column(Boolean, default=False)
    vocal_agent_phone = Column(String(20))
    vocal_agent_24_7 = Column(Boolean, default=True)
    
    # Subscription
    plan = Column(String(50), default="solo")  # solo | cabinet | cabinet_plus
    subscription_status = Column(String(20), default="trial")  # trial | active | canceled
    trial_ends_at = Column(DateTime)
    
    # Activity
    last_login_at = Column(DateTime)
```

**Créer migration :**
```bash
alembic revision --autogenerate -m "create users table"
alembic upgrade head
```

**Task 2.2 : Pydantic schemas** (2h)
- [ ] Créer `app/schemas/user.py`
- [ ] UserCreate (input register)
- [ ] UserResponse (output)
- [ ] UserUpdate

**Code `app/schemas/user.py` :**
```python
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, time
from uuid import UUID

class UserBase(BaseModel):
    email: EmailStr
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    rpps: str = Field(min_length=11, max_length=11)
    phone: str | None = None

class UserCreate(UserBase):
    password: str = Field(min_length=8)

class UserUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    photo_url: str | None = None
    work_zone_radius_km: int | None = None
    work_hours_start: time | None = None
    work_hours_end: time | None = None

class UserResponse(UserBase):
    id: UUID
    photo_url: str | None
    work_zone_radius_km: int
    plan: str
    subscription_status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    user_id: UUID | None = None
```

**Task 2.3 : Auth service (password, JWT)** (2h)
- [ ] Créer `app/utils/security.py`
- [ ] Hash password (bcrypt)
- [ ] Verify password
- [ ] Create JWT token

**Code `app/utils/security.py` :**
```python
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from app.config import settings
from uuid import UUID

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: UUID) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"sub": str(user_id), "exp": expire, "type": "access"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def create_refresh_token(user_id: UUID) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_token(token: str, token_type: str = "access") -> UUID | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        token_type_claim: str = payload.get("type")
        
        if user_id is None or token_type_claim != token_type:
            return None
        
        return UUID(user_id)
    except JWTError:
        return None
```

---

#### **Jour 3 : Auth Endpoints** (6h)

**Task 3.1 : Auth router** (4h)
- [ ] Créer `app/api/v1/auth.py`
- [ ] POST /register
- [ ] POST /login
- [ ] POST /refresh

**Code `app/api/v1/auth.py` :**
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.utils.security import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if RPPS exists
    result = await db.execute(select(User).where(User.rpps == user_in.rpps))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="RPPS already registered"
        )
    
    # Create user
    user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        rpps=user_in.rpps,
        phone=user_in.phone,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return user

@router.post("/login", response_model=Token)
async def login(email: str, password: str, db: AsyncSession = Depends(get_db)):
    # Find user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Update last login
    user.last_login_at = datetime.utcnow()
    await db.commit()
    
    # Create tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh", response_model=Token)
async def refresh(refresh_token: str, db: AsyncSession = Depends(get_db)):
    user_id = verify_token(refresh_token, token_type="refresh")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Verify user exists
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Create new tokens
    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)
    
    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }
```

**Task 3.2 : Dependency current_user** (1h)
- [ ] Créer `app/dependencies.py`
- [ ] get_current_user (vérifie JWT)

**Code `app/dependencies.py` :**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User
from app.utils.security import verify_token

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    token = credentials.credentials
    user_id = verify_token(token, token_type="access")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user
```

**Task 3.3 : Intégrer router dans main** (1h)
- [ ] Import router dans `main.py`
- [ ] Tester avec Swagger docs

**Modifier `app/main.py` :**
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.v1 import auth

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "IDEL Assistant API", "version": settings.APP_VERSION}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
```

---

#### **Jour 4-5 : Patient CRUD** (12h)

**Task 4.1 : Patient model** (2h)
- [ ] Créer `app/models/patient.py`
- [ ] Relation ForeignKey vers User
- [ ] Géolocalisation (lat, lon)
- [ ] Créer migration

**Code `app/models/patient.py` :**
```python
from sqlalchemy import Column, String, Date, Text, ARRAY, ForeignKey, Integer, DECIMAL, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import BaseModel
import uuid

class Patient(BaseModel):
    __tablename__ = "patients"
    
    idel_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Identity
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    birth_date = Column(Date, nullable=False)
    
    # Contact
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(Text, nullable=False)
    lat = Column(DECIMAL(10, 8))
    lon = Column(DECIMAL(11, 8))
    
    # Medical
    pathologies = Column(ARRAY(Text))
    preferred_time_slot = Column(String(20))  # morning | afternoon | evening
    care_duration_default = Column(Integer, default=30)
    notes = Column(Text)
    
    # Status
    status = Column(String(20), default="active")  # active | archived
    archived_reason = Column(String(50))
    archived_at = Column(DateTime)
    
    # Relationships
    idel = relationship("User", back_populates="patients")
```

**Ajouter dans `app/models/user.py` :**
```python
from sqlalchemy.orm import relationship

class User(BaseModel):
    # ... existing fields ...
    
    # Relationships
    patients = relationship("Patient", back_populates="idel")
```

**Créer migration :**
```bash
alembic revision --autogenerate -m "create patients table"
alembic upgrade head
```

**Task 4.2 : Patient schemas** (1h)
- [ ] Créer `app/schemas/patient.py`
- [ ] PatientCreate, PatientResponse, PatientUpdate

**Code `app/schemas/patient.py` :**
```python
from pydantic import BaseModel, Field
from datetime import date, datetime
from uuid import UUID

class PatientBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    birth_date: date
    phone: str | None = None
    email: str | None = None
    address: str
    pathologies: list[str] = []
    preferred_time_slot: str | None = None
    care_duration_default: int = 30
    notes: str | None = None

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    pathologies: list[str] | None = None
    preferred_time_slot: str | None = None
    care_duration_default: int | None = None
    notes: str | None = None

class PatientResponse(PatientBase):
    id: UUID
    idel_id: UUID
    lat: float | None
    lon: float | None
    status: str
    created_at: datetime
    updated_at: datetime | None
    
    class Config:
        from_attributes = True
```

**Task 4.3 : Geocoding service** (3h)
- [ ] Créer `app/services/geocoding.py`
- [ ] Fonction address → lat/lon
- [ ] Utiliser API gratuite (Nominatim)

**Code `app/services/geocoding.py` :**
```python
import httpx
from typing import Tuple

async def geocode_address(address: str) -> Tuple[float | None, float | None]:
    """
    Convert address to latitude/longitude using Nominatim (OpenStreetMap).
    Free API, no key required.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": address,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "fr"
                },
                headers={"User-Agent": "IDEL-Assistant/1.0"}
            )
            
            data = response.json()
            
            if data and len(data) > 0:
                lat = float(data[0]["lat"])
                lon = float(data[0]["lon"])
                return lat, lon
            
            return None, None
            
    except Exception as e:
        print(f"Geocoding error: {e}")
        return None, None
```

**Task 4.4 : Patient router (CRUD)** (6h)
- [ ] Créer `app/api/v1/patients.py`
- [ ] GET /patients (list avec pagination)
- [ ] POST /patients
- [ ] GET /patients/{id}
- [ ] PATCH /patients/{id}
- [ ] DELETE /patients/{id} (soft delete = archive)

**Code `app/api/v1/patients.py` :**
```python
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.models.patient import Patient
from app.schemas.patient import PatientCreate, PatientResponse, PatientUpdate
from app.dependencies import get_current_user
from app.services.geocoding import geocode_address
from datetime import datetime

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=list[PatientResponse])
async def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: str = Query("active", regex="^(active|archived|all)$"),
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Patient).where(Patient.idel_id == current_user.id)
    
    # Filter by status
    if status != "all":
        query = query.where(Patient.status == status)
    
    # Search
    if search:
        search_pattern = f"%{search}%"
        query = query.where(
            (Patient.first_name.ilike(search_pattern)) |
            (Patient.last_name.ilike(search_pattern))
        )
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    patients = result.scalars().all()
    
    return patients

@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_in: PatientCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Geocode address
    lat, lon = await geocode_address(patient_in.address)
    
    # Create patient
    patient = Patient(
        idel_id=current_user.id,
        first_name=patient_in.first_name,
        last_name=patient_in.last_name,
        birth_date=patient_in.birth_date,
        phone=patient_in.phone,
        email=patient_in.email,
        address=patient_in.address,
        lat=lat,
        lon=lon,
        pathologies=patient_in.pathologies,
        preferred_time_slot=patient_in.preferred_time_slot,
        care_duration_default=patient_in.care_duration_default,
        notes=patient_in.notes,
    )
    
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    
    return patient

@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(
            and_(Patient.id == patient_id, Patient.idel_id == current_user.id)
        )
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    return patient

@router.patch("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: UUID,
    patient_update: PatientUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(
            and_(Patient.id == patient_id, Patient.idel_id == current_user.id)
        )
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Update fields
    update_data = patient_update.model_dump(exclude_unset=True)
    
    # Re-geocode if address changed
    if "address" in update_data:
        lat, lon = await geocode_address(update_data["address"])
        update_data["lat"] = lat
        update_data["lon"] = lon
    
    for field, value in update_data.items():
        setattr(patient, field, value)
    
    await db.commit()
    await db.refresh(patient)
    
    return patient

@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_patient(
    patient_id: UUID,
    reason: str = Query(..., regex="^(moved|deceased|end_care)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Patient).where(
            and_(Patient.id == patient_id, Patient.idel_id == current_user.id)
        )
    )
    patient = result.scalar_one_or_none()
    
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found"
        )
    
    # Soft delete (archive)
    patient.status = "archived"
    patient.archived_reason = reason
    patient.archived_at = datetime.utcnow()
    
    await db.commit()
    
    return None
```

**Ajouter router dans main.py :**
```python
from app.api.v1 import auth, patients

app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router, prefix="/api/v1")
```

---

#### **Jour 6-7 : Tests** (12h)

**Task 6.1 : Setup tests** (2h)
- [ ] Créer `tests/conftest.py` (fixtures)
- [ ] Database test (SQLite ou PostgreSQL test)
- [ ] Client FastAPI test

**Code `tests/conftest.py` :**
```python
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.database import Base, get_db
from app.models.user import User
from app.models.patient import Patient
from app.utils.security import hash_password, create_access_token

# Test database URL (SQLite for speed)
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Test engine
test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)

# Test session
TestSessionLocal = sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    # Create tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
    
    # Drop tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    
    app.dependency_overrides.clear()

@pytest.fixture
async def test_user(db_session: AsyncSession) -> User:
    user = User(
        email="test@example.com",
        password_hash=hash_password("testpassword123"),
        first_name="Test",
        last_name="User",
        rpps="12345678901",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user

@pytest.fixture
def auth_headers(test_user: User) -> dict:
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}
```

**Task 6.2 : Tests Auth** (4h)
- [ ] Test register
- [ ] Test login
- [ ] Test refresh token
- [ ] Test auth errors

**Code `tests/test_api/test_auth.py` :**
```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "password": "password123",
            "first_name": "John",
            "last_name": "Doe",
            "rpps": "98765432109",
        }
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new@example.com"
    assert "id" in data

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, test_user):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": test_user.email,
            "password": "password123",
            "first_name": "John",
            "last_name": "Doe",
            "rpps": "11111111111",
        }
    )
    
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user):
    response = await client.post(
        "/api/v1/auth/login",
        params={"email": test_user.email, "password": "testpassword123"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user):
    response = await client.post(
        "/api/v1/auth/login",
        params={"email": test_user.email, "password": "wrongpassword"}
    )
    
    assert response.status_code == 401
```

**Task 6.3 : Tests Patients** (6h)
- [ ] Test create patient
- [ ] Test list patients
- [ ] Test get patient
- [ ] Test update patient
- [ ] Test archive patient
- [ ] Test unauthorized access

**Code `tests/test_api/test_patients.py` :**
```python
import pytest
from httpx import AsyncClient
from datetime import date

@pytest.mark.asyncio
async def test_create_patient(client: AsyncClient, auth_headers: dict):
    response = await client.post(
        "/api/v1/patients",
        json={
            "first_name": "Marie",
            "last_name": "Dupont",
            "birth_date": "1950-05-15",
            "address": "10 Rue de la Paix, 75001 Paris",
            "phone": "0601020304",
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Marie"
    assert data["last_name"] == "Dupont"
    assert "id" in data

@pytest.mark.asyncio
async def test_list_patients(client: AsyncClient, auth_headers: dict):
    # Create 2 patients
    for i in range(2):
        await client.post(
            "/api/v1/patients",
            json={
                "first_name": f"Patient{i}",
                "last_name": "Test",
                "birth_date": "1960-01-01",
                "address": "Paris",
            },
            headers=auth_headers
        )
    
    # List patients
    response = await client.get("/api/v1/patients", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

@pytest.mark.asyncio
async def test_get_patient(client: AsyncClient, auth_headers: dict):
    # Create patient
    create_response = await client.post(
        "/api/v1/patients",
        json={
            "first_name": "Sophie",
            "last_name": "Martin",
            "birth_date": "1970-03-20",
            "address": "Lyon",
        },
        headers=auth_headers
    )
    patient_id = create_response.json()["id"]
    
    # Get patient
    response = await client.get(f"/api/v1/patients/{patient_id}", headers=auth_headers)
    
    assert response.status_code == 200
    data = response.json()
    assert data["first_name"] == "Sophie"

@pytest.mark.asyncio
async def test_unauthorized_access(client: AsyncClient):
    response = await client.get("/api/v1/patients")
    assert response.status_code == 401
```

---

#### **Jour 8 : Documentation & Review** (4h)

**Task 8.1 : README.md** (2h)
- [ ] Écrire README projet
- [ ] Setup instructions
- [ ] API usage examples

**Task 8.2 : Code review & refactoring** (2h)
- [ ] Linter (black, flake8)
- [ ] Type hints
- [ ] Docstrings

---

### 6.3 Definition of Done (Sprint 1)

**Checklist avant de merger :**

- [ ] ✅ Code fonctionne (testé manuellement)
- [ ] ✅ Tests passent (pytest)
- [ ] ✅ Coverage >80% sur code ajouté
- [ ] ✅ Linter passe (black, flake8)
- [ ] ✅ Type hints ajoutés (mypy)
- [ ] ✅ Docstrings sur fonctions publiques
- [ ] ✅ Migration Alembic créée et testée
- [ ] ✅ Swagger docs à jour (http://localhost:8000/docs)
- [ ] ✅ README updated si nécessaire
- [ ] ✅ Commit messages clairs
- [ ] ✅ Pas de secrets/API keys dans code

---

## 7. WORKFLOW DÉVELOPPEMENT

### 7.1 Git workflow

**Branches :**
```
main          → Production stable
develop       → Développement actif
feature/*     → Nouvelles features (ex: feature/auth)
bugfix/*      → Bug fixes
hotfix/*      → Fixes urgents production
```

**Commandes Git standard :**

```bash
# Créer feature branch
git checkout develop
git pull origin develop
git checkout -b feature/auth

# Commit
git add .
git commit -m "feat(auth): add JWT authentication"

# Push
git push origin feature/auth

# Merge dans develop (après review)
git checkout develop
git merge feature/auth
git push origin develop
```

**Convention commits :**
```
feat: Nouvelle feature
fix: Bug fix
docs: Documentation
style: Formatting (black, isort)
refactor: Refactoring code
test: Tests
chore: Maintenance (deps, config)
```

### 7.2 Daily dev workflow

**1. Début de journée :**
```bash
# Update code
cd ~/projects/idel-assistant
git checkout develop
git pull

# Start services
docker-compose up -d

# Activate venv
cd backend
source venv/bin/activate

# Run tests (sanity check)
pytest

# Start dev server
uvicorn app.main:app --reload
```

**2. Développement :**
- Écrire test (TDD)
- Implémenter feature
- Vérifier test passe
- Commit petit & souvent

**3. Fin de journée :**
```bash
# Run full tests
pytest --cov=app

# Format code
black app tests
isort app tests

# Lint
flake8 app tests

# Commit & push
git add .
git commit -m "feat: implement patient CRUD"
git push
```

### 7.3 Debugging

**Print debugging :**
```python
print(f"DEBUG: user_id={user_id}")
```

**VS Code debugger :**
- Mettre breakpoint (clic gauche numéro ligne)
- F5 → Run "FastAPI" config
- Appeler endpoint depuis Swagger
- Debugger s'arrête au breakpoint

**Logs :**
```python
import logging
logger = logging.getLogger(__name__)

logger.info(f"User {user.id} logged in")
logger.error(f"Database error: {e}")
```

---

## 8. TESTS

### 8.1 Types de tests

**1. Tests unitaires** (services, utils)
```python
# tests/test_services/test_geocoding.py
@pytest.mark.asyncio
async def test_geocode_valid_address():
    lat, lon = await geocode_address("10 Rue de Rivoli, Paris")
    assert lat is not None
    assert lon is not None
    assert 48.8 < lat < 48.9  # Paris latitude range
```

**2. Tests intégration** (API endpoints)
```python
# tests/test_api/test_patients.py
@pytest.mark.asyncio
async def test_create_patient_workflow(client, auth_headers):
    response = await client.post("/api/v1/patients", ...)
    assert response.status_code == 201
```

**3. Tests E2E** (futur, avec Playwright)

### 8.2 Lancer tests

```bash
# Tous les tests
pytest

# Tests spécifiques
pytest tests/test_api/test_auth.py::test_login_success

# Avec coverage
pytest --cov=app --cov-report=html

# Parallèle (plus rapide)
pytest -n auto

# Verbose
pytest -v -s
```

### 8.3 Fixtures utiles

**Fixture user avec patients :**
```python
@pytest.fixture
async def user_with_patients(db_session: AsyncSession, test_user: User):
    patients = []
    for i in range(3):
        patient = Patient(
            idel_id=test_user.id,
            first_name=f"Patient{i}",
            last_name="Test",
            birth_date=date(1960, 1, 1),
            address=f"Address {i}",
        )
        db_session.add(patient)
        patients.append(patient)
    
    await db_session.commit()
    return test_user, patients
```

---

## 9. TROUBLESHOOTING

### 9.1 Problèmes courants

**❌ "ModuleNotFoundError: No module named 'app'"**

**Solution :**
```bash
# Vérifier que venv est activé
which python  # Doit pointer vers venv/bin/python

# Installer requirements
pip install -r requirements.txt

# Ajouter PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)"
```

---

**❌ "sqlalchemy.exc.OperationalError: connection refused"**

**Solution :**
```bash
# Vérifier que PostgreSQL tourne
docker-compose ps

# Restart si nécessaire
docker-compose restart postgres

# Vérifier connexion
docker exec -it idel-postgres psql -U idel_user -d idel_db -c "SELECT 1;"
```

---

**❌ "alembic.util.exc.CommandError: Target database is not up to date"**

**Solution :**
```bash
# Appliquer migrations
alembic upgrade head

# Si migrations corrompues, reset
alembic downgrade base
alembic upgrade head
```

---

**❌ "403 Forbidden" sur API geocoding**

**Solution :**
```python
# Ajouter User-Agent header (Nominatim requis)
headers={"User-Agent": "IDEL-Assistant/1.0"}
```

---

**❌ Tests échouent avec "Event loop closed"**

**Solution :**
```python
# Dans conftest.py, utiliser scope="function"
@pytest.fixture(scope="function")
async def db_session():
    ...
```

---

**❌ "docker: Cannot connect to the Docker daemon"**

**Solution :**
```bash
# macOS: Ouvrir Docker Desktop
open /Applications/Docker.app

# Linux: Start docker service
sudo systemctl start docker
```

---

### 9.2 Debug checklist

Quand quelque chose ne marche pas :

1. **Services running ?**
   ```bash
   docker-compose ps
   # Tous en "Up" ?
   ```

2. **Venv activé ?**
   ```bash
   which python
   # Pointe vers venv ?
   ```

3. **Variables env ?**
   ```bash
   cat .env
   # Toutes définies ?
   ```

4. **Migrations appliquées ?**
   ```bash
   alembic current
   # Affiche version ?
   ```

5. **Logs Docker ?**
   ```bash
   docker-compose logs -f postgres
   # Erreurs visibles ?
   ```

---

## 10. CHECKLIST QUALITY GATES

### 10.1 Avant chaque commit

- [ ] Code fonctionne localement
- [ ] Tests ajoutés pour nouveau code
- [ ] Tests existants passent
- [ ] Black formaté (`black app tests`)
- [ ] isort importé (`isort app tests`)
- [ ] Pas de print() debug oublié
- [ ] Pas de secrets en dur

### 10.2 Avant chaque push

- [ ] `pytest` → 100% pass
- [ ] `flake8 app tests` → 0 erreurs
- [ ] `pytest --cov=app` → Coverage >80%
- [ ] Commit message descriptif
- [ ] Branch à jour avec develop

### 10.3 Avant chaque merge

- [ ] Code review (pair ou auto-review)
- [ ] Documentation API updated (si endpoints ajoutés)
- [ ] Migration Alembic créée (si model changé)
- [ ] README updated (si setup changé)
- [ ] CHANGELOG updated (si feature majeure)

### 10.4 Avant mise en production

- [ ] Tests E2E passent
- [ ] Performance acceptable (load test)
- [ ] Monitoring setup (Sentry)
- [ ] Secrets en variables env (pas en code)
- [ ] Migrations testées sur copie prod
- [ ] Backup BDD avant deploy
- [ ] Rollback plan défini

---

## 🎉 FÉLICITATIONS !

Si tu as suivi ce guide, tu as maintenant :

✅ Environnement dev complet fonctionnel  
✅ Backend FastAPI avec Auth + CRUD Patients  
✅ Tests automatisés (>80% coverage)  
✅ Docker compose (PostgreSQL + Redis)  
✅ Migrations Alembic  
✅ Code formaté & linté  
✅ Documentation API (Swagger)  
✅ Workflow Git structuré  

**Tu es prêt pour le Sprint 2 ! 🚀**

---

## 📚 RESSOURCES

**Documentation officielle :**
- FastAPI : https://fastapi.tiangolo.com
- SQLAlchemy : https://docs.sqlalchemy.org/en/20/
- Alembic : https://alembic.sqlalchemy.org
- Pydantic : https://docs.pydantic.dev
- Pytest : https://docs.pytest.org

**Outils :**
- Swagger Editor : https://editor.swagger.io
- DB Diagram : https://dbdiagram.io
- Postman : https://www.postman.com

**Community :**
- FastAPI Discord : https://discord.gg/fastapi
- Stack Overflow : tag `fastapi`

---

## 📧 SUPPORT

**Questions ou problèmes ?**

1. Vérifier Troubleshooting section
2. Chercher dans issues GitHub (si repo public)
3. Demander à Claude Code ! 😄

---

**Bonne chance et bon coding ! 💻✨**

**Version :** 1.0  
**Dernière mise à jour :** Janvier 2026
