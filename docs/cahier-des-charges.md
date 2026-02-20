# CAHIER DES CHARGES - ASSISTANT IA POUR INFIRMIÈRES LIBÉRALES

## 1. PRÉSENTATION DU PROJET

### 1.1 Contexte
Les infirmières libérales (IDEL) font face à des défis organisationnels majeurs :
- Gestion complexe de tournées avec multiples patients
- Coordination entre plusieurs soignants
- Charge administrative importante (appels, planning, transmissions)
- Interruptions fréquentes pendant les soins
- Contraintes temporelles et géographiques strictes

### 1.2 Objectifs du projet
Développer une solution logicielle intelligente permettant de :
- Automatiser la gestion des rendez-vous et de la planification
- Optimiser les tournées quotidiennes
- Réduire la charge administrative
- Améliorer la continuité des soins via des transmissions efficaces
- Libérer du temps pour les soins aux patients

### 1.3 Périmètre V1 (MVP)
**Inclus :**
- Agenda partagé multi-utilisateurs
- Planification intelligente des tournées
- Secrétaire vocal IA pour prise de RDV
- Gestion des transmissions (vocal -> texte -> synthese)

**Exclu de la V1 :**
- Facturation et télétransmission CPAM
- Dossier patient complet
- Gestion des stocks de matériel
- Intégration avec logiciels métiers existants

---

## 2. UTILISATEURS ET ACTEURS

### 2.1 Utilisateurs principaux
- **Infirmières libérales** (solo ou en cabinet de groupe)
- **Secrétaires médicales** (si présentes)
- **Patients** (indirectement via le système vocal)

### 2.2 Rôles et permissions
1. **Administrateur cabinet** : gestion complète, configuration
2. **Infirmière titulaire** : accès complet à ses données et agenda partagé
3. **Infirmière remplaçante** : accès temporaire limité
4. **Secrétaire** : gestion agenda et appels uniquement

---

## 3. FONCTIONNALITÉS DÉTAILLÉES

### 3.1 GESTION D'AGENDAS MULTIPLES ET PARTAGÉS

#### 3.1.1 Fonctionnalités principales
**Visualisation**
- Vue jour / semaine / mois par infirmière
- Vue consolidée multi-agendas (cabinet)
- Affichage géographique des RDV sur carte
- Codes couleur par type de soin

**Gestion des RDV**
- Créer / modifier / supprimer un RDV
- RDV récurrents (ex: pansement 3x/semaine)
- Gestion des séries de soins (prescription)
- Blocage de créneaux (congés, formation)

**Partage et collaboration**
- Synchronisation temps réel entre utilisateurs
- Notifications de modifications
- Gestion des conflits de planning
- Historique des modifications

#### 3.1.2 Données par RDV
- Patient (nom, prénom, coordonnées)
- Type de soin (nomenclature NGAP)
- Durée estimée
- Adresse / localisation GPS
- Horaire (plage ou horaire fixe)
- Commentaires spécifiques
- Priorité / urgence
- Statut (planifié / réalisé / annulé)

#### 3.1.3 Exigences techniques
- Synchronisation offline (mode dégradé)
- Export ICS pour calendriers externes
- Notifications push (rappels)
- Interface mobile responsive

---

### 3.2 MOTEUR IA DE PLANIFICATION DE TOURNÉE

#### 3.2.1 Objectif
Générer automatiquement l'ordre optimal de visite des patients en minimisant le temps de trajet tout en respectant les contraintes métier.

#### 3.2.2 Contraintes à gérer

**Contraintes dures (impératives)**
- Créneaux horaires imposés par le patient
- Durée des soins par type d'acte
- Respect des prescriptions (fréquence, horaires)
- Disponibilité de l'infirmière
- Temps de trajet entre patients

**Contraintes souples (à optimiser)**
- Minimisation distance totale parcourue
- Regroupement géographique
- Préférences patient (matin/soir)
- Équilibrage de charge entre infirmières
- Temps de pause

**Types de soins à gérer**
- Soins rapides (5-15 min) : piqûres, prélèvements
- Soins moyens (15-30 min) : pansements, perfusions
- Soins longs (30-60 min) : toilettes, nursing
- Soins urgents : à caser en priorité

#### 3.2.3 Fonctionnalités

**Planification automatique**
- Génération de tournée quotidienne optimisée
- Proposition de plusieurs scénarios
- Ajustement dynamique (nouveau patient urgent)
- Planification multi-jours (vision hebdomadaire)

**Interface utilisateur**
- Visualisation de la tournée sur carte
- Ordre de visite numéroté
- Temps estimé par trajet
- Heure d'arrivée estimée chez chaque patient
- Mode drag & drop pour ajustements manuels
- Comparaison avant/après optimisation

**Algorithme**
- Résolution de problème de tournées (VRP - Vehicle Routing Problem)
- Prise en compte contraintes temporelles (VRPTW)
- Possibilité de contraintes multiples
- Temps de calcul < 5 secondes

#### 3.2.4 Données nécessaires
- Base de données patients avec géolocalisation
- Matrice de distances/temps entre adresses
- Historique de durées réelles des soins
- Contraintes et préférences paramétrables

---

### 3.3 AGENT IA VOCAL - SECRÉTAIRE MÉDICALE

#### 3.3.1 Objectif
Agent conversationnel vocal capable de répondre aux appels téléphoniques et gérer les prises de RDV de manière autonome.

#### 3.3.2 Capacités conversationnelles

**Compréhension**
- Reconnaissance vocale multilocuteur (accents, âges variés)
- Compréhension du langage naturel
- Gestion des interruptions et hésitations
- Détection de l'intention (RDV, annulation, information)

**Dialogue naturel**
- Voix synthétique professionnelle et empathique
- Reformulation pour confirmation
- Gestion des ambiguïtés
- Politesse et adaptation au patient

#### 3.3.3 Scénarios fonctionnels

**Scénario 1 : Prise de RDV simple**
1. Accueil et identification besoin
2. Identification patient (nouveau/existant)
3. Collecte type de soin
4. Proposition créneaux disponibles
5. Confirmation et récapitulatif

**Scénario 2 : Urgence**
- Détection mots-clés urgence
- Questions ciblées sur la situation
- Priorisation dans le planning
- Alerte infirmière si nécessaire

**Scénario 3 : Annulation/modification**
- Identification RDV existant
- Traitement modification
- Proposition nouveau créneau si besoin

**Scénario 4 : Transfert humain**
- Détection situations complexes
- Transfert vers infirmière/secrétaire
- Résumé de la conversation

#### 3.3.4 Intégration système

**Actions automatiques**
- Création RDV dans agenda
- Envoi SMS confirmation au patient
- Mise à jour planning tournée
- Notification infirmière

**Sécurité et validation**
- Enregistrement des conversations (RGPD)
- Log des actions effectuées
- Validation humaine optionnelle (mode apprentissage)
- Détection anomalies

#### 3.3.5 Paramétrages
- Plages horaires de disponibilité de l'agent
- Message d'accueil personnalisable
- Seuils de confiance pour actions autonomes
- Règles métier (durée min/max, créneaux interdits)

---

### 3.4 GESTION DES TRANSMISSIONS

#### 3.4.1 Objectif
Faciliter la communication entre soignants lors des relèves, remplacements ou prises en charge partagées.

#### 3.4.2 Flux de transmission

**1. Capture vocale**
- Enregistrement vocal en mobilité
- Dictée pendant/après la visite patient
- Support multi-formats audio

**2. Retranscription automatique**
- Speech-to-text en temps réel ou différé
- Correction automatique termes médicaux
- Horodatage précis
- Identification locuteur (multi-infirmières)

**3. Traitement IA**

**Synthèse automatique**
- Extraction informations clés
- Structuration par sections :
  - État général du patient
  - Soins réalisés
  - Observations particulières
  - Actions à prévoir
  - Alertes/points de vigilance

**Reformulation**
- Clarification du langage oral
- Mise en forme professionnelle
- Détection et mise en évidence urgences
- Suggestions de compléments si manques

**4. Transmission**
- Diffusion aux soignants concernés
- Attachement au dossier patient
- Notification temps réel
- Accusé de lecture

#### 3.4.3 Types de transmissions
- **Transmissions ciblées** : patient spécifique
- **Transmissions de relève** : synthèse de tournée
- **Alertes urgentes** : événements critiques
- **Notes d'observation** : évolution patient

#### 3.4.4 Format de sortie
```
TRANSMISSION - Patient [Nom]
Date : [Date/Heure]
Soignant : [Nom infirmière]

SYNTHÈSE :
[Résumé en 2-3 phrases]

DÉTAILS :
État général : ...
Soins réalisés : ...
Observations : ...
Évolution : ...

ACTIONS À PRÉVOIR :
- ...
- ...

ALERTES : [ALERTE]
- ...
```

#### 3.4.5 Fonctionnalités complémentaires
- Historique des transmissions par patient
- Recherche textuelle dans transmissions
- Export PDF
- Annotations collaboratives
- Validation/signature électronique

---

## 4. EXIGENCES NON-FONCTIONNELLES

### 4.1 Performance
- Temps de réponse < 2s (interface utilisateur)
- Génération tournée < 5s (jusqu'à 50 patients)
- Retranscription temps réel (latence < 1s)
- Disponibilité 99.5% (hors maintenance)

### 4.2 Sécurité et conformité

**RGPD**
- Consentement explicite patients
- Droit à l'oubli
- Portabilité des données
- Registre des traitements

**Hébergement Données de Santé (HDS)**
- Certification HDS obligatoire
- Chiffrement données au repos (AES-256)
- Chiffrement communications (TLS 1.3)
- Authentification forte (2FA)
- Traçabilité des accès

**Secret médical**
- Isolation des données par cabinet
- Gestion fine des permissions
- Anonymisation pour analytics
- Durée de conservation définie

### 4.3 Ergonomie
- Interface intuitive (max 3 clics pour actions courantes)
- Adaptation mobile/tablette/desktop
- Mode sombre
- Accessibilité (WCAG 2.1 niveau AA)
- Temps de formation < 2h

### 4.4 Scalabilité
- Support 1 à 100 infirmières par cabinet
- Gestion 1000+ patients par cabinet
- 10 000+ RDV par mois
- Architecture cloud élastique

### 4.5 Fiabilité IA
- **Agent vocal** : taux de compréhension > 95%
- **Planification** : satisfaction utilisateur > 80%
- **Transcription** : précision > 98% (vocabulaire médical)
- **Synthèse** : conservation 100% informations critiques

---

## 5. CONTRAINTES TECHNIQUES

### 5.1 Technologies pressenties
- **Backend** : Python (FastAPI) / Node.js
- **Frontend** : React Native (mobile) + React (web)
- **BDD** : PostgreSQL + Vector DB (embeddings)
- **IA** : LLM (OpenAI/Claude), STT (Whisper), TTS
- **Planification** : OR-Tools / Algorithmes génétiques
- **Infra** : Cloud HDS certifié (Azure Health / OVH)

### 5.2 Intégrations futures
- Annuaire RPPS (répertoire professionnels santé)
- Messagerie sécurisée de santé (MSS)
- INS (identifiant national de santé)
- Services de géolocalisation (Google Maps / OpenStreetMap)

### 5.3 Contraintes d'exploitation
- Mode hors-ligne partiel (consultation agenda)
- Synchronisation lors de connexion
- Sauvegarde quotidienne automatique
- Plan de reprise d'activité (PRA)

---

## 6. USER STORIES PRINCIPALES

### US1 - Planification automatique
**En tant qu'** infirmière libérale  
**Je veux** que le système génère automatiquement ma tournée quotidienne  
**Afin de** gagner du temps et optimiser mes déplacements

**Critères d'acceptation :**
- La tournée respecte tous les RDV fixes
- Le temps de trajet total est minimisé
- Je peux ajuster manuellement l'ordre
- Je visualise le parcours sur une carte

### US2 - Prise de RDV vocal
**En tant que** patient  
**Je veux** prendre RDV par téléphone avec un assistant vocal  
**Afin de** obtenir un créneau sans attendre un rappel

**Critères d'acceptation :**
- L'assistant me comprend naturellement
- Il me propose des créneaux disponibles
- Il confirme mon RDV par SMS
- Je peux annuler/modifier facilement

### US3 - Transmission rapide
**En tant qu'** infirmière  
**Je veux** dicter mes observations après une visite  
**Afin de** les transmettre à ma collègue sans rédiger

**Critères d'acceptation :**
- Je peux enregistrer en moins de 30 secondes
- La retranscription est précise
- Ma collègue reçoit une synthèse claire
- Les points importants sont mis en évidence

### US4 - Agenda partagé
**En tant que** membre d'un cabinet de groupe  
**Je veux** voir les plannings de mes collègues  
**Afin de** coordonner les soins patients communs

**Critères d'acceptation :**
- Je vois qui intervient chez quel patient
- Je peux ajouter un RDV sur le planning commun
- Les modifications sont synchronisées en temps réel
- Je reçois une notification en cas de conflit

---

## 7. RISQUES ET POINTS D'ATTENTION

### 7.1 Risques techniques
| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| Fiabilité agent vocal insuffisante | Élevé | Moyen | Phase de test extensive, possibilité transfert humain |
| Complexité algorithme planification | Moyen | Élevé | Démarrer avec algo simple, amélioration itérative |
| Latence transcription temps réel | Moyen | Faible | Mode différé acceptable, optimisation infrastructure |

### 7.2 Risques réglementaires
- Non-conformité HDS -> Audit avant mise en production
- RGPD -> DPO dès conception, privacy by design
- Responsabilité médicale -> Clauses contractuelles claires

### 7.3 Risques adoption
- Résistance au changement -> Co-conception avec IDEL
- Complexité perçue -> UX simple, onboarding guidé
- Coût -> Modèle freemium, ROI démontrable

---

## 8. PRIORISATION ET ROADMAP SUGGÉRÉE

### Phase 1 - MVP (3-4 mois)
1. Agenda partagé basique
2. Prise de RDV manuelle
3. Planification semi-automatique (suggestions)
4. Transcription vocal -> texte simple

### Phase 2 - IA Core (2-3 mois)
5. Planification automatique optimisée
6. Agent vocal prise de RDV (beta)
7. Synthèse intelligente transmissions

### Phase 3 - Raffinement (2 mois)
8. Amélioration UX basée sur retours
9. Optimisations performance
10. Certification HDS

---

## 9. INDICATEURS DE SUCCÈS (KPI)

### Métriques d'usage
- Taux d'adoption : >70% IDEL utilisent quotidiennement
- NPS (Net Promoter Score) : >40

### Métriques d'efficacité
- Temps gagné : 30min/jour/infirmière
- Réduction kilométrage : 15%
- Taux de RDV automatisés : >60%

### Métriques qualité
- Taux erreur agent vocal : <5%
- Satisfaction transmissions : >4/5
- Taux de bugs critiques : <1/mois

---

## 10. ANNEXES

### 10.1 Glossaire
- **IDEL** : Infirmier(ère) Diplômé(e) d'État Libéral(e)
- **NGAP** : Nomenclature Générale des Actes Professionnels
- **HDS** : Hébergeur de Données de Santé
- **RPPS** : Répertoire Partagé des Professionnels de Santé
- **INS** : Identifiant National de Santé
- **MSS** : Messagerie Sécurisée de Santé
- **VRP** : Vehicle Routing Problem
- **VRPTW** : Vehicle Routing Problem with Time Windows

### 10.2 Références
- Certification HDS : https://esante.gouv.fr/labels-certifications/hds
- RGPD santé : https://www.cnil.fr/fr/la-sante
- Nomenclature NGAP : https://www.ameli.fr/infirmier/exercice-liberal/facturation-remuneration/nomenclature-actes

---

**Document rédigé le** : 29 janvier 2026  
**Version** : 1.0  
**Auteur** : Cahier des charges initial
