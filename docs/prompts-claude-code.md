# PROMPTS CLAUDE CODE — ASSISTANT IA IDEL
## Séquence de génération du backend MVP

**Mode d'emploi :**
1. Ouvre Claude Code dans le dossier de ton projet
2. Donne-lui le fichier `architecture-idel-assistant.md` en contexte (`/add docs/architecture.md`)
3. Exécute les prompts dans l'ordre, un par un
4. Après chaque prompt, vérifie le checkpoint avant de passer au suivant
5. Si quelque chose ne te convient pas, demande à Claude Code de corriger avant de continuer

---

## PROMPT 0 — Setup projet et infrastructure locale

```
Initialise un projet Python pour une application healthcare (infirmières libérales) sur Windows 11.

Crée la structure de dossiers suivante (dossiers vides pour le moment, on les remplira après) :

idel-assistant/
├── backend/
│   ├── app/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value_objects/
│   │   │   ├── repositories/
│   │   │   ├── services/
│   │   │   └── rules/
│   │   ├── application/
│   │   │   ├── use_cases/
│   │   │   │   ├── auth/
│   │   │   │   ├── patients/
│   │   │   │   ├── appointments/
│   │   │   │   ├── tournees/
│   │   │   │   ├── transmissions/
│   │   │   │   └── invoices/
│   │   │   └── dtos/
│   │   └── infrastructure/
│   │       ├── api/
│   │       │   ├── v1/
│   │       │   └── schemas/
│   │       ├── persistence/
│   │       │   ├── models/
│   │       │   └── repositories/
│   │       ├── external/
│   │       ├── optimization/
│   │       └── security/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── api/
│   └── alembic/
│       └── versions/
├── docs/
└── frontend-mobile/

Crée ces fichiers de configuration :

1. docker-compose.yml avec :
   - PostgreSQL 16 (port 5432, user=idel, password=idel_dev, db=idel_db)
     avec extensions PostGIS et pg_trgm activées via un script d'init
   - Redis 7 (port 6379)
   - Adminer (port 8080) pour inspecter la BDD visuellement
   Volumes nommés pour persistence des données.

2. backend/requirements.txt :
   fastapi==0.115.*
   uvicorn[standard]==0.34.*
   sqlalchemy[asyncio]==2.0.*
   asyncpg==0.30.*
   alembic==1.14.*
   pydantic==2.10.*
   pydantic-settings==2.7.*
   python-jose[cryptography]==3.3.*
   passlib[bcrypt]==1.7.*
   redis==5.2.*
   celery==5.4.*
   httpx==0.28.*
   ortools==9.11.*
   python-dateutil==2.9.*
   cryptography==44.*

3. backend/requirements-dev.txt :
   -r requirements.txt
   pytest==8.3.*
   pytest-asyncio==0.25.*
   pytest-cov==6.0.*
   black==24.*
   ruff==0.8.*
   mypy==1.14.*

4. backend/.env :
   DATABASE_URL=postgresql+asyncpg://idel:idel_dev@localhost:5432/idel_db
   DATABASE_URL_SYNC=postgresql://idel:idel_dev@localhost:5432/idel_db
   REDIS_URL=redis://localhost:6379/0
   SECRET_KEY=dev-secret-key-change-in-production
   ENCRYPTION_MASTER_KEY=dev-encryption-key-32-bytes-long!!
   OPENROUTESERVICE_API_KEY=placeholder
   ENVIRONMENT=development
   DEBUG=true

5. .gitignore (Python complet + .env + __pycache__ + .venv + docker volumes)

6. backend/pytest.ini :
   [pytest]
   asyncio_mode = auto
   testpaths = tests
   python_files = test_*.py
   python_functions = test_*
   addopts = -v --tb=short

7. Tous les __init__.py nécessaires (fichiers vides)

8. README.md avec instructions de setup :
   - Prérequis (Python 3.12, Docker Desktop)
   - git clone + cd
   - docker compose up -d
   - python -m venv .venv
   - .venv\Scripts\activate (PowerShell)
   - pip install -r backend/requirements-dev.txt
   - Comment lancer les tests
   - Comment lancer le serveur

Ne génère PAS encore de code applicatif, uniquement la structure et la configuration.
```

**✅ Checkpoint 0 :** Vérifie que `docker compose up -d` lance bien PostgreSQL + Redis + Adminer. Vérifie que tu accèdes à Adminer sur http://localhost:8080. Crée le venv et installe les dépendances.

---

## PROMPT 1 — Domain Layer (entités, value objects, règles métier)

```
Consulte le fichier docs/architecture.md pour le contexte complet du projet.

Implémente la couche Domain du projet. Cette couche ne doit avoir AUCUNE dépendance externe
(pas de SQLAlchemy, FastAPI, ou bibliothèque tierce) sauf :
- dataclasses (stdlib)
- abc (stdlib)
- datetime, uuid, enum, typing (stdlib)
- python-dateutil (uniquement dans RecurrenceRule pour parser les RRULE)

=== VALUE OBJECTS (domain/value_objects/) ===

Crée des frozen dataclasses avec validation dans __post_init__.
Voici le pattern attendu :

```python
# Exemple : rpps_number.py
from dataclasses import dataclass

@dataclass(frozen=True)
class RPPSNumber:
    """Numéro RPPS d'un professionnel de santé (11 chiffres)."""
    value: str

    def __post_init__(self):
        if not self.value.isdigit() or len(self.value) != 11:
            raise ValueError(f"Numéro RPPS invalide: {self.value} (doit être 11 chiffres)")

    def __str__(self) -> str:
        return self.value
```

Crée les value objects suivants sur ce même pattern :
- RPPSNumber(value: str) — 11 chiffres
- Address(street: str, lat: float | None = None, lon: float | None = None)
  avec méthode has_coordinates() → bool
- TimeWindow(start: datetime.time, end: datetime.time)
  avec méthodes : contains(t: time) → bool, overlaps(other: TimeWindow) → bool, duration_minutes() → int
- RecurrenceRule(rule: str)
  avec méthode generate_occurrences(from_date: date, to_date: date) → list[date]
  utilisant dateutil.rrule.rrulestr pour parser le RRULE

=== ENTITÉS (domain/entities/) ===

Utilise des dataclasses régulières (pas frozen, car mutables).
Utilise UUID pour les ids, avec default_factory=uuid4.
Voici la liste complète des entités à créer (voir architecture.md section 3 pour tous les champs) :
- Cabinet, User, CabinetMember
- Patient (note : les champs sensibles sont juste des str ici dans le domain, le chiffrement est dans infrastructure)
- CareProtocol
- Appointment
- Tournee, TourneeStop
- Transmission
- Invoice, InvoiceLine
- CareTypeCatalog
- AuditLog

Chaque entité dans son propre fichier. Ajoute un __init__.py dans entities/ qui ré-exporte tout.

=== REPOSITORY INTERFACES (domain/repositories/) ===

Interfaces ABC. Voici le pattern attendu :

```python
# Exemple : patient_repository.py
from abc import ABC, abstractmethod
from uuid import UUID
from app.domain.entities.patient import Patient

class PatientRepository(ABC):
    @abstractmethod
    async def get_by_id(self, patient_id: UUID) -> Patient | None: ...

    @abstractmethod
    async def list_by_cabinet(
        self, cabinet_id: UUID, status: str = "active",
        search: str | None = None, skip: int = 0, limit: int = 50
    ) -> tuple[list[Patient], int]: ...

    @abstractmethod
    async def create(self, patient: Patient) -> Patient: ...

    @abstractmethod
    async def update(self, patient: Patient) -> Patient: ...

    @abstractmethod
    async def archive(self, patient_id: UUID, reason: str) -> None: ...
```

Crée les interfaces pour : PatientRepository, AppointmentRepository, TourneeRepository, TransmissionRepository, InvoiceRepository, CabinetRepository, UserRepository.
Chacune avec les méthodes CRUD adaptées à l'entité.
AppointmentRepository doit avoir : list_by_date(cabinet_id, idel_id, date), list_by_patient(patient_id), check_time_conflict(idel_id, scheduled_at, duration_minutes, exclude_id?).
TourneeRepository doit avoir : get_by_date(cabinet_id, idel_id, date), save_with_stops(tournee, stops).

=== SERVICE INTERFACES (domain/services/) ===

Interfaces ABC pour les services externes :

```python
# routing_service.py
class RoutingService(ABC):
    @abstractmethod
    async def get_distance_matrix(
        self, origins: list[tuple[float, float]], destinations: list[tuple[float, float]]
    ) -> list[list[float]]: ...
    """Retourne matrice de distances en km."""

    @abstractmethod
    async def get_duration_matrix(
        self, origins: list[tuple[float, float]], destinations: list[tuple[float, float]]
    ) -> list[list[float]]: ...
    """Retourne matrice de durées en minutes."""
```

Crée : RoutingService, GeocodingService(geocode_address → Address), TranscriptionService(transcribe_audio → str), SynthesisService(generate_summary → dict).

=== RÈGLES MÉTIER (domain/rules/) ===

Fonctions pures qui encodent les règles du domaine IDEL.

appointment_rules.py :
- check_no_time_conflict(existing: list[Appointment], new_start: datetime, new_duration: int, exclude_id: UUID | None = None) → bool
  Vérifie qu'aucun RDV existant ne chevauche le nouveau créneau.
- validate_within_work_hours(scheduled_at: datetime, duration: int, work_start: time, work_end: time) → bool
  Vérifie que le RDV tient dans les horaires de travail.

tournee_rules.py :
- validate_lunch_break(stops: list[TourneeStop], lunch_start: time, lunch_duration: int) → bool
  Vérifie que la pause déjeuner est respectée dans la tournée.
- build_time_windows(appointments: list[Appointment]) → list[tuple[int, int]]
  Convertit les appointments en fenêtres temporelles pour OR-Tools (minutes depuis minuit).

care_protocol_rules.py :
- generate_appointments_from_protocol(protocol: CareProtocol, idel_id: UUID, from_date: date, to_date: date) → list[Appointment]
  Utilise RecurrenceRule pour générer les Appointments. Status=scheduled, created_by=protocol.

=== TESTS (tests/unit/) ===

Crée des tests pytest pour :
- test_value_objects.py : validation RPPSNumber (valide, invalide), TimeWindow.overlaps (cas qui overlap, cas qui n'overlap pas), RecurrenceRule.generate_occurrences (quotidien, hebdo lun-mer-ven)
- test_appointment_rules.py : conflit horaire détecté, pas de conflit, hors horaires de travail
- test_care_protocol_rules.py : génération appointments depuis protocole quotidien, hebdomadaire

Les tests ne doivent utiliser AUCUNE base de données, uniquement des entités instanciées en mémoire.
```

**✅ Checkpoint 1 :** Lance `pytest tests/unit/ -v`. Tous les tests doivent passer. Vérifie que le dossier `domain/` n'importe rien de `infrastructure/` ou `application/` (aucun import sqlalchemy, fastapi, etc.).

---

## PROMPT 2 — Infrastructure : sécurité + persistence

```
Consulte docs/architecture.md. On implémente maintenant la couche Infrastructure,
en commençant par la sécurité et la persistence (SQLAlchemy).

=== SÉCURITÉ (infrastructure/security/) ===

encryption.py — Chiffrement AES-256-GCM :

```python
# Pattern attendu (utilise cryptography.hazmat)
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import os

def encrypt(plaintext: str, key: bytes, associated_data: bytes | None = None) -> bytes:
    """Chiffre avec AES-256-GCM. Retourne nonce (12 bytes) + ciphertext."""
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), associated_data)
    return nonce + ct

def decrypt(ciphertext: bytes, key: bytes, associated_data: bytes | None = None) -> str:
    """Déchiffre AES-256-GCM. Input = nonce (12 bytes) + ciphertext."""
    aesgcm = AESGCM(key)
    nonce = ciphertext[:12]
    ct = ciphertext[12:]
    return aesgcm.decrypt(nonce, ct, associated_data).decode("utf-8")
```

Implémente ce module complet avec aussi : derive_key(master_key: str, context: str) → bytes (HKDF-SHA256 pour dériver une clé par cabinet) et compute_search_hash(value: str, key: bytes) → str (HMAC-SHA256 pour recherche par nom).

key_manager.py :
```python
class KeyManager:
    def __init__(self, master_key: str):
        self._master_key = master_key

    def get_cabinet_key(self, cabinet_id: UUID) -> bytes:
        """Dérive une clé unique par cabinet depuis la master key."""
        return derive_key(self._master_key, f"cabinet:{cabinet_id}")
```

password_handler.py : hash_password(password) → str, verify_password(password, hash) → bool. Utilise passlib bcrypt.

jwt_handler.py : create_access_token(user_id, cabinet_id, role, expires_minutes=30) → str, create_refresh_token(user_id, expires_days=7) → str, verify_token(token) → dict (payload). Utilise python-jose.

=== PERSISTENCE (infrastructure/persistence/) ===

database.py :
- create_async_engine avec DATABASE_URL
- async_sessionmaker
- async def get_db() → AsyncGenerator[AsyncSession] (dependency FastAPI)

models/ — Modèles SQLAlchemy 2.0 avec Mapped[] :

Pour les colonnes chiffrées, utilise ce pattern avec un hybrid_property :

```python
# Exemple pour patient_model.py
from sqlalchemy import Column, LargeBinary, String
from sqlalchemy.ext.hybrid import hybrid_property

class PatientModel(Base):
    __tablename__ = "patients"

    id = mapped_column(UUID, primary_key=True, server_default=func.gen_random_uuid())
    cabinet_id = mapped_column(UUID, ForeignKey("cabinets.id"), nullable=False, index=True)

    # Colonnes chiffrées stockées en binaire
    _first_name_encrypted = mapped_column("first_name_encrypted", LargeBinary, nullable=False)
    _last_name_encrypted = mapped_column("last_name_encrypted", LargeBinary, nullable=False)
    # ... idem pour birth_date, phone, email, address, pathologies, notes

    # Hash pour recherche par nom
    first_name_search_hash = mapped_column(String(64), index=True)
    last_name_search_hash = mapped_column(String(64), index=True)

    # Colonnes en clair (non identifiantes ou nécessaires pour requêtes)
    lat = mapped_column(Numeric(10, 8), nullable=True)
    lon = mapped_column(Numeric(11, 8), nullable=True)
    preferred_time_slot = mapped_column(String(20), nullable=True)
    care_duration_default = mapped_column(Integer, default=30)
    status = mapped_column(String(20), default="active", index=True)
    # ...timestamps...
```

Note : le chiffrement/déchiffrement réel se fait dans le repository, pas dans le model directement, car il a besoin du KeyManager (injection de dépendance). Le model stocke juste des bytes.

Crée TOUS les models : CabinetModel, UserModel, CabinetMemberModel, PatientModel, CareProtocolModel, AppointmentModel, TourneeModel, TourneeStopModel, TransmissionModel, InvoiceModel, InvoiceLineModel, CareTypeCatalogModel, AuditLogModel.

Chaque model avec : UUID PK, timestamps (created_at server_default=func.now(), updated_at onupdate=func.now()), les indexes importants, et les ForeignKey avec les bonnes cascades.

base.py : DeclarativeBase avec convention de nommage pour les contraintes (facilite Alembic).

repositories/ — Implémentations SQLAlchemy des interfaces domain :

Commence par sqlalchemy_patient_repo.py comme exemple complet :
- Implémente PatientRepository
- Injecte AsyncSession et KeyManager
- create() : chiffre les champs sensibles, calcule search_hash, insère
- get_by_id() : récupère, déchiffre, retourne entité domain Patient
- list_by_cabinet() : filtre par cabinet_id (RLS en plus), search via search_hash, pagination
- update() : re-chiffre les champs modifiés
- archive() : soft delete

Puis crée les repos pour : Appointment, Tournee, Cabinet, User (au minimum).

=== ALEMBIC ===

Configure alembic :
- alembic.ini pointant vers DATABASE_URL_SYNC (alembic ne supporte pas async nativement)
- env.py qui importe target_metadata depuis models/base.py
- Première migration "001_initial_schema" qui crée TOUTES les tables
- Dans la migration, ajoute les commandes RLS :
  ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
  (et pour toutes les tables métier)
  CREATE POLICY sur chaque table filtrant par cabinet_id

=== TESTS ===

tests/unit/test_encryption.py :
- Test encrypt/decrypt roundtrip
- Test que le ciphertext est différent du plaintext
- Test derive_key produit des clés différentes pour des contexts différents
- Test compute_search_hash est déterministe

tests/integration/conftest.py :
- Fixture qui crée une BDD PostgreSQL de test (utilise le même docker-compose, db=idel_db_test)
- Fixture async session
- Fixture qui applique les migrations

tests/integration/test_patient_repo.py :
- Test create + get_by_id (vérifie que les données sont déchiffrées correctement)
- Test list_by_cabinet avec search
- Test archive
```

**✅ Checkpoint 2 :** Lance `pytest tests/unit/test_encryption.py -v` (doit passer sans BDD). Puis `alembic upgrade head` pour vérifier que la migration s'applique. Connecte-toi à Adminer et vérifie que toutes les tables sont créées avec les bonnes colonnes. Lance les tests d'intégration si la BDD de test est configurée.

---

## PROMPT 3 — Infrastructure : API FastAPI

```
Consulte docs/architecture.md. On ajoute maintenant la couche API HTTP (FastAPI).

=== CONFIG (app/config.py) ===

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    redis_url: str
    secret_key: str
    encryption_master_key: str
    openrouteservice_api_key: str = ""
    environment: str = "development"
    debug: bool = True

    # JWT
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    class Config:
        env_file = ".env"

settings = Settings()
```

=== MIDDLEWARE (infrastructure/api/middleware.py) ===

Implémente :

1. RLS Middleware : après authentification, exécute SET app.current_cabinet_id = '{cabinet_id}' sur la session PostgreSQL. Ça active le Row Level Security.

2. Audit Middleware : pour les requêtes POST/PATCH/DELETE, log dans audit_log (user_id, cabinet_id, entity_type déduit du path, action déduite du method).

3. CORS : autorise localhost:* en dev, domaine spécifique en prod.

=== DEPENDENCIES (infrastructure/api/dependencies.py) ===

```python
# Pattern d'injection attendu :
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> UserModel:
    """Extrait et valide le JWT, retourne l'utilisateur."""
    ...

async def get_current_cabinet(user: UserModel = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> CabinetModel:
    """Retourne le cabinet actif de l'utilisateur."""
    ...

def get_key_manager() -> KeyManager:
    return KeyManager(settings.encryption_master_key)

def get_patient_repository(db: AsyncSession = Depends(get_db), km: KeyManager = Depends(get_key_manager)) -> SQLAlchemyPatientRepo:
    return SQLAlchemyPatientRepo(db, km)

# Idem pour les autres repositories...
```

=== SCHEMAS (infrastructure/api/schemas/) ===

Pydantic v2 models pour request/response. Séparés des DTOs application.

patient_schemas.py :
- PatientCreate(first_name, last_name, birth_date, address, phone?, email?, pathologies?, preferred_time_slot?, care_duration_default?, notes?)
- PatientUpdate (tous les champs optionnels)
- PatientResponse(id, first_name, last_name, birth_date, address, lat?, lon?, phone?, email?, pathologies?, preferred_time_slot, care_duration_default, notes?, status, created_at, updated_at) — données déchiffrées
- PatientListResponse(items: list[PatientResponse], total: int)

Crée les schemas pour : Auth (RegisterRequest, LoginRequest, TokenResponse), Appointment, CareProtocol, Tournee.

=== ROUTES ===

auth_routes.py :
- POST /register : crée User + Cabinet solo + CabinetMember(role=admin). Retourne tokens.
- POST /login : vérifie credentials, retourne tokens.
- POST /refresh : vérifie refresh token, retourne nouveau pair.

patient_routes.py :
- GET / : list patients du cabinet (pagination, search)
- POST / : crée patient. Géocode l'adresse automatiquement via GeocodingService (pour le MVP, utilise un stub ou Nominatim). Retourne 201.
- GET /{id} : détail patient avec ses care_protocols et prochains RDV
- PATCH /{id} : mise à jour partielle
- DELETE /{id}?reason=... : archive (soft delete)

appointment_routes.py :
- GET / : list par date/idel/patient (query params)
- POST / : crée RDV. Vérifie conflit horaire via appointment_rules.
- PATCH /{id} : modifie
- POST /{id}/cancel : annule avec raison
- POST /{id}/complete : marque comme réalisé

care_protocol_routes.py :
- POST / : crée protocole + génère appointments 4 semaines
- GET /?patient_id=... : list protocoles d'un patient

=== MAIN (app/main.py) ===

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup : vérifier connexion BDD, Redis
    yield
    # Shutdown : fermer connexions

app = FastAPI(
    title="IDEL Assistant API",
    version="0.1.0",
    lifespan=lifespan,
)

# Inclure middleware
# Inclure routers avec prefix /api/v1
```

=== TESTS API ===

tests/api/conftest.py :
- Fixture app de test avec BDD de test
- Fixture client httpx (AsyncClient)
- Fixture pour créer un utilisateur authentifié et obtenir son token

tests/api/test_auth_routes.py :
- Test register → 201, retourne tokens
- Test login avec bon password → 200
- Test login avec mauvais password → 401
- Test refresh token → 200 nouveaux tokens

tests/api/test_patient_routes.py :
- Test create patient → 201, vérifie les champs retournés
- Test list patients (vide puis après création)
- Test get patient by id
- Test update patient
- Test archive patient
- Test qu'un user ne voit PAS les patients d'un autre cabinet (isolation RLS)

Lance le serveur avec : uvicorn app.main:app --reload --port 8000
Swagger dispo sur : http://localhost:8000/docs
```

**✅ Checkpoint 3 :** Lance `uvicorn app.main:app --reload`. Ouvre http://localhost:8000/docs et vérifie que tous les endpoints apparaissent. Teste manuellement : register → login → create patient → list patients. Lance `pytest tests/api/ -v`.

---

## PROMPT 4 — Optimisation de tournées (killer feature)

```
Consulte docs/architecture.md. On implémente la feature d'optimisation de tournées
avec OR-Tools (Vehicle Routing Problem with Time Windows - VRPTW).

=== SOLVER (infrastructure/optimization/ortools_solver.py) ===

Implémente un solver OR-Tools qui :

Input :
- depot: tuple[float, float] (point de départ, domicile IDEL)
- stops: list[dict] avec pour chaque stop :
  - location: tuple[float, float]
  - duration_minutes: int (durée du soin)
  - time_window: tuple[int, int] (minutes depuis minuit, ex: (480, 600) = 8h-10h)
    Si pas de contrainte horaire, utiliser (480, 1080) = 8h-18h
- distance_matrix: list[list[float]] (distances en mètres entre tous les points, incluant depot)
- duration_matrix: list[list[float]] (durées en secondes entre tous les points)
- lunch_break: tuple[int, int, int] (start_minute, end_minute, duration_minutes)

Output :
- ordered_stop_indices: list[int] (ordre optimal des stops)
- total_distance_km: float
- total_duration_hours: float
- arrival_times: list[datetime.time] (heure d'arrivée estimée à chaque stop)
- status: str ("optimal" | "feasible" | "no_solution")

Utilise :
- ortools.constraint_solver routing_enums_pb2, pywrapcp
- 1 véhicule (l'IDEL)
- Dimension "Time" pour les fenêtres temporelles
- Break pour la pause déjeuner
- Timeout solver : 5 secondes (largement suffisant pour <30 stops)

Gère le cas où OR-Tools ne trouve pas de solution (contraintes incompatibles) :
retourne status="no_solution" avec un message explicatif.

=== CLIENT ROUTING (infrastructure/external/openrouteservice_client.py) ===

Implémente RoutingService via l'API OpenRouteService (gratuite, 2000 req/jour) :

POST https://api.openrouteservice.org/v2/matrix/driving-car
Headers: Authorization: {api_key}
Body: {"locations": [[lon,lat], ...], "metrics": ["distance","duration"]}

Retourne les matrices distance et durée.

Pour le développement, crée aussi un FakeRoutingService qui calcule les distances
à vol d'oiseau (Haversine) × 1.4 (facteur route) et les durées à 30 km/h moyen.
C'est suffisant pour les tests et les démos sans consommer l'API.

=== USE CASE (application/use_cases/tournees/optimize_tournee.py) ===

```python
class OptimizeTourneeUseCase:
    def __init__(
        self,
        appointment_repo: AppointmentRepository,
        patient_repo: PatientRepository,
        tournee_repo: TourneeRepository,
        routing_service: RoutingService,
        solver: ORToolsSolver,
    ):
        ...

    async def execute(self, cabinet_id: UUID, idel_id: UUID, date: date,
                      start_location: tuple[float, float] | None = None) -> TourneeDTO:
        # 1. Récupérer les appointments du jour pour cette IDEL
        # 2. Récupérer les patients associés (pour les coordonnées)
        # 3. Obtenir la matrice de distances via routing_service
        # 4. Appliquer les règles métier (build_time_windows, lunch_break)
        # 5. Lancer le solver
        # 6. Créer et sauvegarder Tournee + TourneeStops
        # 7. Calculer les savings (vs ordre original)
        # 8. Retourner TourneeDTO avec toutes les infos
```

=== ROUTE API ===

tournee_routes.py :
- POST /api/v1/tournees/optimize : optimise la tournée du jour
  Body: {date: "2026-02-20", idel_id?: uuid, start_location?: {lat, lon}, end_location?: {lat, lon}}
  Response: 200 avec tournée complète (stops ordonnés, distances, savings, heures estimées)

- GET /api/v1/tournees/{id} : détail d'une tournée

- POST /api/v1/tournees/{id}/reoptimize : ré-optimise après annulation
  Body: {removed_appointment_ids: [uuid]}

- GET /api/v1/tournees/stats?from=...&to=... : statistiques (km économisés, temps gagné)

=== DÉMO VISUELLE (optionnel mais recommandé) ===

Crée un script backend/scripts/demo_tournee.py qui :
1. Génère 8 patients fictifs dans l'agglomération nantaise (coordonnées réalistes)
2. Crée 8 appointments pour aujourd'hui
3. Lance l'optimisation avec le FakeRoutingService
4. Génère une carte HTML avec Folium montrant :
   - Le trajet optimisé (ligne bleue, numérotée)
   - Le trajet non optimisé (ligne rouge pointillée)
   - Les marqueurs patients avec popup (nom, heure estimée, type soin)
   - Un encadré "Gain : X km, X minutes"
5. Sauvegarde dans demo_output/tournee_demo.html

Utilise des noms de rues réels de Nantes et sa périphérie pour le réalisme.

=== TESTS ===

tests/unit/test_ortools_solver.py :
- Test avec 5 stops en carré → vérifie que l'ordre minimise la distance
- Test avec time windows incompatibles → retourne no_solution
- Test avec pause déjeuner → vérifie qu'aucun soin pendant la pause

tests/integration/test_tournee_optimization.py :
- Test complet : créer patients + appointments + optimiser + vérifier la tournée sauvegardée
```

**✅ Checkpoint 4 :** Lance `python scripts/demo_tournee.py` et ouvre la carte HTML. Tu dois voir les 8 patients sur la carte de Nantes avec le trajet optimisé. C'est cette démo que tu montreras à ta femme. Lance les tests : `pytest tests/unit/test_ortools_solver.py -v`.

---

## RÉSUMÉ DE LA SÉQUENCE

```
Prompt 0 : Setup (30 min)          → Structure + Docker + venv
Prompt 1 : Domain (1-2h)           → Entités, règles, tests unitaires
Prompt 2 : Persistence (2-3h)      → SQLAlchemy, chiffrement, migrations
Prompt 3 : API (2-3h)              → FastAPI, auth, CRUD, tests API
Prompt 4 : Tournées (2-3h)         → OR-Tools, optimisation, démo carte

Total estimé : 1-2 jours de travail
Résultat : backend fonctionnel + démo visuelle de la killer feature
```

Après chaque prompt, prends le temps de vérifier le checkpoint.
Si Claude Code génère quelque chose qui ne compile pas ou ne passe pas les tests,
demande-lui de corriger avant de passer au prompt suivant.
