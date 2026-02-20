# PROMPTS DE REVIEW — IDEL Assistant
## À exécuter dans Claude Code après chaque prompt de génération

**Mode d'emploi :**
1. Exécute le prompt de génération (Prompt 0, 1, 2, 3 ou 4)
2. Vérifie le checkpoint technique (tests, docker, etc.)
3. Exécute le prompt de review correspondant ci-dessous
4. Corrige les problèmes identifiés AVANT de passer au prompt suivant
5. Commit quand la review est clean

---

## REVIEW 0 — Après le setup projet

```
Tu es un DevOps senior. Audite le setup du projet qu'on vient de générer.

Vérifie les points suivants et liste chaque problème trouvé avec sa sévérité
(CRITIQUE / IMPORTANT / MINEUR) :

1. docker-compose.yml :
   - PostgreSQL 16 avec extensions PostGIS et pg_trgm activées
   - Redis 7
   - Volumes nommés (pas de bind mounts) pour la persistence
   - Healthchecks configurés sur PostgreSQL et Redis
   - Le réseau permet la communication entre services

2. Dépendances Python :
   - Toutes les librairies listées dans docs/architecture.md section "Stack technique" sont présentes
   - Les versions sont pinnées (pas de >= sans borne supérieure)
   - requirements-dev.txt inclut bien les outils de test et linting

3. Configuration :
   - .env contient toutes les variables nécessaires (DATABASE_URL, REDIS_URL, SECRET_KEY, ENCRYPTION_MASTER_KEY, OPENROUTESERVICE_API_KEY)
   - .gitignore exclut bien .env, __pycache__, .venv, docker volumes
   - pytest.ini est configuré avec asyncio_mode = auto

4. Structure des dossiers :
   - L'arborescence correspond exactement à celle définie dans docs/architecture.md section 4.1
   - Tous les __init__.py sont présents
   - Les 3 couches sont bien séparées : domain/, application/, infrastructure/

5. CLAUDE.md :
   - Les commandes documentées fonctionnent réellement
   - Les conventions sont cohérentes avec le reste de la config

Pour chaque problème, donne la correction exacte à appliquer.
Si tout est OK sur un point, confirme avec ✅.
```

---

## REVIEW 1 — Après le Domain Layer

```
Tu es un architecte logiciel senior spécialisé en Domain-Driven Design.
Audite la couche Domain (app/domain/) qu'on vient de générer.

Consulte docs/architecture.md pour le modèle de données de référence.

RÈGLE ABSOLUE à vérifier en premier :
Exécute cette commande et rapporte le résultat :
  Select-String -Path "app\domain\**\*.py" -Pattern "sqlalchemy|fastapi|httpx|redis|celery|cryptography" -Recurse
Si elle retourne quoi que ce soit, c'est un problème CRITIQUE — le domain layer
ne doit avoir AUCUNE dépendance externe (sauf stdlib + python-dateutil pour RRULE).

Puis vérifie chaque sous-dossier :

=== VALUE OBJECTS (domain/value_objects/) ===
Pour chaque value object :
- [ ] Est-il frozen (immutable) ?
- [ ] La validation dans __post_init__ couvre-t-elle les cas limites ?
  - RPPSNumber : 11 chiffres uniquement, pas de lettres, pas vide
  - TimeWindow : start < end, méthode overlaps() correcte (cas adjacents, contenus, disjoints)
  - Address : lat entre -90/90, lon entre -180/180 si fournis
  - RecurrenceRule : le RRULE est parsable par dateutil ? Que se passe-t-il avec un RRULE invalide ?
- [ ] Les __eq__ et __hash__ fonctionnent correctement pour comparaison ?

=== ENTITÉS (domain/entities/) ===
Pour chaque entité, vérifie :
- [ ] Tous les champs de docs/architecture.md section 3 sont présents
- [ ] Les types sont corrects (UUID, datetime, Decimal pour les montants, pas de float pour l'argent)
- [ ] Les champs enum utilisent des str ou des Enum Python (status, role, plan, etc.)
- [ ] Les relations sont exprimées (un Patient a un cabinet_id, pas un objet Cabinet)

Vérifie spécifiquement ces entités critiques :
- Patient : les champs sensibles (first_name, last_name, etc.) sont bien des str normaux
  dans le domain (le chiffrement est dans infrastructure, PAS ici)
- CareProtocol : a bien recurrence_rule (str), start_date, end_date (optionnel)
- Appointment : a bien care_protocol_id (optionnel), created_by avec les bonnes valeurs
- Tournee : a bien total_distance_km, total_duration_minutes, travel_time_minutes pour les métriques
- TourneeStop : a bien stop_order, estimated_arrival, actual_arrival, status
- Invoice/InvoiceLine : les montants sont en Decimal, pas en float
- AuditLog : a bien entity_type, entity_id, action, changes (dict)

=== REPOSITORY INTERFACES (domain/repositories/) ===
Pour chaque interface :
- [ ] C'est bien une ABC avec que des @abstractmethod
- [ ] Les méthodes async sont bien marquées async
- [ ] Les signatures de retour sont explicites (pas de Any)
- [ ] PatientRepository a bien : get_by_id, list_by_cabinet (avec search, pagination), create, update, archive
- [ ] AppointmentRepository a bien : list_by_date, list_by_patient, check_time_conflict
- [ ] TourneeRepository a bien : get_by_date, save_with_stops

=== SERVICE INTERFACES (domain/services/) ===
- [ ] RoutingService : get_distance_matrix et get_duration_matrix
- [ ] GeocodingService : geocode_address retourne un Address
- [ ] TranscriptionService : transcribe_audio retourne un str
- [ ] SynthesisService : generate_summary retourne un dict

=== RÈGLES MÉTIER (domain/rules/) ===
Vérifie la logique de chaque règle :

appointment_rules.py :
- [ ] check_no_time_conflict : gère correctement les cas limites
  (RDV qui se touchent sans se chevaucher, RDV contenus, RDV identique exclu)
- [ ] validate_within_work_hours : vérifie que tout le RDV (début + durée) est dans la plage

tournee_rules.py :
- [ ] validate_lunch_break : vérifie qu'aucun soin n'est pendant la pause
- [ ] build_daily_schedule : construit les stops ordonnés chronologiquement

care_protocol_rules.py :
- [ ] generate_appointments_from_protocol : utilise bien RecurrenceRule.generate_occurrences
- [ ] Les appointments générés ont status=scheduled, created_by=protocol
- [ ] Gère le cas end_date=None (protocole indéfini) → génère sur la période demandée
- [ ] Gère le cas où to_date < start_date → retourne liste vide

=== TESTS (tests/unit/) ===
- [ ] Chaque règle métier a au moins 3 tests (cas nominal, cas limite, cas d'erreur)
- [ ] Les value objects ont des tests de validation (valide + invalide)
- [ ] RecurrenceRule est testée avec : DAILY, WEEKLY;BYDAY=MO,WE,FR, MONTHLY
- [ ] TimeWindow.overlaps est testée avec au moins 4 cas
- [ ] Aucun test n'utilise de base de données ou de mock de framework externe

Pour chaque problème trouvé, donne :
1. Sévérité (CRITIQUE / IMPORTANT / MINEUR)
2. Fichier et ligne concernés
3. Le code corrigé
```

---

## REVIEW 2 — Après la Persistence + Sécurité

```
Tu es un security engineer spécialisé en applications healthcare et conformité HDS/RGPD.
Audite la couche Infrastructure/Security et Infrastructure/Persistence.

Consulte docs/architecture.md sections 5 (contrats API) et 6 (chiffrement).

=== SÉCURITÉ (infrastructure/security/) ===

encryption.py — CRITIQUE, erreur ici = fuite de données patients :
- [ ] Utilise AES-256-GCM (pas AES-CBC, pas Fernet)
- [ ] Le nonce est généré aléatoirement (os.urandom(12)) à CHAQUE appel encrypt
- [ ] Le nonce est préfixé au ciphertext (nonce + ct), pas stocké séparément
- [ ] Le paramètre associated_data (AAD) est supporté pour l'authenticated encryption
- [ ] decrypt vérifie l'intégrité (GCM le fait nativement, mais vérifie que l'exception est propagée si tampered)
- [ ] La clé fait bien 32 bytes (256 bits)
- [ ] derive_key utilise HKDF-SHA256 avec un salt et un context différent par cabinet
- [ ] compute_search_hash est déterministe (même input → même output) et utilise HMAC-SHA256
- [ ] Aucune clé ou donnée sensible n'est loggée (vérifie les print/logging)

Teste mentalement ces scénarios :
- Chiffrer "Marie" avec clé cabinet A, déchiffrer avec clé cabinet B → doit échouer
- Chiffrer "Marie" deux fois → les ciphertexts doivent être DIFFÉRENTS (nonce aléatoire)
- compute_search_hash("Dupont") deux fois → résultat IDENTIQUE
- compute_search_hash("dupont") vs compute_search_hash("Dupont") → décide si c'est
  case-insensitive (ça devrait l'être pour la recherche — normaliser en lowercase avant hash)

key_manager.py :
- [ ] Dérive une clé unique par cabinet_id
- [ ] Deux cabinet_id différents produisent des clés différentes
- [ ] La master key n'est jamais exposée ou retournée directement

jwt_handler.py :
- [ ] Access token a une durée courte (30 min max)
- [ ] Refresh token a une durée plus longue (7 jours)
- [ ] Le payload contient user_id, cabinet_id, role
- [ ] verify_token lève une exception claire si le token est expiré ou invalide
- [ ] L'algorithme est HS256 ou RS256, pas "none"

password_handler.py :
- [ ] Utilise bcrypt (pas MD5, pas SHA256 brut)
- [ ] Le salt est généré automatiquement par bcrypt

=== MODELS SQLAlchemy (infrastructure/persistence/models/) ===

Pour chaque model, vérifie :
- [ ] UUID primary key avec server_default=func.gen_random_uuid()
- [ ] created_at avec server_default=func.now()
- [ ] updated_at avec onupdate=func.now()
- [ ] Les ForeignKey pointent vers les bonnes tables
- [ ] Les indexes sont présents sur les colonnes filtrées fréquemment
  (cabinet_id, status, scheduled_at, patient_id)

PatientModel — le plus critique :
- [ ] Les colonnes sensibles sont stockées en LargeBinary (pas String)
  Colonnes chiffrées : first_name, last_name, birth_date, phone, email, address, pathologies, notes
- [ ] Les colonnes search_hash (first_name_search_hash, last_name_search_hash) sont String(64), indexées
- [ ] lat/lon sont en Numeric (pas Float), restent en clair
- [ ] Les colonnes non-sensibles (status, preferred_time_slot, care_duration_default) sont en clair

Vérifie que ces tables sont présentes :
cabinets, users, cabinet_members, patients, care_protocols, appointments,
tournees, tournee_stops, transmissions, invoices, invoice_lines,
care_type_catalog, audit_logs

=== REPOSITORIES SQLAlchemy ===

sqlalchemy_patient_repo.py — vérifie le flow chiffrement :
- [ ] create() : chiffre les champs sensibles AVANT insert, calcule search_hash
- [ ] get_by_id() : déchiffre les champs sensibles APRÈS select, retourne une entité domain Patient (pas un model SQLAlchemy)
- [ ] list_by_cabinet() : filtre par cabinet_id, search via search_hash (pas déchiffrement de toute la table !)
- [ ] update() : re-chiffre les champs modifiés, recalcule search_hash si nom changé
- [ ] archive() : soft delete (status="archived", archived_at=now, archived_reason=reason)
- [ ] Le KeyManager est injecté (pas importé en global)

=== ALEMBIC ===

- [ ] env.py importe target_metadata depuis les models
- [ ] La migration initiale crée TOUTES les tables
- [ ] Les commandes RLS sont présentes dans la migration :
  ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
  CREATE POLICY ... USING (cabinet_id = current_setting('app.current_cabinet_id')::UUID);
  (pour chaque table métier : patients, appointments, care_protocols, tournees, transmissions, invoices)
- [ ] La migration est réversible (downgrade supprime tables et policies)

=== TESTS ===

tests/unit/test_encryption.py :
- [ ] Test roundtrip encrypt → decrypt
- [ ] Test que deux chiffrements du même texte donnent des résultats différents
- [ ] Test déchiffrement avec mauvaise clé → exception
- [ ] Test derive_key donne des clés différentes par context
- [ ] Test search_hash déterministe
- [ ] Test search_hash case-insensitive (si implémenté)

tests/integration/ :
- [ ] Utilise une BDD de test séparée (pas la BDD de dev)
- [ ] Les fixtures nettoient les données entre les tests
- [ ] Test create patient → get_by_id : les données déchiffrées correspondent à l'original
- [ ] Test d'isolation RLS : user du cabinet A ne voit pas les patients du cabinet B

Pour chaque problème trouvé, donne :
1. Sévérité (CRITIQUE pour sécurité, IMPORTANT pour fonctionnel, MINEUR pour style)
2. Fichier et ligne
3. Risque concret (ex: "fuite de données patients si...")
4. Le code corrigé
```

---

## REVIEW 3 — Après l'API FastAPI

```
Tu es un développeur senior backend spécialisé en API REST et sécurité web.
Audite les routes FastAPI, middleware et schemas.

Consulte docs/architecture.md section 5 (contrats API) et docs/PRD.md section 7
(endpoints API).

=== MIDDLEWARE (infrastructure/api/middleware.py) ===

RLS Middleware :
- [ ] Exécute SET app.current_cabinet_id = '{cabinet_id}' sur CHAQUE requête authentifiée
- [ ] Le cabinet_id vient du JWT (pas d'un header client manipulable)
- [ ] La requête SET est exécutée AVANT le traitement de la route
- [ ] Protégé contre l'injection SQL (cabinet_id est un UUID validé, pas une string brute)
- [ ] Les routes non authentifiées (register, login) ne passent PAS par le RLS

Audit Middleware :
- [ ] Log les opérations d'écriture (POST, PATCH, DELETE) dans audit_logs
- [ ] Capture : user_id, cabinet_id, entity_type (déduit du path), action (déduit du method), IP
- [ ] Ne log PAS le body de la requête (il peut contenir des données patients sensibles)
- [ ] Ne bloque pas la réponse si le logging échoue (try/except, log l'erreur mais continue)

CORS :
- [ ] Autorise localhost en développement
- [ ] Ne met PAS allow_origins=["*"] en production

=== DEPENDENCIES (infrastructure/api/dependencies.py) ===

- [ ] get_current_user extrait le user_id du JWT et le récupère en BDD
- [ ] Si le token est invalide ou expiré → retourne 401 (pas 500)
- [ ] Si l'utilisateur n'existe pas en BDD → retourne 401
- [ ] get_current_cabinet retourne le cabinet actif de l'utilisateur
- [ ] Les repositories sont injectés via Depends() avec session et KeyManager
- [ ] Le KeyManager est instancié UNE fois (singleton ou dependency cached)

=== SCHEMAS (infrastructure/api/schemas/) ===

Vérifie pour chaque schema :
- [ ] Les champs sensibles NE SONT PAS exposés dans les réponses
  (password_hash ne doit JAMAIS apparaître dans un schema Response)
- [ ] Les champs obligatoires vs optionnels correspondent au contrat API
  dans docs/architecture.md section 5
- [ ] Les validations Pydantic sont pertinentes :
  - email : EmailStr ou regex
  - phone : format français (+33 ou 0X)
  - birth_date : pas dans le futur
  - rpps : 11 chiffres
  - duration_minutes : > 0
  - care_type : valeurs autorisées ou string libre ?

=== ROUTES ===

auth_routes.py :
- [ ] POST /register crée User + Cabinet (plan=solo) + CabinetMember (role=admin) en une transaction
- [ ] Si l'email existe déjà → 409 Conflict (pas 500)
- [ ] Si le RPPS existe déjà → 409 Conflict
- [ ] Le password est hashé AVANT stockage
- [ ] La réponse contient access_token + refresh_token
- [ ] POST /login vérifie le password avec bcrypt (timing-safe)
- [ ] Login échoué → 401 avec message générique (pas "email inconnu" vs "mauvais password")
- [ ] POST /refresh valide le refresh token et retourne une nouvelle paire

patient_routes.py :
- [ ] Toutes les routes nécessitent l'authentification (Depends(get_current_user))
- [ ] POST crée un patient rattaché au cabinet_id du user (pas un cabinet_id fourni par le client)
- [ ] GET list filtre automatiquement par cabinet_id (RLS + filtre applicatif)
- [ ] Le géocodage de l'adresse est appelé à la création (async, ne bloque pas si ça échoue)
- [ ] DELETE est un soft delete (archive), pas un vrai DELETE
- [ ] PATCH ne permet PAS de changer le cabinet_id d'un patient

appointment_routes.py :
- [ ] POST vérifie les conflits horaires AVANT création (appointment_rules.check_no_time_conflict)
- [ ] POST vérifie que le patient_id appartient au même cabinet
- [ ] POST /cancel demande une raison
- [ ] POST /complete met à jour le status

care_protocol_routes.py :
- [ ] POST crée le protocole ET génère les appointments des 4 prochaines semaines
- [ ] Si le RRULE est invalide → 422 avec message clair

=== MAIN (app/main.py) ===

- [ ] Lifespan vérifie la connexion BDD au startup
- [ ] Les routers sont inclus avec le prefix /api/v1
- [ ] Le middleware est appliqué dans le bon ordre (CORS → Audit → RLS)
- [ ] Le Swagger est accessible en dev (/docs)

=== TESTS API ===

- [ ] test_auth : register, login success, login fail, refresh
- [ ] test_patients : CRUD complet + test d'isolation cabinet
- [ ] test_appointments : create, cancel, complete, test conflit horaire
- [ ] Les tests utilisent un client authentifié (fixture avec token)
- [ ] Les tests nettoient les données entre chaque test

=== TEST MANUEL RAPIDE ===

Lance ces commandes et vérifie les réponses :

1. Register :
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.fr","password":"Test1234!","first_name":"Sophie","last_name":"Martin","rpps":"12345678901","phone":"0601020304"}'
   → Doit retourner 201 avec tokens

2. Login :
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.fr","password":"Test1234!"}'
   → Doit retourner 200 avec tokens

3. Create patient (avec le token du login) :
   curl -X POST http://localhost:8000/api/v1/patients \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer {TOKEN}" \
     -d '{"first_name":"Marie","last_name":"Dupont","birth_date":"1955-03-15","address":"12 rue de la Paix, 44000 Nantes","phone":"0602030405"}'
   → Doit retourner 201

4. Vérifie dans Adminer que first_name_encrypted est bien du binaire illisible (pas "Marie" en clair)

Pour chaque problème trouvé, donne :
1. Sévérité
2. Fichier et ligne
3. Impact utilisateur ou sécurité
4. Le code corrigé
```

---

## REVIEW 4 — Après la suggestion de créneaux

```
Tu es un product manager avec expertise en optimisation logistique.
Audite le moteur de suggestion de créneaux et la visualisation des tournées.

Consulte docs/architecture-update-tournees.md pour les exigences.

=== RÈGLE MÉTIER FONDAMENTALE ===
- [ ] CRITIQUE : Aucune partie du code ne réordonne des RDV existants
- [ ] Le moteur suggère des créneaux pour de NOUVEAUX RDV uniquement
- [ ] Les RDV existants sont traités comme des contraintes fixes

=== ALGORITHME DE SUGGESTION ===

- [ ] find_available_slots identifie correctement les trous entre RDV
- [ ] La pause déjeuner est exclue des suggestions
- [ ] Le calcul de détour est correct : (A→new + new→B) - A→B
- [ ] Le scoring pondère : détour 40%, secteur 25%, préférence horaire 20%, confort 15%
- [ ] Les suggestions sont triées par score décroissant
- [ ] Maximum 3 suggestions retournées
- [ ] Si aucun créneau ne tient → retourne liste vide avec message explicatif
- [ ] Les horaires suggérés respectent les horaires de travail de l'IDEL

Cas limites :
- [ ] Journée vide → suggère en début de matinée
- [ ] Un seul RDV existant → 2 trous (avant et après)
- [ ] Patient sans coordonnées → erreur claire, pas de crash
- [ ] Durée de soin > trou disponible → ce trou n'est pas proposé

=== LOCATION TYPE ===
- [ ] RDV 'home' : time_window de 30 min (ex: 9h00-9h30)
- [ ] RDV 'office' : time_window_start = time_window_end (horaire fixe)
- [ ] La suggestion adapte la fenêtre selon le location_type

=== SECTEURS ===
- [ ] Les patients sont rattachés automatiquement à un secteur via postal_code
- [ ] Le bonus secteur dans le score fonctionne (même secteur que RDV adjacents)
- [ ] CRUD secteurs fonctionne (create, list, update, delete)
- [ ] Un patient sans secteur ne cause pas de crash

=== TOURNÉE DU JOUR ===
- [ ] GET /tournees/today retourne les stops dans l'ORDRE CHRONOLOGIQUE (pas optimisé)
- [ ] Les métriques sont réalistes (distance totale, temps trajet)
- [ ] detect_scheduling_inefficiencies identifie les allers-retours
- [ ] Les suggestions d'amélioration sont informatives, pas des actions automatiques

=== DÉMO ===
- [ ] La carte affiche les 3 secteurs en couleurs distinctes
- [ ] Les patients existants et les suggestions sont bien visibles
- [ ] L'explication de chaque suggestion est compréhensible par une IDEL non technique
- [ ] Les distances et temps affichés sont réalistes pour Nantes

Pour chaque problème, donne sévérité, fichier, et correction.
```

---

## REVIEW FINALE — Vue d'ensemble après tous les prompts

```
Tu es un CTO qui fait une revue technique complète avant une demo produit.
Le projet doit être présentable à un utilisateur métier (infirmière libérale).

Fais une passe rapide sur l'ensemble du projet et vérifie :

=== COHÉRENCE GLOBALE ===
- [ ] Toutes les entités du domain sont bien mappées vers des models SQLAlchemy
- [ ] Tous les models ont bien une migration Alembic
- [ ] Tous les repositories du domain ont une implémentation dans infrastructure
- [ ] Tous les endpoints du contrat API (docs/architecture.md section 5) sont implémentés
- [ ] Le principe de dépendance est respecté partout (domain ← application ← infrastructure)

=== SÉCURITÉ ===
- [ ] Aucun mot de passe en clair dans le code ou les logs
- [ ] Aucune clé de chiffrement en clair dans le code (uniquement dans .env)
- [ ] Le .env n'est PAS versionné (vérifie .gitignore)
- [ ] Les données patients en BDD sont bien chiffrées (vérifie dans Adminer)
- [ ] Le RLS est actif (un user ne peut pas accéder aux données d'un autre cabinet)

=== QUALITÉ ===
- [ ] Tous les tests passent : pytest --cov=app tests/ -v
- [ ] Couverture de code > 60% (acceptable pour un MVP)
- [ ] Pas de TODO/FIXME critiques laissés dans le code
- [ ] Le serveur démarre sans erreur
- [ ] Le Swagger fonctionne et documente tous les endpoints

=== DÉMO-READY ===
- [ ] Le script demo_suggestion.py génère une carte propre
- [ ] Le flow complet fonctionne : register → create patients → create appointments → suggérer créneau → voir la carte
- [ ] Les suggestions affichées sont réalistes et pertinentes

=== DETTE TECHNIQUE ACCEPTÉE (à noter pour plus tard) ===
Liste ce qui manque mais est acceptable pour un MVP :
- Stubs non implémentés (whisper, mistral, etc.)
- Tests manquants
- Endpoints manquants
- Aspects performance non optimisés

Donne un verdict global : PRÊT POUR DEMO / CORRECTIONS NÉCESSAIRES / PROBLÈMES BLOQUANTS
Avec la liste ordonnée des corrections par priorité.
```
