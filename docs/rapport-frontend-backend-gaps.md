# Rapport comparatif Frontend v2 / Backend — Gaps & Sécurité

> Date : 2026-02-23 | Auteur : Claude Opus 4.6

---

## 1. Comparaison des modèles de données

### 1.1 Patient

| Champ Frontend | Champ Backend (DB) | Statut | Notes |
|---|---|---|---|
| `id` | `id` (UUID) | OK | Frontend utilise `p_<timestamp>`, backend UUID |
| `firstName` | `first_name_encrypted` (AES-256-GCM) | OK | Chiffré en BDD |
| `lastName` | `last_name_encrypted` (AES-256-GCM) | OK | Chiffré en BDD |
| `phone` | `phone_encrypted` (AES-256-GCM) | OK | Chiffré en BDD |
| `email` | `email_encrypted` (AES-256-GCM) | OK | Chiffré en BDD |
| `address` | `address_encrypted` (AES-256-GCM) | OK | Chiffré en BDD |
| `ssn` | `ssn_encrypted` (AES-256-GCM) | **CORRIGÉ** | Ajouté dans migration 007 |
| `doctorName` | `doctor_name_encrypted` (AES-256-GCM) | **CORRIGÉ** | Ajouté dans migration 007 |
| `doctorContact` | `doctor_contact_encrypted` (AES-256-GCM) | **CORRIGÉ** | Ajouté dans migration 007 |
| `antecedents` | `pathologies_encrypted` (AES-256-GCM) | **PARTIEL** | Backend stocke `list[str]`, frontend un texte libre |
| `notes` | `notes_encrypted` (AES-256-GCM) | OK | Chiffré en BDD |
| `active` (bool) | `status` ("active"/"archived") | OK | Mapping à faire |
| `prescriptions[]` | via `care_protocols` | **PARTIEL** | Voir section 1.2 |
| — | `birth_date_encrypted` | **ABSENT DU FRONTEND** | Existe en BDD, pas dans le frontend |
| — | `lat`, `lon` | **ABSENT DU FRONTEND** | Géolocalisation (backend) |
| — | `postal_code`, `city` | **ABSENT DU FRONTEND** | Séparés en backend, fusionnés dans `address` en frontend |
| — | `sector_id` | **ABSENT DU FRONTEND** | Secteur géographique |
| — | `preferred_time_slot` | **ABSENT DU FRONTEND** | Préférence horaire |
| — | `care_duration_default` | **ABSENT DU FRONTEND** | Durée soins par défaut |

### 1.2 Prescription / Ordonnance

| Champ Frontend | Équivalent Backend | Statut | Notes |
|---|---|---|---|
| **Entité `Prescription`** | **`CareProtocol`** | **PARTIEL** | Modèle différent |
| `label` | `label` (String 255) | **CORRIGÉ** | Ajouté dans migration 007 |
| `startDate` | `start_date` | OK | |
| `endDate` | `end_date` | OK | |
| `careSchedule.frequency` | `frequency_display` (String 20) | **CORRIGÉ** | Ajouté dans migration 007 |
| `careSchedule.customFrequency` | `custom_frequency_encrypted` | **CORRIGÉ** | Ajouté dans migration 007, chiffré |
| `careSchedule.preferredSlot` | `preferred_slot` | **PARTIEL** | Frontend: "Matin et Soir", Backend: "morning\|afternoon\|evening" |
| `careSchedule.notes` | `notes_encrypted` | OK | Chiffré en BDD |
| `documents[]` | table `documents` | **CORRIGÉ** | Ajouté dans migration 007 |
| — | `duration_minutes` | **ABSENT DU FRONTEND** | Durée du soin |
| — | `preferred_time` (Time) | **ABSENT DU FRONTEND** | Heure précise préférée |
| — | `recurrence_rule` (RRULE) | **INCOMPATIBLE** | Frontend: enum simple, Backend: format RRULE iCalendar |

### 1.3 Document / Fichier

| Besoin Frontend | Backend | Statut |
|---|---|---|
| Upload PDF/images | `POST /documents/upload` | **CORRIGÉ** |
| Stockage fichiers chiffrés | Service stockage AES-256-GCM | **CORRIGÉ** |
| Métadonnées (nom, taille, URL) | Table `documents` avec RLS | **CORRIGÉ** |

### 1.4 Infirmier (Nurse)

| Champ Frontend | Champ Backend | Statut | Notes |
|---|---|---|---|
| `id` | `id` (UUID) | OK | |
| `firstName` | `first_name` | OK | |
| `lastName` | `last_name` | OK | |
| `role` ("Titulaire", "Collaborateur", "Remplaçant(e)") | `role` via `cabinet_members` ("admin", "member", "replacement") | **MAPPING** | Valeurs différentes |
| `phone` | `phone` | OK | |
| `email` | `email` | OK | |
| `color` (CSS class) | **ABSENT** | **MANQUANT EN BDD** | Couleur d'affichage |
| `active` (bool) | `is_active` via `cabinet_members` | OK | |

### 1.5 Configuration horaire / Slot / Planning

| Entité Frontend | Backend | Statut |
|---|---|---|
| `Config` (nom, date début, créneaux) | **ABSENT** | **MANQUANT** |
| `Slot` dans Config (nom, heures) | **ABSENT** | **MANQUANT** |
| `Schedule` (date → slot → nurses[]) | **ABSENT** | **MANQUANT** |
| `PlanningStatus` (draft/validated) | **ABSENT** | **MANQUANT** |

Le backend gère les horaires **au niveau User** (`work_hours_start/end`, `lunch_break_*`), pas via un système de configurations/créneaux partagés.

### 1.6 Rendez-vous (Appointment)

| Champ Frontend | Champ Backend | Statut | Notes |
|---|---|---|---|
| `id` | `id` (UUID) | OK | |
| `dateStr` + `startTime/endTime` | `scheduled_at` + `duration_minutes` | **MAPPING** | Backend: datetime + durée, Frontend: date + heures début/fin |
| `nurseId` | `idel_id` | OK | Nommage différent |
| `patientId` | `patient_id` | OK | |
| `patient` (nom dénormalisé) | — | Frontend only | Pas stocké en backend |
| `slotId` | **ABSENT** | **MANQUANT** | Concept de "slot config" inexistant en backend |
| — | `care_type` | **ABSENT DU FRONTEND** | Type de soin |
| — | `location_type` | **ABSENT DU FRONTEND** | Domicile/cabinet/hôpital |
| — | `status` | **ABSENT DU FRONTEND** | scheduled/completed/canceled... |
| — | `care_protocol_id` | **ABSENT DU FRONTEND** | Lien avec protocole de soin |

---

## 2. Comparaison des endpoints API

### 2.1 Endpoints existants et couverture

| Opération Frontend | Endpoint Backend | Statut |
|---|---|---|
| **Auth** | | |
| Login | `POST /auth/login` | OK |
| Register | `POST /auth/register` | OK |
| Refresh token | `POST /auth/refresh` | OK |
| **Patients** | | |
| Lister patients | `GET /patients/` | OK |
| Créer patient | `POST /patients/` | **CORRIGÉ** — ssn, doctorName, doctorContact ajoutés |
| Détail patient | `GET /patients/{id}` | OK |
| Modifier patient | `PATCH /patients/{id}` | **CORRIGÉ** — mêmes champs ajoutés |
| Désactiver patient | `DELETE /patients/{id}` | OK (soft delete) |
| Réactiver patient | `PATCH /patients/{id}` avec `status: "active"` | OK |
| Rechercher patient | `GET /patients/?search=` | OK (via HMAC hash) |
| **Prescriptions/Ordonnances** | | |
| Lister ordonnances d'un patient | `GET /care-protocols/?patient_id=` | OK |
| Créer ordonnance | `POST /care-protocols/` | **CORRIGÉ** — label, frequency_display, custom_frequency ajoutés |
| Modifier ordonnance | `PATCH /care-protocols/{id}` | **CORRIGÉ** — nouveau endpoint |
| Supprimer ordonnance | `DELETE /care-protocols/{id}` | **CORRIGÉ** — nouveau endpoint |
| Upload document | `POST /documents/upload` | **CORRIGÉ** — nouveau endpoint |
| Lister documents | `GET /documents/?entity_type=&entity_id=` | **CORRIGÉ** — nouveau endpoint |
| Télécharger document | `GET /documents/{id}` | **CORRIGÉ** — nouveau endpoint |
| Supprimer document | `DELETE /documents/{id}` | **CORRIGÉ** — nouveau endpoint |
| **Rendez-vous** | | |
| Lister RDV | `GET /appointments/` | OK |
| Créer RDV | `POST /appointments/` | **PARTIEL** — format différent |
| Supprimer RDV | `POST /appointments/{id}/cancel` | OK (cancel vs delete) |
| **Infirmiers** | | |
| Lister infirmiers | **ABSENT** | **MANQUANT** — pas de `GET /cabinet-members/` |
| Créer infirmier | **ABSENT** | **MANQUANT** |
| Modifier infirmier | **ABSENT** | **MANQUANT** |
| Désactiver/réactiver | **ABSENT** | **MANQUANT** |
| **Planning** | | |
| Configs horaires CRUD | **ABSENT** | **MANQUANT** — tout le système |
| Schedule (affectation nurses/slots) | **ABSENT** | **MANQUANT** |
| Statut planning (draft/validated) | **ABSENT** | **MANQUANT** |
| **Tournées** | | |
| Tournée du jour | `GET /tournees/today` | OK |
| **Suggestions** | | |
| Suggérer créneaux | `POST /slots/suggest` | OK |
| Réserver suggestion | `POST /slots/suggest/{rank}/book` | OK |

### 2.2 Endpoints restant à créer

| Endpoint requis | Priorité | Description |
|---|---|---|
| `GET /cabinet-members/` | **IMPORTANT** | Lister les infirmiers du cabinet |
| `POST /cabinet-members/invite` | **IMPORTANT** | Ajouter un infirmier |
| `PATCH /cabinet-members/{id}` | **IMPORTANT** | Modifier rôle/statut |
| Endpoints planning/configs | **SECONDAIRE** | Tout le système de planning horaire |

---

## 3. Modifications base de données réalisées (migration 007)

### 3.1 Champs ajoutés sur `patients`

```sql
ALTER TABLE patients ADD COLUMN ssn_encrypted BYTEA;           -- N° Sécurité Sociale (AES-256-GCM)
ALTER TABLE patients ADD COLUMN ssn_search_hash VARCHAR(64);    -- Hash HMAC-SHA256 pour recherche
ALTER TABLE patients ADD COLUMN doctor_name_encrypted BYTEA;    -- Médecin traitant (AES-256-GCM)
ALTER TABLE patients ADD COLUMN doctor_contact_encrypted BYTEA; -- Contact médecin (AES-256-GCM)
CREATE INDEX ix_patients_ssn_search_hash ON patients(ssn_search_hash);
```

### 3.2 Champs ajoutés sur `care_protocols`

```sql
ALTER TABLE care_protocols ADD COLUMN label VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE care_protocols ADD COLUMN frequency_display VARCHAR(20) NOT NULL DEFAULT 'daily';
ALTER TABLE care_protocols ADD COLUMN custom_frequency_encrypted BYTEA;
```

### 3.3 Table `documents` créée

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabinet_id UUID NOT NULL REFERENCES cabinets(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,    -- 'care_protocol', 'patient', etc.
    entity_id UUID NOT NULL,             -- ID du protocole ou patient lié
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,  -- Chemin du fichier chiffré
    checksum_sha256 VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_cabinet_isolation ON documents
    FOR ALL
    USING (cabinet_id::text = current_setting('app.current_cabinet_id', true))
    WITH CHECK (cabinet_id::text = current_setting('app.current_cabinet_id', true));

-- Index
CREATE INDEX ix_documents_entity ON documents(entity_type, entity_id);
CREATE INDEX ix_documents_cabinet ON documents(cabinet_id);
```

---

## 4. Analyse de sécurité des données de santé

### 4.1 Classification des données et niveau de protection

| Donnée | Classification RGPD | Protection backend | Statut |
|---|---|---|---|
| Nom/Prénom patient | **Donnée personnelle** | AES-256-GCM + HMAC search | OK |
| Date de naissance | **Donnée personnelle** | AES-256-GCM | OK |
| Téléphone patient | **Donnée personnelle** | AES-256-GCM | OK |
| Email patient | **Donnée personnelle** | AES-256-GCM | OK |
| Adresse patient | **Donnée personnelle** | AES-256-GCM | OK |
| **N° Sécu (SSN)** | **Donnée sensible (NIR)** | AES-256-GCM + HMAC search | **CORRIGÉ** |
| **Antécédents/Pathologies** | **Donnée de santé (Art. 9)** | AES-256-GCM | OK |
| **Notes médicales** | **Donnée de santé (Art. 9)** | AES-256-GCM | OK |
| **Médecin traitant** | **Donnée de santé (Art. 9)** | AES-256-GCM | **CORRIGÉ** |
| **Ordonnances (documents)** | **Donnée de santé (Art. 9)** | AES-256-GCM (fichiers chiffrés au repos) | **CORRIGÉ** |
| **Notes soins (prescriptions)** | **Donnée de santé (Art. 9)** | AES-256-GCM (via CareProtocol) | OK |
| Coordonnées GPS patient | **Donnée personnelle** | Clair en BDD | **ATTENTION** |

### 4.2 Problèmes critiques résolus

**1. N° Sécurité Sociale (NIR) — RÉSOLU**
- Chiffrement AES-256-GCM + hash HMAC-SHA256 pour recherche sans déchiffrement
- Index dédié `ix_patients_ssn_search_hash`

**2. Documents d'ordonnances — RÉSOLU**
- Fichiers chiffrés AES-256-GCM au repos (clé dérivée par cabinet)
- Validation type MIME réel (PDF, JPEG, PNG, GIF, WebP uniquement)
- Limitation de taille (10 Mo max par fichier)
- Checksum SHA-256 pour vérification d'intégrité
- RLS sur table `documents` (isolation par cabinet)
- Stockage dans répertoire dédié par cabinet (`uploads/{cabinet_id}/`)

**3. Données médecin traitant — RÉSOLU**
- `doctor_name_encrypted` et `doctor_contact_encrypted` chiffrés AES-256-GCM

**4. Notes CareProtocol — RÉSOLU**
- `notes_encrypted` maintenant déchiffré dans le repository (était un placeholder `""`)
- `custom_frequency_encrypted` chiffré pour les fréquences personnalisées

### 4.3 Problèmes critiques restants

**1. Clé de chiffrement maître — CRITIQUE**
- Actuellement dans une variable d'environnement (`ENCRYPTION_MASTER_KEY=dev-encryption-key-32-bytes-long!!`)
- **Exigence HDS** : stockage dans un HSM ou coffre-fort (AWS KMS, HashiCorp Vault, Azure Key Vault)
- Pas de mécanisme de rotation de clé

**2. Absence de révocation de tokens JWT — IMPORTANT**
- Un token volé reste valide 30 minutes
- Pas de blacklist Redis sur logout
- **Exigence** : implémenter token revocation pour la conformité

**3. Audit trail incomplet — IMPORTANT**
- Le champ `changes` est toujours vide (pas de diff avant/après)
- Les lectures (GET) de données patient ne sont pas journalisées
- **Exigence HDS** : traçabilité complète "qui a accédé à quoi, quand"

**4. Coordonnées GPS en clair — ATTENTION**
- `lat` et `lon` du patient sont stockés en clair en BDD
- Permettent la localisation du domicile
- À évaluer si le chiffrement est nécessaire (impact sur les requêtes géographiques)

### 4.4 Flux sécurisé des documents (implémenté)

```
Upload document ordonnance :

1. Frontend : sélection fichier (PDF/image, max 10 Mo)
2. Frontend → Backend : POST multipart/form-data, HTTPS
3. Backend :
   a. Vérification type MIME (PDF, JPEG, PNG, GIF, WebP)
   b. Vérification taille (< 10 Mo)
   c. Calcul SHA-256 du fichier original (intégrité)
   d. Chiffrement AES-256-GCM du contenu (clé dérivée cabinet_id)
   e. Stockage sur disque (fichier .enc)
   f. Insertion métadonnées en BDD (table documents, RLS)
   g. Audit log automatique (middleware)
4. Backend → Frontend : {id, name, size, mime_type, checksum}
5. Consultation :
   a. GET /documents/{id} → vérif RLS + déchiffrement à la volée
   b. Réponse avec Content-Disposition: attachment
```

---

## 5. Synthèse des actions

### Actions réalisées (Priorité 1)

| Action | Composant | Statut |
|---|---|---|
| Ajouter `ssn_encrypted` + `doctor_name_encrypted` + `doctor_contact_encrypted` sur `patients` | Migration + Domain + Model + Repo + API | **FAIT** |
| Créer table `documents` + service de stockage chiffré | Migration + Domain + Model + Repo + API | **FAIT** |
| Créer endpoints `PATCH/DELETE /care-protocols/{id}` | Routes + Schemas | **FAIT** |
| Ajouter `label` et `frequency_display` sur `care_protocols` | Migration + Domain + Model + Repo + API | **FAIT** |
| CareProtocolRepo : injection KeyManager, déchiffrement notes | Repository | **FAIT** |
| Tests unitaires entités (Patient, CareProtocol, Document) | 9 tests | **FAIT** |

### Actions restantes (Priorité 2 — IMPORTANT)

| Action | Composant | Effort |
|---|---|---|
| Créer endpoints gestion équipe (`GET/POST/PATCH /cabinet-members/`) | API | Moyen |
| Compléter l'audit trail (champ `changes`, lectures patient) | Middleware | Moyen |
| Implémenter token blacklist (Redis) | Auth + Redis | Faible |
| Ajouter le mapping de fréquences frontend↔RRULE | Couche Application (DTO) | Faible |
| Ajouter `color` sur `cabinet_members` ou table de préférences UI | Migration BDD | Faible |
| Scan antivirus à l'upload (ClamAV) | Service documents | Moyen |

### Actions restantes (Priorité 3 — SECONDAIRE)

| Action | Composant | Effort |
|---|---|---|
| Système complet planning/configs/slots | BDD + Domain + API | Élevé |
| Conformité RGPD complète (droit à l'oubli, portabilité, consentement) | Domain + API | Élevé |
| Déplacer la clé maître vers un coffre-fort | Infra + Config | Moyen |
| Implémenter la rotation de clés | Infra + Migration | Élevé |
| Rate limiting sur endpoints auth | Middleware | Faible |
| Headers de sécurité (CSP, X-Frame-Options...) | Middleware | Faible |

---

## 6. Checklist conformité

| Exigence | Statut | Notes |
|---|---|---|
| **HDS** | | |
| Chiffrement au repos | ✅ | AES-256-GCM (patients, protocoles, documents) |
| Chiffrement en transit | ⚠️ | HTTPS requis en production |
| Contrôle d'accès | ✅ | RLS + JWT + cabinet_id |
| Audit trail | ⚠️ | Basique ; manque read logs + diff changes |
| Gestion des clés | ❌ | Master key en variable d'environnement |
| Rotation de clés | ❌ | Non implémenté |
| Hachage mots de passe | ✅ | Bcrypt |
| **RGPD** | | |
| Consentement | ❌ | Non implémenté |
| Droit à l'oubli | ❌ | Soft delete uniquement |
| Portabilité des données | ❌ | Pas d'endpoint export |
| Minimisation des données | ⚠️ | Documenté informellement |
| Notification de violation | ❌ | Non implémenté |
| **Healthcare** | | |
| Chiffrement données patient | ✅ | AES-256-GCM (10 champs + documents) |
| Isolation multi-tenant | ✅ | RLS par cabinet_id |
| Journalisation | ⚠️ | Implémentation basique |
