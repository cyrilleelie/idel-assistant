# Règles de facturation — IDEL Assistant

Documentation complète des règles appliquées pour la génération automatique des factures (cotations NGAP, lignes ajoutées, conditions d'application).

---

## 1. Vue d'ensemble du pipeline de facturation

Le processus de facturation se décompose en deux flux :

**Flux automatique** : `POST /appointments/{id}/complete` → `CreateInvoiceFromAppointmentUseCase` → `SimulateCotationUseCase` → `CotationEngine.coter_passage()` → Facture brouillon

**Flux manuel** : `SimulateCotationUseCase` → cotation simulée (prévisualisation sans création de facture)

Le cœur du système est le **`CotationEngine`** (`backend/app/domain/rules/cotation_engine.py`), un pipeline en **9 étapes séquentielles** conforme à l'avenant 10 de la NGAP.

---

## 2. Données d'entrée

Le moteur de cotation reçoit :

| Paramètre | Type | Description |
|---|---|---|
| `actes` | `list[str]` | Codes NGAP (ex : `["AMI_4", "AMI_1.5"]`) |
| `date_heure_soin` | `datetime` | Date et heure exacte du soin |
| `distance_km` | `Decimal` | Distance cabinet → patient (Haversine × 1.3) |
| `lieu` | `str` | `"domicile"` ou `"cabinet"` |
| `zone_ik` | `str` | `"plaine"` ou `"montagne"` |
| `est_premier_soin_journee` | `bool` | Premier passage technique du patient ce jour |
| `patient_context` | `PatientCotationContext` | Contexte patient (BSI, ALD, âge…) |
| `catalog` | `dict[str, CareTypeCatalog]` | Catalogue des actes NGAP |

### PatientCotationContext (value object immuable)

| Champ | Type | Description |
|---|---|---|
| `has_active_bsi` | `bool` | Patient sous BSI actif |
| `bsi_level` | `str \| None` | Niveau BSI : `"BSA"`, `"BSB"`, `"BSC"` |
| `bsi_already_billed_today` | `bool` | Forfait BSI déjà facturé par un collègue aujourd'hui |
| `is_ald` | `bool` | Affection Longue Durée (prise en charge 100 % AMO) |
| `is_maternity` | `bool` | Maternité (prise en charge 100 % AMO) |
| `age` | `int` | Âge du patient (pour MIE < 7 ans) |
| `is_palliative` | `bool` | Soins palliatifs |

---

## 3. Barème des tarifs (avenant 10)

### 3.1 Majorations horaires

| Code | Libellé | Montant | Plage horaire |
|---|---|---|---|
| `MAJ_NUIT_PROF` | Nuit profonde | **18,30 €** | 23h00 – 5h00 |
| `MAJ_NUIT` | Nuit | **9,15 €** | 20h00 – 23h00 / 5h00 – 8h00 |
| `MAJ_DIM` | Dimanche / jour férié | **8,50 €** | Toute la journée |

### 3.2 Majorations actes

| Code | Libellé | Montant | Condition |
|---|---|---|---|
| `MCI` | Coordination infirmière | **5,00 €** | 1er soin technique de la journée pour ce patient |
| `MAU` | Acte unique | **1,35 €** | Exactement 1 seul acte technique dans le passage |
| `MIE` | Enfant < 7 ans | **3,15 €** | Patient < 7 ans, 1 MIE **par acte technique** |

### 3.3 Indemnités de déplacement (domicile uniquement)

| Code | Libellé | Montant |
|---|---|---|
| `IFD` | Forfait déplacement (hors BSI) | **2,75 €** |
| `IFI` | Forfait infirmier BSI | **2,75 €** |
| `IK` (plaine) | Kilométrique plaine | **0,35 €/km** après abattement de **4 km** |
| `IK` (montagne) | Kilométrique montagne | **0,50 €/km** après abattement de **2 km** |

### 3.4 Forfaits BSI

Les montants BSA/BSB/BSC sont définis dans le **CareTypeCatalog** via le champ `fixed_amount`. Le forfait est **journalier et unique par patient**, quel que soit le nombre de passages ou d'IDEL intervenant.

---

## 4. Pipeline de cotation — Les 9 étapes

### Étape 1 : Résolution AMI → AMX (patient BSI)

Si le patient a un BSI actif (`has_active_bsi = true`), **tous les codes commençant par `AMI`** sont convertis en `AMX` :

- `AMI_4` → `AMX_4`
- `AMI_1.5` → `AMX_1.5`

**Raison** : Les actes AMX (soins infirmiers de pratique courante pour patients BSI) remplacent les AMI quand le patient relève du BSI. Le suffixe (coefficient) est conservé.

Une auto-correction est tracée : `"AMI_4 → AMX_4 (patient avec BSI actif)"`.

### Étape 2 : Application de l'article 11 (cumul d'actes techniques)

L'article 11 de la NGAP régit le cumul des actes techniques dans un même passage :

1. Les actes AMI/AMX sont **triés par coefficient décroissant**
2. **1er acte** : facturé à **100 %** → `montant = coefficient × base_rate`
3. **2e acte** : facturé à **50 %** → `montant = coefficient × base_rate × 0.5`
4. **3e acte et suivants** : facturés à **0 %** (gratuits)

**Exemple** avec AMI_4 (coeff 4) et AMI_1.5 (coeff 1.5), base_rate AMI = 3,15 € :

- AMI_4 → 4 × 3,15 = **12,60 €** (100 %)
- AMI_1.5 → 1,5 × 3,15 × 0,5 = **2,36 €** (50 %)

Le tri par coefficient décroissant garantit que l'acte le plus valorisé est facturé à taux plein.

> Si un acte n'est pas trouvé dans le catalogue, une `ValueError` est levée (erreur bloquante).

### Étape 3 : Ajout du forfait BSI

Conditions d'ajout (cumulatives) :

1. `has_active_bsi` = true
2. `bsi_already_billed_today` = **false** (vérification multi-IDEL)
3. `bsi_level` est défini (`"BSA"`, `"BSB"` ou `"BSC"`)
4. Le code BSI existe dans le catalogue

Le forfait est un **montant fixe journalier** (`fixed_amount` du catalogue).

**Déduplication multi-IDEL** : Avant de créer la facture, `_check_bsi_already_billed()` parcourt les factures non-annulées du jour pour le même patient et cherche si une ligne commence par `"BS"`. Si oui, le forfait est omis et une auto-correction est tracée : `"Forfait BSI non facturé (déjà facturé aujourd'hui par un collègue)"`.

### Étape 4 : Indemnités de déplacement

**Condition préalable** : `lieu = "domicile"`. Aucune indemnité au cabinet.

**Indemnité forfaitaire** :

- Si patient BSI → ligne **IFI** (2,75 €) + auto-correction `"IFD → IFI (patient avec BSI actif)"`
- Sinon → ligne **IFD** (2,75 €)

**Indemnité kilométrique (IK)** :

```
distance_facturable = max(0, distance_km − abattement)
montant_IK = distance_facturable × tarif_km
```

| Zone | Abattement | Tarif/km |
|---|---|---|
| Plaine | 4 km | 0,35 € |
| Montagne | 2 km | 0,50 € |

L'IK n'est ajoutée que si `distance_facturable > 0`. L'explication détaillée est tracée (ex : `"IK : 12km − 4km = 8km × 0.35€ = 2.80€"`).

**Calcul de la distance** : `haversine_distance_km()` utilise la formule Haversine (vol d'oiseau) × coefficient route **1.3** pour estimer la distance réelle. La CPAM accepte la distance par la route la plus courte ; le coefficient 1.3 est une estimation conservative pour le MVP.

### Étape 5 : Majorations horaires

**Ne s'appliquent PAS aux forfaits BSI** — uniquement aux actes techniques AMI/AMX. Si `nb_actes_techniques == 0`, aucune majoration horaire n'est ajoutée.

**Majoration nuit** (mutuellement exclusives) :

- **23h00 – 5h00** : `MAJ_NUIT_PROF` = 18,30 €
- **20h00 – 23h00 ou 5h00 – 8h00** : `MAJ_NUIT` = 9,15 €

**Majoration dimanche/férié** :

- S'applique si `is_sunday_or_holiday(date_soin)` = true
- `MAJ_DIM` = 8,50 €
- **Cumul possible** avec la majoration nuit (un soin à 23h un dimanche cumule les deux)

**Jours fériés français reconnus** (11 jours) :

- Fixes : 1er janvier, 1er mai, 8 mai, 14 juillet, 15 août, 1er novembre, 11 novembre, 25 décembre
- Mobiles (basés sur Pâques, algorithme de Butcher/Meeus) : Lundi de Pâques, Ascension (+39j), Lundi de Pentecôte (+50j)

### Étape 6 : MCI (Majoration Coordination Infirmière)

Conditions (cumulatives) :

- `est_premier_soin_journee` = true (1er passage technique du patient aujourd'hui)
- `nb_actes_techniques > 0`

Montant : **5,00 €**

### Étape 7 : MAU (Majoration Acte Unique)

Condition : `nb_actes_techniques == 1` (exactement un seul acte technique)

Montant : **1,35 €**

> MAU et article 11 (50 %) sont mutuellement exclusifs en pratique : si 2 actes, l'article 11 s'applique mais pas la MAU ; si 1 acte, la MAU s'applique mais pas l'article 11.

### Étape 8 : MIE (Majoration Infirmier Enfant)

Conditions :

- `patient.age < 7`
- `nb_actes_techniques > 0`

Montant : **3,15 € par acte technique**. Si 2 actes techniques, 2 lignes MIE sont ajoutées.

### Étape 9 : Calcul des totaux et répartition AMO/AMC

**Total** = somme de toutes les lignes (arrondi au centime, `ROUND_HALF_UP`)

**Répartition** :

| Cas | AMO | AMC | Patient |
|---|---|---|---|
| **ALD** ou **Maternité** | 100 % | 0 % | 0 % |
| **Cas standard** | 60 % | 40 % | 0 % |

> Note MVP : le reste à charge patient est toujours à 0 (tiers payant total supposé).

---

## 5. Flux de facturation automatique (auto-billing)

**Déclencheur** : `POST /appointments/{id}/complete`

Étapes du `CreateInvoiceFromAppointmentUseCase` :

1. **Validation du RDV** : statut `completed`, codes actes NGAP présents
2. **Anti-doublon** : vérifie qu'aucune facture non-annulée n'existe pour ce RDV
3. **Chargement patient** : récupère contexte BSI, ALD, âge
4. **Calcul distance** : `haversine_distance_km(cabinet_coords, patient_coords)` — persistée sur le RDV pour réutilisation
5. **Check BSI multi-IDEL** : scan des factures du jour pour ce patient, recherche lignes `BS*`
6. **Simulation cotation** : appel au `CotationEngine` avec toutes les données collectées
7. **Génération numéro** : format séquentiel par cabinet/année/mois
8. **Recherche ordonnance** : tente de rattacher une ordonnance active/valide du plan de soins
9. **Détection `needs_review`** : flag pour vérification humaine (voir section 6)
10. **Création facture draft** + toutes les lignes
11. **Retour DTO** avec métadonnées (`auto_corrections`, `explications`, `needs_review`)

---

## 6. Détection `needs_review` (vérification humaine)

Une facture est marquée `needs_review = true` si **au moins un** des critères suivants est vérifié :

| Critère | Seuil | Raison affichée |
|---|---|---|
| Ordonnance manquante | Aucune ordonnance rattachée au plan de soins | `"Aucune ordonnance rattachée au plan de soins"` |
| Ordonnance invalide | Ordonnance présente mais expirée/incomplète | Message spécifique de l'erreur |
| Ordonnance expirante | Expire bientôt (statut `expiring`) | `"Ordonnance expire dans X jour(s)"` |
| Horaire exceptionnel | Soin avant 7h ou après 20h | `"Soin en horaire exceptionnel — vérifier majorations"` |
| Montant élevé | `total > 80 €` | `"Montant élevé (XX€) — vérifier"` |
| Montant très faible | `0 < total < 3 €` | `"Montant très faible (XX€) — vérifier"` |

---

## 7. Cycle de vie de la facture

```
draft → validated → transmitted → paid
  │        │                        │
  │        └→ canceled              └→ rejected
  └→ canceled
```

| Statut | Modifiable | Annulable | Transitions possibles |
|---|---|---|---|
| `draft` | Oui | Oui | → `validated`, → `canceled` |
| `validated` | Non | Oui | → `transmitted`, → `canceled`, → `paid`, → `rejected` |
| `transmitted` | Non | Non | → `paid`, → `rejected` |
| `paid` | Non | Non | Terminal |
| `rejected` | Non | Non | → Correction (`correct-and-resubmit` crée une nouvelle facture) |
| `canceled` | Non | Non | Terminal |

**Règles de validation** : requiert `status == "draft"`, au moins 1 ligne, et `care_date <= invoice_date`.

**Recalcul totaux** : `Invoice.recalculate_totals(is_ald, is_maternity)` recalcule `total_amount` depuis les lignes, puis applique la répartition AMO/AMC.

---

## 8. Structure du catalogue d'actes (`CareTypeCatalog`)

Chaque entrée du catalogue contient :

| Champ | Usage |
|---|---|
| `code` | Code NGAP (AMI_4, BSA, IFD, MAJ_NUIT…) |
| `lettre_cle` | Lettre-clé NGAP (AMI, AMX, IFD, IK…) |
| `coefficient` | Coefficient multiplicateur (ex : 4 pour AMI_4) |
| `base_rate` | Tarif de base de la lettre-clé (ex : 3,15 € pour AMI) |
| `fixed_amount` | Montant fixe (utilisé pour BSA/BSB/BSC, IFD, majorations) |
| `category` | `technique`, `technique_bsi`, `bsi_forfait`, `majoration`, `indemnite_deplacement`, `indemnite_km` |
| `is_cumulative` | Si l'acte est cumulable (article 11) |

**Calcul du montant** :

- Si `fixed_amount` défini → `montant = fixed_amount × quantity`
- Sinon → `montant = coefficient × base_rate × quantity`

---

## 9. Ligne de facture (`InvoiceLine`)

Chaque ligne de facture contient :

| Champ | Description |
|---|---|
| `act_code` | Code NGAP (AMI_4, BSA, IFD, IK, MAJ_NUIT, MCI…) |
| `act_label` | Libellé lisible (peut contenir `"(art.11 : 50%)"`) |
| `coefficient` | Coefficient appliqué |
| `base_rate` | Tarif de base appliqué |
| `quantity` | Quantité (1 pour la plupart, km facturables pour IK) |
| `supplements` | Suppléments en dict (optionnel) |
| `line_subtotal` | `coefficient × base_rate × quantity` |
| `line_total` | `line_subtotal + supplements_total` |

---

## 10. Exemple complet

**Scénario** : Pansement complexe (AMI_4) + injection (AMI_1), patient BSI niveau BSB, domicile à 12 km (plaine), mardi 8h30, premier soin du jour, patient 45 ans, pas ALD.

| Étape | Action | Lignes ajoutées |
|---|---|---|
| 1 — AMI → AMX | Conversion BSI | AMI_4 → **AMX_4**, AMI_1 → **AMX_1** |
| 2 — Article 11 | Tri + cumul | AMX_4 → 4 × 3,15 = **12,60 €** (100 %), AMX_1 → 1 × 3,15 × 0,5 = **1,58 €** (50 %) |
| 3 — BSI forfait | Forfait journalier | BSB → **montant catalogue** (omis si déjà facturé par un collègue) |
| 4 — Déplacement | IFI + IK | IFI = **2,75 €**, IK = (12 − 4) × 0,35 = **2,80 €** |
| 5 — Majorations horaires | Vérification | Aucune (8h30 = hors plage nuit/dimanche) |
| 6 — MCI | 1er soin technique | **5,00 €** |
| 7 — MAU | Acte unique ? | Non (2 actes techniques) |
| 8 — MIE | Enfant < 7 ans ? | Non (45 ans) |
| 9 — Totaux | Répartition | Total = somme lignes, AMO = 60 %, AMC = 40 % |

---

## Fichiers sources de référence

| Fichier | Rôle |
|---|---|
| `backend/app/domain/rules/cotation_engine.py` | Pipeline de cotation 9 étapes |
| `backend/app/domain/rules/invoice_rules.py` | Validation facture et répartition AMO/AMC |
| `backend/app/application/use_cases/billing/create_invoice_from_appointment.py` | Auto-billing depuis complétion RDV |
| `backend/app/application/use_cases/billing/simulate_cotation.py` | Orchestration simulation de cotation |
| `backend/app/domain/value_objects/cotation_result.py` | Structure du résultat (lignes, totaux, explications) |
| `backend/app/domain/value_objects/patient_cotation_context.py` | Contexte patient pour la cotation |
| `backend/app/domain/entities/care_type_catalog.py` | Catalogue des actes NGAP |
| `backend/app/domain/entities/invoice.py` | Entité facture et cycle de vie |
| `backend/app/domain/services/french_holidays.py` | Jours fériés français |
| `backend/app/domain/value_objects/haversine.py` | Calcul de distance GPS |
