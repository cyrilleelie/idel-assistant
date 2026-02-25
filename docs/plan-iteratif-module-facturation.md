# PLAN ITÉRATIF DÉTAILLÉ — MODULE FACTURATION
## Assistant IA IDEL — Epic 6

**Version :** 1.0  
**Date :** Février 2026  
**Auteur :** Cyrille (Tech Lead)  
**Basé sur :** Architecture v1.0, PRD v1.0, Modèle de données revu

---

## VISION GLOBALE

```
ITER 1          ITER 2          ITER 3          ITER 4          ITER 5
Référentiel     Factures        Moteur de       Ordonnances     Pré-remplissage
NGAP            basiques        cotation auto   & prescriptions auto depuis RDV

    │               │               │               │               │
    ▼               ▼               ▼               ▼               ▼
  1 sem           1.5 sem         2 sem           1 sem           1 sem
  Fondation       CRUD            Intelligence    Traçabilité     UX terrain
                  factures        métier          réglementaire


ITER 6          ITER 7          ITER 8
Dashboard       Export          Préparation
suivi & stats   comptable       télétransmission

    │               │               │
    ▼               ▼               ▼
  1.5 sem         1 sem           2 sem
  Pilotage CA     Intégration     SESAM-Vitale
                  cabinet comptable  (V1.0)
```

**Durée totale estimée : ~11.5 semaines**

- Itérations 1–5 : scope MVP (facturation basique utilisable)
- Itérations 6–7 : confort et pilotage cabinet
- Itération 8 : préparation V1.0 (télétransmission réelle)

**Principe directeur :** Chaque itération produit une valeur utilisable en autonomie. Ta femme peut tester et donner du feedback à chaque fin d'itération.

---

## ITÉRATION 1 : RÉFÉRENTIEL NGAP + MÉCANISME DE MISE À JOUR (Semaine 1)

### Objectif
Construire la base de données des actes facturables (le "catalogue" sur lequel tout le module repose) ET le mécanisme de mise à jour des tarifs, puisqu'il n'existe aucune API officielle de la NGAP.

### Pourquoi en premier
Le `care_type_catalog` est la fondation de toute la chaîne. Chaque facture, chaque ligne, chaque calcul de montant en dépend. C'est aussi l'occasion de valider avec ta femme que le référentiel couvre bien sa pratique quotidienne.

### Contexte : il n'existe PAS d'API officielle NGAP

La NGAP est publiée uniquement au format PDF sur ameli.fr (~180 pages), mise à jour via des avenants conventionnels publiés au Journal Officiel (1 à 2 par an). Pas de JSON, pas de CSV, pas d'API REST côté Assurance Maladie.

Il existe une API communautaire open source (MedShake, licence AGPL, sur GitHub) mais elle est réservée aux tests et maintenue par une seule personne — trop risqué comme dépendance pour un logiciel commercial.

**→ Stratégie retenue : référentiel interne versionné + push de mises à jour centralisé**, qui est exactement l'approche de tous les logiciels IDEL du marché (VEGA, Agathe YOU, Desmos, etc.).

### Point crucial : impact de l'avenant 10 (janvier 2024)

L'avenant 10 à la convention nationale des infirmiers a apporté des changements majeurs :

1. **Généralisation totale du BSI** (octobre 2023) : la facturation en AIS pour les patients dépendants est remplacée par les forfaits BSI (BSA/BSB/BSC). Les AIS facturés pour des soins BSI sont désormais **directement rejetés par la CPAM**.
2. **Revalorisation IFD/IFI de 10%** : passage de 2,50€ à **2,75€** (effectif depuis le 28 janvier 2024).
3. **Introduction de la lettre-clé AMX** : les actes techniques réalisés pendant un soin de dépendance (BSI) se facturent en AMX (pas en AMI). Ex: une prise de sang pendant un BSI = 1 AMX 1.5 (et non 1 AMI 1.5).

Ces distinctions sont **critiques** pour éviter les rejets CPAM.

### Features

**F1.1 — Modèle de données `care_type_catalog` enrichi**

La table existante dans l'architecture doit être étendue pour couvrir la réalité NGAP post-avenant 10 :

```
CARE_TYPE_CATALOG
├── uuid id PK
├── uuid cabinet_id FK (nullable → entrées système partagées)
├── string code                    -- "AMI_1", "AMX_1.5", "BSA", "IFD"
├── string lettre_cle              -- "AMI", "AMX", "AIS", "BSI", "IFD", "IFI", "IK"
├── string label                   -- "Injection sous-cutanée"
├── string category                -- "technique", "technique_bsi", "nursing", "bsi_forfait",
│                                  --  "majoration", "indemnite_deplacement", "indemnite_km",
│                                  --  "teleconsultation"
├── decimal coefficient            -- 1.0, 1.5, 4.0 (pour AMI/AMX/AIS)
├── decimal base_rate              -- tarif lettre-clé (3.15€ AMI/AMX, 2.65€ AIS)
├── decimal fixed_amount           -- montant fixe pour forfaits/majorations (IFD 2.75€)
├── string unit                    -- "acte", "jour", "km", "passage"
├── int default_duration_minutes   -- 15, 30, 45
├── boolean is_cumulative          -- cette majoration peut-elle se cumuler avec d'autres ?
├── jsonb cumul_rules              -- règles de cumul/exclusion détaillées
├── jsonb context_rules            -- contexte d'application (ex: "requires_bsi_patient": true)
├── date effective_from            -- date d'entrée en vigueur du tarif
├── date effective_to              -- date de fin (null = tarif en cours)
├── string avenant_source          -- "avenant_10", "avenant_6", etc. (traçabilité réglementaire)
├── boolean is_system              -- true = fourni par défaut, non modifiable
├── boolean is_active              -- le cabinet peut désactiver un acte
├── int display_order              -- ordre d'affichage dans l'interface
├── timestamp created_at
├── timestamp updated_at
```

**F1.2 — Seed data : tarifs NGAP en vigueur (post-avenant 10, février 2026)**

> ⚠️ **Ces tarifs sont à valider avec ta femme avant intégration.** Les sources sont ameli.fr et les sites professionnels IDEL. L'avenant 11 est en négociation et pourrait modifier certains tarifs.

**Actes techniques (AMI) — hors contexte BSI :**

| Code | Lettre-clé | Coeff | Tarif | Catégorie | Description |
|------|-----------|-------|-------|-----------|-------------|
| AMI_1 | AMI | 1 | 3,15€ | technique | Injection SC/IM, prélèvement sanguin |
| AMI_1.5 | AMI | 1.5 | 4,73€ | technique | Pansement simple, ablation fils |
| AMI_2 | AMI | 2 | 6,30€ | technique | Pansement complexe, perfusion simple |
| AMI_3 | AMI | 3 | 9,45€ | technique | Sonde urinaire |
| AMI_4 | AMI | 4 | 12,60€ | technique | Pansement lourd, perfusion complexe |
| AMI_4.1 | AMI | 4.1 | 12,92€ | technique | Perfusion IV produit médicamenteux |
| AMI_5 | AMI | 5 | 15,75€ | technique | Chimiothérapie SC |
| AMI_5.1 | AMI | 5.1 | 16,07€ | technique | Perfusion IV avec surveillance continue |

**Actes techniques pendant soins BSI (AMX) — même base que AMI mais lettre-clé distincte :**

| Code | Lettre-clé | Coeff | Tarif | Catégorie | Description |
|------|-----------|-------|-------|-----------|-------------|
| AMX_1 | AMX | 1 | 3,15€ | technique_bsi | Injection pendant soin BSI |
| AMX_1.5 | AMX | 1.5 | 4,73€ | technique_bsi | Pansement simple pendant soin BSI |
| AMX_2 | AMX | 2 | 6,30€ | technique_bsi | Pansement complexe pendant soin BSI |
| AMX_4 | AMX | 4 | 12,60€ | technique_bsi | Pansement lourd pendant soin BSI |

> **Règle critique :** Un acte technique réalisé lors d'un passage pour un patient en BSI DOIT être coté en AMX, pas en AMI. Le moteur de cotation (iter 3) doit vérifier le statut BSI du patient pour choisir automatiquement la bonne lettre-clé.

**Forfaits BSI (Bilan de Soins Infirmiers) — remplacent les AIS pour patients dépendants :**

| Code | Lettre-clé | Tarif/jour | Catégorie | Description |
|------|-----------|-----------|-----------|-------------|
| BSA | BSI | 13,00€ | bsi_forfait | BSI léger (dépendance faible) |
| BSB | BSI | 18,20€ | bsi_forfait | BSI intermédiaire (dépendance modérée) |
| BSC | BSI | 28,70€ | bsi_forfait | BSI lourd (dépendance forte) |

> **Règles BSI importantes :**
> - Le forfait est journalier : 1 seul forfait BSA/BSB/BSC par patient par jour
> - Une seule IDEL facture le forfait. Si plusieurs IDEL interviennent, les autres facturent uniquement AMX + IFI + IK + majorations
> - Le niveau BSA/BSB/BSC est déterminé par l'algorithme CPAM via le téléservice BSI sur AmeliPro
> - Les majorations horaires (nuit, dimanche) NE s'appliquent PAS sur les forfaits BSI eux-mêmes
> - Maximum 4 IFI par jour par patient si BSA/BSB/BSC facturé le même jour

**AIS — usage résiduel uniquement :**

| Code | Lettre-clé | Coeff | Tarif | Catégorie | Description |
|------|-----------|-------|-------|-----------|-------------|
| AIS_3 | AIS | 3 | 7,95€ | nursing | Séance soins infirmiers 30 min (hors BSI) |
| AIS_4 | AIS | 4 | 10,60€ | nursing | Séance soins infirmiers 1h (hors BSI) |

> ⚠️ **Les AIS ne sont plus utilisables pour les patients dépendants avec BSI.** Depuis octobre 2023, les AIS facturés pour des soins BSI sont directement rejetés par la CPAM. L'AIS reste dans le référentiel uniquement pour des cas spécifiques (soin ponctuel non lié à la dépendance, sans ordonnance BSI).

**Indemnités de déplacement (post-avenant 10 : +10% depuis janvier 2024) :**

| Code | Lettre-clé | Tarif | Unité | Catégorie | Description |
|------|-----------|-------|-------|-----------|-------------|
| IFD | IFD | 2,75€ | passage | indemnite_deplacement | Indemnité forfaitaire déplacement (actes AMI) |
| IFI | IFI | 2,75€ | passage | indemnite_deplacement | Indemnité forfaitaire infirmière (soins BSI/AIS) |
| IK_PLAINE | IK | 0,35€ | km | indemnite_km | Indemnité kilométrique plaine |
| IK_MONTAGNE | IK | 0,50€ | km | indemnite_km | Indemnité kilométrique montagne |

> **Règles IK :**
> - Abattement forfaitaire sur la distance : −4 km en plaine, −2 km en montagne (par trajet)
> - Plafond quotidien : 299 km plein tarif → 300-399 km à 50% → >400 km non remboursable
> - Distance = trajet cabinet → patient par la route la plus courte
>
> **Règle IFD vs IFI :**
> - IFD = déplacement pour actes techniques hors contexte BSI
> - IFI = déplacement pour soins BSI ou AIS dépendance. Max 4/jour/patient si BSI facturé
> - 1 seul IFD ou IFI par passage chez un même patient (même si plusieurs actes)

**Majorations :**

| Code | Tarif | Catégorie | Description | Cumul |
|------|-------|-----------|-------------|-------|
| MAU | 1,35€ | majoration | Majoration acte unique (1 seul AMI dans le passage) | Avec horaires |
| MCI | 5,00€ | majoration | Majoration coordination infirmière (1er soin du patient/jour) | Avec IFD/IK |
| MAJ_DIM | 8,50€ | majoration | Dimanche et jours fériés (dès samedi 8h pour appels urgences) | Avec nuit |
| MAJ_NUIT | 9,15€ | majoration | Nuit 20h-23h et 5h-8h | Avec dimanche |
| MAJ_NUIT_PROF | 18,30€ | majoration | Nuit profonde 23h-5h | Avec dimanche |
| MIE | 3,15€ | majoration | Majoration infirmier enfant (< 7 ans) | Avec IFD, horaires |
| MIEJ | 9,15€ | majoration | Majoration enfant dimanche/férié (< 7 ans) | Remplace MIE + MAJ_DIM |

> **Règles de non-cumul :**
> - MAU : uniquement si 1 seul acte AMI dans le passage. Pas avec AIS, pas avec BSI.
> - MAJ_NUIT et MAJ_NUIT_PROF ne se cumulent pas entre elles
> - Les majorations horaires (nuit, dimanche) ne s'appliquent PAS sur les forfaits BSI
> - MCI s'applique uniquement sur les actes techniques (AMI), pas sur les forfaits BSI
> - MIE s'applique sur CHAQUE acte de la séance (pas seulement le principal)

**Autres actes (téléconsultation) :**

| Code | Tarif | Catégorie | Description |
|------|-------|-----------|-------------|
| TLS | 10,00€ | teleconsultation | Accompagnement téléconsultation pendant soin prévu |
| TLL | 12,00€ | teleconsultation | Téléconsultation en lieu dédié |
| TLD | 15,00€ | teleconsultation | Accompagnement téléconsultation à domicile (IFD+IK facturables) |
| DI | 10,00€ | forfait | Démarche de soins infirmiers (résiduel, remplacé par BSI) |

**F1.3 — Mécanisme de mise à jour des tarifs**

Puisqu'il n'existe pas d'API officielle, le système doit gérer les évolutions tarifaires de manière fiable :

**A. Versioning par date d'effet (déjà dans le modèle)**

Chaque enregistrement a `effective_from` / `effective_to`. Quand un avenant modifie un tarif :
- L'ancien enregistrement reçoit une `effective_to` = veille de l'entrée en vigueur
- Un nouvel enregistrement est créé avec `effective_from` = date d'entrée en vigueur
- Les factures existantes gardent les tarifs figés (snapshot au moment de la facturation)

**B. Push centralisé de mises à jour**

```
TARIFF_UPDATE
├── uuid id PK
├── string version                 -- "2026.1", "2026.2"
├── string avenant_reference       -- "avenant_11"
├── date published_at              -- Date de publication JO
├── date effective_at              -- Date d'entrée en vigueur
├── string description             -- "Revalorisation AMI +5%, nouveau forfait BSI-D"
├── jsonb changes                  -- Détail des modifications (ancien/nouveau tarif)
├── string status                  -- "available", "applied", "skipped"
├── timestamp applied_at
├── timestamp created_at
```

Workflow :
1. Quand un avenant sort, tu prépares un fichier JSON de mise à jour (hébergé sur ton serveur / CDN)
2. L'app vérifie périodiquement (1x/jour) si une nouvelle version est disponible
3. L'IDEL reçoit une notification "Mise à jour tarifaire disponible : avenant 11 — entrée en vigueur le XX/XX/XXXX"
4. L'IDEL consulte le détail des changements et applique la mise à jour
5. Les nouveaux tarifs s'appliquent automatiquement aux factures futures

**C. Modification manuelle par le cabinet (sécurité)**

En complément du push centralisé, le cabinet peut :
- Ajuster un tarif manuellement si l'update centralisé tarde
- Créer des actes custom spécifiques à leur pratique
- Désactiver des actes qu'ils n'utilisent jamais (allège l'interface)

Les actes `is_system=true` ne sont pas supprimables, seulement désactivables.

**D. Sources de veille tarifaire (documentation interne)**

Pour préparer les mises à jour :
- PDF officiel NGAP sur ameli.fr (source de vérité)
- Avenants publiés au Journal Officiel
- Communications FNI / SNIIL (syndicats IDEL)
- Optionnel : script Python `pdfplumber` pour semi-automatiser l'extraction du PDF NGAP

**F1.4 — API CRUD catalogue + mises à jour**

```
# Catalogue actes
GET    /api/v1/care-catalog                         -- Liste actes actifs du cabinet
GET    /api/v1/care-catalog?category=technique       -- Filtrage par catégorie
GET    /api/v1/care-catalog?lettre_cle=AMI           -- Filtrage par lettre-clé
GET    /api/v1/care-catalog/{id}                    -- Détail acte
POST   /api/v1/care-catalog                         -- Ajout acte custom cabinet
PUT    /api/v1/care-catalog/{id}                    -- Modification (actes custom uniquement)
PATCH  /api/v1/care-catalog/{id}/toggle             -- Activer/désactiver acte

# Mises à jour tarifaires
GET    /api/v1/tariff-updates/check                 -- Vérifier si mise à jour dispo
GET    /api/v1/tariff-updates/{id}                  -- Détail d'une mise à jour (changements)
POST   /api/v1/tariff-updates/{id}/apply            -- Appliquer la mise à jour
GET    /api/v1/tariff-updates/history               -- Historique des mises à jour appliquées
```

**F1.5 — Logique métier (Domain Layer)**

- Value Object `ActCode` : validation format code NGAP + distinction AMI/AMX selon contexte patient
- Value Object `Tarif` : calcul montant = coefficient × base_rate (ou fixed_amount pour forfaits)
- Value Object `IKCalculator` : calcul distance facturable avec abattement (−4km plaine, −2km montagne) et plafond quotidien
- Règle : les actes `is_system=true` ne sont pas supprimables, seulement désactivables
- Règle : un tarif avec `effective_to` passé n'apparaît plus dans les listes actives
- Règle : la résolution de tarif utilise toujours la date du soin (pas la date de facturation)

### Livrables
- Migration Alembic `care_type_catalog` enrichie + `tariff_update`
- Seed data NGAP post-avenant 10 (script SQL / fixture Python)
- Endpoints API REST avec tests
- Endpoint de vérification/application de mises à jour tarifaires
- Validation terrain avec ta femme : "est-ce que tous les actes que tu utilises sont là ?"

### Critère de succès
Ta femme parcourt la liste et confirme qu'elle retrouve tous les actes qu'elle cote au quotidien, avec les bons tarifs en vigueur.

---

## ITÉRATION 2 : FACTURES BASIQUES — CRUD (Semaines 2–3)

### Objectif
Permettre la création, consultation, modification et validation de factures manuelles. L'IDEL sélectionne un patient, ajoute des lignes d'actes, et obtient un montant calculé.

### Features

**F2.1 — Modèle de données `invoice` + `invoice_line` enrichi**

Extension du modèle existant :

```
INVOICE
├── uuid id PK
├── uuid cabinet_id FK
├── uuid idel_id FK                 -- IDEL qui a réalisé les soins
├── uuid patient_id FK
├── uuid prescription_id FK         -- (nullable, ajouté iter 4)
├── string invoice_number           -- Numéro auto-incrémenté par cabinet (ex: "2026-02-0042")
├── date invoice_date               -- Date de la facture
├── date care_date                  -- Date effective du soin (peut différer)
├── decimal total_amo               -- Part Assurance Maladie Obligatoire
├── decimal total_amc               -- Part Assurance Maladie Complémentaire
├── decimal total_patient           -- Reste à charge patient
├── decimal total_amount            -- Total global
├── string tiers_payant_type        -- "total", "partiel", "none"
├── string status                   -- "draft", "validated", "transmitted", "paid", "rejected"
├── string rejection_reason         -- Motif rejet CPAM (nullable)
├── timestamp validated_at
├── timestamp transmitted_at
├── timestamp paid_at
├── jsonb metadata                  -- Données complémentaires libres
├── timestamp created_at
├── timestamp updated_at

INVOICE_LINE
├── uuid id PK
├── uuid invoice_id FK
├── uuid appointment_id FK          -- (nullable, lien RDV si existant)
├── int line_order                  -- Ordre d'affichage
├── string act_code                 -- Code NGAP (référence care_type_catalog)
├── string act_label                -- Libellé figé au moment de la facturation
├── decimal coefficient             -- Coefficient figé
├── decimal base_rate               -- Tarif figé au moment de la facturation
├── decimal quantity                -- Nombre (1 pour acte, km pour IK)
├── decimal line_subtotal           -- coefficient × base_rate × quantity
├── jsonb supplements               -- Majorations appliquées sur cette ligne
├── decimal supplements_total       -- Total des majorations
├── decimal line_total              -- line_subtotal + supplements_total
├── timestamp created_at
```

> **Point clé :** Les tarifs sont **figés** dans la ligne de facture au moment de la création (snapshot). Si le tarif NGAP change ensuite, les anciennes factures gardent les anciens montants. C'est un principe comptable fondamental.

**F2.2 — Numérotation automatique**

Chaque cabinet a sa propre séquence de numérotation. Format configurable, par défaut : `{ANNEE}-{MOIS}-{SEQUENCE}` → "2026-02-0001". La séquence se remet à zéro chaque mois (ou chaque année, configurable par cabinet).

**F2.3 — API factures**

```
POST   /api/v1/invoices                        -- Créer brouillon
GET    /api/v1/invoices                        -- Liste (filtres: status, date, patient)
GET    /api/v1/invoices/{id}                   -- Détail avec lignes
PUT    /api/v1/invoices/{id}                   -- Modifier brouillon
DELETE /api/v1/invoices/{id}                   -- Supprimer brouillon uniquement
POST   /api/v1/invoices/{id}/lines             -- Ajouter ligne
PUT    /api/v1/invoices/{id}/lines/{line_id}   -- Modifier ligne
DELETE /api/v1/invoices/{id}/lines/{line_id}   -- Supprimer ligne
POST   /api/v1/invoices/{id}/validate          -- Passer en "validated" (verrouille)
POST   /api/v1/invoices/{id}/cancel            -- Annuler une facture validée
```

**F2.4 — Règles métier (Domain Layer)**

- Une facture `validated` ne peut plus être modifiée (immuable) — on peut seulement l'annuler et en recréer une
- Une facture `draft` est librement modifiable
- Le `total_amount` est toujours recalculé côté serveur (jamais confiance au client)
- Le `total_amount = Σ line_total` de toutes les lignes
- Chaque `line_total = line_subtotal + supplements_total`
- Validation : au moins 1 ligne, patient existant et actif, date cohérente

**F2.5 — Calcul de la répartition AMO/AMC/patient**

Simplification MVP : taux de prise en charge standard (60% AMO soins courants, 100% pour ALD/maternité). Pour le MVP, les champs patient suivants suffisent :

```
Patient (champs à ajouter pour la facturation) :
├── boolean is_ald                  -- Affection Longue Durée → 100% AMO
├── boolean is_maternity            -- Maternité → 100% AMO
├── boolean has_active_bsi          -- Patient avec BSI actif (dépendant)
├── string bsi_level                -- "BSA", "BSB", "BSC" (nullable)
├── date bsi_start_date             -- Date début BSI en cours
├── date bsi_end_date               -- Date fin BSI (renouvellement nécessaire)
```

```
Si ALD ou maternité → 100% AMO, 0% AMC, 0% patient
Sinon → 60% AMO, 40% réparti entre AMC et patient selon couverture
```

> **Le champ `has_active_bsi` est crucial** pour le moteur de cotation (iter 3) : c'est lui qui déclenche la résolution automatique AMI→AMX et IFD→IFI.

### Livrables
- Migrations Alembic `invoice` + `invoice_line`
- Endpoints API complets avec tests
- Logique de calcul automatique des montants
- Use case : "Créer une facture pour un pansement complexe AMI 4 du dimanche avec IK 8km"

### Critère de succès
L'IDEL peut créer une facture brouillon, ajouter un acte AMI 4 + IK + majoration dimanche, voir le montant calculé automatiquement, et valider la facture.

---

## ITÉRATION 3 : MOTEUR DE COTATION AUTOMATIQUE (Semaines 4–5)

### Objectif
Automatiser le calcul des majorations applicables en fonction du contexte (heure, jour, nombre d'actes). C'est le cœur intelligent du module facturation — ce qui fait gagner du temps à l'IDEL.

### Pourquoi c'est la partie la plus complexe
Les majorations ont des règles de cumul subtiles. Une IDEL expérimentée les connaît par cœur, mais une débutante peut facilement se tromper (et risquer un rejet CPAM ou perdre du chiffre d'affaires). Le moteur de cotation est la vraie valeur ajoutée.

### Features

**F3.1 — Service de cotation (Domain Layer)**

```python
class CotationEngine:
    """Moteur de cotation NGAP post-avenant 10.
    
    Gère automatiquement :
    - La distinction AMI vs AMX selon le statut BSI du patient
    - Le choix IFD vs IFI selon le contexte de soin
    - Le non-cumul majorations horaires / forfaits BSI
    - Les règles de cumul article 11 (acte principal 100%, 2e à 50%)
    """
    
    def coter_passage(
        self,
        actes: list[ActCode],           # Actes réalisés dans le passage
        date_heure_soin: datetime,
        distance_km: float,
        lieu: str,                       # "domicile" | "cabinet"
        zone_ik: str,                    # "plaine" | "montagne"
        est_premier_soin_journee: bool,
        patient_context: PatientCotationContext  # BSI actif ? ALD ? Enfant ?
    ) -> CotationResult:
        ...
```

Le `PatientCotationContext` est essentiel :

```python
@dataclass
class PatientCotationContext:
    has_active_bsi: bool          # Patient avec BSI actif → AMX au lieu d'AMI, IFI au lieu d'IFD
    bsi_level: str | None         # "BSA", "BSB", "BSC" (si BSI actif)
    bsi_already_billed_today: bool  # Un autre IDEL a déjà facturé le forfait BSI aujourd'hui
    is_ald: bool                  # Affection Longue Durée → 100% AMO
    is_maternity: bool            # Maternité → 100% AMO
    age: int                      # Pour la majoration MIE (< 7 ans)
    is_palliative: bool           # Soins palliatifs → règles spécifiques
```

**F3.2 — Règles de majorations automatiques (post-avenant 10)**

Le moteur applique les règles suivantes automatiquement :

**Indemnités de déplacement :**

| Indemnité | Condition | Montant | Règle clé |
|-----------|-----------|---------|-----------|
| **IFD** | Domicile, patient SANS BSI actif | 2,75€ | 1 par passage, pas au cabinet |
| **IFI** | Domicile, patient AVEC BSI/AIS actif | 2,75€ | Max 4/jour/patient si BSI facturé |
| **IK** | Domicile, distance > abattement | 0,35€/km (plaine) ou 0,50€/km (montagne) | Abattement −4km plaine, −2km montagne |

**Majorations techniques (s'appliquent sur AMI et AMX) :**

| Majoration | Condition | Montant | Cumul |
|-----------|-----------|---------|-------|
| **MCI** | 1er soin technique du patient dans la journée | 5,00€ | Avec IFD/IFI/IK |
| **MAU** | 1 seul acte AMI/AMX dans le passage | 1,35€ | Avec majorations horaires |
| **MAJ_DIM** | Dimanche ou jour férié | 8,50€ | Avec nuit |
| **MAJ_NUIT** | Soin entre 20h-23h ou 5h-8h | 9,15€ | Avec dimanche |
| **MAJ_NUIT_PROF** | Soin entre 23h-5h | 18,30€ | Avec dimanche |
| **MIE** | Patient < 7 ans, sur chaque acte | 3,15€ | Avec IFD, horaires |

**Règles critiques de non-cumul :**

- ⛔ Les majorations horaires (nuit, dimanche) **NE s'appliquent PAS sur les forfaits BSI** (BSA/BSB/BSC). Elles s'appliquent uniquement sur les actes AMI/AMX associés.
- ⛔ MAU ne s'applique que si **1 seul** acte AMI/AMX dans le passage. Pas avec AIS, pas avec forfaits BSI.
- ⛔ MAJ_NUIT et MAJ_NUIT_PROF ne se cumulent **jamais** entre elles.
- ⛔ MCI s'applique sur les actes techniques (AMI/AMX) uniquement, **pas sur les forfaits BSI**.
- ⛔ Article 11 (cumul d'actes) : acte principal à 100%, 2e acte à 50%, actes suivants non facturables. Sauf exceptions (pansements lourds + injection = cumul autorisé dans certains cas).

**F3.3 — Logique AMI vs AMX automatique**

C'est une des valeurs ajoutées majeures du moteur. L'IDEL n'a pas à se demander si elle cote en AMI ou AMX :

```python
def resolve_lettre_cle(acte: ActCode, patient: PatientCotationContext) -> str:
    """Résout automatiquement AMI → AMX si le patient a un BSI actif."""
    if patient.has_active_bsi and acte.lettre_cle == "AMI":
        return "AMX"  # Même coefficient, même tarif, mais lettre-clé distincte
    return acte.lettre_cle
```

De même pour IFD/IFI :
```python
def resolve_indemnite_deplacement(patient: PatientCotationContext) -> str:
    """IFI pour patients BSI/AIS, IFD sinon."""
    if patient.has_active_bsi:
        return "IFI"
    return "IFD"
```

> **C'est exactement le genre d'erreur que les IDEL font régulièrement** (coter AMI au lieu d'AMX) et qui génère des rejets CPAM. L'automatiser est un vrai argument commercial.

**F3.3 — Détection automatique des jours fériés**

Table ou module de calcul des jours fériés français (fixes + Pâques mobile + Ascension + Pentecôte). La librairie Python `workalendar` gère ça nativement.

**F3.4 — API de simulation de cotation**

```
POST   /api/v1/cotation/simulate
Body: {
    "actes": [{"code": "AMI_4"}],
    "date_heure": "2026-03-15T21:30:00",
    "patient_id": "uuid",
    "lieu": "domicile",
    "distance_km": 8.5,
    "zone_ik": "plaine"
}
Response: {
    "lignes": [
        {"code": "AMI_4", "label": "Pansement lourd", "montant": 12.60},
        {"code": "IFD", "label": "Indemnité forfaitaire déplacement", "montant": 2.75},
        {"code": "IK_PLAINE", "label": "IK (8.5km − 4km abattement = 4.5km)", "quantite": 4.5, "montant": 1.58},
        {"code": "MAJ_NUIT", "label": "Majoration nuit (21h30)", "montant": 9.15},
        {"code": "MCI", "label": "Coordination infirmière", "montant": 5.00},
        {"code": "MAU", "label": "Acte unique", "montant": 1.35}
    ],
    "total": 32.43,
    "repartition": {
        "amo": 19.46,
        "amc": 12.97,
        "patient": 0.00
    },
    "auto_corrections": [
        "IFD appliquée (patient sans BSI actif — si BSI actif, IFI serait utilisée)"
    ],
    "explications": [
        "Majoration nuit appliquée (21h30 → plage 20h-23h)",
        "MCI appliquée (premier soin du patient aujourd'hui)",
        "MAU appliquée (acte unique dans le passage)",
        "IK calculée : 8.5km − 4km abattement plaine = 4.5km × 0.35€"
    ]
}
```

Exemple avec **patient BSI** :

```
POST   /api/v1/cotation/simulate
Body: {
    "actes": [{"code": "AMI_1.5"}],
    "date_heure": "2026-03-15T08:30:00",
    "patient_id": "uuid-patient-bsi",
    "lieu": "domicile",
    "distance_km": 5.0,
    "zone_ik": "plaine"
}
Response: {
    "lignes": [
        {"code": "BSB", "label": "Forfait BSI intermédiaire", "montant": 18.20},
        {"code": "AMX_1.5", "label": "Pansement simple (pendant BSI)", "montant": 4.73},
        {"code": "IFI", "label": "Indemnité forfaitaire infirmière (BSI)", "montant": 2.75},
        {"code": "IK_PLAINE", "label": "IK (5km − 4km = 1km)", "quantite": 1.0, "montant": 0.35}
    ],
    "total": 26.03,
    "auto_corrections": [
        "AMI_1.5 → AMX_1.5 (patient avec BSI actif)",
        "IFD → IFI (patient avec BSI actif)",
        "MAU non appliquée (pas de cumul avec forfait BSI)",
        "MCI non appliquée (pas de cumul avec forfait BSI)"
    ],
    "explications": [
        "Patient avec BSI actif niveau BSB → forfait journalier 18.20€",
        "Acte technique coté en AMX (et non AMI) car contexte BSI",
        "Pas de majorations horaires sur le forfait BSI"
    ]
}
```

> **Le champ `auto_corrections` est la vraie valeur ajoutée** : il montre à l'IDEL les corrections automatiques que le moteur a faites (AMI→AMX, IFD→IFI), ce qui la rassure et la forme aux bonnes pratiques de cotation.

**F3.5 — Détection automatique des jours fériés**

Table ou module de calcul des jours fériés français (fixes + Pâques mobile + Ascension + Pentecôte). La librairie Python `workalendar` gère ça nativement.

Note : la majoration dimanche s'applique aussi dès le **samedi 8h** pour les appels urgences. Ceci est une subtilité à intégrer.

**F3.6 — Tests exhaustifs du moteur de cotation**

C'est la feature où les tests unitaires sont critiques. Cas à couvrir :

**Cas standard (patient sans BSI) :**
- Pansement simple lundi 9h domicile 5km plaine → AMI 1.5 + IFD 2.75 + IK (5−4=1km) 0.35 + MCI + MAU
- Injection dimanche 8h domicile 3km → AMI 1 + IFD 2.75 + MAJ_DIM 8.50 + MCI + MAU (pas d'IK : 3−4 = négatif → 0)
- 2 actes (injection + pansement) mardi 7h30 domicile → AMI 4 (100%) + AMI 1 (50%) + IFD + IK + MCI + MAJ_NUIT (pas de MAU car 2 actes)
- Soin au cabinet → pas d'IFD, pas d'IK

**Cas BSI (patient dépendant) :**
- BSI intermédiaire + prise de sang lundi 10h domicile 6km → BSB 18.20 + AMX 1.5 + IFI 2.75 + IK (6−4=2km) 0.70 (pas de MCI, pas de MAU sur forfait)
- BSI lourd dimanche 9h domicile → BSC 28.70 + IFI 2.75 + IK + MAJ_DIM sur AMX seulement (pas sur BSC)
- Forfait BSI déjà facturé par collègue → pas de BSA/BSB/BSC, uniquement AMX + IFI + IK + majorations

**Cas spéciaux :**
- Patient < 7 ans → MIE 3.15 sur chaque acte
- Soin à 23h30 un dimanche férié → cumul MAJ_NUIT_PROF + MAJ_DIM
- IK > 299km dans la journée → plafonnement à 50%
- Patient ALD → 100% AMO, 0% part complémentaire

### Livrables
- `CotationEngine` dans le Domain Layer avec tests unitaires complets
- Endpoint `/cotation/simulate` fonctionnel
- Module jours fériés français
- Au moins 20 cas de test validés avec ta femme

### Critère de succès
Ta femme vérifie 10 scénarios de cotation tirés de sa semaine réelle, et le moteur retourne les bons montants à chaque fois.

---

## ITÉRATION 4 : ORDONNANCES & PRESCRIPTIONS (Semaine 6)

### Objectif
Tracer le lien entre l'ordonnance du médecin et les factures générées. C'est une exigence réglementaire (chaque acte facturé doit être rattaché à une prescription) et un gain pratique (une ordonnance "pansement 15 jours" génère 15 factures).

### Features

**F4.1 — Modèle de données `prescription`**

```
PRESCRIPTION
├── uuid id PK
├── uuid cabinet_id FK
├── uuid patient_id FK
├── uuid prescriber_id FK          -- (nullable, référence vers un médecin)
├── string prescriber_name          -- Nom du prescripteur (texte libre en attendant)
├── string prescriber_rpps          -- RPPS du prescripteur (si disponible)
├── date prescription_date          -- Date de l'ordonnance
├── date start_date                 -- Date de début des soins
├── date end_date                   -- Date de fin (calculée ou explicite)
├── int duration_days               -- Durée prescrite en jours
├── int max_renewals                -- Nombre de renouvellements autorisés
├── int current_renewal             -- Renouvellement en cours (0 = initial)
├── string care_description         -- Description libre du soin prescrit
├── string[] act_codes              -- Actes NGAP associés (array)
├── string frequency                -- "quotidien", "3x/semaine", "hebdomadaire"
├── string status                   -- "active", "expired", "completed", "canceled"
├── text notes                      -- Notes libres
├── timestamp created_at
├── timestamp updated_at
```

**F4.2 — Lien prescription → invoice**

Ajout de `prescription_id` sur la table `invoice` (FK nullable). Permet :
- De savoir combien de factures ont été émises pour une ordonnance donnée
- De vérifier qu'on ne dépasse pas la durée prescrite
- D'alerter quand une ordonnance arrive à expiration

**F4.3 — Alertes ordonnance**

- Alerte "ordonnance expire dans 3 jours" → l'IDEL doit demander un renouvellement au médecin
- Alerte "ordonnance expirée" → les factures ne peuvent plus être créées sur cette prescription
- Alerte "nombre de séances atteint" → rappel de vérifier avec le prescripteur

**F4.4 — API prescriptions**

```
POST   /api/v1/prescriptions                   -- Créer ordonnance
GET    /api/v1/prescriptions                   -- Liste (filtres: patient, status, date)
GET    /api/v1/prescriptions/{id}              -- Détail avec factures liées
PUT    /api/v1/prescriptions/{id}              -- Modifier
GET    /api/v1/prescriptions/{id}/invoices     -- Factures rattachées
GET    /api/v1/prescriptions/expiring          -- Ordonnances expirant sous 7 jours
POST   /api/v1/prescriptions/{id}/renew        -- Renouveler ordonnance
```

### Livrables
- Migration Alembic `prescription`
- Lien FK `invoice.prescription_id`
- Endpoints API avec tests
- Système d'alertes expiration

### Critère de succès
L'IDEL crée une ordonnance "pansement quotidien 15 jours", crée des factures rattachées, et reçoit une alerte au 12e jour pour renouvellement.

---

## ITÉRATION 5 : PRÉ-REMPLISSAGE AUTOMATIQUE DEPUIS LES RDV (Semaine 7)

### Objectif
Relier le module facturation au module agenda existant. Après un rendez-vous `completed`, le système pré-remplit une facture brouillon avec les actes prévus, les majorations calculées, et le lien patient/ordonnance. L'IDEL n'a plus qu'à valider.

### Pourquoi c'est un game-changer
C'est la feature qui transforme la facturation d'une corvée administrative en un geste de validation rapide. Dans le flow quotidien (voir PRD section 5.2), l'IDEL rentre chez elle le soir, ouvre la facturation, et voit ses 8 passages pré-cotés. Elle valide en 2 minutes au lieu de 20.

### Features

**F5.1 — Génération automatique de brouillon post-RDV**

Quand un `appointment` passe en status `completed` :

1. Le système identifie le `care_type` du RDV
2. Il vérifie le **statut BSI du patient** (BSI actif ? quel niveau ? déjà facturé aujourd'hui par un collègue ?)
3. Il retrouve l'ordonnance active du patient pour ce type de soin
4. Il appelle le `CotationEngine` avec le contexte complet (heure, lieu, distance, BSI, etc.)
5. Le moteur résout automatiquement AMI→AMX et IFD→IFI si le patient est en BSI
6. Il crée une `invoice` en status `draft` avec toutes les lignes pré-remplies
7. L'IDEL reçoit une notification "Facture brouillon créée pour Mme Durand"

> **Point BSI multi-IDEL :** Si plusieurs IDEL du cabinet interviennent le même jour chez un patient BSI, seule la première facture inclut le forfait BSA/BSB/BSC. Les suivantes ne contiennent que les AMX + IFI + IK + majorations. Le système doit vérifier `bsi_already_billed_today` au moment de la génération.

**F5.2 — Calcul automatique de la distance IK**

Le système utilise les coordonnées déjà disponibles :
- Point de départ : adresse du cabinet (ou domicile IDEL)
- Point d'arrivée : adresse du patient
- Calcul : distance à vol d'oiseau × 1.3 (coefficient route) ou via l'API de routing déjà intégrée pour les tournées

> La convention CPAM accepte la distance réelle par la route la plus courte. Si ton module tournée calcule déjà les distances, réutilise cette donnée.

**F5.3 — Vue "Facturation du jour"**

```
GET /api/v1/invoices/daily-summary?date=2026-03-15

Response: {
    "date": "2026-03-15",
    "appointments_completed": 8,
    "invoices_draft": 8,
    "invoices_validated": 0,
    "total_estimated": 287.50,
    "items": [
        {
            "patient": "Mme Durand",
            "appointment_time": "08:30",
            "care_type": "Pansement complexe",
            "invoice_id": "uuid",
            "invoice_status": "draft",
            "total": 33.58,
            "needs_review": false
        },
        {
            "patient": "M. Martin",
            "appointment_time": "09:15",
            "care_type": "Injection insuline",
            "invoice_id": "uuid",
            "invoice_status": "draft",
            "total": 18.35,
            "needs_review": true,
            "review_reason": "Acte non standard détecté"
        }
    ]
}
```

**F5.4 — Validation en batch**

```
POST /api/v1/invoices/validate-batch
Body: {
    "invoice_ids": ["uuid1", "uuid2", "uuid3", ...]
}
Response: {
    "validated": 7,
    "errors": [
        {"invoice_id": "uuid4", "reason": "Ordonnance expirée"}
    ]
}
```

L'IDEL peut valider toutes ses factures du jour en un clic (sauf celles qui nécessitent une revue).

**F5.5 — Flag `needs_review`**

Certaines factures auto-générées nécessitent une vérification humaine :
- Acte réalisé différent de l'acte prévu (ex: pansement simple au lieu de complexe)
- Premier passage chez un nouveau patient (vérifier cotation)
- Soin à un horaire inhabituel (vérifier majoration)
- Ordonnance proche de l'expiration

### Livrables
- Event handler `on_appointment_completed` → création brouillon
- Intégration avec le `CotationEngine` (iter 3)
- Endpoint `/invoices/daily-summary`
- Endpoint `/invoices/validate-batch`
- Logique `needs_review`

### Critère de succès
Après une journée de tournée simulée (8 patients), 8 factures brouillon sont créées automatiquement. Ta femme les valide toutes en moins de 3 minutes.

---

## ITÉRATION 6 : DASHBOARD SUIVI & STATISTIQUES (Semaines 8–9)

### Objectif
Offrir une vue consolidée de la facturation : combien facturé ce mois, combien en attente, combien rejeté, évolution du CA. C'est le pilotage financier du cabinet.

### Features

**F6.1 — Statistiques mensuelles**

```
GET /api/v1/invoices/stats?period=2026-02

Response: {
    "period": "2026-02",
    "total_invoiced": 4520.00,
    "total_paid": 3890.00,
    "total_pending": 480.00,
    "total_rejected": 150.00,
    "num_invoices": 142,
    "num_patients_billed": 28,
    "avg_invoice_amount": 31.83,
    "top_acts": [
        {"code": "AMI_4", "count": 45, "total": 567.00},
        {"code": "AIS_3", "count": 38, "total": 302.10},
        {"code": "BSI_INTER", "count": 30, "total": 546.00}
    ],
    "daily_breakdown": [
        {"date": "2026-02-01", "total": 185.00, "count": 8},
        {"date": "2026-02-02", "total": 210.50, "count": 7},
        ...
    ]
}
```

**F6.2 — Suivi des paiements**

Quand la CPAM paie, le virement arrive avec un bordereau de remboursement. Pour le MVP, le rapprochement est manuel : l'IDEL marque les factures comme payées.

```
POST /api/v1/invoices/mark-paid
Body: {
    "invoice_ids": ["uuid1", "uuid2"],
    "payment_date": "2026-02-28",
    "payment_reference": "CPAM-VIR-20260228-001"
}
```

**F6.3 — Gestion des rejets**

```
POST /api/v1/invoices/{id}/reject
Body: {
    "rejection_reason": "Ordonnance non conforme",
    "rejection_code": "R01"       // code CPAM standard
}

POST /api/v1/invoices/{id}/correct-and-resubmit
Body: {
    // Modifications sur les lignes
    "lines": [...]
}
// Crée une nouvelle facture corrective liée à l'originale
```

**F6.4 — Comparaison inter-période**

```
GET /api/v1/invoices/stats/compare?period1=2026-01&period2=2026-02

Response: {
    "period1": { "total": 4200.00, "count": 135 },
    "period2": { "total": 4520.00, "count": 142 },
    "evolution_percent": 7.6,
    "evolution_count": 5.2
}
```

**F6.5 — Statistiques par IDEL (mode cabinet)**

Pour les cabinets multi-IDEL : qui a facturé combien, répartition des actes par infirmière. Utile pour le partage des charges et la comptabilité du cabinet.

### Livrables
- Endpoints statistiques avec agrégation performante
- Gestion workflow paiements (mark-paid)
- Gestion workflow rejets (reject → correct → resubmit)
- Données de comparaison inter-période

### Critère de succès
En fin de mois, l'IDEL voit son CA, le nombre de factures en attente, et peut marquer comme payées les factures correspondant au virement CPAM reçu.

---

## ITÉRATION 7 : EXPORT COMPTABLE (Semaine 10)

### Objectif
Permettre l'export des données de facturation vers le cabinet comptable ou le logiciel de comptabilité. La plupart des IDEL ont un comptable qui gère leur 2035 (déclaration BNC).

### Features

**F7.1 — Export CSV générique**

```
GET /api/v1/invoices/export?format=csv&from=2026-01-01&to=2026-01-31

Colonnes : date_facture, numero_facture, patient_nom, patient_prenom,
           prescripteur, actes_codes, total_amo, total_amc, total_patient,
           total_ttc, status, date_paiement, reference_paiement
```

**F7.2 — Export format comptable standard**

Les formats les plus courants pour les comptables d'IDEL :
- **FEC** (Fichier des Écritures Comptables) : format obligatoire pour l'administration fiscale
- **CSV Cegid** : format du logiciel comptable le plus utilisé par les experts-comptables
- **CSV générique** : pour import dans n'importe quel logiciel

```
GET /api/v1/invoices/export?format=fec&year=2026
GET /api/v1/invoices/export?format=cegid&from=2026-01-01&to=2026-03-31
```

**F7.3 — Récapitulatif URSSAF / CARPIMKO**

Les IDEL libérales paient des cotisations sociales calculées sur le chiffre d'affaires. Un récapitulatif trimestriel facilite les déclarations :

```
GET /api/v1/invoices/quarterly-summary?year=2026&quarter=1

Response: {
    "quarter": "2026-Q1",
    "total_honoraires": 13560.00,
    "total_deplacements": 1245.00,    // IFI + IK séparés
    "total_brut": 14805.00,
    "num_actes": 426,
    "num_patients": 32
}
```

### Livrables
- Endpoint export CSV multi-format
- Générateur FEC basique
- Récapitulatif trimestriel
- Documentation des formats pour le comptable

### Critère de succès
Ta femme exporte le mois de mars, envoie le fichier à son comptable, et celui-ci peut l'importer sans retraitement manuel.

---

## ITÉRATION 8 : PRÉPARATION TÉLÉTRANSMISSION SESAM-VITALE (Semaines 11–12)

### Objectif
Préparer l'infrastructure pour la télétransmission réelle des FSE. Cette itération ne va PAS jusqu'à l'homologation SESAM-Vitale (c'est un processus long prévu en V1.0), mais pose les fondations techniques.

### Contexte
L'homologation SESAM-Vitale est un processus lourd qui nécessite :
- L'intégration avec le lecteur de carte Vitale (physique ou e-CPS)
- L'intégration avec la carte CPS (identification professionnelle)
- Le respect du cahier des charges du GIE SESAM-Vitale
- Des tests d'homologation avec le centre de test

Pour le MVP, l'objectif est de **préparer les données au format FSE** sans les télétransmettre réellement, avec une solution de contournement.

### Features

**F8.1 — Modèle de données FSE**

```
FSE (Feuille de Soins Électronique)
├── uuid id PK
├── uuid invoice_id FK             -- 1 FSE = 1 facture
├── uuid cabinet_id FK
├── string fse_number              -- Numéro FSE (séquence)
├── string nir_patient             -- N° sécu patient (CHIFFRÉ)
├── string rpps_idel               -- RPPS de l'IDEL
├── string rpps_prescripteur       -- RPPS du prescripteur
├── date date_soins
├── jsonb actes_fse                -- Actes au format FSE normalisé
├── decimal montant_total
├── decimal montant_amo
├── decimal montant_amc
├── string organisme_amo           -- Code organisme AMO
├── string organisme_amc           -- Code organisme AMC (mutuelle)
├── string status                  -- "generated", "exported", "transmitted", "accepted", "rejected"
├── jsonb raw_fse_data             -- Données brutes format FSE (pour debug)
├── timestamp exported_at
├── timestamp transmitted_at
├── timestamp created_at
```

**F8.2 — Génération FSE (format données uniquement)**

Transformation d'une facture validée en structure de données FSE. Pas encore de télétransmission réelle, mais les données sont prêtes.

```
POST /api/v1/fse/generate
Body: { "invoice_ids": ["uuid1", "uuid2"] }

Response: {
    "generated": 2,
    "fse_ids": ["uuid_fse1", "uuid_fse2"]
}
```

**F8.3 — Solution de contournement MVP : export vers logiciel tiers**

En attendant l'homologation SESAM-Vitale, deux options de contournement :

**Option A — Export au format d'import d'un logiciel agréé :**
Beaucoup d'IDEL ont déjà un logiciel de facturation (VEGA, Agathe, etc.) pour la télétransmission. On exporte les factures dans un format importable par ces logiciels.

```
GET /api/v1/fse/export?format=vega&from=2026-03-01&to=2026-03-31
```

**Option B — Impression feuille de soins papier :**
Génération d'un PDF de feuille de soins conforme pour les cas où le papier est encore accepté.

```
GET /api/v1/fse/{id}/pdf
```

**F8.4 — Intégration e-CPS (investigation)**

L'e-CPS (carte professionnelle dématérialisée) est la voie d'avenir pour l'authentification des professionnels de santé. Investigation des API disponibles :
- API Pro Santé Connect (authentification)
- API INSi (identification patient via NIR)
- Documentation GIE SESAM-Vitale

> Cette feature est exploratoire. L'objectif est de documenter le chemin technique pour l'homologation, pas de l'implémenter.

**F8.5 — Documentation chemin vers homologation**

Livrable : document technique décrivant :
- Les étapes de l'homologation SESAM-Vitale
- Les prérequis techniques
- Le calendrier estimé
- Les coûts (agrément + lecteur + tests)
- Les API et SDK à intégrer

### Livrables
- Table `fse` et migration
- Générateur de données FSE
- Export format logiciel tiers (VEGA ou autre)
- Générateur PDF feuille de soins
- Document technique "roadmap homologation SESAM-Vitale"

### Critère de succès
L'IDEL peut exporter ses factures du mois dans un format importable par son logiciel de télétransmission actuel, ou imprimer des feuilles de soins papier propres.

---

## RÉCAPITULATIF

| Itération | Durée | Features clés | Dépendances | Valeur utilisateur |
|-----------|-------|--------------|-------------|-------------------|
| **1. Référentiel NGAP** | 1.5 sem | Catalogue post-avenant 10, AMI/AMX/BSI, mécanisme push mises à jour | Aucune | Fondation fiable |
| **2. Factures basiques** | 1.5 sem | CRUD factures, calcul montants, numérotation | Iter 1 | Création manuelle de factures |
| **3. Cotation automatique** | 2 sem | Moteur AMI↔AMX auto, IFD↔IFI auto, majorations, jours fériés | Iter 1 | Calcul intelligent anti-rejets |
| **4. Ordonnances** | 1 sem | Prescriptions, alertes expiration | Iter 2 | Traçabilité réglementaire |
| **5. Pré-remplissage** | 1 sem | Auto-génération post-RDV avec contexte BSI, validation batch | Iter 2, 3, 4 + module agenda | UX terrain (game-changer) |
| **6. Dashboard** | 1.5 sem | Stats, suivi paiements, gestion rejets | Iter 2 | Pilotage financier |
| **7. Export comptable** | 1 sem | CSV, FEC, récap trimestriel | Iter 2, 6 | Relation comptable |
| **8. Prép. télétransmission** | 2 sem | Format FSE, export tiers, investigation e-CPS | Iter 2 | Transition vers V1.0 |

```
Semaine  1    2    3    4    5    6    7    8    9    10   11   12
         ├────┤
         Iter 1
              ├─────────┤
              Iter 2
                        ├──────────────┤
                        Iter 3
                                       ├────┤
                                       Iter 4
                                            ├────┤
                                            Iter 5
                                                 ├─────────┤
                                                 Iter 6
                                                           ├────┤
                                                           Iter 7
                                                                ├──────────┤
                                                                Iter 8
```

### Points de validation terrain

| Moment | Quoi valider | Avec qui |
|--------|-------------|----------|
| Fin iter 1 | "Retrouves-tu tous tes actes ?" | Ta femme |
| Fin iter 3 | "10 cas de cotation réels = bons montants ?" | Ta femme |
| Fin iter 5 | "Journée simulée : validation en < 3 min ?" | Ta femme |
| Fin iter 7 | "Export envoyé au comptable : il s'en sort ?" | Ta femme + comptable |

### Risques et mitigations

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Tarifs NGAP incorrects/obsolètes | Montants faux → rejets CPAM | Validation avec ta femme + source officielle ameli.fr + mécanisme push mises à jour (iter 1) |
| Pas d'API officielle NGAP | Mises à jour manuelles | Versioning par date d'effet + push centralisé + veille avenants JO |
| Règles de cumul majorations mal implémentées | Sous/sur-facturation | Tests exhaustifs iter 3 + validation terrain |
| Confusion AMI/AMX et IFD/IFI | Rejets CPAM systématiques | Résolution automatique dans CotationEngine selon statut BSI patient |
| Complexité BSI sous-estimée (multi-IDEL, forfait unique/jour) | BSI mal géré en cabinet | Commencer par le cas simple (1 IDEL), itérer sur multi-IDEL ensuite |
| Avenant 11 en cours de négociation | Changements imprévus | Architecture versionnée prête à absorber les changements |
| Format export comptable non compatible | Rejet comptable | Tester avec le comptable réel dès iter 7 |
| Homologation SESAM-Vitale trop longue | Retard V1.0 | Solution de contournement dès iter 8 |
