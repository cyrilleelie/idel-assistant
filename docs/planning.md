# PLANNING DE RÉALISATION ITÉRATIF
## Développement POC → MVP → Production
### Optimisé pour démos rapides et demandes de financement

---

## VISION GLOBALE : APPROCHE ITÉRATIVE

```
PHASE 0          POC 1         POC 2         MVP 1         MVP 2
Préparation   Backend Demo   Frontend     Beta testable  Production
                              Demo                        
    │             │             │             │             │
    ▼             ▼             ▼             ▼             ▼
  0-2 sem      3-4 sem       5-6 sem       7-16 sem     17-44 sem
    0€          500€           0€          5 000€       40 000€
    
    │◄──── Démo financement ────►│
              (6 semaines)
                                 │◄────── Beta tests ──────►│
                                        (10 semaines)
                                                            │◄── Production ──►│
                                                                  (28 semaines)
```

**Jalons clés :**
- ✅ **Semaine 6** : Démo fonctionnelle pour financements (BPI, investisseurs)
- ✅ **Semaine 16** : Beta privée avec 3-5 cabinets
- ✅ **Semaine 44** : Production certifiée HDS, lancement commercial

---

## PHASE 0 : PRÉPARATION (Semaines 1-2) - COÛT : 0€

### Objectif
Focus 100% sur la création de valeur : POC technique et candidatures financement

**⚠️ PAS DE CRÉATION SAS à ce stade**
- Pas nécessaire pour développer
- Pas nécessaire pour candidater BPI (accepte "projet en création")
- Reporté à semaine 10 (quand financement confirmé)
- Économie : 300€ + focus préservé

### SEMAINE 1 : POC Backend + Candidatures

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Setup environnement dev** | Toi | 0.5j | 0€ | Env prêt |
| - GitHub repo privé (gratuit) | Toi | 10min | 0€ | Repo créé |
| - Docker PostgreSQL local | Toi | 30min | 0€ | DB locale |
| - VS Code + extensions Python | Toi | 30min | 0€ | IDE configuré |
| - Claude (déjà abonné) | - | - | 0€ | Accès API |
| **POC Backend FastAPI** | Toi + Claude | 2j | 0€ | API fonctionnelle |
| - Structure projet (Claude Code/Antigravity) | Toi | 1h | 0€ | Boilerplate |
| - Modèles SQLAlchemy (Patient, RDV, User) | Toi + Claude | 3h | 0€ | Models |
| - Auth JWT | Toi + Claude | 2h | 0€ | Login/register |
| - CRUD Patients | Toi + Claude | 2h | 0€ | 4 endpoints |
| - CRUD Rendez-vous | Toi + Claude | 2h | 0€ | 4 endpoints |
| - Seed data démo (5 patients, 10 RDV) | Toi | 1h | 0€ | DB peuplée |
| - Tests Postman | Toi | 1h | 0€ | Collection |
| **Pitch deck v0.1** | Toi + Ta femme | 1j | 0€ | PDF 10 slides |
| - Template Canva gratuit | Toi | 30min | 0€ | Template |
| - Problème IDEL (ta femme expertise) | Ta femme | 2h | 0€ | Slides 1-3 |
| - Solution technique (toi) | Toi | 2h | 0€ | Slides 4-6 |
| - Marché et business model | Toi | 1h | 0€ | Slides 7-8 |
| - Équipe (vous deux) | Toi | 30min | 0€ | Slide 9 |
| - Demande financement | Toi | 30min | 0€ | Slide 10 |

**Budget semaine 1 : 0€**

**Livrables clés :**
- ✅ Backend API fonctionnelle (locale)
- ✅ Pitch deck v0.1

---

### SEMAINE 2 : POC Optimisation + Candidatures financement

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Candidature BPI Bourse French Tech** | Toi | 1j | 0€ | Dossier soumis |
| - Business plan simple | Toi | 3h | 0€ | Excel + PDF |
| - Formulaire BPI "projet en création" | Toi | 3h | 0€ | Formulaire |
| - Soumission (sans SIRET nécessaire) | Toi | 1h | 0€ | Accusé réception |
| **Candidatures subventions régionales** | Toi | 0.5j | 0€ | Dossiers soumis |
| - Identifier dispositifs région | Toi | 1h | 0€ | Liste (2-3) |
| - Adapter pitch deck | Toi | 2h | 0€ | Dossiers |
| - Soumissions | Toi | 1h | 0€ | Accusés |
| **POC OR-Tools optimisation** | Toi + Claude | 1j | 0€ | Algo démo |
| - Prompt Claude : VRPTW OR-Tools | Toi | 1h | 0€ | Code généré |
| - Données test (10 patients Paris) | Toi | 1h | 0€ | Dataset |
| - Tests avec vraies adresses (ta femme) | Toi + Ta femme | 2h | 0€ | Validé |
| - Visualisation carte (Folium) | Toi | 1h | 0€ | Carte HTML |
| - Endpoint API /optimize-tour | Toi | 1h | 0€ | Endpoint |
| **Sourcing DPO externe** | Toi | 0.5j | 0€ | 3 devis |
| - Recherche DPO (LinkedIn, annuaires) | Toi | 1h | 0€ | Liste 10 DPO |
| - Demande devis (3 DPO) | Toi | 1h | 0€ | Emails envoyés |
| - Appels découverte | Toi | 2h | 0€ | Notes |

**Budget semaine 2 : 0€**

**Livrables clés :**
- ✅ Candidatures financement soumises (réponse sem 8-10)
- ✅ POC optimisation tournées fonctionnel
- ✅ Devis DPO reçus

**Budget cumulé Phase 0 : 0€** ✅

---

## POC 1 : BACKEND DÉMO (Semaines 3-4) - COÛT : 0€

### Objectif
**Backend déployé publiquement pour démo financement** (pas production-ready)

Fonctionnalités :
- API REST complète (Auth, Patients, RDV, Optimisation)
- PostgreSQL
- Démo optimisation tournée
- **Déploiement public gratuit (Oracle Cloud Free)**

### SEMAINE 3 : Backend complet

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Finalisation API** | Toi + Claude | 2j | 0€ | API complète |
| - Amélioration modèles | Toi + Claude | 0.5j | 0€ | Models |
| - Endpoints manquants | Toi + Claude | 0.5j | 0€ | CRUD complet |
| - Validation données (Pydantic) | Toi + Claude | 0.5j | 0€ | Validators |
| - Tests unitaires (pytest) | Toi + Claude | 0.5j | 0€ | Tests |
| **Documentation API** | Toi + Claude | 0.5j | 0€ | Swagger UI |
| - OpenAPI auto (FastAPI) | Toi | 1h | 0€ | Docs auto |
| - Collection Postman enrichie | Toi | 1h | 0€ | Collection |
### SEMAINE 4 : Déploiement démo + Vidéo

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Déploiement Oracle Cloud Free** | Toi | 1j | 0€ | URL publique |
| - Créer compte Oracle Cloud (gratuit) | Toi | 30min | 0€ | Compte |
| - VM Always Free (1 vCPU, 1GB RAM) | Toi | 1h | 0€ | VM active |
| - Docker + Docker-compose | Toi | 1h | 0€ | Conteneurs |
| - Deploy FastAPI + PostgreSQL | Toi | 2h | 0€ | API live |
| - SSL Let's Encrypt (gratuit) | Toi | 1h | 0€ | HTTPS |
| - Seed data sur serveur | Toi | 30min | 0€ | DB peuplée |
| **Vidéo démo 2-3min** | Toi | 1j | 0€ | MP4 |
| - Screencast API (OBS Studio gratuit) | Toi | 1h | 0€ | Vidéo brute |
| - Démo optimisation tournée (carte) | Toi | 30min | 0€ | Screencast |
| - Montage (DaVinci Resolve gratuit) | Toi | 1h | 0€ | Montage |
| - Voiceover explicatif | Toi | 30min | 0€ | Audio |
| - Export + upload YouTube (unlisted) | Toi | 30min | 0€ | URL vidéo |

**Budget semaine 4 : 0€**

**Livrables POC 1 :**
- ✅ API backend déployée publiquement (URL)
- ✅ Documentation Swagger accessible
- ✅ POC optimisation tournée fonctionnel
- ✅ Vidéo démo 2-3min professionnelle
- ✅ Collection Postman complète

**🎯 Utilisable pour :**
- Candidatures financement (démo technique vivante)
- Pitch investisseurs (preuve faisabilité concrète)
- Discussions avec beta testers potentiels

**Budget cumulé : 0€** ✅

---

## POC 2 : FRONTEND DÉMO (Semaines 5-6) - COÛT : 0€

### Objectif
**Interface mobile basique pour démo visuelle**

Écrans :
- Login
- Liste patients
- Liste RDV
- Carte tournée optimisée

**Pas production-ready** : juste démo visuelle pour financement

### SEMAINE 5 : Setup frontend + Écrans de base

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Logo + Identité (gratuit)** | Toi | 0.5j | 0€ | Assets |
| - Génération logo (Canva gratuit ou Bing AI) | Toi | 1h | 0€ | Logo PNG/SVG |
| - Palette couleurs (Claude suggère) | Toi | 15min | 0€ | Hex codes |
| - Typographie Google Fonts | Toi | 10min | 0€ | Fonts |
| **Setup React Native** | Toi + Claude | 1j | 0€ | App squelette |
| - Prompt Claude : boilerplate Expo | Toi | 30min | 0€ | Code généré |
| - Navigation (React Navigation) | Toi + Claude | 2h | 0€ | Stack nav |
| - Theme Tailwind (NativeWind) | Toi + Claude | 1h | 0€ | Styled |
| **Écran Login** | Toi + Claude | 0.5j | 0€ | Écran |
| - Prompt Claude : écran login styled | Toi | 20min | 0€ | Code |
| - Intégration API auth | Toi | 1h | 0€ | Fonctionnel |
| - Tests | Toi | 30min | 0€ | Validé |
| **Écran Liste Patients** | Toi + Claude | 1j | 0€ | Écran |
| - Prompt Claude : liste avec cards | Toi | 20min | 0€ | UI généré |
| - Intégration API patients | Toi | 2h | 0€ | Data réelle |
| - Pull-to-refresh | Toi | 30min | 0€ | Feature |
| - Navigation vers détail | Toi | 30min | 0€ | Navigation |
| **Écran Liste RDV** | Toi + Claude | 1j | 0€ | Écran |
| - Prompt Claude : liste RDV timeline | Toi | 20min | 0€ | UI |
| - Intégration API RDV | Toi | 2h | 0€ | Data |
| - Filtres date | Toi | 1h | 0€ | Filtres |

**Budget semaine 5 : 0€**

---

### SEMAINE 6 : Carte tournée + Démo finale

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Écran Carte tournée** | Toi + Claude | 2j | 0€ | Écran carte |
| - Prompt Claude : map React Native Maps | Toi | 30min | 0€ | Code carte |
| - Affichage markers patients | Toi | 2h | 0€ | Markers |
| - Appel API /optimize-tour | Toi | 1h | 0€ | Intégré |
| - Polyline itinéraire optimisé | Toi | 2h | 0€ | Tracé |
| - Numéros ordre visite | Toi | 1h | 0€ | Labels |
| **Polish UI** | Toi + Claude | 1j | 0€ | UI améliorée |
| - Dark mode | Toi + Claude | 2h | 0€ | Theme |
| - Loading states | Toi | 1h | 0€ | Spinners |
| - Error handling basique | Toi | 1h | 0€ | Messages |
| - Icons (Lucide) | Toi | 1h | 0€ | Icons |
| **Build démo** | Toi | 0.5j | 0€ | APK + démo |
| - Build APK Android (Expo) | Toi | 1h | 0€ | APK |
| - Test sur device physique | Toi + Ta femme | 1h | 0€ | Testé |
| **Vidéo démo complète 3min** | Toi | 0.5j | 0€ | Vidéo |
| - Screencast app mobile | Toi | 1h | 0€ | Vidéo |
| - Montage + voiceover | Toi | 1h | 0€ | MP4 final |
| **Mise à jour pitch deck v0.2** | Toi | 0.5j | 0€ | Pitch v0.2 |
| - Screenshots app | Toi | 30min | 0€ | Images |
| - Intégration vidéo démo | Toi | 30min | 0€ | Slides |
| - Ajout métriques POC | Toi | 30min | 0€ | Updated |

**Budget semaine 6 : 0€**

**Livrables POC 2 :**
- ✅ App mobile démo (4 écrans)
- ✅ APK Android testable
- ✅ Vidéo démo 3min (backend + frontend)
- ✅ Pitch deck v0.2 avec screenshots

**🎯 Package démo complet pour financement :**
- URL API live + docs Swagger
- APK téléchargeable
- Vidéo démo YouTube
- Pitch deck actualisé

**Budget cumulé : 0€** ✅

---

## 📊 CHECKPOINT FINANCEMENT (Semaine 6)

### Bilan à 6 semaines

**Investissement :** 0€ ✅
**Temps :** 6 semaines (toi temps plein)
**Livrables :**
- ✅ Backend fonctionnel déployé (Oracle Cloud Free)
- ✅ App mobile démo (4 écrans)
- ✅ POC optimisation tournées
- ✅ Pitch deck avec démos
- ✅ Candidature BPI soumise (réponse attendue sem 8-10)

**🎯 Actions financement (parallèle au dev) :**

| Action | Timing | Effort | Résultat attendu |
|--------|--------|--------|------------------|
| **Suivi BPI** | Semaine 8 | 2h | Clarifications dossier |
| **Pitch business angels santé** | Semaine 7-10 | 1j/sem | 5-10 pitchs |
| **Candidature incubateurs** | Semaine 7 | 1j | Station F, WILCO |
| **Love money (réseau)** | Semaine 7-10 | Variable | 10-30k€ potentiel |

**Décision GO/NO-GO :**
- ✅ Si financement sécurisé (20-50k€) → MVP 1 (créer SAS sem 10)
- ⚠️ Si financement incertain → Continuer bootstrap MVP 1 réduit  
- ❌ Si aucun financement → Pivot ou pause

**Note importante :** 
Création SAS différée à semaine 10 (quand BPI confirme = 300€)
Permet de préserver focus et trésorerie en phase POC

---

## MVP 1 : VERSION BETA TESTABLE (Semaines 7-16) - COÛT : 5 300€

### Objectif
**Version fonctionnelle pour beta privée avec 3-5 cabinets IDEL**

Fonctionnalités complètes :
- Backend production-ready (PostgreSQL RLS, chiffrement)
- App mobile complète (iOS + Android)
- Optimisation tournées robuste
- Transcription transmissions (Whisper)
- Infrastructure OVH basique
- **Création SAS (semaine 10 si BPI OK)**

**Pas encore inclus :**
- Agent vocal
- Certification HDS
- Scaling

### SEMAINE 7-8 : Infrastructure OVH + Sécurité (2 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Compte OVH + Provision** | Toi | 0.5j | 1000€ | Crédit OVH |
| - Création projet OVH | Toi | 1h | 0€ | Projet |
| - Provision 1000€ (6 mois infra) | Toi | 5min | 1000€ | Crédit |
| **Recrutement DevOps freelance** | Toi | 1j | 0€ | Freelance trouvé |
| - Sourcing (Malt, Comet) | Toi | 2h | 0€ | 5-10 profils |
| - Entretiens (3 candidats) | Toi | 3h | 0€ | Notes |
| - Sélection + brief | Toi | 1h | 0€ | Choisi |
| **Mission DevOps (5 jours)** | DevOps freelance | 5j | 3000€ | Infra prod |
| *Jour 1-2: Setup Kubernetes OVH* | DevOps | 2j | 1200€ | K8s cluster |
| - Terraform IaC cluster K8s | DevOps | 1j | - | Code Terraform |
| - Déploiement cluster (2 nodes B2-15) | DevOps | 0.5j | - | Cluster actif |
| - Setup Helm | DevOps | 0.5j | - | Helm installé |
| *Jour 3: PostgreSQL + Vault* | DevOps | 1j | 600€ | DB + secrets |
| - PostgreSQL Managed OVH | DevOps | 0.5j | - | DB prod |
| - HashiCorp Vault (self-hosted) | DevOps | 0.5j | - | Vault actif |
| *Jour 4: CI/CD* | DevOps | 1j | 600€ | Pipeline |
| - GitHub Actions (build, test, deploy) | DevOps | 1j | - | Workflow |
| *Jour 5: Monitoring + Docs* | DevOps | 1j | 600€ | Observabilité |
| - Prometheus + Grafana | DevOps | 0.5j | - | Monitoring |
| - Documentation (runbook) | DevOps | 0.5j | - | Docs |
| **Row-Level Security** | Toi + Claude | 2j | 0€ | RLS implémenté |
| - Prompt Claude : policies RLS PostgreSQL | Toi | 1h | 0€ | SQL généré |
| - Tests isolation cabinets | Toi | 3h | 0€ | Tests OK |
| - Middleware contexte cabinet | Toi | 2h | 0€ | Code |
| **Chiffrement données** | Toi + Claude | 2j | 0€ | Chiffrement actif |
| - Setup Vault secrets | Toi | 2h | 0€ | Secrets |
| - Clés par cabinet dans Vault | Toi + Claude | 2h | 0€ | Keys |
| - Chiffrement colonnes sensibles | Toi + Claude | 3h | 0€ | Crypto |
| - Tests chiffrement | Toi | 1h | 0€ | Validé |

**Budget semaines 7-8 : 4 000€**
- DevOps : 3 000€
- OVH provision : 1 000€ (couvre 6 mois infra)

---

### SEMAINE 9-10 : Backend production + Création SAS (2 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **CRÉATION SAS (Semaine 10)** | Toi | 1j | 300€ | Société créée |
| - ⏰ Timing : Dès réponse positive BPI | - | - | - | - |
| - LegalStart/Captain Contrat (en ligne) | Toi | 2h | 300€ | Dossier |
| - Dépôt capital (1€ symbolique) | Toi | 30min | 1€ | Attestation |
| - Délai greffe (48h-1 sem) | - | 1 sem | - | KBIS |
| - Compte bancaire pro (Qonto gratuit) | Toi | 1h | 0€ | Compte |
| - SIRET pour virement BPI | - | - | - | Reçu |
| **Migration code POC → Production** | Toi | 2j | 0€ | Code migré |
| - Refactoring structure | Toi | 1j | 0€ | Clean code |
| - Tests unitaires (Claude génère) | Toi + Claude | 1j | 0€ | Tests |
| **API complète production** | Toi + Claude | 3j | 0€ | API v1 |
| - Endpoints manquants | Toi + Claude | 1j | 0€ | 15+ endpoints |
| - Validation données (Pydantic) | Toi + Claude | 1j | 0€ | Validators |
| - Gestion erreurs robuste | Toi + Claude | 1j | 0€ | Error handling |
| **Service Transmissions** | Toi + Claude | 3j | 0€ | API transmissions |
| - Upload audio chiffré | Toi + Claude | 1j | 0€ | Endpoint |
| - Stockage OVH Object Storage | Toi | 1j | 0€ | S3 compatible |
| - Retranscription Whisper (local) | Toi | 1j | 0€ | STT basic |
| **Déploiement production** | Toi | 2j | 0€ | API live OVH |
| - Docker images | Toi | 1j | 0€ | Images |
| - Deploy via CI/CD | Toi | 0.5j | 0€ | Auto-deploy |
| - Tests end-to-end | Toi | 0.5j | 0€ | Validé |

**Budget semaines 9-10 : 300€** (Création SAS)

**Note importante :** Si BPI refuse ou retarde, création SAS différée jusqu'à premiers clients payants (sem 20+)

---

### SEMAINE 11-12 : Frontend production (2 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Écrans manquants** | Toi + Claude | 3j | 0€ | App complète |
| - Détail patient | Toi + Claude | 0.5j | 0€ | Écran |
| - Création/édition RDV | Toi + Claude | 1j | 0€ | 2 écrans |
| - Profil utilisateur | Toi + Claude | 0.5j | 0€ | Écran |
| - Paramètres | Toi + Claude | 0.5j | 0€ | Écran |
| - Transmissions (liste + détail) | Toi + Claude | 0.5j | 0€ | 2 écrans |
| **Fonctionnalités avancées** | Toi + Claude | 3j | 0€ | Features |
| - Mode offline (SQLite local) | Toi + Claude | 1j | 0€ | Offline OK |
| - Synchronisation auto | Toi + Claude | 1j | 0€ | Sync |
| - Push notifications (Expo) | Toi | 0.5j | 0€ | Notifs |
| - Upload audio transmissions | Toi + Claude | 0.5j | 0€ | Upload |
| **Tests utilisateurs internes** | Ta femme | 2j | 0€ | Feedback |
| - Tests quotidiens (1h/jour × 10j) | Ta femme | 10h | 0€ | Liste bugs |
| - Remontée bugs/améliorations | Ta femme | - | 0€ | Backlog |
| **Corrections bugs** | Toi | 2j | 0€ | App stable |
| - Fix bugs critiques | Toi | 1j | 0€ | Fixes |
| - Améliorations UX | Toi | 1j | 0€ | Polish |

**Budget semaines 11-12 : 0€**

---

### SEMAINE 13-14 : Whisper GPU + Optimisation (2 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Setup GPU OVH** | Toi | 1j | 0€ | Node GPU |
| - Ajout node T1-45 (GPU) au cluster | Toi | 2h | 0€ | Node actif |
| - Terraform update | Toi | 1h | 0€ | IaC |
| **Whisper déploiement** | Toi + Claude | 2j | 0€ | STT prod |
| - Prompt Claude : Dockerfile Whisper | Toi | 1h | 0€ | Dockerfile |
| - Build image + GPU support | Toi | 3h | 0€ | Image |
| - Déploiement K8s avec GPU | Toi | 2h | 0€ | Pod GPU |
| - API wrapper Whisper | Toi + Claude | 2h | 0€ | Endpoint |
| - Tests transcription | Toi | 2h | 0€ | Validé |
| **Intégration transmissions** | Toi | 2j | 0€ | Feature complète |
| - Upload audio → Whisper → DB | Toi | 1j | 0€ | Pipeline |
| - Tests avec ta femme (audio réel) | Ta femme + Toi | 1j | 0€ | Testé |
| **Optimisation tournées robuste** | Toi + Claude | 3j | 0€ | Algo prod |
| - OR-Tools production (contraintes) | Toi + Claude | 2j | 0€ | Algo complet |
| - OSRM self-hosted (distances) | Toi | 1j | 0€ | OSRM actif |
| - Tests avec vraies données | Toi + Ta femme | - | 0€ | Validé |

**Budget semaines 13-14 : 0€** (GPU inclus provision OVH)

---

### SEMAINE 15-16 : Préparation beta + Recrutement testers (2 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **DPO externe (démarrage mission)** | DPO externe | - | 1000€ | Contrat + DPIA |
| - Signature contrat DPO | Toi | 1h | - | Contrat |
| - Kickoff (brief projet) | Toi + DPO | 2h | - | Compris |
| - DPIA (analyse d'impact) brouillon | DPO + Toi | 1j | 500€ | DPIA v0.1 |
| - Registre traitements v1 | DPO assisté Claude | 1j | 500€ | Registre |
| **Documentation utilisateur** | Toi + Claude | 2j | 0€ | Docs |
| - Guide démarrage (PDF) | Toi + Claude | 1j | 0€ | PDF |
| - Vidéos tuto (3× 2min) | Toi | 1j | 0€ | 3 vidéos |
| **Recrutement beta testers** | Ta femme | 2j | 0€ | 3-5 cabinets |
| - Identifier cabinets (réseau IDEL) | Ta femme | 1j | 0€ | Liste 10 |
| - Appels (pitch beta gratuite) | Ta femme | 1j | 0€ | 3-5 OK |
| **Setup support beta** | Toi | 1j | 0€ | Canal support |
| - Slack workspace beta | Toi | 1h | 0€ | Slack |
| - Process remontée bugs | Toi | 2h | 0€ | Template |
| **Builds production** | Toi | 1j | 0€ | Apps |
| - Build iOS (TestFlight) | Toi | 2h | 0€ | IPA |
| - Build Android (Play Console beta) | Toi | 2h | 0€ | AAB |
| - Distribution aux beta testers | Toi | 1h | 0€ | Installé |
| **Formation beta testers** | Toi + Ta femme | 2j | 0€ | Formés |
| - Visio onboarding (2h × 5 cabinets) | Toi + Ta femme | 2j | 0€ | Formés |

**Budget semaines 15-16 : 1 000€** (DPO)

**Livrables MVP 1 :**
- ✅ SAS créée + SIRET (semaine 10)
- ✅ Backend production OVH avec RLS + chiffrement
- ✅ App mobile iOS + Android (15+ écrans)
- ✅ Optimisation tournées (OR-Tools + OSRM)
- ✅ Transcription transmissions (Whisper GPU)
- ✅ 3-5 cabinets beta actifs
- ✅ Infrastructure scalable
- ✅ DPIA + Registre RGPD v1

**Budget cumulé MVP 1 : 5 300€**
- Sem 7-8 : 4 000€ (DevOps + OVH)
- Sem 9-10 : 300€ (Création SAS)
- Sem 11-14 : 0€ (dev)
- Sem 15-16 : 1 000€ (DPO)

---

## 🧪 PHASE BETA (Semaines 17-24) - COÛT : 1 500€

### Objectif
**Itérations rapides basées sur feedback beta testers**

Durée : 8 semaines (2 mois)
Budget : Infrastructure + DPO

### Activités continues

| Action | Responsable | Fréquence | Coût/mois | Livrable |
|--------|-------------|-----------|-----------|----------|
| **Monitoring beta** | Toi | Quotidien | 0€ | Dashboards |
| - Check logs erreurs | Toi | 30min/j | - | - |
| - Monitoring Grafana | Toi | 15min/j | - | - |
| **Support beta testers** | Toi + Ta femme | Variable | 0€ | Tickets résolus |
| - Slack support (~5-10 msg/j) | Toi | 1h/j | - | Réponses |
| - Bugs critiques (hotfix) | Toi | Variable | - | Fixes |
| **Calls feedback hebdo** | Ta femme | 1×/sem | 0€ | Notes feedback |
| - Visio 30min × 5 cabinets | Ta femme | 2.5h/sem | - | Retours |
| - Synthèse priorités | Ta femme + Toi | 1h/sem | - | Backlog |
| **Développement itératif** | Toi + Claude | 3j/sem | 0€ | Features |
| - Sprint planning | Toi + Ta femme | 0.5j/sem | - | Sprint |
| - Développement | Toi + Claude | 2j/sem | - | Code |
| - Release hebdo | Toi | 0.5j/sem | - | Deploy |
| **Infrastructure** | OVH | - | 350€/mois | Running |
| - K8s (2 nodes CPU + 1 GPU) | - | - | 300€/mois | - |
| - PostgreSQL Managed | - | - | 30€/mois | - |
| - Object Storage | - | - | 5€/mois | - |
| - Load Balancer | - | - | 15€/mois | - |
| **DPO suivi** | DPO externe | 1j/mois | 300€/mois | Conformité |
| - Point mensuel conformité | DPO + Toi | 2h/mois | - | Checklist |
| - Mise à jour registre | DPO | 2h/mois | - | Updates |

**Budget phase beta (2 mois) :**
- Infrastructure OVH : 700€ (350€ × 2)
- DPO : 600€ (300€ × 2)
- Divers : 200€
- **Total : 1 500€**

**Résultats attendus fin beta :**
- ✅ App stable (crash rate <1%)
- ✅ Feedback positif 5 cabinets
- ✅ 2-3 cabinets prêts à payer
- ✅ Backlog priorisé pour MVP 2

**Budget cumulé beta : 7 081€**

---

## MVP 2 : VERSION PRODUCTION (Semaines 25-44) - COÛT : 40 000€

### Objectif
**Version certifiée HDS, agent vocal, lancement commercial**

Durée : 20 semaines (5 mois)
Fonctionnalités ajoutées :
- Agent vocal complet (OVH Telecom + Mistral)
- Synthèse IA transmissions (Mistral)
- Certification HDS
- Scaling infrastructure
- 15-20 cabinets payants

### SEMAINE 25-28 : Agent vocal (4 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **OVH Telecom setup** | Toi | 1 sem | 200€ | Ligne SIP |
| - Commande lignes SIP (5 lignes) | Toi | 1h | 50€ setup | Lignes |
| - Configuration webhook | Toi | 1j | - | Config |
| - Tests appels entrants | Toi | 0.5j | 150€ tests | Validé |
| **Whisper streaming temps réel** | Toi + Claude | 1 sem | 0€ | STT live |
| - Adaptation Whisper pour streaming | Toi + Claude | 2j | - | Code |
| - WebSocket bidirectionnel | Toi + Claude | 1j | - | WS |
| - Tests latence | Toi | 1j | - | <1s OK |
| **Mistral AI integration** | Toi + Claude | 1 sem | 300€ | LLM dialogue |
| - Compte Mistral AI | Toi | 5min | 0€ | API key |
| - Dialogue manager (function calling) | Toi + Claude | 2j | - | Code |
| - Pseudonymisation | Toi + Claude | 1j | - | Anonymizer |
| - Tests conversations | Toi + Ta femme | 2j | 300€ | Testé |
| **Coqui TTS** | Toi + Claude | 1 sem | 0€ | TTS |
| - Setup Coqui TTS (self-hosted) | Toi + Claude | 1j | - | Déployé |
| - Tests qualité voix | Toi + Ta femme | 1j | - | Acceptable |
| - Intégration pipeline | Toi | 1j | - | Intégré |

**Budget semaines 25-28 : 500€**

---

### SEMAINE 29-32 : Synthèse IA + Polish (4 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Synthèse transmissions Mistral** | Toi + Claude | 1 sem | 200€ | Synthèse auto |
| - Prompt engineering synthèse | Toi + Claude | 2j | - | Prompt |
| - Tests avec audio réels | Ta femme + Toi | 2j | 200€ | Validé |
| - UI synthèse dans app | Toi + Claude | 1j | - | Écrans |
| **Optimisations performance** | Toi | 1 sem | 0€ | App rapide |
| - Profiling app mobile | Toi | 1j | - | Metrics |
| - Optimisations critiques | Toi | 2j | - | Faster |
| - Tests performance | Toi | 1j | - | <2s loads |
| **UI/UX final polish** | Toi + Claude | 1 sem | 0€ | UI polie |
| - Animations | Toi + Claude | 1j | - | Smooth |
| - États vides (empty states) | Toi + Claude | 1j | - | Done |
| - Feedback visuels | Toi + Claude | 1j | - | Done |
| - Accessibilité basique | Toi | 1j | - | WCAG A |
| **Tests regression complets** | Toi | 1 sem | 0€ | App testée |
| - Tests end-to-end | Toi | 2j | - | E2E |
| - Tests manuels exhaustifs | Toi + Ta femme | 2j | - | Checklist |

**Budget semaines 29-32 : 200€**

---

### SEMAINE 33-38 : Certification HDS (6 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Préparation audit** | DPO + Toi | 2 sem | 2000€ | Dossier |
| - DPIA finalisée | DPO | 2j | 500€ | DPIA v1 |
| - Registre traitements complet | DPO | 2j | 500€ | Registre |
| - Documentation technique | Toi + Claude | 3j | - | Docs tech |
| - Procédures RGPD | DPO assisté Claude | 3j | 1000€ | Procédures |
| **Audit conformité applicative** | Auditeur externe | 2 sem | 5000€ | Rapport |
| - Audit sur site/distance (2j) | Auditeur | 2j | 3000€ | Audit |
| - Rapport préliminaire | Auditeur | 1 sem | - | Rapport |
| - Corrections demandées | Auditeur | - | 2000€ | Liste |
| **Corrections post-audit** | Toi | 1 sem | 0€ | Fixes |
| - Corrections sécurité | Toi | 3j | - | Done |
| - Documentation updated | Toi + DPO | 1j | - | Docs |
| - Tests conformité | Toi | 1j | - | OK |
| **Audit final + Attestation** | Auditeur | 1 sem | 7000€ | Certificat |
| - Re-audit (1j) | Auditeur | 1j | 3000€ | Validé |
| - Attestation conformité | Auditeur | - | 4000€ | PDF signé |

**Budget semaines 33-38 : 14 000€**

---

### SEMAINE 39-42 : Scaling + Marketing (4 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Scaling infrastructure** | Toi | 1 sem | 0€ | Scaled |
| - Autoscaling K8s | Toi | 1j | - | HPA |
| - Node pools (3-5 nodes) | Toi | 1j | - | Scaled |
| - Load testing | Toi | 1j | - | 50 users OK |
| **Site web vitrine** | Toi + Claude | 1 sem | 100€ | Site |
| - Landing page (Next.js) | Toi + Claude | 2j | - | Site |
| - SEO basique | Toi + Claude | 1j | - | Meta tags |
| - Déploiement (Vercel) | Toi | 2h | 0€ | Live |
| - Nom domaine | Toi | 10min | 100€/an | DNS |
| **Contenus marketing** | Ta femme + Toi | 1 sem | 0€ | Contenus |
| - Posts LinkedIn (ta femme IDEL) | Ta femme | 2j | - | 5-10 posts |
| - Vidéos démo YouTube | Toi | 1j | - | 3 vidéos |
| - FAQ / Documentation | Toi + Claude | 1j | - | Docs |
| **Recrutement early adopters** | Ta femme | 2 sem | 300€ | 10-15 leads |
| - Posts forums IDEL | Ta femme | 1j | - | Posts |
| - Groupes Facebook IDEL | Ta femme | 1j | - | Posts |
| - Bouche-à-oreille réseau | Ta femme | Ongoing | - | Leads |
| - Ads Facebook ciblées (test) | Toi | - | 300€ | 10-15 leads |

**Budget semaines 39-42 : 400€**

---

### SEMAINE 43-44 : Lancement commercial (2 semaines)

| Action | Responsable | Durée | Coût | Livrable |
|--------|-------------|-------|------|----------|
| **Finalisation juridique** | Toi + Juriste | 1 sem | 1500€ | Contrats |
| - CGV/CGU | Juriste | 1j | 500€ | CGV |
| - Contrats clients | Juriste | 1j | 500€ | Template |
| - Mentions légales | Juriste | 0.5j | 300€ | Mentions |
| - RGPD (politique confidentialité) | DPO + Juriste | 1j | 200€ | Politique |
| **Onboarding automatisé** | Toi + Claude | 1 sem | 0€ | Workflow |
| - Formulaire inscription | Toi + Claude | 1j | - | Form |
| - Emails automatiques (Brevo) | Toi | 1j | - | Campagnes |
| - Vidéo onboarding | Toi | 1j | - | Vidéo |
| - Chatbot support (FAQ) | Toi + Claude | 1j | - | Bot |
| **Pricing & Paiement** | Toi | 0.5 sem | 0€ | Stripe |
| - Intégration Stripe | Toi + Claude | 1j | - | Payment |
| - Plans tarifaires | Toi + Ta femme | 0.5j | - | Pricing |
| **Lancement** | Toi + Ta femme | 0.5 sem | 0€ | Live |
| - Annonce LinkedIn | Ta femme | 2h | - | Post |
| - Email beta → paying | Toi | 2h | - | Campaign |
| - Suivi onboarding premiers clients | Toi + Ta femme | - | - | Support |

**Budget semaines 43-44 : 1 500€**

**Livrables MVP 2 :**
- ✅ Agent vocal complet (OVH Telecom + Mistral + Whisper)
- ✅ Synthèse IA transmissions
- ✅ Attestation conformité HDS
- ✅ Infrastructure scaled (50+ users)
- ✅ Site web + marketing
- ✅ Contrats juridiques
- ✅ 15-20 cabinets payants

---

## 💰 BUDGET CONSOLIDÉ PAR PHASE

```
RÉCAPITULATIF FINANCIER
═══════════════════════════════════════════════════════════

Phase 0 : Préparation (Sem 1-2)
├─ Outils dev (déjà possédés)           : 0€
├─ Setup technique (gratuit)            : 0€
└─ Total Phase 0                        : 0€

POC 1 : Backend démo (Sem 3-4)
├─ VPS démo (Oracle Cloud Free)         : 0€
└─ Total POC 1                          : 0€

POC 2 : Frontend démo (Sem 5-6)
├─ Logo (Canva gratuit)                 : 0€
└─ Total POC 2                          : 0€

──────────────────────────────────────────────
CHECKPOINT FINANCEMENT (Sem 6)          : 0€
──────────────────────────────────────────────

MVP 1 : Beta testable (Sem 7-16)
├─ Création SAS (sem 10, si BPI OK)     : 300€
├─ DevOps (5j)                          : 3 000€
├─ OVH provision 6 mois                 : 1 000€
├─ DPO démarrage                        : 1 000€
└─ Total MVP 1                          : 5 300€

Phase Beta (Sem 17-24)
├─ Infrastructure (2 mois)              : 700€
├─ DPO (2 mois)                         : 600€
├─ Divers                               : 200€
└─ Total Beta                           : 1 500€

MVP 2 : Production (Sem 25-44)
├─ Agent vocal (OVH Telecom, Mistral)   : 500€
├─ Synthèse IA                          : 200€
├─ Audit HDS conformité                 : 14 000€
├─ Juridique (CGV, contrats)            : 1 500€
├─ Marketing (site, ads)                : 400€
├─ Infrastructure (5 mois)              : 1 750€
├─ DPO (5 mois)                         : 1 500€
├─ Mistral AI usage                     : 1 500€
├─ Divers                               : 1 000€
└─ Total MVP 2                          : 22 350€

═══════════════════════════════════════════════════════════
BUDGET TOTAL PROJET (44 semaines)       : 29 150€
═══════════════════════════════════════════════════════════

vs Estimation initiale "Toi + IA"       : 45 750€
OPTIMISATION                            : -16 600€ (-36%)
```

**Pourquoi l'écart ?**
- Provision OVH mieux optimisée
- Pas de designer externe (0€ économisé : 1 500€)
- DPO démarrage différé (économie trésorerie)
- Infrastructure minimale en début
- Marketing très light (bootstrap)

---

## 📊 COÛTS CUMULÉS DANS LE TEMPS

```
Semaine    Phase              Coût période    Cumulé      Événement clé
───────────────────────────────────────────────────────────────────────
Sem 1-2    Phase 0            0€              0€          POC technique démarré
Sem 3-4    POC 1              0€              0€          Backend démo (Oracle Free)
Sem 5-6    POC 2              0€              0€          ✅ DÉMO FINANCEMENT
───────────────────────────────────────────────────────────────────────
Sem 7-8    MVP 1 - Infra      4 000€          4 000€      OVH + DevOps
Sem 9-10   MVP 1 - Backend    300€            4 300€      API prod + SAS créée
Sem 11-12  MVP 1 - Frontend   0€              4 300€      App complète
Sem 13-14  MVP 1 - IA         0€              4 300€      Whisper + Optim
Sem 15-16  MVP 1 - Beta prep  1 000€          5 300€      ✅ BETA LANCÉE
───────────────────────────────────────────────────────────────────────
Sem 17-24  Beta (2 mois)      1 500€          6 800€      Itérations
───────────────────────────────────────────────────────────────────────
Sem 25-28  MVP 2 - Vocal      500€            7 300€      Agent vocal
Sem 29-32  MVP 2 - Synthèse   200€            7 500€      Synthèse IA
Sem 33-38  MVP 2 - HDS        14 000€         21 500€     ✅ CERTIFIÉ HDS
Sem 39-42  MVP 2 - Marketing  400€            21 900€     Marketing
Sem 43-44  MVP 2 - Launch     1 500€          23 400€     ✅ LANCEMENT COMMERCIAL
───────────────────────────────────────────────────────────────────────
Sem 1-44   Infrastructure     5 750€          29 150€     11 mois total
```
Sem 29-32  MVP 2 - Synthèse   200€            7 781€      Synthèse IA
Sem 33-38  MVP 2 - HDS        14 000€         21 781€     ✅ CERTIFIÉ HDS
Sem 39-42  MVP 2 - Marketing  400€            22 181€     Marketing
Sem 43-44  MVP 2 - Launch     1 500€          23 681€     ✅ LANCEMENT COMMERCIAL
───────────────────────────────────────────────────────────────────────
Sem 1-44   Infrastructure     5 750€          29 431€     11 mois total
```

---

## 💸 PLAN DE FINANCEMENT OPTIMISÉ

### Scénario recommandé : Financement par paliers

```
PALIER 1 : DÉMARRAGE (Sem 1-6)
═══════════════════════════════════════════════════
Besoin                                  : 0€ ✅
Source                                  : Aucun financement nécessaire
Action                                  : Démarrer immédiatement
Résultat                                : Démo complète pour financement
Outils                                  : VS Code + Claude (déjà possédés)
═══════════════════════════════════════════════════

PALIER 2 : MVP 1 (Sem 7-16)
═══════════════════════════════════════════════════
Besoin                                  : 5 300€
Source potentielle                      :
├─ Subvention BPI (30k€)                : Soumise sem 2, réponse sem 8-10
├─ Subvention région (10k€)             : Soumise sem 2, réponse sem 10
├─ Love money                           : Sollicité sem 6-8
└─ Apport personnel (si subv retardées) : Backup

Timeline critique :
- Sem 6 : Démo prête (0€ investi)
- Sem 7 : Besoin financement pour DevOps
- Sem 8-10 : Réponses subventions attendues
- Sem 10 : Création SAS (300€) si BPI OK

Stratégie :
- Si subventions OK (sem 8-10) → Provision complète + Création SAS
- Si retard → Apport 5k€ puis remboursement subventions
═══════════════════════════════════════════════════

PALIER 3 : BETA + MVP 2 (Sem 17-44)
═══════════════════════════════════════════════════
Besoin                                  : 23 850€
Source recommandée                      :
├─ Subventions obtenues                 : 40 000€
├─ Revenus beta (sem 20+)               : 1 000-3 000€
└─ Apport personnel complément          : 0-5 000€

Utilisation subventions (40k€) :
├─ MVP 1 (si pas apport)                : 5 300€
├─ Beta + MVP 2                         : 23 850€
├─ Trésorerie sécurité                  : 10 850€
└─ Total                                : 40 000€

Revenus attendus (sem 20-44) :
├─ Sem 20-24 : 3 cabinets × 100€ × 1 mois  = 300€
├─ Sem 25-36 : 8 cabinets × 120€ × 3 mois  = 2 880€
├─ Sem 37-44 : 15 cabinets × 130€ × 2 mois = 3 900€
└─ Total revenus                           = 7 080€

→ Revenus couvrent 30% du budget MVP 2
═══════════════════════════════════════════════════
```

### Budget minimal absolu (bootstrap extrême)

**Si AUCUNE subvention obtenue :**

```
Stratégie dégradée
═══════════════════════════════════════════════════
Palier 1 : Démo                         : 581€
Palier 2 : MVP 1 sans DevOps            : 2 000€
├─ Setup infra manuel (toi)             : 0€
├─ Pas de DevOps freelance              : -3 000€
├─ OVH provision 3 mois                 : 500€
├─ DPO démarrage                        : 500€
├─ Whisper + reste                      : 1 000€

Beta simplifiée                         : 1 000€
MVP 2 sans certif HDS immédiate         : 10 000€
├─ Pas de certif HDS (différée)         : -14 000€
├─ Agent vocal basique                  : 500€
├─ Infra 5 mois                         : 1 750€
├─ DPO 5 mois                           : 1 500€
├─ Marketing light                      : 200€
├─ Juridique essentiel                  : 1 000€
├─ Mistral + divers                     : 5 050€

═══════════════════════════════════════════════════
TOTAL BOOTSTRAP EXTRÊME                 : 13 581€
═══════════════════════════════════════════════════

Apport nécessaire : 15 000€ (avec marge)

⚠️ Risques :
- Pas de certification HDS → Pas de commercialisation légale
- Infra fragile (pas de DevOps expert)
- Qualité moindre
- Timeline rallongée (+3 mois)

→ À n'utiliser QU'EN DERNIER RECOURS
```

---

## 🎯 JALONS CRITIQUES & DÉCISIONS

### Semaine 6 : GO/NO-GO Financement

**Évaluation :**
- Démo technique validée ?
- Subventions en cours (BPI soumise) ?
- Love money possible ?
- Apport personnel disponible ?

**Décision :**
- ✅ Si 2+ sources financement → GO MVP 1 (5k€)
- ⚠️ Si 1 source incertaine → GO réduit (apport 3k€)
- ❌ Si 0 source → Pause ou pivot

### Semaine 16 : GO/NO-GO Beta

**Évaluation :**
- MVP 1 stable ?
- Beta testers positifs ?
- Budget restant ?

**Décision :**
- ✅ Si stable + budget → GO Beta étendue
- ⚠️ Si bugs critiques → Fix 2 sem, puis beta
- ❌ Si feedback négatif → Pivot produit

### Semaine 24 : GO/NO-GO Production

**Évaluation :**
- Beta réussie (NPS >40) ?
- 2-3 cabinets prêts à payer ?
- Budget MVP 2 sécurisé (20-40k€) ?

**Décision :**
- ✅ Si validé + budget → GO MVP 2
- ⚠️ Si budget limité → MVP 2 light (pas HDS immédiat)
- ❌ Si beta échec → Analyse causes, pivot

---

## 📋 LIVRABLES PAR PHASE (Résumé)

| Phase | Semaines | Budget | Livrables clés | Usage |
|-------|----------|--------|----------------|-------|
| **Phase 0** | 1-2 | **0€** | POC Backend, Pitch deck, BPI soumis | Candidatures |
| **POC 1** | 3-4 | **0€** | Backend déployé (Oracle Free), Vidéo | Démo tech |
| **POC 2** | 5-6 | **0€** | App mobile 4 écrans, APK, Logo | Démo visuelle |
| **MVP 1** | 7-16 | **5 300€** | SAS (sem 10), App complète, Infra OVH | Beta privée |
| **Beta** | 17-24 | **1 500€** | 5 cabinets testeurs, Feedback | Validation |
| **MVP 2** | 25-44 | **22 350€** | Agent vocal, HDS, 15-20 clients | Commercial |
| **TOTAL** | **44 sem** | **29 150€** | **Production certifiée HDS** | **Lancement** |

---

## 🚀 ACTIONS IMMÉDIATES (Semaine actuelle)

### À faire cette semaine (coût : 0€) ✅

**Aujourd'hui (2-3h)**
- [ ] GitHub repo privé (gratuit)
- [ ] Docker PostgreSQL local
- [ ] VS Code + extensions Python
- [ ] Claude (déjà abonné) + Claude Code/Antigravity

**Jour 1-2 : POC Backend (2j)**
- [ ] Structure projet FastAPI (avec Claude)
- [ ] Modèles SQLAlchemy (Patient, RDV, User)
- [ ] Auth JWT
- [ ] CRUD endpoints
- [ ] Seed data
- [ ] Tests Postman

**Jour 3 : Pitch + BPI (1j)**  
- [ ] Pitch deck 10 slides (Canva gratuit)
- [ ] Business plan simple (Excel)
- [ ] Candidature BPI "projet en création" (pas de SIRET nécessaire)

**Jour 4 : POC Optimisation (1j)**
- [ ] OR-Tools optimisation tournée
- [ ] Visualisation carte (Folium)
- [ ] Endpoint API /optimize-tour

**Jour 5 : Financement (1j)**
- [ ] Candidatures subventions régionales
- [ ] Sourcing DPO externe (3 devis)

**Total semaine 1 : 0€** ✅

**Note importante :**
Création SAS différée à semaine 10 (quand BPI confirme)
Permet de se concentrer 100% sur création de valeur

### Semaine prochaine (Jours 6-10) - Coût : 0€ ✅

**Objectif : Finaliser backend démo**

- [ ] Amélioration API backend
- [ ] Documentation Swagger
- [ ] Deploy sur Oracle Cloud Free (gratuit à vie)
- [ ] Vidéo démo 2-3min (OBS + DaVinci gratuits)

**Livrable : API démo + vidéo**

---

### Semaine 3-4 (Jours 11-20) - Coût : 0€ ✅

**Objectif : App mobile démo**

- [ ] Logo gratuit (Canva/Bing AI)
- [ ] React Native setup
- [ ] 4 écrans (Login, Patients, RDV, Carte)
- [ ] APK testable
- [ ] Vidéo démo finale 3min

**Livrable : App démo + vidéo complète**

---

### Semaine 6 : 🎯 **PITCH FINANCEMENT**

**Package complet disponible :**
- ✅ Backend API live (Oracle Cloud Free)
- ✅ App mobile APK
- ✅ POC optimisation tournées
- ✅ Vidéo démo 3min
- ✅ Pitch deck v0.2
- ✅ Candidature BPI soumise

**Investissement total : 0€** 🎉

---

## ✅ CONCLUSION : PLANNING OPTIMISÉ

**Budget total : 29 150€** (vs 45 750€ estimation initiale, vs 90 000€ scénario humain)

**Timeline : 44 semaines (11 mois)**

**Jalons clés :**
1. ✅ **Semaine 6** : Démo financement (coût : **0€** ✅)
2. ✅ **Semaine 16** : Beta testable (coût cumulé : 5 300€)
3. ✅ **Semaine 44** : Production HDS (coût total : 29 150€)

**Financement recommandé :**
- Apport : 0-5k€ (sécurité si subventions retardées)
- Subventions : 30-40k€ (BPI + région)
- Revenus beta : 5-7k€ (sem 20-44)

**Points forts du planning :**
- ✅ **Démarrage immédiat** à coût ZÉRO
- ✅ Itératif (POC → MVP → Production)
- ✅ Financement par paliers
- ✅ Validation continue (feedback beta)
- ✅ Budget optimisé (29k€ vs 90k€ initial, -68%)
- ✅ SAS différée (focus sur valeur)

**Prêt à démarrer dès maintenant pour 0€ !** 🚀

**Optimisations clés vs planning initial :**
- Phase 0 : 0€ (vs 61€) → Claude + VS Code déjà possédés
- POC 1-2 : 0€ (vs 520€) → Oracle Cloud Free + Logo gratuit  
- MVP 1 : 5 300€ (vs 5 000€) → Inclut création SAS en semaine 10
- Total : 29 150€ (vs 29 431€) → -281€ d'optimisation supplémentaire

**Tu peux littéralement démarrer cette semaine sans débourser un centime.**
