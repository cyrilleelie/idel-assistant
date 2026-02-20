# ARCHITECTURE FRONTEND — ASSISTANT IA IDEL
## Application mobile (React Native) + Dashboard web (React)

**Version :** 1.0
**Date :** Février 2026
**Basé sur :** PRD v1.0, architecture.md, architecture-update-tournees.md

---

## TABLE DES MATIÈRES

1. [Stratégie frontend](#1-stratégie)
2. [ADR frontend](#2-adr)
3. [Application mobile — Écrans MVP](#3-mobile)
4. [Dashboard web — Écrans MVP](#4-web)
5. [API Client partagé](#5-api-client)
6. [Prompt 5 — Frontend mobile](#6-prompt-5)
7. [Prompt 6 — Frontend web](#7-prompt-6)
8. [Review 5 & 6](#8-reviews)

---

## 1. STRATÉGIE FRONTEND

### 1.1 Deux interfaces, deux usages

**Application mobile (React Native + Expo)** — Interface terrain
- Utilisée par l'IDEL pendant sa tournée, entre deux patients
- Contraintes : une main occupée, réseau variable, écran petit
- Priorités : rapidité, gros boutons, informations essentielles
- Écrans clés : tournée du jour (carte), suggestion de créneaux, dossier patient rapide

**Dashboard web (React + Vite)** — Interface bureau
- Utilisée au cabinet, en fin de journée ou en soirée
- Contraintes : écran large, clavier/souris, connexion stable
- Priorités : vue d'ensemble, gestion, statistiques, configuration
- Écrans clés : agenda complet, gestion patients, stats, configuration secteurs

### 1.2 Scope MVP pour chaque frontend

**Mobile MVP (Prompt 5) — Ce qu'on montre à ta femme :**
- Login
- Tournée du jour (carte avec secteurs + liste des patients ordonnés)
- Suggestion de créneaux (la killer feature : "où caser ce nouveau patient ?")
- Fiche patient rapide (infos essentielles + dernière transmission)
- Création rapide d'un RDV

**Web MVP (Prompt 6) — Gestion et vue d'ensemble :**
- Login
- Dashboard stats (patients du jour, km, nombre de visites)
- Gestion patients (liste, recherche, création, édition)
- Agenda semaine (vue calendrier)
- Gestion des secteurs géographiques (carte interactive)

**Hors scope MVP (V1.0+) :**
- Transcription vocale (nécessite Whisper, MVP2)
- Facturation/télétransmission
- Agent vocal
- Notifications push
- Mode hors-ligne

---

## 2. ARCHITECTURE DECISION RECORDS

### ADR-010 : Expo (managed workflow) pour le mobile

**Contexte :** L'app mobile doit accéder au GPS (carte tournée), et potentiellement au micro (transcription future). Build iOS + Android nécessaire.

**Options considérées :**
- React Native CLI (bare workflow) — contrôle total, config complexe
- Expo managed — simplifié, OTA updates, limitations sur certains modules natifs
- Flutter — performant, mais langage Dart, pas de partage code avec le web React

**Décision :** Expo managed workflow.

**Justification :**
- Un seul développeur (Cyrille), pas le temps de gérer Xcode + Android Studio
- Expo Go permet de tester sur le téléphone de ta femme SANS build ni déploiement
- OTA updates = corrections instantanées pendant la beta, pas besoin de republier sur les stores
- Les modules nécessaires au MVP (Maps, Location, Camera) sont disponibles dans Expo
- Si besoin d'un module natif non supporté plus tard (ex: WebSocket audio streaming pour Whisper), on pourra eject vers bare workflow

**Conséquence :** Pas besoin de Mac pour build iOS pendant le MVP — Expo Go + EAS Build (cloud) suffisent.

---

### ADR-011 : Zustand pour le state management (mobile + web)

**Contexte :** Gestion de l'état client (user connecté, données en cache, UI state).

**Options considérées :**
- Redux Toolkit — puissant, verbose, boilerplate important
- Zustand — minimal, simple, performant
- Jotai/Recoil — atomique, bien pour état distribué
- TanStack Query seul — suffisant pour le server state, pas pour le UI state

**Décision :** Zustand pour l'UI state + TanStack Query pour le server state.

**Justification :**
- Zustand : ~1kb, API minimaliste, pas de boilerplate, pas de Provider
- TanStack Query : gère le cache API, refetch automatique, loading/error states
- Combinaison = chaque outil fait ce qu'il fait de mieux
- Même stack sur mobile et web = partage de logique possible

---

### ADR-012 : Leaflet (web) + react-native-maps (mobile) pour les cartes

**Contexte :** Les cartes sont centrales (tournée du jour, secteurs, suggestions de créneaux).

**Décision :**
- **Mobile** : `react-native-maps` via Expo — utilise Apple Maps (iOS) et Google Maps (Android) nativement
- **Web** : Leaflet + OpenStreetMap (gratuit, pas de clé API, données souveraines)

**Justification :** Pas de Google Maps sur le web pour éviter la dépendance à une API key payante et l'envoi de données à Google. OpenStreetMap est suffisant pour afficher des tournées et des secteurs.

---

### ADR-013 : Vite + Tailwind + shadcn/ui pour le web

**Décision :** React (Vite) avec Tailwind CSS et shadcn/ui.

**Justification :**
- Vite : build ultra-rapide, HMR instantané
- Tailwind : styling utility-first, rapide à itérer pour un dev solo
- shadcn/ui : composants accessibles et customisables (pas une dépendance npm, code copié dans le projet)
- Recharts pour les graphiques de stats
- TanStack Query pour le cache API
- react-router-dom v7 pour le routing

---

## 3. APPLICATION MOBILE — ÉCRANS MVP

### 3.1 Navigation structure

```
Tab Navigator (bottom tabs)
├── 🏠 Tournée (écran principal)
│   ├── Vue carte (tournée du jour, secteurs colorés)
│   └── Vue liste (patients ordonnés chronologiquement)
│
├── 🔍 Suggestion (killer feature)
│   ├── Formulaire de recherche de créneau
│   └── Résultats : top 3 suggestions sur carte
│
├── 👤 Patients
│   ├── Liste patients (recherche, filtres)
│   └── Fiche patient (détail, dernière transmission, protocole)
│
└── ⚙️ Profil
    ├── Infos IDEL
    ├── Horaires de travail
    └── Déconnexion

Écrans modaux :
├── Login / Register
├── Création RDV rapide
└── Détail d'une suggestion (carte zoomée + explication)
```

### 3.2 Écran par écran

**Écran 1 — Tournée du jour (onglet principal)**
```
┌─────────────────────────────┐
│  Lun. 20 Février     👤 SM  │  ← Date + initiales IDEL
├─────────────────────────────┤
│                             │
│      [CARTE LEAFLET]        │  ← Carte centrée sur la zone
│    Marqueurs patients       │     de travail
│    colorés par secteur      │     Secteurs en overlay
│    Ligne chronologique      │     semi-transparent
│    du trajet                │
│                             │
├─────────────────────────────┤
│  📊 8 patients | 34 km      │  ← Métriques résumées
│     2h15 trajet | 4h soins  │
├─────────────────────────────┤
│  ⚠️ Aller-retour détecté    │  ← Alerte inefficacité
│  Orvault→Nantes→Orvault     │     (optionnel, discret)
├─────────────────────────────┤
│                             │
│  🕐 08:00  Mme Durand      │  ← Liste scrollable
│     📍 Orvault | Insuline   │     ordonnée par heure
│     🔵 Secteur Nord         │
│                             │
│  🕐 08:45  M. Petit        │
│     📍 Orvault | Pansement  │
│     🔵 Secteur Nord         │
│                             │
│  🕐 09:30  Mme Martin      │
│     📍 Sautron | BSI        │
│     🔵 Secteur Nord         │
│                             │
│  🕐 12:00 ── Pause déj ──  │
│                             │
│  ...                        │
└─────────────────────────────┘
│ 🏠 Tournée  🔍 Suggestion  👤 Patients  ⚙️ Profil │
```

**Écran 2 — Suggestion de créneau (killer feature)**
```
┌─────────────────────────────┐
│  Trouver un créneau         │
├─────────────────────────────┤
│                             │
│  Patient : [Recherche... 🔍]│  ← Autocomplete patients
│                             │
│  Type soin : [Pansement  ▼] │  ← Dropdown
│  Durée :     [20 min     ▼] │
│  Lieu :      ● Domicile     │
│              ○ Cabinet      │
│  Jour :      [Aujourd'hui▼] │
│  Préférence: [Matin      ▼] │
│                             │
│  [ 🔍 Trouver un créneau ] │  ← Bouton principal
│                             │
├─────────────────────────────┤
│  3 créneaux trouvés         │
│                             │
│  ⭐ 1. 10h10 - 10h40       │  ← Meilleure suggestion
│     Score 87/100            │
│     📍 800m de Mme Dupont   │
│     🔵 Secteur Nord         │
│     +3 min de trajet        │
│     [ Réserver ce créneau ] │
│                             │
│  2. 14h30 - 15h00           │
│     Score 62/100            │
│     📍 2.1km de M. Bernard  │
│     🔴 Nantes Centre        │
│     +8 min de trajet        │
│     [ Réserver ce créneau ] │
│                             │
│  3. 16h15 - 16h45           │
│     Score 45/100            │
│     📍 5.3km, hors secteur  │
│     +15 min de trajet       │
│     [ Réserver ce créneau ] │
└─────────────────────────────┘
```

**Écran 3 — Fiche patient rapide**
```
┌─────────────────────────────┐
│  ← Retour     Mme Durand   │
├─────────────────────────────┤
│  📍 12 rue de la Paix       │
│     Orvault (44700)         │
│     🔵 Secteur Nord         │
│  📞 06 01 02 03 04          │
├─────────────────────────────┤
│  Protocole actif            │
│  💉 Insuline — 2×/jour      │
│  📅 Tous les jours 8h00     │
├─────────────────────────────┤
│  Dernière transmission      │
│  📅 19 fév. — Sophie M.     │
│  "Glycémie 1.1, injection   │
│  réalisée sans difficulté.  │
│  Patiente en bon état       │
│  général."                  │
├─────────────────────────────┤
│  Prochains RDV              │
│  📅 Demain 08:00 — Insuline │
│  📅 22 fév. 08:00 — Insuline│
│                             │
│  [ + Nouveau RDV ]          │
└─────────────────────────────┘
```

**Écran 4 — Liste patients**
```
┌─────────────────────────────┐
│  Patients         [🔍    ]  │
├─────────────────────────────┤
│  Filtres: Tous ▼ | A-Z ▼   │
├─────────────────────────────┤
│                             │
│  👤 Mme Durand              │
│     Orvault | 🔵 Nord      │
│     Insuline 2×/j          │
│                             │
│  👤 M. Petit                │
│     Orvault | 🔵 Nord      │
│     Pansement 3×/sem       │
│                             │
│  👤 Mme Martin              │
│     Sautron | 🔵 Nord      │
│     BSI 1×/sem             │
│                             │
│  ...                        │
├─────────────────────────────┤
│  [ + Nouveau patient ]      │
└─────────────────────────────┘
```

---

## 4. DASHBOARD WEB — ÉCRANS MVP

### 4.1 Navigation structure

```
Sidebar (gauche fixe)
├── 📊 Dashboard (accueil)
├── 📅 Agenda (vue semaine)
├── 👤 Patients (gestion complète)
├── 🗺️ Secteurs (carte + config)
└── ⚙️ Paramètres

Header (top bar)
├── Nom du cabinet
├── Sélecteur IDEL (si cabinet multi)
└── Profil / Déconnexion
```

### 4.2 Écran par écran

**Dashboard — Vue d'ensemble**
```
┌──────┬──────────────────────────────────────────────┐
│      │  Dashboard              Aujourd'hui 20 fév.  │
│  📊  ├──────────────────────────────────────────────┤
│      │                                              │
│  📅  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│      │  │  8   │ │ 34km │ │2h15  │ │ 4h   │       │
│  👤  │  │visits│ │trajet│ │route │ │soins │       │
│      │  └──────┘ └──────┘ └──────┘ └──────┘       │
│  🗺️  │                                              │
│      │  ┌─ Tournée du jour ──────────────────────┐  │
│  ⚙️  │  │                                        │  │
│      │  │         [CARTE LEAFLET]                │  │
│      │  │    Patients + secteurs + trajet         │  │
│      │  │                                        │  │
│      │  └────────────────────────────────────────┘  │
│      │                                              │
│      │  ┌─ Prochains RDV ──┐ ┌─ Stats semaine ──┐  │
│      │  │ 08:00 Mme Durand │ │ [RECHARTS]       │  │
│      │  │ 08:45 M. Petit   │ │ km/jour sur 7j   │  │
│      │  │ 09:30 Mme Martin │ │                   │  │
│      │  │ ...               │ │                   │  │
│      │  └──────────────────┘ └───────────────────┘  │
└──────┴──────────────────────────────────────────────┘
```

**Agenda — Vue semaine**
```
┌──────┬──────────────────────────────────────────────┐
│      │  Agenda        < Sem. 8 — Fév 2026 >        │
│  📊  ├──────────────────────────────────────────────┤
│      │  Lun    Mar    Mer    Jeu    Ven    Sam      │
│  📅  │ ┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐       │
│      │ │8:00││8:00││8:00││8:00││8:00││    │       │
│  👤  │ │Dura││Dura││Dura││Dura││Dura││    │       │
│      │ │────││────││────││────││────││    │       │
│  🗺️  │ │8:45││8:30││8:45││8:45││9:00││    │       │
│      │ │Peti││Mart││Peti││Peti││Mart││    │       │
│  ⚙️  │ │────││────││────││────││────││    │       │
│      │ │9:30││    ││9:30││    ││    ││    │       │
│      │ │Mart││    ││Mart││    ││    ││    │       │
│      │ │... ││... ││... ││... ││... ││    │       │
│      │ └────┘└────┘└────┘└────┘└────┘└────┘       │
│      │                                              │
│      │  Clic sur créneau vide → Suggestion créneau  │
│      │  Clic sur RDV → Détail / Modifier / Annuler  │
└──────┴──────────────────────────────────────────────┘
```

**Patients — Liste et gestion**
```
┌──────┬──────────────────────────────────────────────┐
│      │  Patients (42)    [🔍 Rechercher...]  [+Add] │
│  📊  ├──────────────────────────────────────────────┤
│      │  Filtres: Secteur [Tous▼] Statut [Actifs▼]   │
│  📅  ├──────────────────────────────────────────────┤
│      │  Nom          Commune    Secteur   Protocole  │
│  👤  │  ─────────────────────────────────────────── │
│      │  Mme Durand   Orvault   🔵 Nord   Insuline   │
│  🗺️  │  M. Petit     Orvault   🔵 Nord   Pansement  │
│      │  Mme Martin   Sautron   🔵 Nord   BSI        │
│  ⚙️  │  M. Bernard   Nantes    🔴 Centre  Injection  │
│      │  Mme Lefebvre Nantes    🔴 Centre  Pansement  │
│      │  ...                                          │
│      ├──────────────────────────────────────────────┤
│      │  < 1 2 3 ... 5 >         42 patients au total│
└──────┴──────────────────────────────────────────────┘
```

**Secteurs — Carte interactive**
```
┌──────┬──────────────────────────────────────────────┐
│      │  Secteurs géographiques              [+Add]  │
│  📊  ├──────────────────────────────────────────────┤
│      │                                              │
│  📅  │  ┌──────────────────────┐ ┌──────────────┐  │
│      │  │                      │ │ 🔵 Nord      │  │
│  👤  │  │    [CARTE LEAFLET]   │ │ Orvault,     │  │
│      │  │                      │ │ Sautron      │  │
│  🗺️  │  │  Zones colorées     │ │ 18 patients  │  │
│      │  │  par secteur         │ │ [✏️] [🗑️]    │  │
│  ⚙️  │  │                      │ │              │  │
│      │  │  Marqueurs patients  │ │ 🟢 Est       │  │
│      │  │  sur la carte        │ │ Carquefou,   │  │
│      │  │                      │ │ Ste-Luce     │  │
│      │  │                      │ │ 12 patients  │  │
│      │  │                      │ │ [✏️] [🗑️]    │  │
│      │  │                      │ │              │  │
│      │  │                      │ │ 🔴 Centre    │  │
│      │  │                      │ │ Nantes       │  │
│      │  │                      │ │ 12 patients  │  │
│      │  │                      │ │ [✏️] [🗑️]    │  │
│      │  └──────────────────────┘ └──────────────┘  │
└──────┴──────────────────────────────────────────────┘
```

---

## 5. API CLIENT PARTAGÉ

### 5.1 Structure commune

Les deux frontends communiquent avec la même API. Pour éviter la duplication, on crée un client API typé réutilisable.

```typescript
// Fichier partageable entre mobile et web (ou dupliqué avec même structure)

// api/client.ts — Configuration axios/fetch
const API_BASE_URL = __DEV__ ? 'http://localhost:8000/api/v1' : 'https://api.idel-assistant.fr/api/v1';

// api/auth.ts
export const authApi = {
  register: (data: RegisterRequest) => post<TokenResponse>('/auth/register', data),
  login: (data: LoginRequest) => post<TokenResponse>('/auth/login', data),
  refresh: (data: RefreshRequest) => post<TokenResponse>('/auth/refresh', data),
};

// api/patients.ts
export const patientsApi = {
  list: (params?: PatientListParams) => get<PatientListResponse>('/patients', params),
  getById: (id: string) => get<PatientResponse>(`/patients/${id}`),
  create: (data: PatientCreateRequest) => post<PatientResponse>('/patients', data),
  update: (id: string, data: PatientUpdateRequest) => patch<PatientResponse>(`/patients/${id}`, data),
  archive: (id: string, reason: string) => del(`/patients/${id}?reason=${reason}`),
};

// api/slots.ts
export const slotsApi = {
  suggest: (data: SlotSuggestRequest) => post<SlotSuggestResponse>('/slots/suggest', data),
  book: (rank: number, data: BookSlotRequest) => post<AppointmentResponse>(`/slots/suggest/${rank}/book`, data),
};

// api/tournees.ts
export const tourneesApi = {
  getToday: (idelId?: string) => get<TourneeDetailResponse>('/tournees/today', { idel_id: idelId }),
  arrive: (tourneeId: string, stopId: string) => post(`/tournees/${tourneeId}/stops/${stopId}/arrive`),
  getStats: (from: string, to: string) => get<TourneeStatsResponse>('/tournees/stats', { from, to }),
};

// api/sectors.ts
export const sectorsApi = {
  list: () => get<SectorResponse[]>('/sectors'),
  create: (data: SectorCreateRequest) => post<SectorResponse>('/sectors', data),
  update: (id: string, data: SectorUpdateRequest) => patch<SectorResponse>(`/sectors/${id}`, data),
  delete: (id: string) => del(`/sectors/${id}`),
};

// api/appointments.ts
export const appointmentsApi = {
  list: (params?: AppointmentListParams) => get<AppointmentListResponse>('/appointments', params),
  create: (data: AppointmentCreateRequest) => post<AppointmentResponse>('/appointments', data),
  cancel: (id: string, reason: string) => post(`/appointments/${id}/cancel`, { reason }),
  complete: (id: string) => post(`/appointments/${id}/complete`),
};
```

### 5.2 Types TypeScript

```typescript
// types/models.ts — Types miroir des schemas Pydantic du backend

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  address: string;
  lat?: number;
  lon?: number;
  phone?: string;
  email?: string;
  postal_code?: string;
  city?: string;
  sector_id?: string;
  preferred_time_slot?: 'morning' | 'afternoon' | 'any';
  care_duration_default: number;
  status: 'active' | 'archived';
}

interface Appointment {
  id: string;
  patient_id: string;
  idel_id: string;
  scheduled_at: string;
  duration_minutes: number;
  care_type: string;
  location_type: 'home' | 'office';
  time_window_start: string;
  time_window_end: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'canceled' | 'no_show';
  created_by: 'manual' | 'vocal_agent' | 'protocol' | 'import';
  patient?: Patient;  // Inclus dans certaines réponses
}

interface SlotSuggestion {
  rank: number;
  start_time: string;
  end_time: string;
  detour_km: number;
  detour_minutes: number;
  same_sector: boolean;
  sector_name?: string;
  score: number;
  explanation: string;
  previous_appointment?: AppointmentSummary;
  next_appointment?: AppointmentSummary;
}

interface TourneeDetail {
  tournee: Tournee;
  map_data: {
    stops: TourneeMapStop[];
    sectors: SectorMapData[];
  };
  metrics: TourneeMetrics;
  inefficiencies: string[];
}

interface Sector {
  id: string;
  name: string;
  postal_codes: string[];
  communes: string[];
  color: string;
  display_order: number;
}
```

---

## 6. PROMPT 5 — FRONTEND MOBILE (React Native + Expo)

```
Consulte docs/architecture-frontend.md et docs/architecture-update-tournees.md.

On crée l'application mobile MVP avec React Native + Expo.

=== SETUP PROJET ===

Initialise un projet Expo dans le dossier frontend-mobile/ :
- Expo SDK 52 (ou le plus récent stable)
- TypeScript
- Expo Router (file-based routing)
- Le template "tabs" d'Expo comme point de départ

Installe ces dépendances :
- @tanstack/react-query (server state, cache API)
- zustand (UI state : user, tokens, préférences)
- react-native-maps (carte native)
- expo-location (GPS)
- expo-secure-store (stockage sécurisé des tokens)
- axios (HTTP client)
- react-native-paper (composants UI Material Design)
- date-fns (manipulation dates, format français)

Configuration :
- app.json / app.config.ts avec nom "IDEL Assistant", icône placeholder, splash screen
- Thème couleurs : bleu médical (#2563EB primary, #1E40AF dark, #60A5FA light)
- Font : Inter (Google Fonts via expo-google-fonts, ou system font)

=== STRUCTURE DES DOSSIERS ===

```
frontend-mobile/
├── app/                          # Expo Router (file-based)
│   ├── _layout.tsx               # Root layout (providers, auth check)
│   ├── (auth)/                   # Groupe non authentifié
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/                   # Groupe authentifié (tab navigator)
│   │   ├── _layout.tsx           # Tab bar config
│   │   ├── index.tsx             # Tournée du jour (onglet principal)
│   │   ├── suggest.tsx           # Suggestion de créneaux
│   │   ├── patients/
│   │   │   ├── index.tsx         # Liste patients
│   │   │   └── [id].tsx          # Fiche patient
│   │   └── profile.tsx           # Profil IDEL
│   └── modals/
│       ├── new-appointment.tsx   # Création RDV rapide
│       └── slot-detail.tsx       # Détail suggestion sur carte
│
├── src/
│   ├── api/                      # Client API
│   │   ├── client.ts             # Config axios, interceptors, refresh token
│   │   ├── auth.ts
│   │   ├── patients.ts
│   │   ├── appointments.ts
│   │   ├── slots.ts
│   │   ├── tournees.ts
│   │   └── sectors.ts
│   ├── hooks/                    # Custom hooks
│   │   ├── useAuth.ts            # Login, logout, token management
│   │   ├── useTournee.ts         # Query tournée du jour
│   │   ├── useSlotSuggestion.ts  # Mutation suggestion créneaux
│   │   └── usePatients.ts        # Query/mutation patients
│   ├── stores/                   # Zustand stores
│   │   └── authStore.ts          # User, tokens, isAuthenticated
│   ├── components/               # Composants réutilisables
│   │   ├── TourneeMap.tsx        # Carte avec patients et secteurs
│   │   ├── PatientCard.tsx       # Card patient dans une liste
│   │   ├── AppointmentItem.tsx   # Ligne RDV dans une liste
│   │   ├── SlotSuggestionCard.tsx # Card suggestion de créneau
│   │   ├── SectorBadge.tsx       # Badge coloré du secteur
│   │   └── MetricsBar.tsx        # Barre de métriques (km, patients, etc.)
│   ├── types/                    # Types TypeScript
│   │   └── models.ts
│   └── utils/
│       ├── formatters.ts         # Format dates, distances, durées en français
│       └── colors.ts             # Palette couleurs secteurs
│
└── assets/                       # Images, icônes
```

=== ÉCRANS À IMPLÉMENTER ===

1. Login (app/(auth)/login.tsx) :
   - Email + password
   - Bouton "Se connecter"
   - Lien "Créer un compte"
   - Stocke tokens dans expo-secure-store
   - Redirige vers (tabs) après login

2. Tournée du jour (app/(tabs)/index.tsx) — ÉCRAN PRINCIPAL :
   - En haut : carte react-native-maps avec :
     - Marqueurs patients colorés par secteur
     - Zones secteurs en overlay semi-transparent
     - Ligne du trajet chronologique
   - En bas : liste scrollable des RDV du jour ordonnés par heure
     - Chaque item : heure, nom patient, commune, type soin, badge secteur
     - Tap → ouvre fiche patient
   - Barre métriques : nombre patients, km total, temps trajet
   - Si alerte inefficacité → bandeau discret en bas de la carte
   - Pull-to-refresh pour recharger

3. Suggestion de créneau (app/(tabs)/suggest.tsx) — KILLER FEATURE :
   - Formulaire : sélection patient (autocomplete), type soin (dropdown),
     durée, lieu (domicile/cabinet), jour, préférence (matin/après-midi/peu importe)
   - Bouton "Trouver un créneau"
   - Résultats : 3 cards SlotSuggestionCard empilées avec :
     - Rang (⭐1, 2, 3), horaire, score /100
     - Détour en km et minutes
     - Badge secteur, explication en langage naturel
     - Bouton "Réserver ce créneau" → crée le RDV via l'API
   - État vide : "Aucun créneau disponible pour ce jour"
   - Loading state pendant la recherche

4. Liste patients (app/(tabs)/patients/index.tsx) :
   - Barre de recherche en haut
   - FlatList avec PatientCard (nom, commune, secteur, protocole actif)
   - FAB "+" pour ajouter un patient
   - Tap → navigation vers fiche patient

5. Fiche patient (app/(tabs)/patients/[id].tsx) :
   - Header : nom, adresse, téléphone (tap to call), badge secteur
   - Section "Protocole actif" : type soin, fréquence, prochains RDV
   - Section "Dernière transmission" : date, contenu résumé
   - Section "Prochains RDV" : liste des 5 prochains
   - Bouton "Nouveau RDV" → modale création

6. Profil (app/(tabs)/profile.tsx) :
   - Nom, email, RPPS
   - Horaires de travail (éditable)
   - Nom du cabinet
   - Bouton déconnexion

=== CLIENT API ===

client.ts doit gérer :
- Base URL configurable (localhost:8000 en dev)
- Interceptor qui ajoute le Bearer token à chaque requête
- Interceptor qui catch les 401, tente un refresh token, et retry
- Si refresh échoue → déconnexion automatique (clear store + redirect login)
- Timeout de 10 secondes

=== AUTH FLOW ===

authStore.ts (Zustand) :
- State : { user, accessToken, refreshToken, isAuthenticated, isLoading }
- Actions : login(email, password), logout(), refreshTokens()
- Persist : tokens dans expo-secure-store (pas AsyncStorage, car données sensibles)

_layout.tsx (root) :
- Au démarrage, vérifie si un token existe dans secure-store
- Si oui → tente un refresh → si OK, redirige vers (tabs)
- Si non → redirige vers (auth)/login

=== CARTE TOURNÉE (composant TourneeMap.tsx) ===

Le composant central. Reçoit les données de GET /tournees/today et affiche :
- MapView centré sur la bounding box de tous les patients
- Markers avec couleur du secteur et numéro d'ordre (callout avec nom + heure)
- Polyline entre les stops dans l'ordre chronologique
- Polygones/cercles semi-transparents pour les secteurs (optionnel MVP, nice to have)

=== GESTION DES ERREURS ===

- Pas de réseau → message "Vérifiez votre connexion" avec bouton retry
- API erreur 500 → message générique "Une erreur est survenue"
- Formulaires : validation inline (champs requis, format email)
- TanStack Query gère le retry automatique (3 tentatives)

=== TESTS ===

Pas de tests automatisés frontend pour le MVP — le test c'est ta femme qui
utilise l'app sur son téléphone via Expo Go. Focus sur le fonctionnel.

=== LANCEMENT EN DEV ===

Pour tester sur le téléphone de ta femme :
1. npx expo start
2. Scanner le QR code avec Expo Go (Android) ou l'app Caméra (iOS)
3. L'app se charge en direct, hot reload activé
```

**✅ Checkpoint 5 :** L'app se lance via `npx expo start`. Sur ton téléphone (Expo Go), tu vois l'écran de login. Après login, l'onglet Tournée affiche la carte avec les patients du jour. L'onglet Suggestion permet de chercher un créneau et affiche les résultats.

---

## 7. PROMPT 6 — FRONTEND WEB (React + Vite)

```
Consulte docs/architecture-frontend.md et docs/architecture-update-tournees.md.

On crée le dashboard web MVP avec React + Vite + Tailwind + shadcn/ui.

=== SETUP PROJET ===

Initialise un projet dans le dossier frontend-web/ :
  npm create vite@latest . -- --template react-ts

Installe les dépendances :
- tailwindcss, @tailwindcss/vite (v4)
- @tanstack/react-query
- zustand
- react-router-dom (v7)
- axios
- recharts
- leaflet + react-leaflet + @types/leaflet
- date-fns
- lucide-react (icônes)

Setup shadcn/ui :
- npx shadcn@latest init
- Ajouter les composants : button, input, card, table, dialog, dropdown-menu,
  tabs, badge, select, label, toast, separator, sheet

Configuration :
- Tailwind configuré avec les couleurs du thème IDEL (#2563EB primary)
- Vite proxy : /api → http://localhost:8000 (pour éviter CORS en dev)
- Alias @ → src/

=== STRUCTURE DES DOSSIERS ===

```
frontend-web/
├── src/
│   ├── main.tsx
│   ├── App.tsx                    # Router + providers
│   │
│   ├── api/                       # Client API (même structure que mobile)
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── patients.ts
│   │   ├── appointments.ts
│   │   ├── slots.ts
│   │   ├── tournees.ts
│   │   └── sectors.ts
│   │
│   ├── hooks/                     # Custom hooks (react-query wrappers)
│   │   ├── useAuth.ts
│   │   ├── useTournee.ts
│   │   ├── usePatients.ts
│   │   ├── useAppointments.ts
│   │   ├── useSectors.ts
│   │   └── useSlotSuggestion.ts
│   │
│   ├── stores/
│   │   └── authStore.ts           # Zustand (tokens dans localStorage en dev)
│   │
│   ├── types/
│   │   └── models.ts              # Types TS identiques au mobile
│   │
│   ├── pages/                     # Pages (une par route)
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── AgendaPage.tsx
│   │   ├── PatientsPage.tsx
│   │   ├── PatientDetailPage.tsx
│   │   └── SectorsPage.tsx
│   │
│   ├── components/                # Composants réutilisables
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── AppLayout.tsx      # Sidebar + Header + content
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx     # Card avec chiffre + label + icône
│   │   │   ├── TodaySchedule.tsx  # Liste RDV du jour
│   │   │   ├── WeekChart.tsx      # Recharts : km/jour sur 7j
│   │   │   └── TourneeMapWeb.tsx  # Carte Leaflet de la tournée
│   │   ├── patients/
│   │   │   ├── PatientTable.tsx   # Table avec tri, recherche, pagination
│   │   │   ├── PatientForm.tsx    # Formulaire création/édition (Dialog)
│   │   │   └── PatientDetail.tsx  # Détail avec protocoles et RDV
│   │   ├── agenda/
│   │   │   ├── WeekView.tsx       # Grille semaine type Google Calendar
│   │   │   ├── DayColumn.tsx      # Colonne d'un jour
│   │   │   └── AppointmentBlock.tsx # Bloc RDV coloré par secteur
│   │   ├── sectors/
│   │   │   ├── SectorMap.tsx      # Carte Leaflet avec zones colorées
│   │   │   ├── SectorList.tsx     # Liste des secteurs (sidebar carte)
│   │   │   └── SectorForm.tsx     # Dialog création/édition secteur
│   │   └── shared/
│   │       ├── SectorBadge.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── EmptyState.tsx
│   │
│   └── utils/
│       ├── formatters.ts
│       └── colors.ts
│
├── public/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

=== PAGES À IMPLÉMENTER ===

1. LoginPage :
   - Centré sur la page, card avec logo + formulaire email/password
   - Bouton connexion, lien création compte
   - Stocke tokens, redirige vers dashboard

2. DashboardPage (page d'accueil après login) :
   - 4 MetricCards en ligne : patients du jour, km trajet, temps trajet, temps soins
   - Carte Leaflet (TourneeMapWeb) : tournée du jour avec secteurs
   - Liste "Prochains RDV" (5 prochains, scrollable)
   - Graphique Recharts : km parcourus par jour sur les 7 derniers jours
   - Si inefficacité détectée → alerte discrète sous la carte

3. AgendaPage :
   - Vue semaine (lundi-samedi) avec grille horaire (7h-19h)
   - Blocs colorés par secteur pour chaque RDV
   - Navigation semaine précédente/suivante
   - Clic sur créneau vide → ouvre Dialog suggestion de créneau
   - Clic sur un RDV → Dialog détail (modifier, annuler)
   - Sélecteur d'IDEL si cabinet multi-membres

4. PatientsPage :
   - Table shadcn avec colonnes : nom, commune, secteur (badge couleur), protocole, statut
   - Recherche en haut (filtre instantané)
   - Filtres : par secteur (dropdown), par statut (actif/archivé)
   - Pagination
   - Bouton "Ajouter" → Dialog PatientForm
   - Clic ligne → PatientDetailPage

5. PatientDetailPage :
   - Header avec nom, adresse, téléphone, email, badge secteur
   - Onglets : "Protocoles", "RDV à venir", "Transmissions", "Infos"
   - Boutons : "Modifier", "Archiver", "Nouveau RDV"

6. SectorsPage :
   - Layout 60/40 : carte Leaflet à gauche, liste secteurs à droite
   - Sur la carte : zones colorées semi-transparentes par secteur, marqueurs patients
   - Liste : cards par secteur avec nom, communes, nombre de patients, couleur
   - Bouton "Ajouter secteur" → Dialog formulaire
   - Clic "Modifier" sur un secteur → Dialog édition
   - Suppression avec confirmation

=== CARTE LEAFLET (composant TourneeMapWeb.tsx) ===

Utilise react-leaflet avec tiles OpenStreetMap :
- TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
- Markers avec icônes personnalisées (numéro + couleur secteur)
- Polyline pour le trajet chronologique
- Popup sur chaque marker : nom patient, heure, type soin
- Bounds automatiques pour cadrer tous les patients

=== ROUTING (react-router-dom) ===

```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<ProtectedRoute />}>    {/* Vérifie auth */}
    <Route element={<AppLayout />}>       {/* Sidebar + Header */}
      <Route path="/" element={<DashboardPage />} />
      <Route path="/agenda" element={<AgendaPage />} />
      <Route path="/patients" element={<PatientsPage />} />
      <Route path="/patients/:id" element={<PatientDetailPage />} />
      <Route path="/sectors" element={<SectorsPage />} />
    </Route>
  </Route>
</Routes>
```

ProtectedRoute : vérifie que le user est authentifié (token valide dans store).
Si non → redirect vers /login.

=== RESPONSIVE ===

Le dashboard est prévu pour desktop (écran large).
- Sidebar collapse en mode tablette (icônes seulement)
- Pas de support mobile pour le web (c'est le rôle de l'app native)
- Min-width recommandé : 1024px

=== TESTS ===

Pas de tests automatisés pour le MVP web. Test manuel en navigateur.
Focus sur Chrome (desktop) — support Firefox/Safari en bonus.

=== LANCEMENT EN DEV ===

```powershell
cd frontend-web
npm install
npm run dev
# → http://localhost:5173
# Le proxy Vite redirige /api vers le backend FastAPI sur :8000
```
```

**✅ Checkpoint 6 :** Le dashboard se lance sur http://localhost:5173. Après login, tu vois le dashboard avec les 4 métriques, la carte de la tournée, et la liste des prochains RDV. La page Patients affiche la table avec recherche. La page Secteurs affiche la carte avec les zones colorées.

---

## 8. PROMPTS DE REVIEW

### REVIEW 5 — Frontend mobile

```
Tu es un développeur React Native senior et UX designer spécialisé en apps terrain.
Audite l'application mobile qu'on vient de générer.

Consulte docs/architecture-frontend.md pour les spécifications.

=== UTILISABILITÉ TERRAIN ===
Le contexte d'usage est critique : une infirmière entre deux patients, 
debout sur le palier, avec une main occupée et 2 minutes devant elle.

- [ ] Les boutons et zones tactiles font au minimum 44x44 px (recommandation Apple)
- [ ] Le texte est lisible sans plisser les yeux (16px minimum pour le body)
- [ ] L'écran principal (tournée) affiche l'info essentielle SANS scroll
- [ ] Le nombre de taps pour les actions fréquentes est minimal :
  - Voir la tournée du jour : 0 tap (écran d'accueil)
  - Chercher un créneau : 1 tap (onglet Suggestion)
  - Voir un patient : 2 taps (onglet Patients → tap patient)
- [ ] Le loading est rapide (<2s) ou montre un skeleton/spinner
- [ ] Pull-to-refresh fonctionne sur les listes

=== NAVIGATION ===
- [ ] La tab bar a 4 onglets max (Tournée, Suggestion, Patients, Profil)
- [ ] Les icônes des tabs sont claires et distinctes
- [ ] Le retour arrière fonctionne correctement (hardware back sur Android)
- [ ] Les modales se ferment en swipe down ou bouton X

=== SUGGESTION DE CRÉNEAUX (écran critique) ===
- [ ] Le formulaire est simple : patient, type soin, durée, lieu, jour, préférence
- [ ] L'autocomplete patient fonctionne (recherche par nom)
- [ ] Les résultats sont clairs : score, horaire, détour, explication
- [ ] Le bouton "Réserver" crée bien le RDV et confirme à l'utilisateur
- [ ] Si aucun créneau → message explicite, pas un écran vide

=== CARTE ===
- [ ] La carte se charge en <3s
- [ ] Les marqueurs sont visibles et distinguables (couleurs + numéros)
- [ ] Le zoom par défaut montre tous les patients du jour
- [ ] Tap sur un marqueur → popup avec nom patient et heure

=== AUTH ===
- [ ] Les tokens sont dans expo-secure-store (PAS AsyncStorage)
- [ ] Le refresh token fonctionne automatiquement
- [ ] Déconnexion → retour à login, tokens supprimés
- [ ] L'app au démarrage vérifie le token et redirige correctement

=== QUALITÉ CODE ===
- [ ] Pas de any TypeScript (ou très peu, justifiés)
- [ ] Les hooks react-query ont des queryKey cohérents
- [ ] Les erreurs API sont gérées (état erreur affiché à l'utilisateur)
- [ ] Pas de console.log en production
- [ ] Les composants sont raisonnablement découpés (pas de fichier de 500 lignes)

Pour chaque problème, donne sévérité et correction.
```

### REVIEW 6 — Frontend web

```
Tu es un développeur frontend senior spécialisé en dashboards React.
Audite le dashboard web qu'on vient de générer.

Consulte docs/architecture-frontend.md pour les spécifications.

=== FONCTIONNEL ===
- [ ] Le login fonctionne et redirige vers le dashboard
- [ ] Le dashboard affiche les 4 métriques et la carte
- [ ] La table patients a recherche, filtres, pagination
- [ ] L'agenda semaine affiche les RDV en blocs colorés par secteur
- [ ] La page secteurs affiche la carte avec zones et la liste
- [ ] La navigation sidebar fonctionne sur toutes les pages

=== CARTE LEAFLET ===
- [ ] Les tiles OpenStreetMap se chargent correctement
- [ ] Les marqueurs patients sont colorés par secteur
- [ ] Le trajet chronologique est affiché en polyline
- [ ] Les popups fonctionnent au clic
- [ ] La carte s'adapte automatiquement pour montrer tous les points (fitBounds)
- [ ] Pas d'erreur dans la console liée à Leaflet

=== UI/UX ===
- [ ] Le layout sidebar + content est propre et aligné
- [ ] Les couleurs correspondent au thème défini (#2563EB primary)
- [ ] Les tables sont lisibles avec suffisamment d'espace
- [ ] Les graphiques Recharts sont lisibles et légendés
- [ ] Les dialogs/modales fonctionnent (ouvrir, fermer, valider)
- [ ] Les états de chargement sont gérés (spinner ou skeleton)
- [ ] Les états vides sont gérés ("Aucun patient" avec bouton d'action)

=== SÉCURITÉ ===
- [ ] Les tokens sont gérés correctement (pas en clair dans le code)
- [ ] Les routes protégées redirigent vers /login si non authentifié
- [ ] Le refresh token fonctionne
- [ ] Le proxy Vite est configuré pour /api → backend

=== QUALITÉ CODE ===
- [ ] TypeScript strict (pas de any injustifiés)
- [ ] Les composants shadcn/ui sont utilisés correctement
- [ ] Les hooks react-query sont cohérents
- [ ] Le code est raisonnablement structuré par feature
- [ ] Les imports sont propres (pas de chemins relatifs profonds, utilise @/)

Pour chaque problème, donne sévérité et correction.
```
