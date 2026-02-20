# PRD - ASSISTANT IA POUR INFIRMIÈRES LIBÉRALES
## Product Requirements Document

**Version :** 1.0  
**Date :** Janvier 2026  
**Product Manager :** [Nom ta femme]  
**Tech Lead :** [Ton nom]  
**Statut :** Draft for MVP

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#1-vue-densemble)
2. [User Personas](#2-user-personas)
3. [User Stories & Use Cases](#3-user-stories--use-cases)
4. [Features détaillées](#4-features-détaillées)
5. [User Flows](#5-user-flows)
6. [Spécifications techniques](#6-spécifications-techniques)
7. [Architecture système](#7-architecture-système)
8. [Exigences non-fonctionnelles](#8-exigences-non-fonctionnelles)
9. [Roadmap & Priorités](#9-roadmap--priorités)
10. [Métriques de succès](#10-métriques-de-succès)

---

## 1. VUE D'ENSEMBLE

### 1.1 Vision produit

Créer l'assistant IA de référence pour les infirmières libérales (IDEL) qui leur fait gagner **1h30 par jour** en automatisant l'administratif et en optimisant leurs tournées grâce à l'intelligence artificielle.

### 1.2 Problème résolu

**Pain points IDEL :**
- 30-40% du temps consacré à l'administratif (vs soins patients)
- Optimisation tournées manuelle et inefficace : 7-10km gaspillés/jour
- Appels patients répétitifs pour prise de RDV (20-40 min/jour)
- Transmissions non structurées et chronophages (15-30 min/jour)
- Burn-out élevé : 42% des IDEL

**Solution apportée :**
Application mobile + web tout-en-un combinant :
1. **Agent vocal IA** : Prise RDV automatique 24/7
2. **Optimisation tournées** : Algorithme OR-Tools
3. **Transcription IA** : Dictée vocale transmissions (Whisper)
4. **Synthèse IA** : Résumés automatiques (Mistral)
5. **Gestion complète** : Patients, agenda, facturation

### 1.3 Objectifs business

**Objectifs M6 (Beta) :**
- 5 cabinets beta actifs
- NPS >40
- Feature adoption optimisation tournées >70%

**Objectifs M12 (PMF) :**
- 50 cabinets payants
- Churn <5%/mois
- Gain temps utilisateur mesuré >1h/jour

**Objectifs M24 (Scale) :**
- 350 cabinets
- 637k€ ARR
- NPS >65

### 1.4 Scope MVP vs V1.0 vs V1.5

**MVP (M6 - Beta) :**
- Gestion patients (CRUD)
- Agenda intelligent
- Optimisation tournées (OR-Tools)
- Transcription transmissions (Whisper)
- Facturation basique

**V1.0 (M11 - Production) :**
- MVP +
- Agent vocal 24/7 (Mistral)
- Synthèse IA transmissions
- Sync agenda externe
- Notifications intelligentes
- Certification HDS

**V1.5 (M18) :**
- V1.0 +
- Téléconsultation intégrée
- Messagerie sécurisée inter-soignants
- Analytics/KPI cabinet
- Export comptabilité

### 1.5 Success criteria

**Produit réussi si :**
- ✅ Gain temps mesuré >1h/jour par utilisateur
- ✅ Adoption feature optimisation >70%
- ✅ NPS >50
- ✅ Churn <5%/mois
- ✅ Time to value <7 jours

---

## 2. USER PERSONAS

### 2.1 Persona 1 : Sophie - IDEL Solo

**Démographie :**
- Âge : 32 ans
- Expérience : 5 ans en libéral
- Localisation : Péri-urbain (Nantes)
- Tech-savvy : Moyen-élevé

**Contexte :**
- 25-30 patients/semaine
- Tournées quotidiennes 8h-18h
- Travaille seule
- Budget serré (dépenses outils : 100€/mois max)

**Goals :**
- Optimiser ses trajets (économie essence + temps)
- Automatiser appels RDV (soirs/week-ends)
- Simplifier transmissions (gagne 20 min/jour)
- Avoir temps pour vie perso

**Pain points :**
- Passe 30 min/matin à planifier tournée manuellement
- Reçoit appels patients tard le soir
- Transmissions à la volée sur papier, resaisies le soir
- Fatigue, pense arrêter libéral

**Outils actuels :**
- VEGA (43€/mois) pour facturation
- Google Maps pour trajets
- Notes papier transmissions
- Téléphone perso RDV

**Jobs to be done :**
- "Quand je planifie ma tournée, je veux un ordre optimal automatique pour gagner 30 min et économiser essence"
- "Quand un patient appelle pour RDV, je veux que l'IA réponde à ma place pour ne pas être dérangée"
- "Quand je fais une transmission, je veux dicter vocalement pour gagner 15 min de saisie"

---

### 2.2 Persona 2 : Claire - Cabinet 3 IDEL

**Démographie :**
- Âge : 45 ans
- Expérience : 15 ans libéral
- Localisation : Urbain (Lyon)
- Tech-savvy : Moyen

**Contexte :**
- Cabinet 3 IDEL (elle + 2 associées)
- 80-90 patients total
- Coordination tournées complexe
- Budget plus confortable (300€/mois outils)

**Goals :**
- Coordonner tournées entre 3 IDEL
- Éviter doublons patients
- Partager transmissions équipe
- Vision consolidée activité cabinet

**Pain points :**
- Conflits d'agenda entre associées
- Transmissions perdues entre collègues
- Pas de vision globale charge travail
- Réorganisation constante si annulation

**Outils actuels :**
- Agathe YOU (119€/mois)
- WhatsApp transmissions
- Agenda papier partagé cabinet

**Jobs to be done :**
- "Quand j'assigne un patient, je veux voir tournées de toutes les IDEL pour optimiser qui y va"
- "Quand je fais une transmission, je veux que mes collègues la voient automatiquement"
- "Quand un patient annule, je veux que l'algo réoptimise toutes les tournées en 1 clic"

---

### 2.3 Persona 3 : Mathieu - Grand Cabinet 8 IDEL

**Démographie :**
- Âge : 52 ans
- Expérience : 20 ans, gérant cabinet
- Localisation : Urbain (Paris)
- Tech-savvy : Faible-moyen

**Contexte :**
- Cabinet 8 IDEL (structure SCM)
- 200+ patients actifs
- Gestion administrative dédiée (secrétaire)
- Budget conséquent (600€/mois outils)

**Goals :**
- Piloter activité cabinet (KPI, CA)
- Réduire coûts opérationnels
- Améliorer satisfaction patients
- Répartir charge équitablement entre IDEL

**Pain points :**
- Difficile suivre activité chaque IDEL
- Patients se plaignent attente RDV
- Certaines IDEL surchargées, autres sous-chargées
- Outils actuels pas adaptés multi-utilisateurs

**Outils actuels :**
- Solution custom développée interne (coûteuse)
- Standard téléphonique pour RDV
- Excel pour suivi CA

**Jobs to be done :**
- "Quand je gère le cabinet, je veux dashboard temps réel activité pour piloter"
- "Quand patients appellent, je veux agent IA qui prend RDV pour libérer secrétaire"
- "Quand je répartis travail, je veux algo qui équilibre charge entre IDEL"

---

## 3. USER STORIES & USE CASES

### 3.1 Epic 1 : Gestion patients

**US-001 : Créer un patient**
- **En tant que** IDEL
- **Je veux** créer un nouveau dossier patient en <2 min
- **Afin de** centraliser toutes les informations patient
- **Acceptance criteria :**
  - Formulaire simple : nom, prénom, adresse, tel, date naissance
  - Géolocalisation automatique adresse
  - Scan ordonnance via photo (OCR)
  - Ajout notes libres
  - Validation en <30 secondes

**US-002 : Consulter dossier patient**
- **En tant que** IDEL
- **Je veux** voir historique complet patient en 1 clic
- **Afin de** préparer visite efficacement
- **Acceptance criteria :**
  - Vue synthétique : dernière visite, prochaine, pathologie
  - Historique transmissions chronologique
  - Ordonnances/prescriptions accessibles
  - Contacts (médecin, famille) visibles
  - Temps chargement <1 seconde

**US-003 : Modifier patient**
- **En tant que** IDEL
- **Je veux** mettre à jour infos patient rapidement
- **Afin de** garder dossier à jour
- **Acceptance criteria :**
  - Édition inline (pas popup)
  - Sauvegarde automatique
  - Historique modifications (audit trail)

**US-004 : Archiver patient**
- **En tant que** IDEL
- **Je veux** archiver patient inactif (décès, déménagement)
- **Afin de** nettoyer liste active
- **Acceptance criteria :**
  - Motif archivage (déménagement, décès, fin soins)
  - Patient n'apparaît plus dans listes actives
  - Récupérable si erreur (30 jours)
  - Données conservées (RGPD, HDS)

---

### 3.2 Epic 2 : Optimisation tournées

**US-010 : Générer tournée optimale quotidienne**
- **En tant que** IDEL
- **Je veux** que l'app optimise automatiquement ordre de mes visites
- **Afin de** gagner 30-60 min et économiser km
- **Acceptance criteria :**
  - Algorithme OR-Tools VRPTW
  - Prend en compte :
    - Fenêtres horaires patients (plages préférées)
    - Durée estimée visite (15/30/45/60 min selon soin)
    - Temps trajet réel (Maps API)
    - Pause déjeuner IDEL (configurable)
    - Priorités patients (urgence)
  - Génération <10 secondes
  - Affichage itinéraire sur carte
  - Économie km affichée (vs ordre manuel)
  - Ordre modifiable manuellement (drag & drop)

**US-011 : Réoptimiser tournée en temps réel**
- **En tant que** IDEL
- **Je veux** réorganiser automatiquement ma tournée si annulation
- **Afin de** ne pas perdre temps à replanifier manuellement
- **Acceptance criteria :**
  - Détection annulation patient
  - Proposition automatique réoptimisation
  - Comparaison "avant/après" (temps, km)
  - Validation 1 clic
  - Notifications patients concernés si horaire change

**US-012 : Visualiser tournée sur carte**
- **En tant que** IDEL
- **Je veux** voir mon itinéraire visuel sur carte
- **Afin de** comprendre rapidement mon parcours
- **Acceptance criteria :**
  - Carte interactive (Leaflet ou Google Maps)
  - Marqueurs patients numérotés (ordre)
  - Tracé itinéraire entre visites
  - Info popup par marqueur (nom, horaire, durée)
  - Temps trajet affiché entre chaque visite
  - Navigation GPS 1 clic vers patient suivant

**US-013 : Consulter historique optimisations**
- **En tant que** IDEL
- **Je veux** voir statistiques gain temps/km
- **Afin de** mesurer ROI de l'optimisation
- **Acceptance criteria :**
  - Dashboard hebdo/mensuel
  - Km économisés vs baseline
  - Temps gagné cumulé
  - Graphiques évolution

---

### 3.3 Epic 3 : Agent vocal IA (RDV)

**US-020 : Prendre RDV via agent vocal**
- **En tant que** Patient
- **Je veux** prendre RDV en appelant, même le soir/week-end
- **Afin de** ne pas attendre heures ouverture
- **Acceptance criteria :**
  - Numéro dédié agent vocal (08...)
  - Disponible 24/7
  - Conversation naturelle (pas menu touche)
  - Questions posées :
    - Identité patient (nom, prénom)
    - Motif RDV (soin type)
    - Disponibilités patient (jours/créneaux)
  - Recherche créneaux libres IDEL
  - Proposition 2-3 créneaux
  - Confirmation verbale
  - SMS confirmation envoyé
  - RDV ajouté agenda automatiquement

**US-021 : Annuler RDV via agent vocal**
- **En tant que** Patient
- **Je veux** annuler RDV en appelant agent IA
- **Afin de** éviter dérangement IDEL
- **Acceptance criteria :**
  - Identification patient (nom + date RDV)
  - Confirmation annulation verbale
  - RDV supprimé agenda
  - SMS confirmation annulation
  - IDEL notifiée annulation (push notification)

**US-022 : Gérer questions fréquentes**
- **En tant que** Patient
- **Je veux** poser questions courantes à l'agent IA
- **Afin de** obtenir infos sans déranger IDEL
- **Acceptance criteria :**
  - Répond questions type :
    - Horaires disponibilités IDEL
    - Tarifs actes courants
    - Zone géographique couverte
    - Documents à préparer
  - Transfert IDEL si question complexe
  - Traçabilité appels (logs)

**US-023 : Dashboard agent vocal (IDEL)**
- **En tant que** IDEL
- **Je veux** consulter activité agent vocal
- **Afin de** suivre RDV pris automatiquement
- **Acceptance criteria :**
  - Liste appels reçus (date, durée, outcome)
  - RDV créés/annulés par IA
  - Transcription conversations disponible
  - Statistiques : nb appels/jour, taux succès
  - Possibilité désactiver agent temporairement

---

### 3.4 Epic 4 : Transcription transmissions

**US-030 : Dicter transmission vocalement**
- **En tant que** IDEL
- **Je veux** dicter ma transmission après visite
- **Afin de** gagner 10-15 min de saisie manuelle
- **Acceptance criteria :**
  - Bouton micro dans dossier patient
  - Enregistrement streaming (pas batch)
  - Transcription temps réel affichée
  - Whisper AI (français médical)
  - Gestion termes médicaux (NGAP, pathologies)
  - Édition transcription avant validation
  - Sauvegarde automatique

**US-031 : Générer synthèse IA transmission**
- **En tant que** IDEL
- **Je veux** que l'IA génère résumé structuré
- **Afin de** avoir transmission claire pour collègues
- **Acceptance criteria :**
  - Mistral AI analyse transcription
  - Extraction automatique :
    - Constantes (TA, température, glycémie)
    - Soins réalisés
    - Observations
    - Actions à prévoir
  - Format structuré (sections)
  - Modification manuelle possible
  - Génération <5 secondes

**US-032 : Consulter transmissions patient**
- **En tant que** IDEL
- **Je veux** voir historique transmissions chronologique
- **Afin de** suivre évolution patient
- **Acceptance criteria :**
  - Timeline transmissions (plus récent en haut)
  - Filtres : date, IDEL, type soin
  - Recherche full-text
  - Export PDF possible
  - Partage sécurisé avec médecin traitant

**US-033 : Partager transmission inter-IDEL**
- **En tant que** IDEL en cabinet
- **Je veux** que mes transmissions soient visibles collègues
- **Afin de** assurer continuité soins
- **Acceptance criteria :**
  - Transmission visible toutes IDEL du cabinet
  - Notification temps réel nouvelle transmission
  - Lecture seule pour autres IDEL
  - Ajout commentaire possible
  - Permissions configurables (admin)

---

### 3.5 Epic 5 : Agenda & Planning

**US-040 : Visualiser agenda quotidien**
- **En tant que** IDEL
- **Je veux** voir mon planning du jour en 1 coup d'œil
- **Afin de** savoir où je vais et quand
- **Acceptance criteria :**
  - Vue journée (timeline 8h-20h)
  - Visites affichées par bloc horaire
  - Couleur par type soin ou statut
  - Info visite : patient, adresse, durée, soin
  - Navigation rapide jours précédents/suivants
  - Synchronisation temps réel

**US-041 : Ajouter RDV manuellement**
- **En tant que** IDEL
- **Je veux** créer RDV pour patient existant/nouveau
- **Afin de** compléter agenda moi-même si besoin
- **Acceptance criteria :**
  - Sélection patient (autocomplete)
  - Choix date/heure
  - Choix type soin (liste NGAP)
  - Durée estimée auto-remplie selon soin
  - Ajout note libre
  - Détection conflits horaires
  - Sauvegarde <1 seconde

**US-042 : Modifier RDV**
- **En tant que** IDEL
- **Je veux** changer horaire/date RDV facilement
- **Afin de** m'adapter aux imprévus
- **Acceptance criteria :**
  - Drag & drop RDV sur nouvel horaire
  - Détection conflits
  - Notification patient si activé
  - Historique modifications (audit)

**US-043 : Gérer disponibilités**
- **En tant que** IDEL
- **Je veux** définir mes horaires de travail
- **Afin que** l'agent IA propose RDV cohérents
- **Acceptance criteria :**
  - Configuration hebdomadaire type
  - Exceptions (congés, formations)
  - Plages indisponibles (pause déj, admin)
  - Import/export calendrier externe (Google, Outlook)

---

### 3.6 Epic 6 : Facturation

**US-050 : Créer facture acte**
- **En tant que** IDEL
- **Je veux** facturer acte après visite
- **Afin de** me faire payer rapidement
- **Acceptance criteria :**
  - Sélection actes NGAP (autocomplete)
  - Calcul automatique montant
  - Ajout majorations (nuit, dimanche, IK, etc.)
  - Support tiers-payant
  - Prévisualisation facture
  - Génération FSE (SESAM-Vitale)

**US-051 : Télétransmettre factures**
- **En tant que** IDEL
- **Je veux** envoyer factures à CPAM en 1 clic
- **Afin de** être payée sous 3 jours
- **Acceptance criteria :**
  - Batch télétransmission (plusieurs FSE)
  - Statut temps réel (envoyé, accepté, rejeté)
  - Gestion rejets (alerte + correction)
  - Historique télétransmissions
  - Conformité SESAM-Vitale

**US-052 : Suivre paiements**
- **En tant que** IDEL
- **Je veux** voir factures payées/en attente
- **Afin de** suivre ma trésorerie
- **Acceptance criteria :**
  - Liste factures : statut, montant, date
  - Filtres : payé, en attente, rejeté
  - Total CA mensuel
  - Rapprochement automatique virements CPAM
  - Export comptable (CSV)

---

## 4. FEATURES DÉTAILLÉES

### 4.1 Feature : Optimisation Tournées (OR-Tools)

#### 4.1.1 Description fonctionnelle

Algorithme d'optimisation de tournées basé sur OR-Tools résolvant le problème VRPTW (Vehicle Routing Problem with Time Windows) adapté aux contraintes IDEL.

**Entrées algorithme :**
- Liste patients à visiter (coordonnées GPS)
- Fenêtres horaires patients (ex: "préfère matin 9h-12h")
- Durée estimée visite (selon type soin)
- Heure début/fin tournée IDEL
- Pause déjeuner IDEL (durée, plage horaire)
- Point départ/arrivée (domicile ou cabinet IDEL)

**Contraintes :**
- Respecter fenêtres horaires patients
- Ne pas dépasser durée journée travail IDEL
- Inclure pause déjeuner
- Ordre patients modifiable (drag & drop priorités)

**Outputs :**
- Ordre visite optimal
- Horaire passage estimé par patient
- Temps trajet entre visites
- Distance totale parcourue
- Gain km vs ordre manuel (si baseline fournie)

#### 4.1.2 Spécifications techniques

**Algorithme :**
- Librairie : OR-Tools (Google)
- Solveur : Constraint Programming (CP-SAT)
- Fonction objectif : Minimiser distance totale
- Contraintes dures : Time windows, durée max journée
- Contraintes souples : Préférences horaires (pénalité si non respecté)

**Performance :**
- Temps calcul : <10s pour 20 patients
- Temps calcul : <30s pour 50 patients
- Fallback si timeout : Heuristique greedy (nearest neighbor)

**API Routing :**
- Provider : OpenRouteService (gratuit, open-source)
- Fallback : Valhalla (auto-hébergé)
- Calcul matrice distances : Batch API (toutes paires patients)
- Cache : Redis (durée 24h)

**Backend :**
```python
# Endpoint
POST /api/v1/tournees/optimiser
Body: {
  "idel_id": "uuid",
  "date": "2026-02-20",
  "patients": [
    {
      "patient_id": "uuid",
      "lat": 47.218371,
      "lon": -1.553621,
      "time_window_start": "09:00",
      "time_window_end": "12:00",
      "duration_minutes": 30,
      "priority": 1
    },
    ...
  ],
  "start_location": {"lat": 47.218371, "lon": -1.553621},
  "end_location": {"lat": 47.218371, "lon": -1.553621},
  "start_time": "08:00",
  "end_time": "18:00",
  "lunch_break": {"start": "12:00", "duration_minutes": 60}
}

Response: {
  "route": [
    {
      "order": 1,
      "patient_id": "uuid",
      "arrival_time": "08:30",
      "departure_time": "09:00",
      "distance_from_previous_km": 5.2,
      "duration_from_previous_min": 12
    },
    ...
  ],
  "stats": {
    "total_distance_km": 45.3,
    "total_duration_hours": 9.5,
    "savings_vs_manual_km": 7.8,
    "savings_vs_manual_min": 35
  }
}
```

#### 4.1.3 Acceptance criteria détaillés

**✅ Fonctionnel :**
- [ ] Optimisation 10 patients : <10s
- [ ] Optimisation 20 patients : <15s
- [ ] Optimisation 50 patients : <30s
- [ ] Respect 100% time windows patients
- [ ] Pause déjeuner toujours incluse
- [ ] Ordre modifiable manuellement (drag & drop)
- [ ] Réoptimisation si annulation patient : <5s

**✅ UI/UX :**
- [ ] Loading spinner pendant calcul
- [ ] Affichage "gain km" vs ordre manuel
- [ ] Carte interactive avec tracé itinéraire
- [ ] Possibilité valider/rejeter optimisation
- [ ] Sauvegarde ordre final dans agenda

**✅ Edge cases :**
- [ ] Pas de solution trouvée → Message clair + suggestions
- [ ] Timeout algorithme → Fallback heuristique
- [ ] Patient sans coordonnées GPS → Erreur explicite
- [ ] Conflits horaires détectés → Alerte utilisateur

---

### 4.2 Feature : Agent Vocal IA (Mistral + Twilio)

#### 4.2.1 Description fonctionnelle

Agent vocal conversationnel basé sur Mistral AI permettant aux patients de prendre/annuler RDV par téléphone 24/7, et répondant aux questions fréquentes.

**Capacités agent :**
1. **Prise de RDV :**
   - Identifier patient (nom, prénom, date naissance)
   - Comprendre motif RDV (type soin)
   - Collecter disponibilités patient
   - Chercher créneaux libres IDEL
   - Proposer 2-3 options
   - Confirmer choix patient
   - Créer RDV dans système
   - Envoyer SMS confirmation

2. **Annulation RDV :**
   - Identifier patient + RDV concerné
   - Confirmer annulation
   - Supprimer RDV
   - Notifier IDEL

3. **Questions FAQ :**
   - Horaires IDEL
   - Zone géographique
   - Tarifs actes courants
   - Documents nécessaires

4. **Escalade :**
   - Détection questions hors scope
   - Proposition rappel IDEL
   - Transfert messagerie si IDEL disponible

#### 4.2.2 Spécifications techniques

**Architecture :**

```
Patient → Twilio Voice → WebSocket → Backend FastAPI → Mistral API
                                          ↓
                                      PostgreSQL
                                      (patients, agenda)
```

**Stack :**
- **Téléphonie :** Twilio Voice (08... virtuel)
- **Speech-to-Text :** Twilio + Deepgram (streaming)
- **LLM :** Mistral Large (function calling)
- **Text-to-Speech :** Twilio Voices (français naturel)
- **Backend :** FastAPI + WebSocket bidirectionnel
- **BDD :** PostgreSQL (patients, RDV)

**Function calling Mistral :**

```python
tools = [
    {
        "type": "function",
        "function": {
            "name": "search_patient",
            "description": "Recherche patient par nom/prénom",
            "parameters": {
                "type": "object",
                "properties": {
                    "first_name": {"type": "string"},
                    "last_name": {"type": "string"}
                },
                "required": ["last_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_available_slots",
            "description": "Trouve créneaux disponibles IDEL",
            "parameters": {
                "type": "object",
                "properties": {
                    "idel_id": {"type": "string"},
                    "from_date": {"type": "string", "format": "date"},
                    "to_date": {"type": "string", "format": "date"},
                    "duration_minutes": {"type": "integer"}
                },
                "required": ["idel_id", "from_date", "duration_minutes"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_appointment",
            "description": "Crée RDV pour patient",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string"},
                    "idel_id": {"type": "string"},
                    "datetime": {"type": "string", "format": "date-time"},
                    "duration_minutes": {"type": "integer"},
                    "care_type": {"type": "string"}
                },
                "required": ["patient_id", "idel_id", "datetime"]
            }
        }
    }
]
```

**System prompt :**

```
Tu es l'assistant vocal de [Nom IDEL], infirmière libérale.
Ta mission : aider patients à prendre RDV ou répondre questions simples.

RÈGLES IMPORTANTES :
- Sois chaleureux, patient, professionnel
- Tutoie le patient sauf si personne âgée (vouvoiement)
- Parle naturellement, pas comme un robot
- Si tu ne sais pas : propose rappel IDEL ou transfert
- JAMAIS donner avis médical
- TOUJOURS confirmer verbalement RDV avant création

FLOW PRISE RDV :
1. Demande nom/prénom patient
2. Si nouveau → Demande date naissance + adresse
3. Demande motif RDV (type soin)
4. Demande disponibilités patient
5. Cherche créneaux libres avec function calling
6. Propose 2-3 options
7. Confirme choix verbal
8. Crée RDV + SMS confirmation

FAQ à connaître :
- Horaires : [horaires_idel]
- Zone : [zone_geographique]
- Tarifs : Pansement 15€, Injection 10€, BSI forfait
```

**Pseudonymisation (HDS) :**
- Logs conversations anonymisés (hash patient_id)
- Données sensibles (nom, date naiss) jamais stockées plain text dans logs
- Transcriptions chiffrées AES-256 en BDD
- Rétention 30 jours puis suppression auto

#### 4.2.3 Acceptance criteria détaillés

**✅ Fonctionnel :**
- [ ] Prise RDV complète en <3 min
- [ ] Reconnaissance vocale >95% accuracy (français)
- [ ] Function calling successful >90%
- [ ] SMS confirmation envoyé <10s après RDV créé
- [ ] Gestion interruptions patient (naturel)
- [ ] Escalade si question hors scope

**✅ Qualité voix :**
- [ ] Voix naturelle (pas robotique)
- [ ] Débit adapté (pas trop rapide)
- [ ] Gestion silences (relance si patient ne répond pas)
- [ ] Compréhension accents régionaux

**✅ Sécurité :**
- [ ] Aucune donnée sensible en logs plain text
- [ ] Transcriptions chiffrées
- [ ] Authentification patient (nom + date naissance)
- [ ] Pas d'avis médical donné

**✅ Monitoring :**
- [ ] Dashboard IDEL : liste appels
- [ ] Taux succès RDV créés
- [ ] Durée moyenne appel
- [ ] Motifs échec (transcription, intent unclear, etc.)

---

### 4.3 Feature : Transcription IA Transmissions (Whisper)

#### 4.3.1 Description fonctionnelle

Transcription vocale temps réel des transmissions infirmières avec dictée mains-libres, reconnaissance termes médicaux et génération synthèse structurée IA.

**User flow :**
1. IDEL termine visite patient
2. Ouvre dossier patient dans app mobile
3. Appuie sur bouton micro 🎤
4. Dicte transmission naturellement (mains libres)
5. Transcription affichée temps réel
6. Correction manuelle si nécessaire
7. Validation → Génération synthèse IA (Mistral)
8. Sauvegarde transmission

#### 4.3.2 Spécifications techniques

**Speech-to-Text :**
- Modèle : **Whisper Large-v3** (OpenAI)
- Mode : Streaming (pas batch)
- Langue : Français médical
- Latence : <500ms (temps réel)
- Accuracy : >95% (contexte médical)

**Custom vocabulary (fine-tuning) :**
- Termes NGAP : AMI, AIS, BSI, MAD, etc.
- Pathologies courantes : diabète, BPCO, AVC, escarres
- Médicaments fréquents : insuline, héparine, morphine
- Constantes : TA (tension artérielle), BPM, SpO2, glycémie

**Synthèse IA (Mistral) :**

```python
# Prompt Mistral
system_prompt = """
Tu es un assistant IA spécialisé dans la structuration de transmissions infirmières.

MISSION : Analyser transcription vocale brute et extraire éléments structurés.

STRUCTURE ATTENDUE :
{
  "constantes": {
    "tension_arterielle": "120/80 mmHg",
    "temperature": "37.2°C",
    "glycemie": "1.2 g/L",
    "saturation_o2": "98%"
  },
  "soins_realises": [
    "Pansement escarre sacrum stade 2",
    "Injection sous-cutanée insuline 10 UI"
  ],
  "observations": [
    "Patient algique, EVA 5/10",
    "Appétit diminué depuis 2 jours"
  ],
  "actions_prevoir": [
    "Surveillance escarre",
    "Adaptation posologie insuline si glycémie instable"
  ],
  "alerte_medecin": false
}

Extrait UNIQUEMENT infos présentes. Si absence donnée, laisse null.
Sois factuel, ne jamais inventer.
"""

user_message = f"Transcription : {transcription_whisper}"
```

**Backend API :**

```python
# Endpoint transcription streaming
WS /api/v1/transmissions/transcribe
- Connection WebSocket
- Client envoie chunks audio (16kHz, 16-bit PCM)
- Server stream transcription partielle
- Fermeture WS → Transcription finale

# Endpoint synthèse
POST /api/v1/transmissions/{transmission_id}/synthesize
Response: {
  "structured_data": {...},
  "summary_text": "Patient algique, pansement escarre...",
  "generation_time_ms": 1200
}
```

#### 4.3.3 Acceptance criteria détaillés

**✅ Performance :**
- [ ] Latence transcription : <500ms
- [ ] Accuracy transcription : >95%
- [ ] Génération synthèse : <3s
- [ ] Support hors-ligne : Enregistrement local, sync quand réseau

**✅ UX :**
- [ ] Feedback visuel enregistrement (waveform animée)
- [ ] Transcription affichée temps réel (scroll auto)
- [ ] Édition transcription inline avant validation
- [ ] Bouton "Générer synthèse" explicite
- [ ] Affichage différencié transcription brute vs synthèse

**✅ Qualité IA :**
- [ ] Extraction constantes : >90% accuracy
- [ ] Détection soins réalisés : >85% recall
- [ ] Pas d'hallucination (inventions)
- [ ] Gestion abréviations médicales

**✅ Conformité :**
- [ ] Audio jamais stocké serveur (streaming direct)
- [ ] Transcription chiffrée AES-256 en BDD
- [ ] Pseudonymisation noms patients dans logs
- [ ] Audit trail modifications

---

## 5. USER FLOWS

### 5.1 Flow : Nouvelle IDEL - Onboarding

**Objectif :** Activer compte et réaliser première optimisation tournée en <10 min

```
1. INSCRIPTION
   User : Ouvre app
   App : Écran bienvenue → Bouton "Créer compte"
   User : Remplit form (nom, email, tel, RPPS)
   App : Vérification RPPS (API RPPS.fr)
   App : Envoi SMS code validation
   User : Entre code
   App : ✅ Compte créé

2. SETUP PROFIL
   App : "Configurons votre profil"
   User : Upload photo (optionnel)
   User : Sélectionne zone géographique (rayon km)
   User : Définit horaires travail type (ex: Lun-Ven 8h-18h)
   App : ✅ Profil enregistré

3. IMPORT PATIENTS (optionnel)
   App : "Avez-vous déjà des patients ?"
   User : "Oui" → Import CSV ou connexion ancien logiciel
   OU User : "Non" → Skip
   App : Import asynchrone en background

4. PREMIER PATIENT
   App : "Ajoutons votre premier patient"
   User : Clique "Ajouter patient"
   User : Remplit form simplifié (nom, adresse, tel)
   User : Scan ordonnance (photo)
   App : OCR ordonnance → Pré-remplit type soin
   App : Géolocalisation adresse
   App : ✅ Patient créé

5. PREMIER RDV
   App : "Planifions un rendez-vous"
   User : Sélectionne date/heure
   User : Choisit type soin (liste)
   App : ✅ RDV ajouté agenda

6. PREMIÈRE OPTIMISATION
   App : "Optimisons votre tournée !"
   App : Affiche carte avec patient(s)
   App : Lance optimisation automatique
   App : Affiche itinéraire + gain km
   User : Valide
   App : 🎉 "Bravo ! Votre première tournée est optimisée"

7. TUTORIEL FEATURES
   App : Carrousel tips (swipe)
   - "Dictez vos transmissions vocalement 🎤"
   - "Activez l'agent vocal pour RDV auto 📞"
   - "Consultez vos stats gain temps 📊"
   User : Skip ou parcourt
   App : ✅ Onboarding terminé → Dashboard

DURÉE TOTALE : <10 min
```

---

### 5.2 Flow : Journée type IDEL avec app

**Objectif :** Démontrer usage quotidien de toutes les features

```
🌅 MATIN (07h30)

1. CONSULTATION AGENDA
   IDEL : Ouvre app au réveil
   App : Affiche planning jour (8 patients)
   App : Notification : "Votre tournée est optimisée (45km, 8h30)"

2. VALIDATION TOURNÉE
   IDEL : Consulte ordre patients sur carte
   IDEL : Voit itinéraire optimal
   IDEL : Drag & drop 1 patient (priorité changée)
   App : Réoptimise en temps réel (5s)
   IDEL : ✅ Valide tournée

3. DÉPART TOURNÉE
   IDEL : Clique "Démarrer tournée"
   App : Active mode navigation
   App : Affiche patient suivant + bouton GPS

---

🏥 JOURNÉE (08h30-17h)

4. VISITE PATIENT 1
   IDEL : Arrive chez Mme Dupont
   App : Notification "Vous êtes arrivée"
   IDEL : Consulte dossier patient (ordonnance, dernière transmission)
   IDEL : Réalise pansement
   
5. TRANSMISSION VOCALE
   IDEL : Appuie sur 🎤 dans dossier
   IDEL : Dicte "Pansement escarre sacrum, évolution favorable, 
          patient non algique, tension 12-8, température 37°C"
   App : Transcription temps réel affichée
   IDEL : Valide transcription
   App : Génère synthèse structurée IA (2s)
   App : Affiche constantes extraites + observations
   IDEL : ✅ Valide transmission

6. NAVIGATION PATIENT SUIVANT
   App : "Prochain patient : M. Martin (12 min)"
   IDEL : Clique bouton GPS
   App : Lance Google Maps avec destination

7. ANNULATION PATIENT
   App : Notification "M. Legrand a annulé RDV 14h"
   IDEL : Consulte notification
   App : Propose "Réoptimiser tournée ?"
   IDEL : Accepte
   App : Réorganise ordre + horaires patients restants (5s)
   App : "Nouvelle tournée : gain 20 min"

8. APPEL NOUVEAU PATIENT (via Agent IA)
   [14h05] Patient appelle numéro IDEL
   Agent IA : "Bonjour, cabinet de Sophie. Comment puis-je vous aider ?"
   Patient : "Je voudrais prendre RDV pour pansement"
   Agent IA : [Conversation prise RDV - 2 min]
   Agent IA : "RDV confirmé vendredi 10h. Vous recevrez SMS."
   
   [14h08] IDEL reçoit notification
   App : "Nouveau RDV : Mme Durand, Vendredi 10h, Pansement"
   IDEL : Consulte → ✅ RDV ajouté automatiquement

---

🌆 FIN JOURNÉE (17h30)

9. FACTURATION
   IDEL : Retour domicile
   IDEL : Ouvre "Facturation"
   App : Liste patients jour avec actes pré-remplis
   IDEL : Valide actes un par un
   IDEL : Ajoute majorations si nécessaire
   IDEL : Clique "Télétransmettre tout" (batch)
   App : Envoi 8 FSE à CPAM
   App : ✅ "8 factures télétransmises, paiement sous 3 jours"

10. STATS JOURNÉE
    IDEL : Consulte dashboard
    App : Affiche
    - 8 patients visités ✅
    - 45 km parcourus (vs 52 km estimé manuel = -7km)
    - 1h10 gagnée (optimisation + transcriptions vocales)
    - 450€ facturés
    IDEL : 😊 Satisfaite de sa journée

FIN ✅
```

---

### 5.3 Flow : Configuration Agent Vocal

**Objectif :** IDEL active agent vocal et configure réponses

```
1. ACTIVATION
   IDEL : Va dans Paramètres → Agent Vocal
   App : Affiche "Agent vocal désactivé"
   IDEL : Toggle ON
   App : Génère numéro 08... dédié
   App : Affiche "Votre numéro agent : 08 XX XX XX XX"

2. CONFIGURATION HORAIRES
   App : "Quand l'agent vocal doit-il répondre ?"
   IDEL : Choisit "24/7" ou "Hors horaires bureau"
   IDEL : Définit horaires bureau si option 2 (ex: 8h-18h)
   App : ✅ Sauvegardé

3. PERSONNALISATION
   App : "Personnalisez votre agent"
   IDEL : Enregistre message accueil custom (optionnel)
   IDEL : Définit types RDV autorisés (pansement, injection, etc.)
   IDEL : Configure délai min prise RDV (ex: 24h à l'avance)
   App : ✅ Configuration enregistrée

4. TEST
   App : "Testez votre agent vocal"
   IDEL : Clique "Tester"
   App : Simule appel avec scénario prise RDV
   IDEL : Écoute conversation type
   IDEL : Valide ou modifie config

5. DIFFUSION NUMÉRO
   App : "Partagez votre numéro agent"
   App : Génère affiche PDF avec QR code
   App : Suggère ajout numéro sur
   - Carte visite
   - Site web
   - Répondeur téléphone perso
   IDEL : ✅ Imprime affiche

6. MONITORING
   IDEL : Retour dashboard agent vocal
   App : Affiche (temps réel)
   - Nombre appels aujourd'hui
   - RDV créés automatiquement
   - Derniers appels (logs)
   IDEL : Peut désactiver temporairement si besoin

✅ Agent vocal actif et configuré
```

---

## 6. SPÉCIFICATIONS TECHNIQUES

### 6.1 Stack technologique

**Frontend Mobile :**
- Framework : **React Native** (iOS + Android from same codebase)
- UI Library : React Native Paper (Material Design)
- State Management : Zustand (simple, performant)
- Navigation : React Navigation v6
- Maps : React Native Maps (wrapper Google Maps / Apple Maps)
- Offline-first : WatermelonDB (sync SQLite ↔ PostgreSQL)

**Frontend Web (Admin/Dashboard) :**
- Framework : **React** (Vite)
- UI : Tailwind CSS + shadcn/ui
- State : TanStack Query (React Query v5)
- Charts : Recharts
- Maps : Leaflet

**Backend :**
- Framework : **FastAPI** (Python 3.12)
- API : REST + WebSocket (transcription streaming)
- Auth : JWT (httpOnly cookies) + Refresh tokens
- Validation : Pydantic v2
- ORM : SQLAlchemy 2.0 (async)
- Migrations : Alembic

**Base de données :**
- Primary : **PostgreSQL 16** (AWS RDS ou OVH)
- Extensions : PostGIS (géolocalisation), pg_trgm (full-text search)
- Row Level Security (RLS) : Isolation données multi-tenant
- Backup : Snapshots quotidiens + PITR (Point-in-time recovery)

**Cache & Queue :**
- Cache : **Redis** (sessions, cache API routing, rate limiting)
- Queue : **Celery** + Redis (tasks asynchrones : optimisation, emails, etc.)

**Storage :**
- Files : **S3** (OVH Object Storage) - Ordonnances, photos
- Encryption : AES-256 at rest
- Backup : Versionning + lifecycle 7 ans (HDS)

**IA & ML :**
- Agent vocal : **Mistral Large** (function calling)
- Transcription : **Whisper Large-v3** (OpenAI API)
- Optimisation : **OR-Tools** (Google, Python)
- Embeddings : Mistral Embed (future : recherche sémantique transmissions)

**Téléphonie :**
- Provider : **Twilio** (Voice, SMS)
- Numéros : 08... français (géographiques)
- Fallback : Plivo (backup provider)

**Infrastructure :**
- Hosting : **OVH Public Cloud** (hébergement France, HDS-ready)
- Containers : Docker + Docker Compose
- Orchestration (future) : Kubernetes (K8s)
- CI/CD : GitHub Actions
- Monitoring : Sentry (errors) + Prometheus + Grafana

**Sécurité :**
- WAF : Cloudflare (protection DDoS, rate limiting)
- Secrets : Vault (HashiCorp) ou AWS Secrets Manager
- Encryption : TLS 1.3, AES-256
- Conformité : HDS, RGPD

---

### 6.2 Architecture système

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENTS                            │
├─────────────────────────────────────────────────────────┤
│  Mobile App (React Native)  │  Web App (React)          │
│  - iOS / Android            │  - Dashboard IDEL         │
│  - Offline-first (WatermelonDB) │  - Admin cabinet      │
└──────────────┬──────────────┴────────────┬──────────────┘
               │                           │
               │  HTTPS (TLS 1.3)          │
               ▼                           ▼
┌──────────────────────────────────────────────────────────┐
│               CLOUDFLARE WAF / CDN                       │
│  - Protection DDoS                                       │
│  - Rate limiting                                         │
│  - SSL/TLS termination                                   │
└──────────────┬───────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│                    LOAD BALANCER                         │
│  (NGINX / HAProxy)                                       │
│  - Round-robin                                           │
│  - Health checks                                         │
└──────────────┬───────────────────────────────────────────┘
               │
       ┌───────┴────────┐
       ▼                ▼
┌─────────────┐  ┌─────────────┐
│ FastAPI 1   │  │ FastAPI 2   │  (Horizontal scaling)
│ (container) │  │ (container) │
└──────┬──────┘  └──────┬──────┘
       │                │
       └────────┬───────┘
                │
    ┌───────────┼────────────┬──────────────┐
    ▼           ▼            ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────────┐
│ PostgreSQL │ Redis  │ │ Celery   │ │   S3        │
│ (RDS)    │ (Cache)│ │ Workers  │ │ (Storage)   │
│          │        │ │          │ │             │
│ - patients│ - sess.│ │ - optim. │ │ - ordonn.   │
│ - agenda │ - cache│ │ - emails │ │ - photos    │
│ - transm.│ - queue│ │ - SMS    │ │             │
└────────┘ └────────┘ └──────────┘ └─────────────┘

EXTERNAL SERVICES (API calls)
─────────────────────────────

┌────────────────┐  ┌──────────────┐  ┌────────────────┐
│ Mistral API    │  │ Whisper API  │  │ Twilio         │
│ (Agent vocal   │  │ (Transcr.)   │  │ (Voice + SMS)  │
│  + Synthèse)   │  │              │  │                │
└────────────────┘  └──────────────┘  └────────────────┘

┌────────────────┐  ┌──────────────┐
│ OpenRouteService│  │ RPPS API     │
│ (Routing)      │  │ (Validation  │
│                │  │  IDEL)       │
└────────────────┘  └──────────────┘
```

---

### 6.3 Data model (PostgreSQL)

#### 6.3.1 Tables principales

**users (IDEL)**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    rpps VARCHAR(11) UNIQUE NOT NULL,
    phone VARCHAR(20),
    photo_url TEXT,
    
    -- Config
    work_zone_radius_km INTEGER DEFAULT 20,
    work_hours_start TIME DEFAULT '08:00',
    work_hours_end TIME DEFAULT '18:00',
    lunch_break_start TIME DEFAULT '12:00',
    lunch_break_duration_minutes INTEGER DEFAULT 60,
    
    -- Agent vocal
    vocal_agent_enabled BOOLEAN DEFAULT false,
    vocal_agent_phone VARCHAR(20),
    vocal_agent_24_7 BOOLEAN DEFAULT true,
    
    -- Subscription
    plan VARCHAR(50) DEFAULT 'solo', -- solo | cabinet | cabinet_plus
    subscription_status VARCHAR(20) DEFAULT 'trial', -- trial | active | canceled
    trial_ends_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_rpps ON users(rpps);
```

**patients**
```sql
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idel_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Identity
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    
    -- Contact
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT NOT NULL,
    lat DECIMAL(10, 8), -- Géolocalisation
    lon DECIMAL(11, 8),
    
    -- Medical
    pathologies TEXT[], -- Array pathologies
    preferred_time_slot VARCHAR(20), -- morning | afternoon | evening
    care_duration_default INTEGER DEFAULT 30, -- minutes
    notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active', -- active | archived
    archived_reason VARCHAR(50), -- moved | deceased | end_care
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    archived_at TIMESTAMP
);

CREATE INDEX idx_patients_idel ON patients(idel_id);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_geoloc ON patients USING GIST(ll_to_earth(lat, lon));
```

**appointments**
```sql
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idel_id UUID REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Scheduling
    scheduled_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    care_type VARCHAR(100) NOT NULL, -- pansement | injection | bsi | ...
    
    -- Status
    status VARCHAR(20) DEFAULT 'scheduled', -- scheduled | completed | canceled | no_show
    cancellation_reason TEXT,
    canceled_at TIMESTAMP,
    
    -- Optimisation
    route_order INTEGER, -- Position dans tournée (1, 2, 3...)
    estimated_travel_time_minutes INTEGER,
    
    -- Source
    created_by VARCHAR(20) DEFAULT 'manual', -- manual | vocal_agent | import
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_appointments_idel_date ON appointments(idel_id, scheduled_at);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
```

**transmissions**
```sql
CREATE TABLE transmissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idel_id UUID REFERENCES users(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    
    -- Content
    transcription TEXT, -- Transcription brute Whisper (chiffrée)
    structured_data JSONB, -- Synthèse IA Mistral
    /* Exemple structured_data:
    {
      "constantes": {
        "tension_arterielle": "120/80",
        "temperature": "37.2",
        "glycemie": "1.2"
      },
      "soins_realises": ["Pansement escarre", "Injection insuline"],
      "observations": ["Patient algique EVA 5/10"],
      "actions_prevoir": ["Surveillance escarre"],
      "alerte_medecin": false
    }
    */
    
    -- Metadata
    recording_duration_seconds INTEGER,
    generation_time_ms INTEGER,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_transmissions_patient ON transmissions(patient_id);
CREATE INDEX idx_transmissions_idel_date ON transmissions(idel_id, created_at DESC);
```

**vocal_agent_calls**
```sql
CREATE TABLE vocal_agent_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idel_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Call metadata
    twilio_call_sid VARCHAR(100) UNIQUE,
    caller_phone VARCHAR(20) NOT NULL,
    duration_seconds INTEGER,
    
    -- Outcome
    outcome VARCHAR(50), -- appointment_created | appointment_canceled | faq_answered | transferred | failed
    patient_id UUID REFERENCES patients(id),
    appointment_id UUID REFERENCES appointments(id),
    
    -- Conversation
    transcription TEXT, -- Full conversation transcript (chiffrée)
    summary TEXT, -- Résumé IA conversation
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_vocal_calls_idel ON vocal_agent_calls(idel_id);
CREATE INDEX idx_vocal_calls_outcome ON vocal_agent_calls(outcome);
```

#### 6.3.2 Row Level Security (RLS)

**Isolation multi-tenant :**

```sql
-- Activer RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transmissions ENABLE ROW LEVEL SECURITY;

-- Policy : IDEL voit uniquement ses données
CREATE POLICY patients_isolation ON patients
    FOR ALL
    USING (idel_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY appointments_isolation ON appointments
    FOR ALL
    USING (idel_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY transmissions_isolation ON transmissions
    FOR ALL
    USING (idel_id = current_setting('app.current_user_id')::UUID);
```

**Configuration session :**
```python
# FastAPI middleware
@app.middleware("http")
async def set_rls_user(request: Request, call_next):
    user_id = request.state.user_id  # From JWT
    async with db.session() as session:
        await session.execute(
            text(f"SET app.current_user_id = '{user_id}'")
        )
        response = await call_next(request)
    return response
```

---

## 7. ARCHITECTURE SYSTÈME

### 7.1 Architecture API (FastAPI)

#### Structure projet

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app
│   ├── config.py            # Settings (env vars)
│   ├── database.py          # SQLAlchemy setup
│   ├── dependencies.py      # DI (current_user, db session)
│   │
│   ├── api/
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py      # POST /login, /register, /refresh
│   │   │   ├── patients.py  # CRUD patients
│   │   │   ├── appointments.py
│   │   │   ├── tournees.py  # POST /optimiser
│   │   │   ├── transmissions.py  # WS /transcribe
│   │   │   └── vocal_agent.py
│   │
│   ├── models/              # SQLAlchemy ORM models
│   │   ├── user.py
│   │   ├── patient.py
│   │   ├── appointment.py
│   │   └── transmission.py
│   │
│   ├── schemas/             # Pydantic schemas (request/response)
│   │   ├── user.py
│   │   ├── patient.py
│   │   └── ...
│   │
│   ├── services/            # Business logic
│   │   ├── optimization.py  # OR-Tools logic
│   │   ├── transcription.py # Whisper integration
│   │   ├── vocal_agent.py   # Mistral + Twilio
│   │   └── synthesis.py     # Mistral synthesis
│   │
│   ├── utils/
│   │   ├── security.py      # Password hashing, JWT
│   │   ├── geocoding.py     # Address → lat/lon
│   │   └── routing.py       # OpenRouteService API
│   │
│   └── tasks/               # Celery tasks
│       ├── emails.py
│       ├── sms.py
│       └── optimization.py
│
├── tests/
│   ├── test_api/
│   ├── test_services/
│   └── fixtures.py
│
├── alembic/                 # DB migrations
│   ├── versions/
│   └── env.py
│
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

#### 7.2 Endpoints API (exhaustif)

**Authentication**
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

**Users**
```
GET    /api/v1/users/me
PATCH  /api/v1/users/me
PATCH  /api/v1/users/me/password
GET    /api/v1/users/me/stats        # Dashboard stats
```

**Patients**
```
GET    /api/v1/patients               # List (paginated, search)
POST   /api/v1/patients
GET    /api/v1/patients/{id}
PATCH  /api/v1/patients/{id}
DELETE /api/v1/patients/{id}         # Soft delete (archive)
POST   /api/v1/patients/import       # CSV import
```

**Appointments**
```
GET    /api/v1/appointments           # List (filters: date, patient, status)
POST   /api/v1/appointments
GET    /api/v1/appointments/{id}
PATCH  /api/v1/appointments/{id}
DELETE /api/v1/appointments/{id}
POST   /api/v1/appointments/{id}/cancel
POST   /api/v1/appointments/{id}/complete
```

**Tournées (Optimisation)**
```
POST   /api/v1/tournees/optimiser    # Optimisation OR-Tools
GET    /api/v1/tournees/history       # Historique optimisations
GET    /api/v1/tournees/stats         # Stats gain km/temps
```

**Transmissions**
```
GET    /api/v1/transmissions                      # List (patient, date)
POST   /api/v1/transmissions                      # Create manual
WS     /api/v1/transmissions/transcribe           # WebSocket streaming
POST   /api/v1/transmissions/{id}/synthesize      # Generate AI summary
GET    /api/v1/transmissions/{id}
PATCH  /api/v1/transmissions/{id}
DELETE /api/v1/transmissions/{id}
```

**Agent Vocal**
```
GET    /api/v1/vocal-agent/config
PATCH  /api/v1/vocal-agent/config
GET    /api/v1/vocal-agent/calls              # List calls
GET    /api/v1/vocal-agent/calls/{id}
POST   /api/v1/vocal-agent/test               # Test call simulation
POST   /api/v1/vocal-agent/webhooks/twilio    # Twilio callback
```

**Facturation**
```
GET    /api/v1/factures                       # List invoices
POST   /api/v1/factures
GET    /api/v1/factures/{id}
POST   /api/v1/factures/teletransmit          # Batch télétransmission
GET    /api/v1/factures/stats                 # CA, rejets, etc.
```

---

## 8. EXIGENCES NON-FONCTIONNELLES

### 8.1 Performance

**Temps de réponse API :**
- GET simple (patient, RDV) : <200ms (p95)
- POST création : <500ms (p95)
- Optimisation tournée 20 patients : <10s (p95)
- Transcription streaming : <500ms latence
- Synthèse IA : <3s (p95)

**Capacité :**
- 1 000 IDEL actives simultanées
- 10 000 RDV créés/jour
- 100 optimisations tournées/minute
- 50 transcriptions simultanées

**Mobile app :**
- Démarrage app : <2s
- Offline-first : Toutes features CRUD disponibles hors connexion
- Sync automatique quand réseau revient

### 8.2 Sécurité

**Authentication & Authorization :**
- JWT tokens (access 15 min, refresh 7 jours)
- Password hashing : bcrypt (10 rounds)
- MFA optionnel (TOTP)
- Rate limiting : 100 req/min par IP

**Data protection :**
- Encryption at rest : AES-256
- Encryption in transit : TLS 1.3
- Pseudonymisation logs (hash user IDs)
- Pas de logs données médicales

**Conformité RGPD :**
- Droit accès données (export JSON)
- Droit rectification
- Droit effacement (suppression compte + cascade)
- Portabilité données
- Durée conservation : 7 ans (exigence HDS)

**Conformité HDS :**
- Hébergement France (OVH)
- Certification hébergeur
- Chiffrement données santé
- Audit trail complet
- DPO externe
- Procédures documentées

### 8.3 Disponibilité & Fiabilité

**SLA target :**
- Uptime : 99.5% (43h downtime/an acceptable)
- RTO (Recovery Time Objective) : 4h
- RPO (Recovery Point Objective) : 1h (max perte données)

**Backup :**
- BDD : Snapshots quotidiens + PITR
- Files S3 : Versioning + lifecycle
- Durée rétention : 30 jours snapshots, 7 ans archives

**Monitoring :**
- Health checks : /health endpoint (200 OK)
- Metrics : Prometheus + Grafana
- Alerting : PagerDuty (critical errors)
- Error tracking : Sentry

### 8.4 Scalabilité

**Horizontal scaling :**
- API : Stateless, load balancer round-robin
- Celery workers : Auto-scaling basé sur queue length
- BDD : Read replicas (future)

**Vertical scaling :**
- PostgreSQL : 4 vCPU, 16 GB RAM (MVP)
- Redis : 2 vCPU, 4 GB RAM
- API containers : 2 vCPU, 4 GB RAM × 2

### 8.5 Accessibilité

**WCAG 2.1 AA compliance :**
- Contraste couleurs : Ratio 4.5:1 minimum
- Navigation clavier complète
- Screen reader compatible
- Taille texte ajustable

**Langues :**
- MVP : Français uniquement
- V2.0 : Multi-langue (EN, ES)

### 8.6 Compatibilité

**Mobile :**
- iOS : 14+ (95% devices)
- Android : 10+ (90% devices)

**Web :**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**APIs externes :**
- Mistral API : Fallback si down (queue requests)
- Whisper API : Fallback local Whisper (future)
- Twilio : Fallback Plivo

---

## 9. ROADMAP & PRIORITÉS

### 9.1 MVP (M1-M6) - Beta

**Objectif :** Valider product-market fit avec 5 cabinets beta

**Features P0 (Must-have) :**
- ✅ Auth (register, login, JWT)
- ✅ CRUD patients (create, read, update, archive)
- ✅ CRUD RDV (agenda journalier/hebdo)
- ✅ Optimisation tournées (OR-Tools)
- ✅ Transcription transmissions (Whisper streaming)
- ✅ Facturation basique (création FSE manuelle)

**Features P1 (Should-have) :**
- Dashboard stats (gain km, temps)
- Notifications push (annulation patient)
- Import patients CSV

**Features P2 (Nice-to-have) :**
- Export données (JSON)
- Thème sombre

**Non-scope MVP :**
- ❌ Agent vocal (M10)
- ❌ Synthèse IA transmissions (M10)
- ❌ Télétransmission auto (M11)
- ❌ Certification HDS (M11)

**Timeline :**
- M1-M2 : Backend API (auth, patients, RDV)
- M3-M4 : Optimisation tournées + Frontend mobile
- M5 : Transcription Whisper + Facturation
- M6 : Beta test (5 cabinets)

**Budget :** 5 300€ (infra + DPO)

---

### 9.2 V1.0 (M7-M11) - Production

**Objectif :** Lancement commercial, 50 cabinets payants

**Features P0 :**
- ✅ Agent vocal IA (Mistral + Twilio)
- ✅ Synthèse IA transmissions (Mistral)
- ✅ Télétransmission automatique (SESAM-Vitale)
- ✅ Sync agenda externe (Google, Outlook)
- ✅ Notifications intelligentes
- ✅ Certification HDS

**Features P1 :**
- Onboarding gamifié (tutoriel interactif)
- Programme parrainage (referral)
- Mode cabinet (multi-utilisateurs)
- Permissions rôles (admin, IDEL)

**Timeline :**
- M7-M8 : Agent vocal (dev + tests)
- M9 : Synthèse IA + Sync calendrier
- M10 : Certification HDS (audit)
- M11 : Lancement production

**Budget :** 22 350€ (certification HDS 12k€ + infra)

---

### 9.3 V1.5 (M12-M18) - Growth

**Objectif :** Scale 150 cabinets, expansion features

**Features P0 :**
- Téléconsultation intégrée (Jitsi ou Twilio Video)
- Messagerie sécurisée inter-soignants (médecins, IDEL, etc.)
- Analytics avancés (dashboard cabinet : CA, KPI, graphiques)
- Export comptabilité (Cegid, ACD, QuadraExpert)

**Features P1 :**
- Intégration DMP (Dossier Médical Partagé)
- API publique (partenaires)
- Mode hors-ligne avancé (sync bidirectionnel robuste)
- Widget site web (prise RDV patients)

**Timeline :** M12-M18

**Budget :** Non défini (à affiner selon traction)

---

### 9.4 Priorisation framework (RICE)

**RICE Score = (Reach × Impact × Confidence) / Effort**

Exemple évaluation features V1.5 :

| Feature | Reach | Impact | Confidence | Effort | RICE | Priorité |
|---------|-------|--------|------------|--------|------|----------|
| Téléconsultation | 70% | 3 | 80% | 8 weeks | 21 | P0 |
| Messagerie sécurisée | 80% | 2 | 90% | 4 weeks | 36 | **P0** |
| Analytics dashboard | 100% | 2 | 100% | 3 weeks | 67 | **P0** |
| Export compta | 60% | 3 | 70% | 6 weeks | 21 | P1 |
| Intégration DMP | 40% | 3 | 50% | 12 weeks | 5 | P2 |

**→ Priorité : Analytics > Messagerie > Téléconsultation > Export compta > DMP**

---

## 10. MÉTRIQUES DE SUCCÈS

### 10.1 Product metrics (KPIs)

**Activation :**
- % users qui créent 1er patient : **>90%**
- % users qui optimisent 1ère tournée : **>70%**
- Time to value (1ère optimisation) : **<7 jours**

**Engagement :**
- DAU/MAU (Daily Active / Monthly Active) : **>60%**
- % IDEL utilisant optimisation quotidiennement : **>80%**
- % IDEL utilisant transcription vocale : **>60%**
- % IDEL activant agent vocal : **>40%**

**Rétention :**
- Day 1 retention : >80%
- Day 7 retention : >60%
- Day 30 retention : >40%
- Churn mensuel : **<5%**

**Satisfaction :**
- NPS (Net Promoter Score) : **>50**
- CSAT (satisfaction post-feature) : **>80%**
- App store rating : **>4.5/5**

**Value delivered :**
- Gain temps moyen/jour : **>1h**
- Gain km moyen/jour : **>5 km**
- % transmissions dictées vocalement : **>70%**
- % RDV pris par agent vocal : **>30%**

---

### 10.2 Business metrics

**Acquisition :**
- New signups/month : M6: 5, M12: 50, M18: 150
- CAC (Customer Acquisition Cost) : **<400€**
- Conversion trial → paid : **>50%**

**Revenue :**
- MRR (Monthly Recurring Revenue) : M12: 7.5k€, M18: 22.5k€, M24: 53k€
- ARPU (Average Revenue Per User) : **180€/mois**
- LTV (Lifetime Value) : **4 850€**

**Unit economics :**
- LTV/CAC ratio : **>10**
- Payback period : **<5 mois**
- Gross margin : **>70%**

**Growth :**
- MoM growth rate : M10-M15: +25%, M16-M24: +15%
- Viral coefficient (referral) : >0.5 (future)

---

### 10.3 Technical metrics

**Performance :**
- API p95 latency : <500ms
- App crash rate : <1%
- Optimisation success rate : >95%
- Transcription accuracy : >95%

**Reliability :**
- Uptime : >99.5%
- Error rate : <0.5%
- Failed background jobs : <2%

**Security :**
- Security incidents : 0
- Data breaches : 0
- Failed auth attempts : <1% (rate limiting OK)

---

### 10.4 Instrumentation & tracking

**Analytics stack :**
- Product analytics : **Mixpanel** ou **Amplitude**
- Error tracking : **Sentry**
- Infrastructure monitoring : **Prometheus + Grafana**
- User feedback : **Intercom** ou **Zendesk**

**Events tracked :**

```javascript
// Activation
track('user_registered', {user_id, plan, source})
track('first_patient_created', {user_id, time_since_signup})
track('first_optimization_run', {user_id, num_patients})

// Engagement
track('optimization_requested', {user_id, num_patients, date})
track('transcription_started', {user_id, patient_id})
track('vocal_agent_call_received', {user_id, outcome})

// Conversion
track('trial_started', {user_id, plan})
track('subscription_created', {user_id, plan, amount})
track('subscription_canceled', {user_id, reason})

// Value
track('daily_time_saved', {user_id, minutes_saved})
track('daily_km_saved', {user_id, km_saved})
```

**Dashboards :**
- **Exec dashboard** : MRR, growth, churn, LTV/CAC
- **Product dashboard** : DAU/MAU, feature adoption, funnel
- **Engineering dashboard** : Latency, errors, uptime
- **Support dashboard** : Tickets, NPS, CSAT

---

## ANNEXES

### A. Glossaire technique

**OR-Tools :** Librairie Google pour optimisation combinatoire  
**VRPTW :** Vehicle Routing Problem with Time Windows  
**Whisper :** Modèle OpenAI transcription vocale  
**Mistral :** LLM français (Mistral AI)  
**Function calling :** Capacité LLM à appeler fonctions externes  
**RLS :** Row Level Security (isolation données PostgreSQL)  
**HDS :** Hébergeur Données de Santé (certification française)  
**SESAM-Vitale :** Système télétransmission feuilles soins  
**FSE :** Feuille de Soins Électronique  
**NGAP :** Nomenclature Générale des Actes Professionnels  
**RPPS :** Répertoire Partagé des Professionnels de Santé  

### B. Références & ressources

**Documentation :**
- OR-Tools : https://developers.google.com/optimization
- FastAPI : https://fastapi.tiangolo.com
- React Native : https://reactnative.dev
- Mistral API : https://docs.mistral.ai
- Twilio Voice : https://www.twilio.com/docs/voice

**Conformité :**
- HDS : https://esante.gouv.fr/securite/hebergement-de-donnees-de-sante
- RGPD : https://www.cnil.fr
- SESAM-Vitale : https://www.sesam-vitale.fr

### C. Contact & ownership

**Product Owner :** [Nom ta femme] - [email]  
**Tech Lead :** [Ton nom] - [email]  
**Stakeholders :** IDEL beta testers (liste)

---

**Document living :** Ce PRD est mis à jour régulièrement selon feedback beta et évolution roadmap.

**Dernière mise à jour :** Janvier 2026  
**Prochaine revue :** Mars 2026 (post-beta)

---

**FIN DU PRD**
