# CHECKLIST DE DÉMARRAGE — IDEL Assistant

## Prérequis à installer (une seule fois)

- [ ] **Python 3.12** — https://www.python.org/downloads/ (cocher "Add to PATH" pendant l'installation)
- [ ] **Docker Desktop** — https://www.docker.com/products/docker-desktop/ (activer WSL2 si demandé)
- [ ] **Git** — https://git-scm.com/download/win
- [ ] **VS Code** — https://code.visualstudio.com/ avec les extensions :
  - Python (Microsoft)
  - Pylance (Microsoft)
  - Docker (Microsoft)
  - GitLens (optionnel mais recommandé)
- [ ] **Claude Code** — `npm install -g @anthropic-ai/claude-code` (nécessite Node.js 18+)
  - Si Node.js pas installé : https://nodejs.org/ (version LTS)
  - Vérifier : `claude --version`

## Vérification des prérequis

Ouvre **PowerShell** et vérifie :

```powershell
python --version        # → Python 3.12.x
docker --version        # → Docker version 2x.x.x
git --version           # → git version 2.x.x
node --version          # → v18.x.x ou supérieur
claude --version        # → claude-code vX.X.X
```

---

## Étape 1 — Initialiser le projet (5 min)

- [ ] Crée le dossier projet et décompresse l'archive :
```powershell
mkdir C:\projets\idel-assistant
# Décompresse idel-assistant-starter.zip dans C:\projets\idel-assistant\
# Tu dois avoir : C:\projets\idel-assistant\docs\, C:\projets\idel-assistant\CLAUDE.md, etc.
```

- [ ] Initialise Git :
```powershell
cd C:\projets\idel-assistant
git init
git add .
git commit -m "Initial: docs, CLAUDE.md, .gitignore"
```

- [ ] (Optionnel) Crée un repo privé sur GitHub et push :
```powershell
# Sur github.com : New repository → "idel-assistant" (private)
git remote add origin https://github.com/TON_USERNAME/idel-assistant.git
git branch -M main
git push -u origin main
```

## Étape 2 — Lancer Claude Code (2 min)

- [ ] Ouvre Claude Code dans le dossier projet :
```powershell
cd C:\projets\idel-assistant
claude
```

- [ ] Vérifie que Claude Code a bien lu le CLAUDE.md :
```
> Résume ce que tu sais du projet
```
Il doit te parler de l'application IDEL, de la Clean Architecture 3 couches, du chiffrement AES-256, etc.

- [ ] Donne-lui le contexte complet de l'architecture :
```
> /add docs/architecture.md
> /add docs/prompts-claude-code.md
```

## Étape 3 — Prompt 0 : Setup projet (30 min)

- [ ] Copie-colle le **Prompt 0** depuis `docs/prompts-claude-code.md` dans Claude Code
- [ ] Attends la génération complète
- [ ] Vérifie :
```powershell
# Lance les containers Docker
docker compose up -d

# Vérifie que tout tourne
docker compose ps
# → PostgreSQL, Redis, Adminer doivent être "running"

# Vérifie Adminer dans le navigateur
# → http://localhost:8080
# → Système: PostgreSQL, Serveur: db, Utilisateur: idel, Mot de passe: idel_dev, Base: idel_db
```

- [ ] Crée l'environnement Python :
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```

- [ ] Commit :
```powershell
cd ..
git add .
git commit -m "Prompt 0: setup projet, docker-compose, requirements"
```

## Étape 4 — Prompt 1 : Domain Layer (1-2h)

- [ ] Copie-colle le **Prompt 1** dans Claude Code
- [ ] Attends la génération
- [ ] **Checkpoint obligatoire** — lance les tests unitaires :
```powershell
cd backend
.venv\Scripts\Activate.ps1
pytest tests/unit/ -v
```
- [ ] Tous les tests doivent passer ✅
- [ ] Vérifie qu'aucun fichier dans `app/domain/` n'importe de SQLAlchemy ou FastAPI :
```powershell
# Cette commande ne doit rien retourner :
Select-String -Path "app\domain\**\*.py" -Pattern "sqlalchemy|fastapi" -Recurse
```
- [ ] Lis rapidement les entités (`app/domain/entities/`) — vérifie que les champs correspondent au modèle de données dans `docs/architecture.md`
- [ ] Commit :
```powershell
cd ..
git add .
git commit -m "Prompt 1: domain layer - entités, value objects, règles, interfaces"
```

## Étape 5 — Prompt 2 : Persistence + Sécurité (2-3h)

- [ ] Copie-colle le **Prompt 2** dans Claude Code
- [ ] Attends la génération
- [ ] **Checkpoint** — teste le chiffrement :
```powershell
cd backend
pytest tests/unit/test_encryption.py -v
```
- [ ] **Checkpoint** — applique la migration :
```powershell
alembic upgrade head
```
- [ ] Vérifie les tables dans Adminer (http://localhost:8080) — toutes les tables doivent apparaître
- [ ] Si les tests d'intégration sont générés :
```powershell
pytest tests/integration/ -v
```
- [ ] Commit :
```powershell
cd ..
git add .
git commit -m "Prompt 2: infrastructure - SQLAlchemy, chiffrement AES-256, migrations, RLS"
```

## Étape 6 — Prompt 3 : API FastAPI (2-3h)

- [ ] Copie-colle le **Prompt 3** dans Claude Code
- [ ] Attends la génération
- [ ] **Checkpoint** — lance le serveur :
```powershell
cd backend
uvicorn app.main:app --reload --port 8000
```
- [ ] Ouvre http://localhost:8000/docs dans le navigateur — le Swagger doit afficher tous les endpoints
- [ ] Teste manuellement dans Swagger :
  - [ ] `POST /api/v1/auth/register` — crée un compte
  - [ ] `POST /api/v1/auth/login` — récupère un token
  - [ ] Clique "Authorize" en haut de Swagger, colle le token
  - [ ] `POST /api/v1/patients` — crée un patient
  - [ ] `GET /api/v1/patients` — vérifie qu'il apparaît
- [ ] Lance les tests API :
```powershell
pytest tests/api/ -v
```
- [ ] Commit :
```powershell
cd ..
git add .
git commit -m "Prompt 3: API FastAPI - auth, CRUD patients, appointments, protocols"
```

## Étape 7 — Prompt 4 : Optimisation tournées (2-3h)

- [ ] Copie-colle le **Prompt 4** dans Claude Code
- [ ] Attends la génération
- [ ] **Checkpoint** — teste le solver :
```powershell
cd backend
pytest tests/unit/test_ortools_solver.py -v
```
- [ ] **Checkpoint** — lance la démo visuelle :
```powershell
python scripts/demo_tournee.py
```
- [ ] Ouvre `demo_output/tournee_demo.html` dans le navigateur
  - [ ] Tu dois voir une carte de Nantes avec 8 patients
  - [ ] Trajet optimisé en bleu, trajet original en rouge
  - [ ] Encadré avec le gain en km et minutes
- [ ] **C'est ça que tu montres à ta femme** 🎯
- [ ] Lance tous les tests :
```powershell
pytest --cov=app tests/ -v
```
- [ ] Commit final :
```powershell
cd ..
git add .
git commit -m "Prompt 4: optimisation tournées OR-Tools, démo carte Nantes"
```

---

## Résultat final attendu

À la fin de ces étapes, tu as :

✅ Un backend FastAPI fonctionnel sur http://localhost:8000
✅ Auth complète (register/login/refresh)
✅ CRUD patients avec chiffrement AES-256 des données sensibles
✅ Gestion des RDV et protocoles de soins récurrents
✅ Optimisation de tournées avec OR-Tools
✅ Une démo carte HTML montrant le gain sur une tournée type Nantes
✅ Tests unitaires, intégration et API
✅ PostgreSQL avec RLS multi-tenant par cabinet
✅ Audit trail pour conformité HDS

## En cas de problème

Si Claude Code génère du code qui ne compile pas ou ne passe pas les tests :
1. Copie-colle l'erreur dans Claude Code
2. Demande-lui de corriger
3. Re-lance le test
4. Ne passe au prompt suivant que quand le checkpoint est vert

Si Docker ne démarre pas :
- Vérifie que Docker Desktop est lancé
- Vérifie que WSL2 est activé
- `docker compose down -v` puis `docker compose up -d` pour repartir de zéro

Si les migrations échouent :
- `alembic downgrade base` puis `alembic upgrade head`
- Si ça persiste, supprime le volume PostgreSQL : `docker compose down -v` puis relance
