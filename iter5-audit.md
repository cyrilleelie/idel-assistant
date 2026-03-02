# Iter 5 — Audit de l'existant et implémentation

## Date d'audit : 2026-02-28

## Ce qui existait déjà (iter 3bis/4)

### Backend — Fonctionnel avant iter 5
- `CreateInvoiceFromAppointmentUseCase` — création facture depuis RDV, validation ordonnance
- `CreateAllDailyInvoicesUseCase` — batch pour tous les RDV du jour
- `GetDailyBillingUseCase` — vue quotidienne avec statuts ordonnance
- `POST /cotation/create-from-appointment` — endpoint création unitaire
- `GET /cotation/daily-billing` — vue facturation du jour
- `POST /cotation/create-all-daily` — batch facturation
- `POST /appointments/{id}/complete` — marquer RDV terminé (sans facturation auto)
- `PatientCotationContext.bsi_already_billed_today` — champ existait, hardcodé à False

### Frontend (`frontend-web-v2/`)
- `FacturationTab.jsx` — table RDV, bouton "Tout facturer", section factures
- `MaTourneeTab.jsx` — bouton completeRdv par RDV
- Couche API — `cotation.js`, `appointments.js`, `invoices.js`

---

## Gaps identifiés et implémentés dans iter 5

### [GAP 4 — CORRIGÉ] prescription_incomplete absent de la réponse API
**Fichier** : `backend/app/infrastructure/api/v1/cotation_routes.py`
**Problème** : `DailyBillingItemResponse` n'exposait pas `prescription_incomplete` ni le mapping
**Correction** : Ajout du champ + mapping dans le endpoint `GET /cotation/daily-billing`

### [GAP 5 — CORRIGÉ] Calcul de distance auto
**Fichier créé** : `backend/app/domain/value_objects/haversine.py`
**Intégré dans** : `CreateInvoiceFromAppointmentUseCase._compute_distance()`
- Haversine × 1.3 (coefficient route conservative)
- Cabinet.lat/lon et Patient.lat/lon disponibles dans les entités domain
- Distance persistée sur `appointment.distance_km` si calculée automatiquement
- Si coordonnées manquantes → distance = 0, pas d'IK (log warning)

### [GAP 3 — CORRIGÉ] needs_review hardcodé à False
**Fichier** : `backend/app/application/use_cases/billing/create_invoice_from_appointment.py`
**Critères implémentés** :
1. Ordonnance expirante (expiring) → reason "Ordonnance expire dans N jour(s)"
2. Soin en horaire exceptionnel (< 7h ou >= 20h) → reason "Soin en horaire exceptionnel — vérifier majorations"
3. Montant élevé (> 80€) → reason "Montant élevé (X€) — vérifier"
4. Montant quasi-nul (< 3€ mais > 0) → reason "Montant très faible (X€) — vérifier"
5. Raisons cumulées avec " · " comme séparateur

### [GAP BSI — CORRIGÉ] bsi_already_billed_today dynamique
**Fichiers** :
- `backend/app/application/dtos/cotation_dto.py` — ajout champ `bsi_already_billed_today: bool = False` à `SimulateCotationDTO`
- `backend/app/application/use_cases/billing/simulate_cotation.py` — utilise le flag du DTO
- `CreateInvoiceFromAppointmentUseCase._check_bsi_already_billed()` — requête les factures du jour avec ligne commençant par "BS"

### [GAP 1+2 — CORRIGÉ] Déclenchement auto + réponse enrichie
**Fichiers** :
- `backend/app/infrastructure/api/schemas/appointment_schemas.py` — ajout `AutoBillingInfo` et `AppointmentCompleteResponse`
- `backend/app/infrastructure/api/v1/appointment_routes.py` — enrichissement complet du endpoint `/complete`

**Comportement** :
- La complétion du RDV déclenche automatiquement `CreateInvoiceFromAppointmentUseCase`
- Si succès → `auto_billing: { status: "created", invoice_id, invoice_number, invoice_total }`
- Si skip (pas d'actes, facture déjà existante, ordonnance invalide) → `auto_billing: { status: "skipped", skip_reason }`
- Si erreur inattendue → `auto_billing: { status: "error" }` + log
- **La complétion n'est jamais bloquée** par la facturation auto

### [GAP FRONTEND 1 — CORRIGÉ] Toast après complétion dans Ma Tournée
**Fichiers** :
- `frontend-web-v2/src/App.jsx` — toast state, completeRdv enrichi, badge counter
- Toast "RDV terminé · Facture brouillon X€ créée" pendant 4.5s (emerald)
- Toast "RDV terminé · Facture à compléter dans Facturation" si skip (slate)

### [GAP FRONTEND 2 — CORRIGÉ] Badge notification Facturation
**Fichiers** :
- `frontend-web-v2/src/components/Header.jsx` — prop `pendingFacturationCount`, badge vert
- `frontend-web-v2/src/App.jsx` — state `pendingFacturationCount`, incrément sur création, reset sur navigation

### [GAP FRONTEND 3 — CORRIGÉ] FacturationTab — Tout valider, badges auto, stats 3 catégories
**Fichier** : `frontend-web-v2/src/components/facturation/FacturationTab.jsx`
- **Bouton principal "Tout valider (N)"** — valide toutes les factures draft `auto_cotation && !needs_review`
- **Bouton secondaire "Tout facturer (M)"** — crée les factures pour RDVs sans facture
- **Stats 4 indicateurs** : RDV du jour / Factures auto prêtes / À vérifier / À compléter
- **Badge "⚡ Auto"** sur les factures avec `metadata.auto_cotation === true`
- **Badge "⚠️ À vérifier"** sur les factures avec `metadata.needs_review === true`
- **Raison needs_review** affichée sous le numéro de facture
- **Bordure gauche ambre** sur les lignes à vérifier

---

## Tests ajoutés

- `backend/tests/unit/test_haversine.py` — 7 tests (calcul Haversine, Paris→Versailles, Paris→Lyon, etc.)
- `backend/tests/unit/test_auto_billing.py` — 14 tests :
  - TestCreateInvoiceFromAppointmentUseCase (4 tests)
  - TestNeedsReview (7 tests)
  - TestBsiCheckLogic (3 tests)

## Résultat final : 361 tests passent, 0 failure
