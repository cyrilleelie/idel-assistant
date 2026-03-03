# PLAN ITÉRATIF DÉTAILLÉ — APPLICATION MOBILE IDEL
## Assistant IA IDEL — App terrain React Native + Expo

**Version :** 1.1  
**Date :** Mars 2026  
**Auteur :** Cyrille (Tech Lead)  
**Basé sur :** Architecture v1.0, PRD v1.0, Plan facturation v1.0, Décisions d'affinage (mars 2026)

---

## PHILOSOPHIE

L'application mobile est **l'outil de terrain**. Elle ne reproduit pas le dashboard web — elle contient **uniquement ce qui est utile pendant la tournée** et sa préparation immédiate. Chaque écran doit être utilisable d'une main, en 3 secondes, entre deux patients.

**Principes directeurs :**
- **Épurée** : pas de superflu, chaque élément affiché a une raison d'être en situation de tournée
- **Offline-first** : les données de tournée sont synchronisées en local, les opérations critiques fonctionnent sans réseau
- **Sécurisée de bout en bout** : les données de santé sont chiffrées au repos sur le device, en transit, et protégées contre la perte/vol du terminal — même niveau d'exigence que le backend
- **Non-directive** : les actions (transmission, facture, scan) sont facilement accessibles mais jamais imposées — l'IDEL choisit son rythme
- **Audio-native** : la voix est le mode de saisie privilégié sur le terrain

---

## VISION GLOBALE

```
ITER M1         ITER M2         ITER M3         ITER M4
Socle mobile    Tournée du      Fiches patients Transmissions
sécurité &      jour            & scan ordo     vocales/écrites
offline

    │               │               │               │
    ▼               ▼               ▼               ▼
  2.5 sem         2 sem           1.5 sem         2 sem
  Fondation       Écran           Consultation    Enregistrement
  technique       principal       & documents     & transcription


ITER M5         ITER M6         ITER M7
Préparer ma     Facturation     Notifications
journée         mobile          & polish

    │               │               │
    ▼               ▼               ▼
  1.5 sem         1.5 sem         1 sem
  Synthèse IA     Consultation    Push notifs
  transmissions   & partage       & UX finale
```

**Durée totale estimée : ~12.5 semaines**

- Itérations M1–M4 : socle + fonctionnalités terrain essentielles (MVP mobile)
- Itérations M5–M6 : intelligence et confort (préparation tournée, facturation)
- Itération M7 : polish et notifications

**Principe directeur :** Chaque itération produit une app testable sur le terrain par ta femme. Le feedback réel guide les ajustements avant l'itération suivante.

**Prérequis :** Les API backend suivantes doivent être opérationnelles avant de démarrer les itérations mobiles correspondantes. L'itération M1 (socle) peut démarrer dès que l'authentification backend est en place.

---

## DÉPENDANCES BACKEND PAR ITÉRATION

```
Itération mobile          API backend requises                      Module source
─────────────────────────────────────────────────────────────────────────────────
M1 (Socle)                POST /auth/login, /auth/refresh           Socle A/B
                          POST /devices/register                    À créer (push tokens)
                          POST /devices/remote-wipe                 À créer (effacement distant)
M2 (Tournée)              GET /tournees/{date}, GET /appointments   Socle A/B + Tournées
                          PUT /appointments/{id}/status
M3 (Patients & scan)      GET /patients, GET /patients/{id}         Socle A/B
                          POST /patients/{id}/documents             À créer (endpoint upload)
                          GET /prescriptions?patient_id=            Facturation iter 4
M4 (Transmissions)        POST /transmissions (audio upload)        Socle A/B + Voice C
                          POST /transmissions (texte)
                          GET /transmissions?patient_id=
                          POST /stt/transcribe (async)              Voice C
M5 (Préparer journée)    GET /tournees/{date}/preparation          À créer (agrégation)
                          POST /transmissions/summarize             À créer (synthèse IA)
M6 (Facturation)          GET /invoices?appointment_id=             Facturation iter 5
                          GET /invoices/{id}/pdf                    Facturation iter 2
                          POST /invoices/{id}/send                  À créer (email/SMS)
M7 (Notifications)        WebSocket ou FCM push                     À créer
```

---

## ITÉRATION M1 : SOCLE MOBILE, SÉCURITÉ, AUTHENTIFICATION & INFRASTRUCTURE OFFLINE (Semaines 1-2.5)

### Objectif
Mettre en place le squelette React Native + Expo avec **l'architecture de sécurité complète** (chiffrement local, biométrie, protection du terminal), l'infrastructure offline-first, l'authentification JWT, et le système de navigation. C'est la fondation sur laquelle toutes les itérations suivantes s'appuient.

### Pourquoi en premier
Aucun écran fonctionnel ne peut exister sans auth, navigation, et gestion du cache local. Le choix d'architecture offline-first et de sécurité dès le départ évite un refactoring coûteux plus tard. **Les données de santé stockées sur le terminal mobile sont soumises aux mêmes exigences RGPD/HDS que celles du serveur** — le chiffrement et la protection du device ne peuvent pas être ajoutés après coup.

### Enjeux de sécurité spécifiques au mobile

Le terminal mobile est un environnement fondamentalement plus exposé que le serveur :
- Le téléphone peut être **perdu ou volé** — les données doivent être illisibles sans authentification
- Le téléphone peut être **partagé** avec un proche — l'app doit se verrouiller automatiquement
- Le téléphone peut être **rooté/jailbreaké** — les protections OS ne sont plus garanties
- Le réseau peut être **compromis** (WiFi public, EHPAD) — les communications doivent résister aux interceptions
- Des **captures d'écran** peuvent exposer des données patient — elles doivent être bloquées sur les écrans sensibles

Chaque mesure de sécurité décrite ci-dessous répond à un ou plusieurs de ces risques.

### Stack technique

```
React Native + Expo (managed workflow)
├── Navigation : React Navigation v6 (stack + bottom tabs)
├── State management : Zustand (stores légers, persistables)
├── Styling : NativeWind (Tailwind pour React Native)
├── Stockage local : WatermelonDB + SQLCipher (base chiffrée)
├── HTTP client : Axios avec interceptors (JWT refresh, queue offline, cert pinning)
├── Audio : expo-av (enregistrement micro)
├── Caméra : expo-camera + expo-image-manipulator
├── Géoloc : expo-location
├── Notifications : expo-notifications + FCM (Android) / APNs (iOS)
├── Linking : expo-linking (ouverture GPS externe)
├── Sécurité :
│   ├── expo-secure-store (Keychain iOS / Keystore Android — tokens + clés)
│   ├── expo-local-authentication (biométrie Face ID / empreinte / PIN)
│   ├── expo-crypto (génération clés, chiffrement fichiers)
│   ├── react-native-ssl-pinning ou expo plugin (certificate pinning)
│   └── jail-monkey ou expo-device (détection root/jailbreak)
└── Chiffrement fichiers : AES-256-GCM applicatif (audio, PDF, scans)
```

### Features

**F-M1.1 — Architecture de sécurité mobile (CRITIQUE)**

Cette feature est la fondation sécurité de l'ensemble de l'app mobile. Toutes les autres features de toutes les itérations en dépendent.

**A. Chiffrement de la base de données locale (SQLCipher)**

```
WatermelonDB + SQLCipher :
- SQLCipher chiffre la totalité de la base SQLite avec AES-256-CBC
- Chaque page de la base est chiffrée individuellement
- Sans la clé, la base est indistinguable d'un fichier aléatoire

Gestion de la clé de chiffrement :

1. GÉNÉRATION (au premier login réussi) :
   - Générer une clé aléatoire de 256 bits via expo-crypto.getRandomBytes(32)
   - Cette clé est la DATABASE_ENCRYPTION_KEY (DEK)
   - Elle est INDÉPENDANTE du token JWT (le token expire et change,
     la clé de la base doit persister)

2. STOCKAGE DE LA DEK :
   - Stockée dans expo-secure-store avec l'option :
     {
       keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY  // iOS
       // Android : Keystore matériel avec biometric binding si disponible
     }
   - expo-secure-store utilise :
     · iOS : Keychain Services (chiffré par Secure Enclave, lié au device)
     · Android : Android Keystore (hardware-backed si disponible)
   - La DEK n'est JAMAIS :
     · Stockée dans AsyncStorage
     · Écrite dans un fichier
     · Loguée
     · Envoyée au serveur
     · Dérivée d'un mot de passe utilisateur

3. UTILISATION :
   - Au démarrage de l'app → récupération DEK depuis SecureStore
   - Ouverture WatermelonDB avec la DEK comme pragma key
   - Si DEK absente (premier lancement ou effacement) → login requis → génération

4. ROTATION :
   - Pas de rotation automatique en v1 (complexité élevée avec SQLCipher)
   - Rotation forcée uniquement en cas de compromission signalée
     (remote wipe + re-login → nouvelle DEK)

Schéma de confiance :
┌──────────────────────────────────────────────┐
│  Secure Enclave / Hardware Keystore          │
│  (protégé par biométrie + PIN device)        │
│  ┌────────────────────────────────────────┐  │
│  │  DATABASE_ENCRYPTION_KEY (DEK)         │  │
│  │  FILE_ENCRYPTION_KEY (FEK)             │  │
│  │  JWT access_token                      │  │
│  │  JWT refresh_token                     │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
┌─────────────────┐  ┌─────────────────────┐
│ WatermelonDB    │  │ Fichiers locaux     │
│ (SQLCipher)     │  │ (AES-256-GCM)       │
│                 │  │                     │
│ Patients        │  │ audio_xxx.m4a.enc  │
│ Appointments    │  │ scan_xxx.pdf.enc   │
│ Transmissions   │  │ facture_xxx.pdf.enc│
│ Invoices        │  │                     │
│ Documents       │  │                     │
│ AuditLog        │  │                     │
└─────────────────┘  └─────────────────────┘
```

**B. Chiffrement des fichiers locaux (audio, PDF, scans)**

```
Les fichiers stockés en dehors de la base (audio de transmissions,
PDF de factures, scans d'ordonnances) doivent être chiffrés individuellement.

Pourquoi : même si iOS offre Data Protection Complete (chiffrement filesystem
quand le device est verrouillé), Android n'offre pas les mêmes garanties
sur tous les devices. Le chiffrement applicatif assure une protection
homogène sur les deux plateformes, indépendante des capacités du device.

Mécanisme :

1. FILE_ENCRYPTION_KEY (FEK) :
   - Clé AES-256 dédiée aux fichiers, distincte de la DEK
   - Générée et stockée dans SecureStore au même moment que la DEK
   - Séparation DEK/FEK : si l'une est compromise, l'autre protège encore

2. Chiffrement à l'écriture :
   encrypt_file(plaintext_path, encrypted_path):
     iv = crypto.getRandomBytes(12)           // Nonce 96 bits unique
     ciphertext = AES-256-GCM(FEK, iv, file_content)
     auth_tag = GCM_tag                       // 128 bits d'intégrité
     write(encrypted_path, iv + auth_tag + ciphertext)

3. Déchiffrement à la lecture :
   decrypt_file(encrypted_path) → plaintext_buffer:
     read(encrypted_path)
     extract iv (12 bytes) + auth_tag (16 bytes) + ciphertext
     plaintext = AES-256-GCM-decrypt(FEK, iv, auth_tag, ciphertext)
     if auth_tag invalid → fichier corrompu/altéré → erreur

4. Workflow fichier type (exemple : enregistrement audio) :
   a. expo-av enregistre en clair dans un fichier temporaire
   b. Immédiatement après arrêt de l'enregistrement :
      - Chiffrement du fichier temporaire → audio_xxx.m4a.enc
      - Suppression sécurisée du fichier temporaire en clair
      - Enregistrement du chemin chiffré dans WatermelonDB
   c. Pour la réécoute :
      - Déchiffrement en mémoire (buffer) ou dans un fichier temporaire éphémère
      - Lecture audio depuis le buffer
      - Suppression immédiate du fichier temporaire si utilisé

5. Convention de nommage :
   - Fichiers chiffrés : {type}_{uuid}.{ext}.enc
   - Exemple : audio_a3f2b1c4.m4a.enc, scan_b7d4e2f1.pdf.enc
   - Le .enc signale le chiffrement (utile pour le debug, pas pour la sécurité)

6. Répertoire de stockage :
   - iOS : Documents/ (sauvegardé par iCloud si activé — chiffré donc OK)
   - Android : files/ (répertoire privé app, pas accessible aux autres apps)
   - Sous-répertoires : /audio/, /scans/, /invoices/, /cache/
```

**C. Verrouillage biométrique de l'application**

```
Problème : l'IDEL pose son téléphone sur la table chez un patient, va se laver
les mains, une autre personne prend le téléphone → accès aux données de santé.

Solution : verrouillage automatique de l'app avec déverrouillage biométrique.

Implémentation via expo-local-authentication :

1. CONFIGURATION (au premier login) :
   - Vérification : le device supporte-t-il la biométrie ?
     expo-local-authentication.hasHardwareAsync()
   - Si oui → proposition d'activer le verrouillage biométrique
   - Si non → fallback sur code PIN applicatif (4-6 chiffres)
   - Le PIN applicatif est TOUJOURS configuré (même si biométrie active)
     comme fallback en cas d'échec biométrique

2. DÉCLENCHEMENT DU VERROUILLAGE :
   - L'app passe en arrière-plan (AppState change → 'background')
   - Timer d'inactivité configurable (par défaut : 2 minutes)
   - Si le timer expire ET que l'app revient au premier plan →
     écran de déverrouillage obligatoire
   - Passage immédiat en mode verrouillé si l'app reste en arrière-plan
     plus de 5 minutes (pas de timer configurable, sécurité dure)

3. ÉCRAN DE DÉVERROUILLAGE :
   ┌────────────────────────────────────┐
   │                                    │
   │         🔒 App verrouillée         │
   │                                    │
   │     [Icône empreinte / Face ID]    │
   │                                    │
   │   Déverrouillez pour accéder       │
   │   aux données patients             │
   │                                    │
   │   ─── ou ───                       │
   │                                    │
   │   Saisir le code PIN               │
   │   ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
   │   │ │ │ │ │ │ │ │ │ │ │ │      │
   │   └─┘ └─┘ └─┘ └─┘ └─┘ └─┘      │
   │                                    │
   │   3 tentatives restantes           │
   │                                    │
   └────────────────────────────────────┘

4. POLITIQUE DE TENTATIVES :
   - 5 tentatives PIN maximum
   - Après 5 échecs → effacement automatique des données locales
     (même comportement qu'un remote wipe)
   - La biométrie n'a pas de limite de tentatives (gérée par l'OS)
   - Après 3 échecs biométrie → fallback PIN obligatoire

5. STOCKAGE DU PIN :
   - Le PIN est hashé (bcrypt ou PBKDF2) et stocké dans SecureStore
   - Le PIN n'est JAMAIS stocké en clair
   - Le PIN n'est PAS synchronisé avec le serveur (local uniquement)
```

**D. Détection de device compromis (root / jailbreak)**

```
Un device rooté ou jailbreaké offre des possibilités d'accès aux données
qui contournent les protections OS (Keychain, sandbox app, etc.).

Implémentation :

1. AU DÉMARRAGE DE L'APP :
   - Vérification root/jailbreak via jail-monkey ou équivalent :
     · Présence de binaires Superuser/su/Magisk (Android)
     · Présence de Cydia/Sileo/checkra1n (iOS)
     · Test d'écriture hors sandbox
     · Vérification intégrité du système de fichiers

2. SI DEVICE COMPROMIS DÉTECTÉ :
   ┌────────────────────────────────────┐
   │  ⚠️ Appareil non sécurisé          │
   │                                    │
   │  Votre appareil semble modifié     │
   │  (rooté ou jailbreaké).            │
   │                                    │
   │  Pour protéger les données de      │
   │  santé de vos patients, cette      │
   │  application ne peut pas           │
   │  fonctionner sur un appareil       │
   │  modifié.                          │
   │                                    │
   │  Contactez le support si vous      │
   │  pensez que c'est une erreur.      │
   │                                    │
   │  [Quitter l'application]           │
   └────────────────────────────────────┘

   → Accès bloqué. Pas d'accès aux données locales.
   → Les données ne sont PAS effacées (l'IDEL peut restaurer
     son device et se reconnecter normalement)

3. VÉRIFICATION PÉRIODIQUE :
   - Revérification à chaque passage au premier plan
   - Si compromission détectée en cours d'utilisation → verrouillage immédiat

Note : la détection root/jailbreak n'est pas infaillible (des outils comme
Magisk Hide peuvent la contourner). C'est une couche de défense en profondeur,
pas une garantie absolue. Le chiffrement SQLCipher + fichiers reste la
protection principale.
```

**E. Protection contre les captures d'écran**

```
Les écrans affichant des données patient identifiantes doivent bloquer
les captures d'écran et l'enregistrement d'écran.

Écrans protégés (FLAG_SECURE) :
- Fiche patient (nom, adresse, téléphone, pathologies)
- Historique des transmissions
- Détail d'une transmission (transcription, synthèse)
- Écran préparation journée (synthèses IA)
- Facture (nom patient, actes, montants)
- Scan d'ordonnance (aperçu avant envoi)

Écrans NON protégés (captures autorisées) :
- Écran login
- Liste des RDV (horaires + prénoms seulement, pas d'info médicale)
- Paramètres
- Écrans d'erreur / états vides

Implémentation :
- Android : FLAG_SECURE sur l'activité → bloque screenshot + screen recording
  Ajout via react-native module natif ou expo config plugin
- iOS : désactivation plus complexe et partielle
  · Détection UIApplicationUserDidTakeScreenshotNotification → notification à l'IDEL
  · Overlay opaque pendant l'enregistrement d'écran (UIScreen.capturedDidChange)
  · Note : iOS ne peut pas empêcher complètement les screenshots,
    seulement détecter et avertir. Le chiffrement reste la vraie protection.
```

**F. Certificate pinning (protection réseau)**

```
Problème : l'IDEL se connecte au WiFi d'un EHPAD ou d'un patient.
Un attaquant sur le même réseau pourrait intercepter les communications
(man-in-the-middle) même avec HTTPS, en utilisant un faux certificat.

Solution : certificate pinning — l'app refuse toute connexion HTTPS
dont le certificat ne correspond pas à celui attendu.

Implémentation :

1. MÉTHODE : pinning de la clé publique du certificat serveur (SPKI pin)
   Avantage vs pin du certificat entier : survit au renouvellement Let's Encrypt
   tant que la clé privée ne change pas

2. CONFIGURATION dans le client Axios :
   - Utilisation de react-native-ssl-pinning ou expo config plugin
   - Pin principal : hash SHA-256 de la clé publique du certificat serveur actuel
   - Pin de backup : hash SHA-256 d'une clé publique de secours
     (générée et stockée offline, utilisée en cas de compromission)

3. COMPORTEMENT EN CAS D'ÉCHEC :
   - Si le certificat ne match aucun pin → connexion refusée
   - Message à l'IDEL : "Connexion sécurisée impossible. Vérifiez votre réseau."
   - L'app continue de fonctionner en mode offline
   - Log d'alerte envoyé au serveur (à la prochaine connexion valide)

4. MISE À JOUR DES PINS :
   - Les pins sont embarqués dans le code de l'app (build time)
   - Mise à jour via OTA Expo Updates quand le certificat serveur change
   - Prévoir la rotation : toujours avoir 2 pins (actuel + prochain)
   - Procédure documentée pour la rotation de certificat serveur
```

**G. Effacement sécurisé et remote wipe**

```
L'effacement des données doit être complet et irrécupérable.

1. EFFACEMENT LOCAL (déconnexion volontaire) :

   Séquence d'effacement au logout :
   a. Fermer la connexion WatermelonDB
   b. Supprimer le fichier SQLite chiffré
   c. Pour chaque fichier dans /audio/, /scans/, /invoices/, /cache/ :
      - Écrire des zéros sur la totalité du fichier (overwrite)
      - Puis supprimer le fichier
      Note : l'overwrite n'est pas garanti efficace sur flash/SSD
      (wear leveling), mais le chiffrement AES-256-GCM rend le contenu
      résiduel illisible. L'overwrite est une précaution supplémentaire.
   d. Vider expo-secure-store (DEK, FEK, tokens, PIN hash)
   e. Réinitialiser tous les stores Zustand
   f. Vider les caches Axios / images

2. EFFACEMENT AUTOMATIQUE (inactivité prolongée) :
   - Si l'app n'est pas utilisée pendant 30 jours consécutifs
     (vérifié au lancement via un timestamp stocké dans SecureStore)
   - → Même séquence d'effacement que le logout
   - → Écran login avec message "Session expirée par sécurité"

3. EFFACEMENT AUTOMATIQUE (échecs d'authentification) :
   - Après 5 tentatives PIN échouées consécutives
   - → Effacement complet immédiat
   - → Écran login avec message "Données effacées par sécurité"

4. EFFACEMENT À DISTANCE (remote wipe) :
   Scénario : l'IDEL se fait voler son téléphone.
   
   a. L'IDEL se connecte au dashboard web
   b. Section "Mes appareils" → sélectionne l'appareil volé
   c. Bouton "Effacer les données à distance"
   d. Le serveur enregistre une commande de wipe pour ce device

   Côté mobile :
   e. À chaque sync pull (ou via notification push silencieuse) :
      - Vérification : GET /api/v1/devices/me/wipe-status
      - Si wipe demandé → effacement complet immédiat
   f. Si le téléphone est hors ligne → effacement au prochain lancement
      (la commande wipe est persistée côté serveur indéfiniment)

   Backend (endpoint à créer) :
   POST /api/v1/devices/{device_id}/remote-wipe
   - Authentification : JWT de l'IDEL (depuis le web)
   - Enregistre wipe_requested_at sur le device
   - Envoie une push notification silencieuse (wake up l'app)

   GET /api/v1/devices/me/wipe-status
   - Retourne { wipe_requested: true/false, requested_at: "..." }
   - Appelé à chaque sync pull et au démarrage de l'app

   Table backend :
   DEVICE_REGISTRATION
   ├── uuid id PK
   ├── uuid user_id FK
   ├── uuid cabinet_id FK
   ├── string device_token             -- Token FCM/APNs
   ├── string platform                 -- "ios", "android"
   ├── string device_name              -- "iPhone de Sophie"
   ├── string app_version
   ├── boolean wipe_requested          -- default false
   ├── timestamp wipe_requested_at
   ├── timestamp last_seen_at          -- Dernière activité
   ├── timestamp registered_at
   └── timestamp updated_at
```

**H. Audit local des accès aux données sensibles**

```
Exigence HDS : traçabilité complète de qui a accédé à quelle donnée, quand.
Le mobile doit contribuer à cet audit trail.

Table locale (WatermelonDB) :

LOCAL_AUDIT_LOG
├── string id
├── string user_id
├── string action                   -- "view_patient", "view_transmission",
│                                   -- "play_audio", "view_invoice",
│                                   -- "scan_document", "mark_completed",
│                                   -- "export_pdf", "send_invoice"
├── string entity_type              -- "patient", "transmission", "invoice", "document"
├── string entity_id                -- server_id de l'entité consultée
├── string context                  -- "tournee", "preparation", "patient_fiche"
├── boolean synced                  -- Envoyé au serveur ?
├── timestamp created_at

Règles :
- Chaque consultation d'une fiche patient → log "view_patient"
- Chaque écoute d'un audio de transmission → log "play_audio"
- Chaque ouverture de facture → log "view_invoice"
- Chaque scan de document → log "scan_document"
- Les logs sont synchronisés vers le serveur lors du sync push
  POST /api/v1/audit/batch { logs: [...] }
- Les logs synchronisés sont purgés localement après 7 jours
- Les logs sont chiffrés par SQLCipher (dans la même base)
- Les logs ne contiennent JAMAIS de données de santé, uniquement des IDs

Note : l'audit local est volontairement léger (pas de contenu de données)
pour ne pas dégrader les performances. Le serveur enrichit les logs
avec le contexte nécessaire pour la conformité HDS.
```

**I. Minimisation des données locales**

```
Principe du moindre privilège appliqué au cache mobile.

Données synchronisées (nécessaires au terrain) :
✅ Patients : identité (nom, prénom, adresse, téléphone), statut BSI/ALD,
   notes pratiques (code porte, clé, animaux)
✅ RDV : fenêtre J-1 / J / J+1 uniquement
✅ Transmissions : 7 derniers jours des patients synchronisés
✅ Factures : uniquement celles liées aux RDV synchronisés
✅ Prescriptions actives : uniquement pour les patients synchronisés
✅ Documents/scans : uniquement les PDF des ordonnances actives

Données NON synchronisées (restent sur le serveur) :
❌ Historique complet des patients au-delà de 7 jours
❌ Historique des factures anciennes
❌ Patients inactifs / archivés
❌ Transmissions au-delà de 7 jours
❌ Statistiques, dashboard, données comptables
❌ Données des autres IDEL du cabinet (sauf transmissions partagées)
❌ Logs d'audit au-delà de 7 jours

Purge automatique :
- À chaque sync pull, les données hors fenêtre sont supprimées localement
- Les fichiers associés (audio, PDF) sont effacés avec la même procédure
  sécurisée que le logout (overwrite + delete)
- Taille cache cible : < 50 Mo par IDEL en utilisation normale
```

**F-M1.2 — Initialisation projet Expo**

```
frontend-mobile/
├── app/                              # Expo Router (file-based routing)
│   ├── _layout.tsx                   # Root layout (auth gate + security gate)
│   ├── (auth)/                       # Écrans non authentifiés
│   │   ├── login.tsx
│   │   ├── setup-pin.tsx             # Configuration PIN au premier login
│   │   ├── setup-biometrics.tsx      # Activation biométrie
│   │   └── _layout.tsx
│   ├── (lock)/                       # Écran de verrouillage
│   │   └── unlock.tsx                # Biométrie + PIN
│   ├── (tabs)/                       # Navigation principale (bottom tabs)
│   │   ├── _layout.tsx               # Tab bar config
│   │   ├── tournee.tsx               # Onglet Tournée (écran principal)
│   │   ├── patients.tsx              # Onglet Patients
│   │   └── preparation.tsx           # Onglet Préparer ma journée
│   ├── appointment/
│   │   └── [id].tsx                  # Détail RDV
│   ├── patient/
│   │   ├── [id].tsx                  # Fiche patient
│   │   └── [id]/
│   │       ├── transmissions.tsx     # Historique transmissions
│   │       ├── documents.tsx         # Documents & ordonnances
│   │       └── scan.tsx              # Scanner ordonnance
│   ├── transmission/
│   │   └── new.tsx                   # Nouvelle transmission (vocal/écrit)
│   ├── invoice/
│   │   └── [id].tsx                  # Détail facture
│   └── settings.tsx                  # Paramètres (sécurité, notifications, sync)
│
├── components/                       # Composants réutilisables
│   ├── ui/                           # Boutons, cards, modals, badges
│   ├── appointment/                  # AppointmentCard, StatusBadge
│   ├── patient/                      # PatientCard, PatientHeader
│   ├── transmission/                 # TransmissionCard, VoiceRecorder
│   ├── invoice/                      # InvoicePreview, ShareActions
│   └── security/                     # ScreenProtector, BiometricPrompt
│
├── stores/                           # Zustand stores
│   ├── authStore.ts                  # JWT tokens, user info
│   ├── securityStore.ts             # État verrouillage, biométrie, dernière activité
│   ├── syncStore.ts                  # État sync (online/offline, pending ops)
│   ├── tourneeStore.ts              # Tournée du jour en cache
│   └── settingsStore.ts             # Préférences utilisateur
│
├── db/                               # WatermelonDB
│   ├── schema.ts                     # Schéma SQLite local (avec audit_log)
│   ├── models/                       # Modèles WatermelonDB
│   │   ├── Patient.ts
│   │   ├── Appointment.ts
│   │   ├── Transmission.ts
│   │   ├── Invoice.ts
│   │   ├── Document.ts
│   │   └── AuditLog.ts
│   ├── sync.ts                       # Logique de synchronisation serveur ↔ local
│   └── database.ts                   # Initialisation BDD avec SQLCipher
│
├── security/                         # Module sécurité dédié
│   ├── encryption.ts                 # AES-256-GCM chiffrement/déchiffrement fichiers
│   ├── keyManager.ts                 # Gestion DEK + FEK via SecureStore
│   ├── biometricAuth.ts             # Gestion biométrie + PIN
│   ├── deviceIntegrity.ts           # Détection root/jailbreak
│   ├── screenProtection.ts          # FLAG_SECURE + détection capture
│   ├── certificatePinning.ts        # Configuration SPKI pins
│   ├── secureWipe.ts                # Effacement sécurisé (fichiers + base)
│   ├── remoteWipe.ts                # Vérification et exécution wipe distant
│   ├── auditLogger.ts              # Journalisation locale des accès
│   └── securityGate.tsx             # Composant racine : vérifie intégrité + auth + lock
│
├── services/                         # Couche API
│   ├── api.ts                        # Client Axios (interceptors, cert pinning, queue offline)
│   ├── authService.ts
│   ├── deviceService.ts             # Enregistrement device, wipe status
│   ├── tourneeService.ts
│   ├── patientService.ts
│   ├── transmissionService.ts
│   ├── invoiceService.ts
│   ├── auditService.ts             # Sync des audit logs vers serveur
│   └── offlineQueue.ts              # File d'attente des opérations offline
│
├── hooks/                            # Hooks custom
│   ├── useAuth.ts
│   ├── useOnlineStatus.ts
│   ├── useSync.ts
│   ├── useAudioRecorder.ts
│   ├── useSecureFile.ts            # Lecture/écriture fichiers chiffrés
│   └── useAudit.ts                 # Hook pour logger les accès
│
├── utils/
│   ├── navigation.ts                 # Helpers ouverture GPS externe
│   ├── dateHelpers.ts
│   └── formatters.ts                 # Formatage montants, noms, etc.
│
├── constants/
│   ├── colors.ts                     # Palette UI
│   ├── config.ts                     # URLs API, timeouts
│   ├── securityConfig.ts            # Timeouts verrouillage, nb tentatives, etc.
│   ├── pinConfig.ts                  # Pins SPKI pour cert pinning
│   └── offlineConfig.ts              # Durée cache, fréquence sync
│
├── app.json                          # Config Expo
├── package.json
├── tsconfig.json
├── tailwind.config.js                # NativeWind config
└── babel.config.js
```

**F-M1.3 — Flux d'authentification sécurisé**

```
PREMIER LOGIN (setup complet) :
1. IDEL saisit email + mot de passe
2. POST /api/v1/auth/login → { access_token, refresh_token, user, cabinet }
3. Vérification intégrité device (root/jailbreak check)
   → Si compromis : blocage immédiat, pas de stockage
4. Génération DEK + FEK → stockage SecureStore
5. Tokens JWT → stockage SecureStore
6. Initialisation WatermelonDB avec DEK (SQLCipher)
7. Configuration PIN obligatoire :
   ┌────────────────────────────────────┐
   │  Créez votre code PIN              │
   │                                    │
   │  Ce code protège l'accès à         │
   │  l'application et aux données      │
   │  de vos patients.                  │
   │                                    │
   │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
   │  │ │ │ │ │ │ │ │ │ │ │ │      │
   │  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘      │
   │                                    │
   │  Confirmez votre code PIN          │
   │  ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐      │
   │  │ │ │ │ │ │ │ │ │ │ │ │      │
   │  └─┘ └─┘ └─┘ └─┘ └─┘ └─┘      │
   └────────────────────────────────────┘
8. Proposition activation biométrie (si hardware disponible)
9. Enregistrement du device auprès du serveur :
   POST /api/v1/devices/register { token_fcm, platform, device_name, app_version }
10. Sync pull initiale → données en cache local
11. Redirection → écran Tournée

LANCEMENTS SUIVANTS :
1. Démarrage app
2. Vérification intégrité device → blocage si compromis
3. Vérification remote wipe → effacement si demandé
4. Vérification timer inactivité 30 jours → effacement si expiré
5. Récupération DEK depuis SecureStore
6. Ouverture WatermelonDB (SQLCipher)
7. Écran de déverrouillage (biométrie ou PIN)
8. Si biométrie/PIN OK → accès app
9. Vérification validité token JWT :
   - Si token valide → sync pull si réseau disponible
   - Si token expiré → refresh automatique
   - Si refresh échoue → mode offline si token < 24h, sinon re-login

RETOUR AU PREMIER PLAN (après background) :
1. Calcul durée en background
2. Si > seuil configurable (défaut 2 min) → écran verrouillage
3. Si > 5 min → verrouillage obligatoire (non configurable)
4. Si < seuil → retour direct (pas de friction inutile)
5. Vérification remote wipe à chaque retour

Séquence de sécurité au démarrage (securityGate.tsx) :
┌─────────────┐
│ App Launch   │
└─────┬───────┘
      ▼
┌─────────────────────┐    ❌
│ Device intégrité OK? ├────────→ Blocage
└─────┬───────────────┘
      ▼ ✅
┌─────────────────────┐    ❌
│ Remote wipe pending? ├────────→ Effacement + Login
└─────┬───────────────┘
      ▼ Non
┌─────────────────────┐    ❌
│ Inactivité > 30j ?  ├────────→ Effacement + Login
└─────┬───────────────┘
      ▼ Non
┌─────────────────────┐    ❌
│ DEK disponible ?     ├────────→ Login complet
└─────┬───────────────┘
      ▼ ✅
┌─────────────────────┐
│ Ouvrir DB (SQLCipher)│
└─────┬───────────────┘
      ▼
┌─────────────────────┐    ❌ (5 échecs → wipe)
│ Biométrie / PIN OK ? ├────────→ Écran verrouillage
└─────┬───────────────┘
      ▼ ✅
┌─────────────────────┐
│ App accessible ✅    │
└─────────────────────┘
```

**F-M1.4 — Infrastructure offline-first avec WatermelonDB chiffré**

WatermelonDB fournit une base SQLite locale avec mécanisme de synchronisation pull/push vers le backend PostgreSQL. SQLCipher assure le chiffrement au repos.

```
Schéma local (WatermelonDB + SQLCipher) — miroir simplifié des entités serveur :

LOCAL_PATIENTS
├── string server_id               -- UUID côté serveur
├── string first_name              -- Données reçues déchiffrées du serveur,
├── string last_name               -- re-chiffrées par SQLCipher localement
├── string phone
├── string address
├── number lat
├── number lon
├── string status                  -- "active", "inactive"
├── boolean is_ald
├── boolean has_active_bsi
├── string bsi_level
├── string notes
├── timestamp last_synced_at

LOCAL_APPOINTMENTS
├── string server_id
├── string patient_id              -- Relation locale
├── string user_id                 -- IDEL assignée
├── string date                    -- YYYY-MM-DD
├── string start_time              -- HH:MM
├── string end_time
├── string care_type_code          -- "AMI_1.5", "BSA"
├── string care_type_label
├── string status                  -- "scheduled", "in_progress", "completed", "cancelled"
├── string location_type           -- "domicile", "cabinet", "ehpad"
├── string notes
├── number sort_order              -- Ordre dans la tournée
├── timestamp last_synced_at

LOCAL_TRANSMISSIONS
├── string server_id               -- null si pas encore synced
├── string patient_id
├── string appointment_id          -- nullable
├── string author_user_id
├── string content_text            -- Texte saisi ou transcription
├── string content_structured      -- JSON synthèse IA (nullable)
├── string audio_file_path         -- Chemin fichier audio CHIFFRÉ (nullable)
├── string status                  -- "draft", "pending_transcription", "transcribed", "validated"
├── boolean audio_uploaded         -- Audio envoyé au serveur ?
├── timestamp created_at
├── timestamp last_synced_at

LOCAL_INVOICES
├── string server_id
├── string appointment_id
├── string patient_id
├── string invoice_number
├── number total_amount
├── number amount_amo
├── number amount_amc
├── number amount_patient
├── string status                  -- "draft", "validated", "cancelled"
├── string pdf_local_path          -- Chemin du PDF CHIFFRÉ en cache (nullable)
├── timestamp created_at
├── timestamp last_synced_at

LOCAL_DOCUMENTS
├── string server_id
├── string patient_id
├── string prescription_id         -- nullable
├── string file_type               -- "ordonnance", "other"
├── string local_file_path         -- Chemin fichier CHIFFRÉ
├── boolean uploaded               -- Envoyé au serveur ?
├── timestamp created_at
├── timestamp last_synced_at

LOCAL_AUDIT_LOG
├── string id
├── string user_id
├── string action
├── string entity_type
├── string entity_id
├── string context
├── boolean synced
├── timestamp created_at
```

**Stratégie de synchronisation :**

```
SYNC PULL (serveur → local) :
  Déclenchement :
  - Au login (sync complète initiale)
  - À l'ouverture de l'app (si réseau disponible)
  - Périodique (toutes les 5 minutes si app au premier plan)
  - Manuel (pull-to-refresh)

  Données synchronisées (fenêtre minimale — cf. minimisation) :
  - Patients du cabinet (actifs uniquement)
  - RDV du jour + lendemain + J-1 (fenêtre glissante 3 jours)
  - Transmissions des patients des RDV synchronisés (7 derniers jours)
  - Factures liées aux RDV synchronisés
  - Prescriptions actives des patients synchronisés

  Sécurité du transit :
  - HTTPS obligatoire (TLS 1.3) avec certificate pinning
  - Les données sensibles (noms, adresses, transmissions) sont déchiffrées
    côté serveur (AES-256-GCM serveur), transmises via TLS, puis stockées
    dans WatermelonDB (re-chiffrées par SQLCipher localement)
  - Pas de double chiffrement applicatif en transit — TLS + cert pinning suffit

  Mécanisme :
  GET /api/v1/sync/pull?last_synced_at={timestamp}
  → Retourne toutes les entités modifiées depuis last_synced_at
  → Résolution de conflits : le serveur gagne (last-write-wins)
  → Vérification wipe_requested à chaque pull

SYNC PUSH (local → serveur) :
  Déclenchement :
  - Immédiat si réseau disponible
  - Dès retour du réseau (file d'attente persistante dans WatermelonDB)

  Opérations poussées (file FIFO) :
  - Changement de statut RDV (completed, cancelled)
  - Nouvelles transmissions (texte + fichier audio chiffré → déchiffré avant upload)
  - Documents scannés (PDF chiffré → déchiffré avant upload)
  - Logs d'audit locaux
  - (Les factures ne sont PAS créées localement — générées côté serveur)

  Sécurité de l'upload :
  - Les fichiers sont déchiffrés en mémoire juste avant l'upload
  - Envoyés via HTTPS (TLS + cert pinning)
  - Le fichier en clair n'est JAMAIS écrit sur le filesystem
  - Le serveur re-chiffre avec sa propre clé (AES-256-GCM serveur)

  Mécanisme :
  POST /api/v1/sync/push
  Body: { operations: [{ type, entity, data, local_id, timestamp }] }
  → Serveur traite séquentiellement, retourne les server_id créés
  → Client met à jour les server_id localement

INDICATEUR DE SYNC :
  - Barre de statut discrète en haut de l'app :
    🟢 "Synchronisé" (tout à jour)
    🟡 "X opérations en attente" (offline avec opérations non poussées)
    🔴 "Hors connexion" (pas de réseau)
  - L'indicateur est non-intrusif mais toujours visible
```

**F-M1.5 — Navigation et structure d'écrans**

```
Bottom Tab Bar (3 onglets) :
┌─────────────────────────────────────────┐
│                                         │
│         [Contenu de l'écran actif]      │
│                                         │
│                                         │
├─────────┬─────────────┬─────────────────┤
│ 📋      │ 👥          │ 📖              │
│ Tournée │ Patients    │ Préparer        │
│ (actif) │             │ ma journée      │
└─────────┴─────────────┴─────────────────┘

L'onglet "Tournée" est l'écran d'accueil par défaut.
```

Navigation interne (stack) depuis chaque onglet :
- Tournée → Détail RDV → Fiche patient → Transmissions / Documents / Scan
- Tournée → Détail RDV → Facture
- Tournée → Nouvelle transmission (vocal/écrit)
- Patients → Fiche patient → Transmissions / Documents / Scan
- Préparer → Détail patient synthèse → Fiche patient complète

**F-M1.6 — Thème visuel et composants de base**

```
Palette couleurs :
- Primary : Bleu santé (#2563EB) — actions principales
- Success : Vert (#16A34A) — RDV réalisé, sync OK
- Warning : Orange (#EA580C) — en attente, attention
- Danger : Rouge (#DC2626) — annulé, erreur
- Background : Gris très clair (#F8FAFC)
- Surface : Blanc (#FFFFFF)
- Text : Gris foncé (#1E293B)
- Text secondary : Gris moyen (#64748B)

Typographie :
- Titres : Inter Bold, 18-22px
- Corps : Inter Regular, 14-16px
- Sous-texte : Inter Regular, 12px, couleur secondary

Composants de base à créer :
- Button (primary, secondary, danger, ghost) avec états loading/disabled
- Card (elevation, border-radius 12px)
- Badge (statut coloré)
- Modal de confirmation
- OfflineBanner (barre de statut sync)
- PullToRefresh wrapper
- EmptyState (illustration + message)
- LoadingScreen
- ScreenProtector (wrapper FLAG_SECURE pour écrans sensibles)
- BiometricPrompt (composant de déverrouillage)
```

### Livrables
- Projet Expo initialisé et buildable (iOS + Android)
- Module sécurité complet : SQLCipher, chiffrement fichiers AES-256-GCM, biométrie + PIN, détection root/jailbreak, protection captures d'écran, certificate pinning, effacement sécurisé, remote wipe, audit local
- Écran login + setup PIN + setup biométrie
- Écran de verrouillage fonctionnel
- Navigation complète (tabs + stacks) avec écrans placeholder
- WatermelonDB configuré avec schéma local chiffré
- Mécanisme sync pull/push implémenté avec transit sécurisé
- Indicateur offline visible
- Composants UI de base stylés
- Tests : flux sécurité complet (login → PIN → biométrie → verrouillage → déverrouillage), chiffrement/déchiffrement fichiers, détection root, effacement sécurisé, sync online/offline

### Critère de succès
L'IDEL peut se connecter, configurer son PIN et sa biométrie, voir la structure de l'app avec les 3 onglets. L'app se verrouille après inactivité et se déverrouille par biométrie/PIN. Les données de test se synchronisent du serveur vers le local de manière chiffrée. Un test d'extraction de la base SQLite depuis un device de test confirme qu'elle est illisible sans la DEK.

---

## ITÉRATION M2 : TOURNÉE DU JOUR — ÉCRAN PRINCIPAL (Semaines 3-4.5)

### Objectif
Construire l'écran central de l'app : la liste des RDV du jour ordonnés par créneau, avec consultation du détail, ouverture de la navigation externe, et marquage des RDV comme réalisés.

### Pourquoi maintenant
C'est l'écran que l'IDEL ouvre 10-20 fois par jour. Tout le reste de l'app gravite autour de cette liste. Le marquage "réalisé" est le déclencheur de la chaîne facture + transmission, c'est le geste métier le plus fréquent.

### Features

**F-M2.1 — Écran liste des RDV du jour**

L'écran principal affiche les RDV du jour de l'IDEL connectée, triés par heure de début (qui correspond à l'ordre de la tournée optimisée si elle existe).

```
┌──────────────────────────────────────────┐
│  📋 Ma tournée — Mardi 3 mars           │
│  🟢 Synchronisé                          │
│  ─────────────────────────────────────── │
│  8 RDV aujourd'hui · 3 réalisés          │
├──────────────────────────────────────────┤
│                                          │
│  ✅ 08:00 — Mme Dupont                   │
│  Pansement (AMI 1.5) · 20 min           │
│  12 rue des Lilas, Lyon 3               │
│  Réalisé à 08:25                         │
│                                          │
│  ✅ 08:45 — M. Martin                    │
│  Insuline (AMI 1) · 10 min              │
│  45 av. Jean Jaurès, Lyon 3             │
│  Réalisé à 08:52                         │
│                                          │
│  ▶️ 09:30 — Mme Legrand                  │
│  BSI + Pansement (BSB + AMX 1.5)        │
│  8 place Bellecour, Lyon 2              │
│  ┌──────────┐  ┌─────────────┐          │
│  │ 🧭 Y aller│  │ ✓ Réalisé  │          │
│  └──────────┘  └─────────────┘          │
│                                          │
│  ⏳ 10:15 — M. Bernard                   │
│  Toilette (BSC) · 45 min                │
│  22 rue Garibaldi, Lyon 6               │
│                                          │
│  ⏳ 11:30 — Mme Petit                    │
│  Perfusion (AMI 4) · 30 min             │
│  ...                                     │
│                                          │
├─────────┬─────────────┬──────────────────┤
│ 📋      │ 👥          │ 📖              │
│ Tournée │ Patients    │ Préparer        │
└─────────┴─────────────┴──────────────────┘
```

**Règles d'affichage :**
- RDV triés par `start_time` (l'ordre de la tournée)
- Indicateurs visuels de statut : ✅ réalisé (vert, compacté), ▶️ prochain (surligné, boutons visibles), ⏳ à venir (normal), ❌ annulé (barré, grisé)
- Le prochain RDV non réalisé est mis en évidence automatiquement (premier de la liste non complété)
- Chaque carte RDV affiche : heure, nom patient, type de soin (code + libellé), durée estimée, adresse
- Le compteur en haut ("8 RDV · 3 réalisés") donne la progression de la journée
- Pull-to-refresh pour forcer la synchronisation
- Les données viennent de WatermelonDB local (offline-ready)
- **Sécurité** : cet écran affiche des noms et adresses mais pas de données médicales détaillées → pas de FLAG_SECURE (les captures d'écran restent possibles sur cet écran pour faciliter le partage de planning entre collègues si besoin)

**F-M2.2 — Détail d'un RDV**

Tap sur une carte RDV → écran détail avec toutes les informations et les actions possibles.

```
┌──────────────────────────────────────────┐
│  ← Retour         Mme Legrand           │
│  ─────────────────────────────────────── │
│                                          │
│  📅 Mardi 3 mars · 09:30 - 10:00        │
│  📍 8 place Bellecour, Lyon 2            │
│  🏥 Domicile                             │
│                                          │
│  SOINS PRÉVUS                            │
│  ┌────────────────────────────────────┐  │
│  │ BSB — Forfait BSI intermédiaire   │  │
│  │ AMX 1.5 — Pansement escarre       │  │
│  │ IFI — Indemnité déplacement       │  │
│  │ IK — 4.2 km                       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  NOTES                                   │
│  Pansement escarre sacrum, protocole     │
│  Dr Moreau. Voir dernière transmission.  │
│                                          │
│  ──────────── ACTIONS ────────────────── │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  🧭  Naviguer vers ce patient     │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  👤  Voir fiche patient           │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  🎤  Ajouter une transmission     │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  🧾  Voir la facture              │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  ✅  Marquer comme réalisé        │    │
│  └──────────────────────────────────┘    │
│                                          │
└──────────────────────────────────────────┘
```

**Règles :**
- Le bouton "Voir la facture" n'apparaît que si le RDV est `completed` et qu'une facture existe
- Le bouton "Marquer comme réalisé" n'apparaît que si le statut est `scheduled` ou `in_progress`
- Le bouton "Naviguer" ouvre le sélecteur d'app de navigation (voir F-M2.3)
- Le bouton "Ajouter une transmission" est toujours visible (disponible avant et après le soin)
- Toutes les informations proviennent du cache local
- **Audit** : l'ouverture du détail d'un RDV logge `view_appointment` dans LOCAL_AUDIT_LOG

**F-M2.3 — Navigation externe vers le patient**

Le bouton "Naviguer" ouvre l'app de navigation préférée de l'IDEL avec l'adresse ou les coordonnées du patient.

```
Implémentation via expo-linking :

Si coordonnées GPS disponibles (lat/lon du patient) :
  - iOS : ouvre Apple Plans par défaut, ou Google Maps si installé
  - Android : ouvre le sélecteur d'apps (Google Maps, Waze, etc.)

URLs de navigation :
  - Google Maps : google.navigation:q={lat},{lon}
  - Waze : waze://?ll={lat},{lon}&navigate=yes
  - Apple Maps : maps://app?daddr={lat},{lon}
  - Fallback (adresse texte) : geo:0,0?q={adresse_encodée}

Logique :
1. Si lat/lon disponibles → navigation par coordonnées (plus précis)
2. Sinon → navigation par adresse texte
3. L'IDEL peut configurer son app GPS préférée dans les paramètres
   (par défaut : sélecteur système)
```

**F-M2.4 — Marquage RDV comme réalisé**

Le marquage "réalisé" est l'action la plus critique de l'app. Elle doit être simple mais protégée contre les erreurs.

```
Flux :
1. IDEL tape "Marquer comme réalisé"
2. Modal de confirmation :
   ┌────────────────────────────────────┐
   │                                    │
   │  Confirmer la réalisation ?        │
   │                                    │
   │  Mme Legrand                       │
   │  BSB + AMX 1.5                     │
   │  09:30 — 8 place Bellecour         │
   │                                    │
   │  Une facture sera générée          │
   │  automatiquement.                  │
   │                                    │
   │  ┌──────────┐  ┌──────────────┐   │
   │  │ Annuler  │  │ ✅ Confirmer │   │
   │  └──────────┘  └──────────────┘   │
   │                                    │
   └────────────────────────────────────┘

3. Si confirmé :
   a. Statut local passe à "completed" immédiatement
   b. Horodatage de réalisation enregistré (completed_at = now)
   c. Opération ajoutée à la file de sync push :
      { type: "appointment_status", id: "...", status: "completed", completed_at: "..." }
   d. Audit log : "mark_completed" sur l'appointment
   e. Si online → sync immédiate → le serveur génère la facture
   f. Si offline → opération en attente → facture générée au retour du réseau
   g. L'écran revient à la liste des RDV, la carte passe en vert

4. Retour arrière possible :
   - Tant que l'opération n'est pas synced, un bouton "Annuler la réalisation" est visible
   - Après sync, l'annulation nécessite de passer par le détail du RDV
     et un bouton "Corriger le statut" (remise en "scheduled")
   - L'annulation côté serveur annule également la facture associée si elle est encore en brouillon
```

**F-M2.5 — Sélection de la date**

Par défaut, l'écran affiche la tournée du jour. L'IDEL peut naviguer vers la veille ou le lendemain (les 3 jours synchronisés en local).

```
Navigation date :
- Swipe gauche/droite pour changer de jour
- Ou tap sur la date en haut → sélecteur de date (limité à J-1 / J / J+1 en offline)
- En online, possibilité de consulter n'importe quelle date (requête serveur)
```

### Livrables
- Écran liste des RDV du jour fonctionnel et stylé
- Écran détail RDV avec toutes les actions
- Navigation externe vers Google Maps / Waze / Apple Plans
- Marquage réalisé avec confirmation et sync
- Sélection de date (J-1, J, J+1)
- Audit logging intégré
- Tests : affichage RDV, marquage réalisé (online + offline), navigation externe

### Critère de succès
Ta femme peut consulter sa tournée du jour, taper sur un patient pour voir le détail, lancer la navigation GPS, et marquer les RDV comme réalisés en fin de visite — y compris sans réseau.

---

## ITÉRATION M3 : FICHES PATIENTS & SCAN ORDONNANCES (Semaines 5-6)

### Objectif
Permettre la consultation des fiches patients depuis le terrain et le scan de documents (ordonnances) via l'appareil photo du téléphone, avec rattachement au patient et conversion en PDF.

### Pourquoi maintenant
La fiche patient est consultée à chaque visite (vérification adresse, pathologies, notes, ordonnance en cours). Le scan d'ordonnance est un besoin terrain immédiat — l'IDEL reçoit une nouvelle ordonnance papier chez le patient et doit la numériser sur place.

### Features

**F-M3.1 — Liste des patients**

L'onglet "Patients" affiche la liste des patients actifs du cabinet, avec recherche rapide.

```
┌──────────────────────────────────────────┐
│  👥 Mes patients                          │
│  🟢 Synchronisé                          │
│  ─────────────────────────────────────── │
│  🔍 Rechercher un patient...              │
├──────────────────────────────────────────┤
│                                          │
│  Dupont Marie — BSI (BSB)                │
│  12 rue des Lilas, Lyon 3               │
│  Prochain RDV : demain 08:00            │
│                                          │
│  Legrand Sophie — ALD                    │
│  8 place Bellecour, Lyon 2              │
│  Prochain RDV : aujourd'hui 09:30       │
│                                          │
│  Martin Paul                             │
│  45 av. Jean Jaurès, Lyon 3             │
│  Prochain RDV : aujourd'hui 08:45       │
│                                          │
│  ...                                     │
│                                          │
└──────────────────────────────────────────┘

Recherche : filtre local instantané sur nom/prénom
  (pas de requête serveur, tout est dans WatermelonDB)

Tri par défaut : alphabétique
Filtres optionnels : BSI actif, ALD, patients du jour
Badges : BSI (niveau), ALD, prochain RDV
```

**F-M3.2 — Fiche patient détaillée**

```
┌──────────────────────────────────────────┐
│  ← Retour         Mme Dupont Marie      │
│  ─────────────────────────────────────── │
│                                          │
│  INFORMATIONS                            │
│  📍 12 rue des Lilas, 69003 Lyon         │
│  📞 06 12 34 56 78                       │
│  🎂 15/03/1942 (83 ans)                  │
│  🏥 BSI actif — BSB (jusqu'au 15/06)    │
│                                          │
│  NOTES                                   │
│  Clé sous le paillasson. Sonne 2 fois.  │
│  Chat agressif dans l'entrée.           │
│                                          │
│  ──────── ACCÈS RAPIDES ─────────────── │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  📋  Ordonnances & documents     │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  💬  Transmissions               │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  📷  Scanner une ordonnance      │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  🧭  Naviguer                    │    │
│  └──────────────────────────────────┘    │
│                                          │
│  PROCHAINS RDV                           │
│  Aujourd'hui 09:30 — BSB + AMX 1.5     │
│  Demain 09:30 — BSB + AMX 1.5          │
│                                          │
└──────────────────────────────────────────┘
```

**Règles :**
- Toutes les informations viennent du cache local (SQLCipher)
- Le numéro de téléphone est cliquable (ouverture composeur)
- L'adresse est cliquable (ouverture navigation)
- Les prochains RDV affichent uniquement les 3-5 suivants
- **Sécurité** : cet écran est protégé par FLAG_SECURE (données identifiantes patient)
- **Audit** : chaque ouverture de fiche patient → log `view_patient`

**F-M3.3 — Liste des documents et ordonnances du patient**

```
Écran documents (accessible depuis la fiche patient) :

┌──────────────────────────────────────────┐
│  ← Mme Dupont     Documents              │
│  ─────────────────────────────────────── │
│                                          │
│  ORDONNANCES ACTIVES                     │
│  ┌────────────────────────────────────┐  │
│  │ 📄 Dr Moreau — Pansement escarre  │  │
│  │    Du 01/01 au 30/06/2026         │  │
│  │    3x/semaine                     │  │
│  │    ⚠️ Expire dans 45 jours        │  │
│  │    [Voir PDF]                     │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │ 📄 Dr Petit — Insuline            │  │
│  │    Du 15/02 au 15/08/2026         │  │
│  │    7j/7                           │  │
│  │    [Voir PDF]                     │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ORDONNANCES EXPIRÉES                    │
│  ┌────────────────────────────────────┐  │
│  │ 📄 Dr Moreau — Pansement (ancien) │  │
│  │    01/07 - 31/12/2025 · Expirée   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  📷  Scanner une ordonnance      │    │
│  └──────────────────────────────────┘    │
│                                          │
└──────────────────────────────────────────┘
```

Les PDF des ordonnances sont stockés chiffrés localement (AES-256-GCM via FEK). Tap sur "Voir PDF" → déchiffrement en mémoire → affichage dans un viewer PDF natif. Le fichier déchiffré n'est jamais écrit sur le filesystem.

**Sécurité** : écran protégé FLAG_SECURE.

**F-M3.4 — Scan d'ordonnance (photo → PDF chiffré)**

Le scan est la fonctionnalité native mobile par excellence. L'IDEL prend en photo l'ordonnance papier, l'app produit un PDF propre et le rattache au patient.

```
Flux de scan :
1. IDEL tape "Scanner une ordonnance"
2. Ouverture caméra (expo-camera) en mode document :
   - Cadrage assisté : détection de contour du document si possible
     (sinon cadrage libre)
   - Bouton capture
   - Possibilité de prendre plusieurs pages (bouton "Ajouter une page")

3. Après capture :
   - Aperçu de la/des photo(s)
   - Recadrage manuel si nécessaire (crop + perspective correction via expo-image-manipulator)
   - Amélioration automatique : contraste, netteté, conversion noir & blanc
     pour lisibilité optimale (traitement local avec expo-image-manipulator)

4. Conversion en PDF :
   - Les images sont assemblées en un PDF multi-pages côté client
   - Librairie : react-native-html-to-pdf ou équivalent
   - Le PDF est généré en mémoire ou dans un fichier temporaire

5. Chiffrement immédiat :
   - Le PDF est chiffré avec AES-256-GCM (FEK) → scan_xxx.pdf.enc
   - Le fichier temporaire en clair est écrasé puis supprimé
   - Les images brutes sont écrasées puis supprimées
   - Seul le fichier .enc persiste sur le filesystem

6. Rattachement :
   - Modal de rattachement :
     ┌────────────────────────────────────┐
     │  Rattacher cette ordonnance        │
     │                                    │
     │  Patient : Mme Dupont (pré-rempli) │
     │                                    │
     │  Prescripteur : [Dr ________]      │
     │  Date ordonnance : [JJ/MM/AAAA]   │
     │  Note (optionnel) : [___________]  │
     │                                    │
     │  ┌──────────┐  ┌──────────────┐   │
     │  │ Annuler  │  │ 💾 Enregistrer│   │
     │  └──────────┘  └──────────────┘   │
     └────────────────────────────────────┘

   - Le patient est pré-rempli si le scan est lancé depuis une fiche patient
   - Les champs prescripteur et date sont libres (pas d'OCR, saisie manuelle)
   - Le document est stocké localement (LOCAL_DOCUMENTS) avec uploaded=false

7. Upload différé :
   - Le PDF est déchiffré en mémoire juste avant upload (pas sur le filesystem)
   - Upload via HTTPS + cert pinning vers POST /api/v1/patients/{id}/documents
   - Le serveur re-chiffre avec sa propre clé serveur (AES-256-GCM)
   - En attendant l'upload, le document est consultable localement (déchiffrement à la volée)
   - Audit log : "scan_document" avec patient_id

Qualité du scan :
- Résolution : 1200x1600px minimum par page
- Traitement image : augmentation contraste (+30%), sharpening, niveaux de gris
- Taille PDF cible : < 500 Ko par page
- Format PDF : PDF/A si possible (archivage long terme)
```

### Livrables
- Onglet patients avec liste et recherche locale
- Fiche patient détaillée (FLAG_SECURE + audit)
- Liste des documents/ordonnances avec visualisation PDF déchiffrée à la volée
- Scanner d'ordonnance (photo → PDF → chiffrement AES-256-GCM)
- Upload différé des documents scannés (déchiffrement en mémoire avant upload)
- Tests : recherche patient offline, scan complet, vérification que le fichier sur filesystem est bien chiffré, déchiffrement et affichage

### Critère de succès
L'IDEL peut consulter la fiche de n'importe quel patient en 2 secondes (même offline), scanner une ordonnance reçue en visite, et retrouver le document rattaché au patient. Un test d'extraction des fichiers du device confirme que les scans sont illisibles sans la FEK.

---

## ITÉRATION M4 : TRANSMISSIONS VOCALES ET ÉCRITES (Semaines 7-8.5)

### Objectif
Permettre l'enregistrement de transmissions en mode vocal (push-to-talk) ou écrit, avec envoi asynchrone au serveur pour transcription et structuration IA, et consultation de l'historique des transmissions par patient.

### Pourquoi maintenant
La transmission est le geste post-visite naturel. L'IDEL sort de chez le patient, monte en voiture, et dicte ses observations pendant que c'est frais. C'est le cas d'usage vocal n°1 et le principal gain de temps quotidien (10-15 min économisées par jour).

### Features

**F-M4.1 — Écran nouvelle transmission**

Accessible depuis le détail d'un RDV ou depuis la fiche patient. Deux modes : vocal et écrit.

```
┌──────────────────────────────────────────┐
│  ← Retour      Nouvelle transmission     │
│  ─────────────────────────────────────── │
│                                          │
│  Patient : Mme Legrand                   │
│  RDV : Aujourd'hui 09:30 (BSB + AMX)    │
│                                          │
│  ─── MODE ────────────────────────────── │
│                                          │
│  ┌─────────┐  ┌─────────────────┐       │
│  │ 🎤 Vocal │  │ ✏️ Écrit       │       │
│  │ (actif)  │  │                 │       │
│  └─────────┘  └─────────────────┘       │
│                                          │
│                                          │
│         ┌───────────────────┐            │
│         │                   │            │
│         │    🎤 Appuyez     │            │
│         │   pour dicter     │            │
│         │                   │            │
│         └───────────────────┘            │
│                                          │
│  Durée : --:--                           │
│                                          │
│                                          │
│                                          │
│                                          │
└──────────────────────────────────────────┘
```

**F-M4.2 — Enregistrement vocal (push-to-talk)**

```
Flux d'enregistrement :

1. État initial : bouton micro gris "Appuyez pour dicter"

2. IDEL tape le bouton → enregistrement démarre
   - Bouton devient rouge avec animation pulsante
   - Texte : "Enregistrement en cours... Appuyez pour arrêter"
   - Compteur de durée affiché (00:00, 00:01, ...)
   - Indicateur de niveau audio (barre animée) pour feedback visuel

3. Arrêt de l'enregistrement (3 méthodes) :
   a. Tap sur le bouton rouge → arrêt immédiat
   b. Détection de silence prolongé (> 5 secondes de silence) → arrêt automatique
   c. Durée max atteinte (5 minutes) → arrêt automatique avec notification

4. Après arrêt — CHIFFREMENT IMMÉDIAT :
   a. expo-av écrit l'audio brut dans un fichier temporaire
   b. Chiffrement AES-256-GCM (FEK) → audio_xxx.m4a.enc
   c. Suppression sécurisée du fichier temporaire en clair
      (overwrite + delete)
   d. Pour la réécoute → déchiffrement en mémoire (buffer audio)

   Écran post-enregistrement :
   ┌──────────────────────────────────────┐
   │  Enregistrement terminé (01:23)      │
   │                                      │
   │  ▶️ ━━━━━━━━━━━━━━━━━ 01:23         │
   │  [Réécouter]                         │
   │                                      │
   │  ┌──────────┐  ┌─────────────────┐  │
   │  │ 🗑️ Refaire│  │ ✅ Enregistrer  │  │
   │  └──────────┘  └─────────────────┘  │
   └──────────────────────────────────────┘

   - L'IDEL peut réécouter avant de valider (déchiffrement à la volée)
   - "Refaire" → suppression sécurisée du fichier chiffré + retour état initial
   - "Enregistrer" sauvegarde la référence dans WatermelonDB

5. Sauvegarde locale :
   - Entrée LOCAL_TRANSMISSIONS créée :
     {
       patient_id: "...",
       appointment_id: "..." (nullable),
       author_user_id: "...",
       audio_file_path: "/audio/audio_a3f2b1c4.m4a.enc",  // FICHIER CHIFFRÉ
       status: "pending_transcription",
       audio_uploaded: false,
       created_at: now()
     }
   - Opération ajoutée à la file de sync push
   - Audit log : "create_transmission" avec patient_id

6. Upload et transcription asynchrone :
   a. Si online → déchiffrement en mémoire → upload immédiat via HTTPS
      POST /api/v1/transmissions (multipart: audio stream + metadata)
      Le flux audio déchiffré n'est JAMAIS écrit sur le filesystem
   b. Serveur reçoit l'audio → stocke chiffré (AES-256-GCM serveur) → lance transcription async
   c. Serveur transcrit → lance structuration IA (Mistral)
   d. Résultats disponibles à la prochaine sync pull
   e. Si offline → audio chiffré reste en local, upload au retour du réseau

7. Réception de la transcription (sync pull ultérieure) :
   - LOCAL_TRANSMISSIONS mis à jour avec content_text et content_structured
   - status passe de "pending_transcription" à "transcribed"
   - L'IDEL peut consulter et corriger le texte (voir F-M4.4)
   - Une fois la transcription reçue et confirmée, le fichier audio local
     peut être supprimé pour économiser l'espace
     (l'audio reste sur le serveur si besoin de réécoute future)

Paramètres audio :
- Format : AAC (.m4a)
- Sample rate : 16000 Hz (suffisant pour la voix, optimal pour Whisper)
- Bitrate : 64 kbps
- Canaux : mono
- Durée max : 5 minutes
```

**Détection de silence :**
```
Implémentation simplifiée :
- expo-av fournit un callback metering
- Si le niveau audio reste sous un seuil (ex: -40 dB) pendant 5 secondes
  → notification visuelle "Silence détecté, arrêt dans 3s..."
  → arrêt automatique après 3 secondes supplémentaires si toujours silence
  → l'IDEL peut annuler l'arrêt automatique en reprenant la parole

Ceci est un comportement "nice to have" — si la détection de silence est
trop complexe à calibrer en v1, le tap pour arrêter suffit.
```

**F-M4.3 — Saisie de transmission écrite**

Alternative au vocal pour les IDEL qui préfèrent taper, ou pour les courts compléments.

```
┌──────────────────────────────────────────┐
│  ← Retour      Nouvelle transmission     │
│  ─────────────────────────────────────── │
│                                          │
│  Patient : Mme Legrand                   │
│  RDV : Aujourd'hui 09:30                │
│                                          │
│  ─── MODE ────────────────────────────── │
│                                          │
│  ┌─────────┐  ┌─────────────────┐       │
│  │ 🎤 Vocal │  │ ✏️ Écrit       │       │
│  │          │  │ (actif)         │       │
│  └─────────┘  └─────────────────┘       │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ Pansement escarre sacrum réalisé. │  │
│  │ Bonne évolution, bourgeonnement   │  │
│  │ en cours. Patiente non algique.   │  │
│  │ TA 12/8, T° 36.8°C.              │  │
│  │ RAS par ailleurs.                 │  │
│  │                                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  ✅  Enregistrer la transmission  │    │
│  └──────────────────────────────────┘    │
│                                          │
└──────────────────────────────────────────┘

Sauvegarde :
- Entrée LOCAL_TRANSMISSIONS créée avec content_text rempli
- status = "draft" (pas besoin de transcription)
- Sync push → le serveur lance la structuration IA (Mistral) sur le texte
- Au retour de la sync, content_structured est rempli
- Audit log : "create_transmission" avec patient_id
```

**F-M4.4 — Historique des transmissions d'un patient**

Accessible depuis la fiche patient. Affiche la timeline chronologique des transmissions.

```
┌──────────────────────────────────────────┐
│  ← Mme Legrand    Transmissions          │
│  ─────────────────────────────────────── │
│                                          │
│  AUJOURD'HUI                             │
│  ┌────────────────────────────────────┐  │
│  │ 🎤 09:45 — Sophie (vous)          │  │
│  │ ⏳ En attente de transcription     │  │
│  │ [🔊 Écouter l'audio]              │  │
│  └────────────────────────────────────┘  │
│                                          │
│  HIER                                    │
│  ┌────────────────────────────────────┐  │
│  │ 🎤 09:50 — Marie (collègue)       │  │
│  │                                    │  │
│  │ SYNTHÈSE IA                        │  │
│  │ Pansement escarre sacrum.          │  │
│  │ Évolution favorable, début de      │  │
│  │ bourgeonnement. Non algique.       │  │
│  │ TA 13/8. RAS.                      │  │
│  │                                    │  │
│  │ DÉTAILS                            │  │
│  │ • Soins : Pansement escarre sacrum │  │
│  │ • Constantes : TA 13/8, T° 37°C   │  │
│  │ • Observations : Bourgeonnement    │  │
│  │ • Actions : Continuer protocole    │  │
│  │                                    │  │
│  │ [🔊 Écouter l'audio]              │  │
│  │ [📝 Voir transcription complète]   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  01/03/2026                              │
│  ┌────────────────────────────────────┐  │
│  │ ✏️ 10:05 — Sophie (vous)           │  │
│  │ Légère rougeur péri-lésionnelle.  │  │
│  │ Surveillé. Dr Moreau prévenu.     │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

**Règles d'affichage :**
- Transmissions triées par date décroissante
- Icône 🎤 pour les vocales, ✏️ pour les écrites
- Nom de l'auteur affiché (important en cabinet multi-IDEL)
- Si synthèse IA disponible → affichée en premier
- "Écouter l'audio" → déchiffrement en mémoire → lecture depuis le buffer
- **Sécurité** : écran protégé FLAG_SECURE (contenu médical)
- **Audit** : chaque consultation → log `view_transmission`, chaque écoute → log `play_audio`

**F-M4.5 — Correction de transcription**

Après réception de la transcription du serveur, l'IDEL peut la corriger.

```
Tap sur une transmission transcrite → écran de correction :

- La transcription est modifiable (correction coquilles, termes médicaux)
- "Régénérer la synthèse" renvoie le texte corrigé au serveur
  pour une nouvelle structuration IA
- "Valider" passe le status à "validated" et sync
- Une transmission validée reste visible mais n'est plus modifiable
```

### Livrables
- Écran nouvelle transmission (mode vocal + mode écrit)
- Enregistrement audio push-to-talk avec chiffrement immédiat (AES-256-GCM)
- Stockage local chiffré de l'audio et upload différé (déchiffrement en mémoire uniquement)
- Historique des transmissions par patient (FLAG_SECURE)
- Écran de correction post-transcription
- Audit logging sur toutes les actions (create, view, play)
- Tests : enregistrement audio offline, vérification chiffrement fichier, upload au retour réseau, affichage historique

### Critère de succès
L'IDEL peut dicter une transmission dans sa voiture entre deux patients (même sans réseau), retrouver la transcription structurée quelques minutes plus tard, la corriger si nécessaire, et consulter les transmissions de ses collègues. Les fichiers audio sur le device sont vérifiés illisibles sans la FEK.

---

## ITÉRATION M5 : PRÉPARER MA JOURNÉE (Semaines 9-10)

### Objectif
Offrir un écran de préparation de la prochaine journée de travail, avec pour chaque patient : la synthèse IA des transmissions récentes et l'accès aux transmissions complètes.

### Pourquoi maintenant
Toutes les briques sont en place (tournée, patients, transmissions). Cet écran est la couche d'intelligence qui les agrège pour un usage spécifique : la préparation de tournée, typiquement la veille au soir.

### Features

**F-M5.1 — Écran principal "Préparer ma journée"**

Le troisième onglet de la barre de navigation. Affiche la tournée du lendemain (ou du prochain jour de travail) avec un focus sur les transmissions.

```
┌──────────────────────────────────────────┐
│  📖 Préparer ma journée                  │
│  🟢 Synchronisé                          │
│  ─────────────────────────────────────── │
│  Demain — Mercredi 4 mars                │
│  8 patients · 3 avec nouvelles infos     │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 08:00 — Mme Dupont Marie          │  │
│  │ BSB + AMX 1.5 (Pansement)         │  │
│  │                                    │  │
│  │ 📝 RÉSUMÉ IA (depuis votre        │  │
│  │    dernière visite il y a 2j)     │  │
│  │ 2 transmissions de Marie.         │  │
│  │ Évolution favorable de l'escarre  │  │
│  │ sacrum. Bourgeonnement confirmé.  │  │
│  │ Patiente stable, constantes       │  │
│  │ normales. Protocole inchangé.     │  │
│  │                                    │  │
│  │ ▼ Voir les 2 transmissions        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 08:45 — M. Martin Paul            │  │
│  │ AMI 1 (Insuline)                  │  │
│  │                                    │  │
│  │ ✅ Aucune nouvelle transmission    │  │
│  │    depuis votre dernière visite   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 09:30 — Mme Legrand Sophie        │  │
│  │ BSB + AMX 1.5 (Pansement)         │  │
│  │                                    │  │
│  │ 📝 RÉSUMÉ IA (depuis votre        │  │
│  │    dernière visite il y a 1j)     │  │
│  │ 1 transmission de Sophie (vous).  │  │
│  │ ⚠️ Légère rougeur péri-lésion.    │  │
│  │ Dr Moreau prévenu. Surveiller     │  │
│  │ évolution.                        │  │
│  │                                    │  │
│  │ ▼ Voir la transmission            │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

**Logique d'affichage :**
- Affiche les patients du prochain jour de travail de l'IDEL
- Pour chaque patient, fenêtre de transmissions depuis la dernière visite de cette IDEL
- Patients avec nouvelles informations mis en évidence (badge compteur en haut)
- Patients sans nouvelle transmission → "Aucune nouvelle" (pas de bruit informationnel)
- Alertes/points de vigilance extraits par l'IA mis en évidence avec ⚠️
- **Sécurité** : écran protégé FLAG_SECURE (synthèses médicales)

**F-M5.2 — Synthèse IA des transmissions**

```
Endpoint backend (à créer) :
GET /api/v1/tournees/{date}/preparation

Response :
{
  "date": "2026-03-04",
  "patients": [
    {
      "patient_id": "uuid",
      "patient_name": "Mme Dupont Marie",
      "appointment_time": "08:00",
      "care_types": ["BSB", "AMX 1.5"],
      "last_visit_by_current_user": "2026-03-02",
      "transmissions_since_last_visit": [
        { "id": "uuid", "author": "Marie", "date": "2026-03-03", "content_text": "..." },
        { "id": "uuid", "author": "Marie", "date": "2026-03-02", "content_text": "..." }
      ],
      "ai_summary": {
        "text": "Évolution favorable de l'escarre sacrum...",
        "alerts": ["Légère rougeur péri-lésionnelle signalée"],
        "key_vitals": { "ta": "12/8", "temperature": "36.8" }
      }
    }
  ]
}

La synthèse IA est générée côté serveur via Mistral :
- Prompt : "Synthétise les transmissions suivantes pour préparer la visite.
  Mets en évidence les alertes, les changements d'état, les constantes anormales.
  Sois concis (3-5 phrases max). Si une information est critique, préfixe-la avec ⚠️."
- Cache serveur : régénérée uniquement si nouvelles transmissions
- En offline : synthèse synchronisée en local avec les données de préparation
```

**F-M5.3 — Dépliage des transmissions complètes**

Tap sur "Voir les X transmissions" → dépliage inline (pas de navigation). L'IDEL a le résumé rapide ET le détail intégral — aucune information n'est perdue.

**F-M5.4 — Données offline pour la préparation**

```
Lors de la sync (soir précédent ou matin) :
1. Le serveur génère les synthèses IA pour les patients du lendemain
2. La sync pull récupère tout en une fois (synthèses + transmissions)
3. Stocké dans WatermelonDB (chiffré SQLCipher)
→ L'IDEL peut consulter l'écran de préparation même sans réseau le matin
```

### Livrables
- Onglet "Préparer ma journée" avec liste des patients du lendemain (FLAG_SECURE)
- Synthèse IA par patient (avec alertes mises en évidence)
- Dépliage des transmissions complètes
- Endpoint backend de préparation avec synthèse IA
- Cache offline des données de préparation
- Tests : affichage avec/sans transmissions, synthèse IA, mode offline

### Critère de succès
L'IDEL consulte l'écran la veille au soir, voit en un coup d'œil les patients nécessitant une attention particulière (alertes ⚠️), et peut lire le détail des transmissions de ses collègues pour préparer ses visites.

---

## ITÉRATION M6 : FACTURATION MOBILE (Semaines 10.5-11.5)

### Objectif
Permettre la consultation des factures générées automatiquement suite au marquage d'un RDV comme réalisé, et leur partage avec le patient (email, SMS, affichage écran). Poser les bases techniques pour l'intégration future de la carte vitale.

### Dépendance forte
Le module facturation backend (itérations 1 à 5 du plan facturation) doit être opérationnel.

### Features

**F-M6.1 — Consultation de la facture post-RDV**

Accessible depuis le détail d'un RDV marqué comme réalisé (bouton "Voir la facture").

```
┌──────────────────────────────────────────┐
│  ← Retour         Facture 2026-03-0042  │
│  ─────────────────────────────────────── │
│                                          │
│  Patient : Mme Legrand Sophie            │
│  Date : 03/03/2026                       │
│  Statut : ✅ Validée                     │
│                                          │
│  DÉTAIL DES ACTES                        │
│  ┌────────────────────────────────────┐  │
│  │ BSB — Forfait BSI interméd.       │  │
│  │                          18,20 €  │  │
│  │ AMX 1.5 — Pansement              │  │
│  │                           4,73 €  │  │
│  │ IFI — Indemnité déplacement      │  │
│  │                           2,75 €  │  │
│  │ IK — 4.2 km (plaine)             │  │
│  │                           0,07 €  │  │
│  ├────────────────────────────────────┤  │
│  │ TOTAL                    25,75 €  │  │
│  │ Part AMO (100% ALD)     25,75 €  │  │
│  │ Part patient              0,00 €  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ──────── PARTAGER ──────────────────── │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  📄  Voir le PDF                  │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  📧  Envoyer par email            │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  📱  Envoyer par SMS (lien)       │    │
│  └──────────────────────────────────┘    │
│  ┌──────────────────────────────────┐    │
│  │  🖥️  Présenter au patient         │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ──────── CARTE VITALE ─────────────── │
│  ┌────────────────────────────────────┐  │
│  │ 🔒 Validation carte vitale         │  │
│  │ Disponible dans une version        │  │
│  │ ultérieure.                        │  │
│  └────────────────────────────────────┘  │
│                                          │
└──────────────────────────────────────────┘
```

- **Sécurité** : écran protégé FLAG_SECURE (données identifiantes + financières)
- **Audit** : chaque consultation → log `view_invoice`, chaque envoi → log `send_invoice`

**F-M6.2 — Visualisation PDF**

```
"Voir le PDF" :
1. Si PDF déjà en cache local (chiffré) → déchiffrement en mémoire → affichage
2. Sinon → téléchargement depuis GET /api/v1/invoices/{id}/pdf → chiffrement → cache local
3. Affichage dans un viewer PDF natif
4. Le PDF déchiffré n'est JAMAIS écrit sur le filesystem
```

**F-M6.3 — Envoi par email**

```
"Envoyer par email" :
1. Si le patient a une adresse email → pré-remplie
2. Sinon → champ email vide à remplir
3. Modal de confirmation
4. Appel API : POST /api/v1/invoices/{id}/send { channel: "email", email: "..." }
5. Confirmation visuelle : "Email envoyé ✅"
6. Si offline → opération en file d'attente, envoi au retour du réseau
```

**F-M6.4 — Envoi par SMS (lien)**

```
"Envoyer par SMS" :
1. Numéro pré-rempli si disponible
2. Appel API : POST /api/v1/invoices/{id}/send { channel: "sms", phone: "..." }
3. Le serveur génère un lien sécurisé temporaire vers le PDF
   (ex: https://app.exemple.fr/factures/view/{token}?expires=48h)
4. Le serveur envoie le SMS avec le lien
5. Confirmation : "SMS envoyé ✅"
6. Si offline → file d'attente
```

**F-M6.5 — Présentation à l'écran pour le patient**

```
"Présenter au patient" :
- Ouvre le PDF en plein écran, orientation paysage autorisée
- Boutons navigation (zoom, pages) visibles
- Bouton "Fermer" bien visible en haut
- Mode "présentation" : pas d'autres éléments UI visibles
  (l'IDEL tend le téléphone au patient pour qu'il voie la facture)
- Note : FLAG_SECURE est désactivé temporairement en mode présentation
  (le patient doit pouvoir voir la facture), mais réactivé à la fermeture
```

**F-M6.6 — Préparation pour la carte vitale (architecture uniquement)**

```
Pas d'implémentation fonctionnelle, mais l'architecture prévoit :

1. LOCAL_INVOICES inclut vitale_status :
   "not_read", "read_pending_validation", "validated"
   → Toujours "not_read" en v1

2. Emplacement visuel réservé (bouton grisé "Disponible prochainement")

3. invoiceService.ts prévoit validateVitaleCard(invoiceId) → placeholder

4. Schéma WatermelonDB inclut les champs NIR (chiffrés par SQLCipher)
   dans LOCAL_PATIENTS pour la future lecture carte vitale

5. Documentation interne : référence l'itération 8 du plan facturation
   (intégration SESAM-Vitale) et les pistes techniques (e-CPS, NFC Bluetooth)
```

### Livrables
- Écran consultation de facture (FLAG_SECURE + audit)
- Viewer PDF avec cache local chiffré
- Envoi par email / SMS avec pré-remplissage
- Mode présentation plein écran
- Placeholder carte vitale
- Endpoint backend POST /invoices/{id}/send
- Tests : consultation online/offline, vérification cache PDF chiffré, envoi email/SMS

### Critère de succès
L'IDEL marque un RDV comme réalisé, ouvre la facture générée, et peut immédiatement l'envoyer au patient ou la lui montrer à l'écran. Le PDF est consultable offline si déjà téléchargé. Le cache PDF est vérifié chiffré sur le filesystem.

---

## ITÉRATION M7 : NOTIFICATIONS PUSH & POLISH UX (Semaine 12-12.5)

### Objectif
Ajouter les notifications push pour les événements importants et effectuer le polish UX final avant les tests terrain.

### Pourquoi en dernier
Les notifications sont transversales et nécessitent que toutes les briques soient stables. Le polish UX bénéficie du feedback accumulé.

### Features

**F-M7.1 — Notifications push**

```
Infrastructure :
- expo-notifications pour la gestion côté client
- FCM (Firebase Cloud Messaging) pour Android
- APNs (Apple Push Notification service) pour iOS
- Backend : endpoint d'enregistrement du device token
  POST /api/v1/devices/register { token, platform, user_id }

IMPORTANT — Sécurité des notifications :
- Les notifications push NE DOIVENT PAS contenir de données de santé
  dans leur payload (visible sur l'écran verrouillé du téléphone)
- Le contenu sensible est récupéré APRÈS déverrouillage de l'app
- Exemples de payloads sûrs :
  ✅ "RDV annulé — consultez votre tournée"
  ✅ "Nouvelle transmission pour Mme D."  (initiale seulement)
  ❌ "Mme Dupont : escarre sacrum en aggravation"  (INTERDIT)

Trois types de notifications en v1 :

1. ANNULATION DE RDV
   Payload : { title: "RDV annulé", body: "Un RDV de votre tournée a été annulé." }
   Action au tap : ouvre l'app → déverrouillage biométrique/PIN → écran tournée

2. NOUVELLE TRANSMISSION D'UNE COLLÈGUE
   Payload : { title: "Nouvelle transmission", body: "Nouveau message pour un de vos patients." }
   Action au tap : ouvre l'app → déverrouillage → historique transmissions du patient

3. CONFIRMATION DE SYNCHRONISATION
   Payload : { title: "Synchronisation terminée", body: "X éléments synchronisés." }
   Action au tap : ouvre l'app → déverrouillage → écran tournée

Notification silencieuse supplémentaire :
4. REMOTE WIPE
   Push silencieux (pas de notification visible)
   → Déclenche l'effacement sécurisé en arrière-plan
   → L'IDEL ne voit rien (le voleur non plus)

Paramètres utilisateur :
- Chaque type de notification peut être activé/désactivé individuellement
- Plage horaire de silence configurable (défaut : pas de notifications entre 22h et 7h)
```

**F-M7.2 — Écran paramètres**

```
┌──────────────────────────────────────────┐
│  ← Retour         Paramètres            │
│  ─────────────────────────────────────── │
│                                          │
│  COMPTE                                  │
│  Sophie Durand · RPPS 12345678          │
│  Cabinet des Brotteaux                  │
│                                          │
│  SÉCURITÉ                                │
│  Verrouillage biométrique   [✅ ON]     │
│  Délai verrouillage         [2 min ▼]   │
│  Modifier le code PIN       [→]         │
│                                          │
│  NAVIGATION                              │
│  App GPS préférée : [Système ▼]         │
│  (Système / Google Maps / Waze)         │
│                                          │
│  NOTIFICATIONS                           │
│  Annulations de RDV         [✅ ON]     │
│  Transmissions collègues    [✅ ON]     │
│  Confirmations de sync      [⬜ OFF]    │
│  Silence nocturne (22h-7h)  [✅ ON]     │
│                                          │
│  DONNÉES                                 │
│  Dernière sync : il y a 3 min           │
│  Données en cache : 12.4 Mo             │
│  [🔄 Forcer la synchronisation]         │
│  [🗑️ Vider le cache local]              │
│                                          │
│  [🚪 Se déconnecter]                    │
│  ⚠️ Toutes les données locales seront   │
│  effacées de manière sécurisée.         │
│                                          │
└──────────────────────────────────────────┘

Note : le bouton "Vider le cache local" effectue un effacement sécurisé
(overwrite + delete) de tous les fichiers + purge WatermelonDB,
puis relance une sync pull complète.

Le délai de verrouillage est configurable : 1 min, 2 min (défaut), 5 min.
Le maximum de 5 minutes est une limite dure non modifiable.
```

**F-M7.3 — Polish UX et micro-interactions**

```
1. États de chargement :
   - Skeleton screens (pas de spinners) pour les listes
   - Shimmer effect sur les cards pendant le chargement
   - Pull-to-refresh avec animation fluide

2. États vides :
   - Illustration + message pour chaque écran vide
   - "Pas de RDV aujourd'hui — profitez de votre journée 🌿"
   - "Aucune transmission pour ce patient"
   - "Aucun document scanné"

3. Feedback haptique :
   - Vibration légère au marquage "réalisé"
   - Vibration de confirmation à l'envoi de transmission

4. Transitions :
   - Animations de navigation fluides
   - Animation de la card RDV quand elle passe en "réalisé" (slide + fade to green)

5. Gestion des erreurs :
   - Messages d'erreur humains (pas de codes techniques)
   - Bouton "Réessayer" systématique
   - Toast notifications pour les confirmations (non-bloquantes)

6. Accessibilité :
   - Labels accessibilité sur tous les boutons
   - Contraste WCAG AA respecté
   - Taille de touch target minimum 44x44px
```

**F-M7.4 — Build et test terrain**

```
Build :
- Build APK Android via EAS Build (Expo Application Services)
- Build TestFlight iOS via EAS Build
- Profil "preview" pour tests internes

Test terrain avec ta femme — check-list complète :

SÉCURITÉ :
  □ Premier login → setup PIN → setup biométrie
  □ Verrouillage après inactivité (2 min) → déverrouillage biométrie
  □ Verrouillage → déverrouillage PIN
  □ 5 échecs PIN → effacement automatique (test sur device de test uniquement !)
  □ Extraction fichiers device → vérification tous chiffrés (.enc)
  □ Extraction base SQLite → vérification illisible sans DEK
  □ Captures d'écran bloquées sur fiche patient
  □ Déconnexion → vérification effacement complet

FONCTIONNEL :
  □ Consultation tournée du jour
  □ Navigation vers un patient (GPS externe)
  □ Marquage RDV réalisé (avec confirmation)
  □ Dictée transmission vocale (réécoute avant envoi)
  □ Saisie transmission écrite
  □ Scan ordonnance → PDF → rattachement patient
  □ Consultation facture post-RDV
  □ Envoi facture par email
  □ Présentation facture à l'écran
  □ Consultation préparation journée lendemain
  □ Historique transmissions patient

OFFLINE :
  □ Mode avion pendant 30 min
  □ Marquage RDV réalisé en offline
  □ Dictée transmission en offline
  □ Scan ordonnance en offline
  □ Consultation fiche patient en offline
  □ Retour réseau → sync automatique → vérification données poussées

NOTIFICATIONS :
  □ Réception notification annulation RDV (simulée depuis le web)
  □ Notification ne contient PAS de données médicales sur l'écran verrouillé
  □ Tap → déverrouillage → bon écran
```

### Livrables
- Notifications push (3 types + remote wipe silencieux) avec sécurité des payloads
- Écran paramètres (sécurité configurable, sync, notifications)
- Polish UX (skeleton screens, états vides, animations, feedback haptique)
- Build APK + TestFlight
- Session de test terrain documentée (sécurité + fonctionnel + offline)
- Liste de bugs/ajustements post-test

### Critère de succès
L'app est suffisamment stable, sécurisée et agréable pour une utilisation quotidienne réelle. Ta femme peut l'utiliser pendant une journée de tournée complète sans blocage. Les notifications arrivent sans exposer de données médicales. Tous les tests de sécurité passent.

---

## RÉCAPITULATIF

| Itération | Durée | Features clés | Dépendances backend | Valeur utilisateur |
|-----------|-------|--------------|--------------------|--------------------|
| **M1. Socle, sécurité & offline** | 2.5 sem | Auth, SQLCipher, chiffrement fichiers AES-256-GCM, biométrie + PIN, détection root, FLAG_SECURE, cert pinning, remote wipe, audit local, WatermelonDB, sync | Auth + devices (socle) | Fondation sécurisée |
| **M2. Tournée du jour** | 2 sem | Liste RDV, détail, nav GPS externe, marquage réalisé | Tournées, Appointments | Écran principal terrain |
| **M3. Patients & scan** | 1.5 sem | Fiches patients, documents, scan ordonnance → PDF chiffré | Patients, Prescriptions | Consultation + numérisation |
| **M4. Transmissions** | 2 sem | Push-to-talk, audio chiffré local, transcription async, historique | STT (voice C), Transmissions | Game-changer temps terrain |
| **M5. Préparer journée** | 1.5 sem | Synthèse IA transmissions, agrégation par patient, alertes | Endpoint préparation | Intelligence pré-tournée |
| **M6. Facturation** | 1.5 sem | Consultation facture, PDF chiffré, envoi email/SMS/écran, base carte vitale | Facturation iters 2+5 | Cycle visite complet |
| **M7. Notifs & polish** | 1 sem | Push sécurisées (sans données médicales), paramètres, UX polish, build test | FCM/APNs | App prête pour le terrain |

**Durée totale : ~12.5 semaines**

---

## POINTS D'ATTENTION TRANSVERSAUX

### Synthèse du modèle de sécurité mobile

```
COUCHES DE PROTECTION (défense en profondeur) :

┌─── COUCHE 1 : Intégrité du device ────────────────────────────┐
│  Détection root/jailbreak → blocage accès si compromis        │
│  Vérification au démarrage + à chaque retour au premier plan  │
└───────────────────────────────────────────────────────────────┘
         │
┌─── COUCHE 2 : Authentification utilisateur ───────────────────┐
│  Login email/mot de passe (premier accès)                     │
│  Biométrie (Face ID / empreinte) + PIN applicatif (retour)    │
│  Verrouillage automatique après inactivité (2-5 min)          │
│  5 échecs PIN → effacement automatique                        │
└───────────────────────────────────────────────────────────────┘
         │
┌─── COUCHE 3 : Chiffrement au repos ──────────────────────────┐
│  Base de données : SQLCipher (AES-256-CBC, clé dans Keychain) │
│  Fichiers (audio, PDF, scans) : AES-256-GCM par fichier      │
│  Clés (DEK + FEK) dans Secure Enclave / Hardware Keystore    │
│  Séparation des clés : DEK ≠ FEK (compromission partielle)   │
└───────────────────────────────────────────────────────────────┘
         │
┌─── COUCHE 4 : Chiffrement en transit ────────────────────────┐
│  TLS 1.3 obligatoire                                          │
│  Certificate pinning SPKI (anti man-in-the-middle)            │
│  Déchiffrement fichiers en mémoire uniquement avant upload    │
└───────────────────────────────────────────────────────────────┘
         │
┌─── COUCHE 5 : Minimisation et effacement ────────────────────┐
│  Données locales minimisées (fenêtre 3 jours RDV, 7j transmissions) │
│  Effacement sécurisé à la déconnexion (overwrite + delete)    │
│  Effacement automatique après 30 jours d'inactivité           │
│  Remote wipe depuis le dashboard web (push silencieux)         │
│  Fichiers temporaires en clair → chiffrement immédiat + suppression │
└───────────────────────────────────────────────────────────────┘
         │
┌─── COUCHE 6 : Protection de l'interface ─────────────────────┐
│  FLAG_SECURE sur écrans avec données médicales (anti-screenshot) │
│  Notifications push sans données de santé dans le payload      │
│  Mode présentation facture : désactivation temporaire contrôlée │
└───────────────────────────────────────────────────────────────┘
         │
┌─── COUCHE 7 : Traçabilité ───────────────────────────────────┐
│  Audit local de tous les accès aux données sensibles          │
│  Sync des logs d'audit vers le serveur (conformité HDS)       │
│  Logs sans contenu médical (uniquement IDs + actions)         │
│  Enregistrement des devices + suivi last_seen_at              │
└───────────────────────────────────────────────────────────────┘

Résultat : même en cas de vol du téléphone, les données patient sont
protégées par au minimum 3 couches (biométrie + SQLCipher + AES fichiers).
Sans la DEK (stockée dans le Secure Enclave), les données sont
cryptographiquement inaccessibles.
```

### Performance et taille de l'app

```
Objectifs :
- Taille APK : < 50 Mo (installation raisonnable)
- Démarrage (incluant checks sécurité) : < 3 secondes
  · Détection root : < 200ms
  · Récupération DEK SecureStore : < 100ms
  · Ouverture SQLCipher : < 500ms
  · Vérification remote wipe : < 200ms (ou skip si offline)
  · Total overhead sécurité : < 1 seconde
- Biométrie prompt : < 500ms (dépend de l'OS)
- Navigation entre écrans : < 300ms
- Recherche patient locale (SQLCipher) : < 100ms
- Chiffrement/déchiffrement fichier 500 Ko : < 200ms
- WatermelonDB est très performant en lecture (lazy loading natif)
  → L'overhead SQLCipher est ~5-15% sur les requêtes, imperceptible

Gestion de la mémoire :
- Les fichiers audio ne sont pas chargés en mémoire entièrement
  (déchiffrement par chunks si possible, sinon buffer complet < 5 Mo)
- Les PDF sont déchiffrés en mémoire à la demande
- Les listes utilisent FlatList (virtualisation native React Native)
- Taille cache cible : < 50 Mo (fichiers chiffrés inclus)
```

### Stratégie de test

```
Tests unitaires :
- Module security/ : chiffrement/déchiffrement, gestion clés, détection root
- Stores Zustand (logique métier locale)
- Helpers (formatage dates, montants)
- Logique de file d'attente offline

Tests d'intégration :
- Flux sync pull/push avec mock serveur
- Flux enregistrement audio → chiffrement → stockage → déchiffrement → upload
- Flux scan → conversion PDF → chiffrement → stockage → upload
- Flux remote wipe (simulé)

Tests de sécurité spécifiques :
- Vérification que la base SQLite extraite est illisible sans DEK
- Vérification que les fichiers .enc sont illisibles sans FEK
- Vérification qu'aucun fichier temporaire en clair ne persiste après opération
- Vérification que les logs d'audit ne contiennent pas de données médicales
- Vérification FLAG_SECURE sur les écrans protégés
- Vérification que les payloads de notification ne contiennent pas de données sensibles
- Test de déconnexion : vérification effacement complet (base + fichiers + SecureStore)

Tests E2E (Detox) :
- Flux login complet (email → PIN → biométrie)
- Flux verrouillage → déverrouillage
- Flux tournée → marquage réalisé
- Flux transmission vocale (enregistrement → chiffrement → réécoute)
- Mode offline → retour online → sync

Tests terrain (manuels) :
- Chaque fin d'itération : test réel avec ta femme
- Focus sur l'utilisabilité en conditions réelles (une main, en marchant, réseau instable)
- Focus sécurité : vérification comportement perte de réseau, verrouillage, etc.
```
