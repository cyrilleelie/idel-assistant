# Audit Frontend Web — Rapport complet

**Date** : 2026-03-10
**Scope** : `frontend-web/src/` (90+ fichiers JSX/JS)
**Score global de coherence UI** : 5.6/10

---

## Table des matieres

- [A. Qualite du code](#a-qualite-du-code)
  - [CRITIQUE](#critique)
  - [IMPORTANT](#important)
  - [MINEUR](#mineur)
- [B. Coherence UX](#b-coherence-ux)
  - [CRITIQUE](#critique-1)
  - [IMPORTANT](#important-1)
  - [MINEUR](#mineur-1)
- [C. Coherence graphique (UI / Design System)](#c-coherence-graphique-ui--design-system)
  - [C1. Palette de couleurs](#c1-palette-de-couleurs)
  - [C2. Coins arrondis](#c2-coins-arrondis)
  - [C3. Ombres](#c3-ombres)
  - [C4. Typographie](#c4-typographie)
  - [C5. Font weight](#c5-font-weight)
  - [C6. Tailles d'icones](#c6-tailles-dicones)
  - [C7. Transitions et animations](#c7-transitions-et-animations)
  - [C8. Z-index](#c8-z-index)
  - [C9. Espacements](#c9-espacements)
  - [C10. Composants reutilisables (ou leur absence)](#c10-composants-reutilisables-ou-leur-absence)
  - [C11. Boutons](#c11-boutons)
  - [C12. Cartes](#c12-cartes)
- [D. Plan d'action recommande](#d-plan-daction-recommande)

---

## A. Qualite du code

### CRITIQUE

| # | Probleme | Fichiers | Impact |
|---|----------|----------|--------|
| A1 | **App.jsx monolithique** — tout le state global (patients, appointments, nurses, cabinet...) dans un seul composant, navigation par `useState('activeScreen')` au lieu de routing URL | `App.jsx` | Impossible a maintenir, pas de deep linking, pas de bookmarks |
| A2 | **Prop drilling massif** — PatientDetail recoit ~23 props dont la plupart sont juste relayees aux enfants | `App.jsx` -> `PatientDetail.jsx` | Chaque ajout de feature necessite de modifier toute la chaine |
| A3 | **JWT en localStorage** — tokens accessibles a tout script XSS | `api/client.js`, `api/agentService.js`, `VoiceInput.jsx` | Vulnerabilite securite |

### IMPORTANT

| # | Probleme | Fichiers |
|---|----------|----------|
| A4 | **Badge de statut duplique 3x** — `invoiceStatusBadge()` copie-colle | `FacturationTab.jsx`, `SyntheseTab.jsx`, `RejetsTab.jsx` |
| A5 | **`fmt()` (formatCurrency) duplique 3x** | `SyntheseTab.jsx`, `RejetsTab.jsx`, `ExportSection.jsx` |
| A6 | **Pattern download blob duplique 4x** | `api/invoices.js`, `api/fse.js` |
| A7 | **Parser de mois duplique 3x** | `FacturationTab.jsx`, `SyntheseTab.jsx`, `ExportSection.jsx` |
| A8 | **12+ state variables fragmentees** dans FacturationTab sans structure | `FacturationTab.jsx` |
| A9 | **Pas de Error Boundary** — un crash dans un onglet crashe toute l'app | `App.jsx` |
| A10 | **Gestion d'erreurs incoherente** — mix de `.catch(() => {})`, `console.error`, `setError()` | Partout |
| A11 | **2 clients axios non synchronises** — `auth.js` et `client.js` avec intercepteurs separes | `api/auth.js`, `api/client.js` |
| A12 | **Pas de timeout sur les requetes axios** | `api/client.js` |
| A13 | **`filteredInvoices` recalcule sans `useMemo`** a chaque render | `FacturationTab.jsx`, `SyntheseTab.jsx` |
| A14 | **ChatPanel rend les 5 onglets meme si 1 seul visible** | `ChatPanel.jsx` |
| A15 | **Race condition potentielle** — `fetchData` dans useEffect sans `useCallback` | `MaTourneeTab.jsx` |
| A16 | **`Set` dans `useState`** — fragile pour la comparaison de reference | `FacturationTab.jsx` |
| A17 | **Pas de validation input avant envoi API** | `PatientDetail.jsx`, formulaires |
| A18 | **Pas de tests frontend** — aucun `.test.jsx` / `.spec.jsx` | tout `src/` |

### MINEUR

| # | Probleme | Fichiers |
|---|----------|----------|
| A19 | Map de nurses dupliquee 2-3x | `FacturationTab.jsx`, `SyntheseTab.jsx` |
| A20 | Imports lucide-react potentiellement inutilises | `App.jsx`, `PatientDetail.jsx` |
| A21 | `AgentStatusBadge.jsx` utilise une seule fois | `ChatPanel.jsx` |
| A22 | `ConfirmationTimer` exporte mais utilise uniquement en interne | `ToolResultCard.jsx` |
| A23 | Closures lambda dans JSX sur formulaires lourds (~20 inputs) | `RdvModal.jsx` |

---

## B. Coherence UX

### CRITIQUE

| # | Probleme | Detail |
|---|----------|--------|
| B1 | **Statut facture `sent` vs `transmitted`** — FacturationTab utilise `sent`, SyntheseTab utilise `transmitted`. Le backend utilise `transmitted`. | Certains statuts ne s'affichent pas correctement selon l'onglet |
| B2 | **Couleur bouton primaire incoherente** — les CTA utilisent `bg-blue-600`, `bg-emerald-600`, ou `bg-green-600` sans logique | Impossible de deviner visuellement l'action principale |

### IMPORTANT

| # | Probleme | Detail |
|---|----------|--------|
| B3 | **Spinners mixes** — `RefreshCw` et `Loader2` melanges, tailles 14/22/24/26px | FacturationTab, TransmissionsTab, MarkPaidModal, RejetsTab |
| B4 | **Etats vides incoherents** — icones de tailles 32/36/48px, couleurs slate/emerald, textes "Aucun" vs "Aucune" | Partout |
| B5 | **Padding modales variable** — `p-5`, `p-6`, `px-6 py-4` selon la modale | RdvModal, NurseModal, TransmissionEditDialog, MarkPaidModal |
| B6 | **Bouton "Enregistrer" parfois bleu, parfois emerald** | RdvModal (bleu) vs PatientDetail (emerald) |
| B7 | **Messages d'erreur** — parfois `bg-red-50 border` (banner), parfois `text-red-600` nu | RdvModal, CabinetTab, PrescriptionForm |
| B8 | **Messages de succes** — mix Toast fixe (`bg-emerald-600`) et Banner (`bg-green-50 border`) | TransmissionsTab vs PrescriptionForm |
| B9 | **Orange semantiquement ambigu** — utilise pour "en cours" (transmissions) ET "corrige" (rejets) | TransmissionCard, RejetsTab |
| B10 | **Badges padding/border incoherents** — `px-2 py-0.5 rounded-full` vs `px-1.5 py-0.5 rounded border` | FacturationTab vs PatientDetail |
| B11 | **Texte secondaire** — alterne entre `text-slate-500`, `text-slate-600`, `text-gray-400` | Partout |
| B12 | **Bordures** — `border-slate-100`, `-200`, `-300` melangees sans logique | Partout |
| B13 | **aria-labels manquants** sur de nombreux boutons d'action | RdvModal, boutons icones |
| B14 | **En-tetes colonnes** — `text-xs font-medium uppercase text-slate-500` vs `font-semibold text-slate-800` | FacturationTab vs PatientDetail |

### MINEUR

| # | Probleme | Detail |
|---|----------|--------|
| B15 | Breakpoints responsive `sm` vs `md` melanges | FacturationTab vs PatientDetail |
| B16 | Champs obligatoires marques `*` rouge dans certains formulaires, absents dans d'autres | RdvModal vs PrescriptionForm |
| B17 | Certaines modales ont un bouton X, d'autres non | MarkPaidModal vs autres |

---

## C. Coherence graphique (UI / Design System)

### C1. Palette de couleurs

#### Couleurs de fond (bg-*) — 25+ teintes

| Couleur | Occurrences | Usage |
|---------|-------------|-------|
| bg-white | 164 | Cartes, panneaux |
| bg-slate-50 | 85 | Fonds legers |
| bg-slate-100 | 90 | Fonds secondaires |
| bg-blue-50 | 52 | Accents bleus |
| bg-blue-600 | 32 | Boutons primaires |
| bg-red-50 | 40 | Alertes/erreurs |
| bg-emerald-100 | 20 | Statuts completes |
| bg-amber-50 | 26 | Avertissements |
| bg-green-100 | 16 | Statuts succes (doublon emerald) |
| bg-gray-50 | 11 | Meme usage que slate-50 |
| bg-gray-100 | 11 | Meme usage que slate-100 |
| bg-orange-100 | 6 | Rare, incoherent |

#### Couleurs de texte (text-*) — 20+ teintes

| Couleur | Occurrences | Usage |
|---------|-------------|-------|
| text-slate-500 | 233 | Texte secondaire |
| text-slate-400 | 191 | Texte tertiaire |
| text-slate-600 | 164 | Texte normal |
| text-slate-700 | 129 | Texte fonce |
| text-slate-800 | 62 | Titres |
| text-blue-600 | 62 | Accents bleus |
| text-red-600 | 50 | Erreurs |
| text-gray-400/500/600 | 71 | **Doublon de slate** |

#### Problemes identifies

1. **Confusion slate vs gray** : 500+ `text-slate-*` vs 71 `text-gray-*` pour le meme usage. Visuellement similaire mais semantiquement confus.

2. **Trois palettes "succes"** coexistent :
   - `emerald-*` (30 occurrences) — standard de facto
   - `green-*` (18 occurrences) — doublon
   - `teal-*` (3 occurrences) — obsolete

3. **Couleurs orphelines** (1-2 occurrences) : `bg-cyan-100`, `bg-pink-100`, `bg-purple-600`, `bg-yellow-100`, `border-indigo-300`, `border-violet-200` — candidats a suppression.

---

### C2. Coins arrondis

| Classe | Occurrences | Usage |
|--------|-------------|-------|
| rounded-lg | 306 | Standard de facto |
| rounded-full | 99 | Badges, avatars |
| rounded-xl | 58 | Cartes principales |
| rounded-md | 27 | Boutons, inputs |
| rounded-2xl | 2 | Rare |
| rounded-sm | 1 | Curseur streaming |

**Probleme** : Cartes alternent entre `rounded-lg` et `rounded-xl` sans regle. Inputs/boutons melangent `rounded-md` et `rounded-lg`.

**Recommendation** : `rounded-md` (inputs/boutons), `rounded-lg` (cartes), `rounded-xl` (panneaux/modales).

---

### C3. Ombres

| Classe | Occurrences | Usage |
|--------|-------------|-------|
| shadow-sm | 52 | Standard leger |
| shadow-lg | 9 | Panneaux flottants |
| shadow-xl | 12 | Dropdowns, overlays |
| shadow-md | 4 | Rare |
| shadow-[custom] | 3 | Ad-hoc |

**Probleme** : Pas de hierarchie claire. Ombres personnalisees (`shadow-[1px_0_0_0_#e2e8f0]`, `shadow-red-200`) hors categorie.

**Recommendation** : `shadow-sm` (cartes), `shadow-md` (hover), `shadow-lg` (panels flottants), supprimer les custom.

---

### C4. Typographie

| Classe | Occurrences | Usage |
|--------|-------------|-------|
| text-xs | 492 | Etiquettes, notes |
| text-sm | 432 | Corps, descriptions |
| text-base | 13 | Rarement utilise |
| text-lg | 28 | Titres legers |
| text-xl | 12 | Titres |
| text-2xl | 11 | Grands titres |
| text-[10px] | 29 | Ad-hoc custom |
| text-[11px] | 7 | Ad-hoc custom |

**Problemes** :
- 45% du texte est xs/sm — peu de differenciation visuelle
- 36 occurrences de tailles ad-hoc (`text-[10px]`, `text-[11px]`) non standardisees
- Pas de hierarchie h1/h2/h3 formelle

**Recommendation** :
```
text-xs (12px)  -> etiquettes, timestamps
text-sm (14px)  -> corps, descriptions
text-base (16px) -> texte principal
text-lg (18px)  -> sous-titres
text-xl (20px)  -> titres de section
text-2xl (24px) -> titres de page
```
Supprimer les tailles ad-hoc.

---

### C5. Font weight

| Classe | Occurrences | Usage |
|--------|-------------|-------|
| font-medium | 421 | Standard par defaut |
| font-semibold | 120 | Titres, labels importants |
| font-bold | 31 | Titres forts |
| font-mono | 27 | Codes NGAP, montants |

**Probleme** : `font-medium` sur-utilise (421x), `font-normal` quasi absent (6x). Labels de formulaires melangent medium/semibold sans pattern.

**Recommendation** : `font-normal` (corps), `font-medium` (labels), `font-semibold` (sous-titres), `font-bold` (titres).

---

### C6. Tailles d'icones

| Size | Occurrences | Usage |
|------|-------------|-------|
| size={14} | 103 | Inline icons |
| size={16} | 58 | Navigation |
| size={12} | 35 | Petites icones |
| size={18} | 28 | Icones moyennes |
| size={20} | 20 | Icones moyennes |
| size={10} | 16 | Badges |
| size={15/13/11/9} | 15 | Ad-hoc non standardise |

**Probleme** : 10+ variantes de tailles. Pas de standardisation entre 14 et 16 comme "taille de base". 15 occurrences de tailles ad-hoc (15, 13, 11, 9).

**Recommendation** : Standardiser sur 10 (tiny), 12 (small), 14 (inline), 16 (base), 18 (button), 20 (medium), 24 (large), 32 (hero). Supprimer les tailles impaires.

---

### C7. Transitions et animations

| Classe | Occurrences | Usage |
|--------|-------------|-------|
| transition-colors | 188 | Hover standard |
| transition-all | 26 | Animations complexes |
| animate-spin | 36 | Spinners |
| animate-pulse | 14 | Loaders |
| duration-300 | 5 | Lent |
| duration-150 | 2 | Rapide |
| duration-200 | 1 | Moyen |

**Probleme** : Durees non standardisees. La majorite utilise la duree Tailwind par defaut (150ms) mais certains composants specifient 200ms ou 300ms sans logique.

**Recommendation** : 150ms (boutons), 200ms (cartes hover), 300ms (modales entree/sortie).

---

### C8. Z-index

| Classe | Occurrences | Usage |
|--------|-------------|-------|
| z-50 | 15 | Modales, overlays |
| z-40 | 4 | Panneaux flottants (ChatPanel, ReceptionistWidget) |
| z-20 | 4 | Dropdowns |
| z-10 | 3 | Sous-elements |

**Etat** : Coherent, pas de conflit. Seules 4 valeurs utilisees avec un gap de 10 suffisant.

---

### C9. Espacements

| Classe | Occurrences | Pattern |
|--------|-------------|---------|
| py-2 | 262 | Padding vertical standard |
| px-3 | 219 | Padding horizontal standard |
| gap-2 | 206 | Gap standard |
| gap-1 | 180 | Gap compact |
| py-1 | 140 | Padding vertical serre |
| px-4 | 119 | Padding horizontal large |
| px-2 | 100 | Padding horizontal compact |

**Probleme** : Pas de grille 8px formelle. `px-2` (100x) et `px-3` (219x) coexistent comme "standard". Paddings de boutons varient (py-1.5, py-2, py-3) sans regle.

**Recommendation** :
```
gap-1 (4px)  -> elements tres serres
gap-2 (8px)  -> compact (element-element)
gap-3 (12px) -> medium (groupe-groupe)
gap-4 (16px) -> large (sections)
p-2 (8px)    -> bouton compact
p-3 (12px)   -> carte body
p-4 (16px)   -> modale body
p-5 (20px)   -> section header
```

---

### C10. Composants reutilisables (ou leur absence)

**Aucun composant shadcn/ui importe dans le code source.**

Malgre shadcn/ui dans la stack declaree, le code n'utilise que des composants custom avec des classes Tailwind inline. Les patterns suivants sont repetes sans abstraction :

| Pattern | Repetitions | Devrait etre |
|---------|-------------|-------------|
| Bouton primaire (`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md`) | ~15x | `<Button variant="primary">` |
| Bouton secondaire (`bg-white border border-slate-300 hover:bg-slate-50`) | ~12x | `<Button variant="secondary">` |
| Bouton texte (`text-blue-600 hover:underline text-sm`) | ~10x | `<Button variant="text">` |
| Badge de statut (`px-2 py-0.5 rounded-full text-xs font-medium`) | 50+ | `<Badge variant="...">` |
| Etat vide (icone + texte gris centre) | ~8x | `<EmptyState>` |
| Spinner (icone animate-spin + texte) | ~10x | `<LoadingSpinner>` |

---

### C11. Boutons

#### Variation des paddings

| Pattern | Occurrences |
|---------|-------------|
| px-3 py-1.5 | ChatInput |
| px-4 py-2 | FacturationTab (standard) |
| px-5 py-3 | Rare |

#### Variation des coins

| Pattern | Occurrences |
|---------|-------------|
| rounded-md | ~16x |
| rounded-lg | ~20x |

#### Variation des couleurs

| Couleur | Semantique presumee | Probleme |
|---------|---------------------|----------|
| bg-blue-600 | Action primaire | OK mais pas unique |
| bg-emerald-600 | Validation/succes | Utilise aussi comme primaire |
| bg-green-600 | Succes | Doublon d'emerald |
| bg-red-600 | Danger | OK |
| bg-amber-500 | Avertissement | OK |

**Probleme central** : `bg-blue-600` et `bg-emerald-600` sont tous deux utilises comme bouton primaire selon le contexte, ce qui empeche l'utilisateur de distinguer visuellement l'action principale.

---

### C12. Cartes

Les ToolResultCards (CotationCard, TransmissionCard, CreneauxCard, OrdonnanceCard, TourneeReoptCard) suivent un pattern coherent :

```
bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-{color}-500 p-4
```

Couleurs d'accent par type :
- CotationCard : `border-l-blue-500` (facturation)
- TransmissionCard : `border-l-emerald-500` (transmission)
- CreneauxCard : `border-l-violet-500` (planning)
- OrdonnanceCard : `border-l-violet-500` (ordonnance)
- TourneeReoptCard : `border-l-indigo-500` (tournee)

**Etat** : Coherent entre elles. Bonne pratique.

---

## D. Plan d'action recommande

### Phase 1 : Nettoyage palette et unification (rapide)

1. Remplacer tous `gray-*` par `slate-*` (-71 classes)
2. Remplacer tous `green-*` par `emerald-*` pour le succes (-18 classes)
3. Supprimer `teal-*` et couleurs orphelines
4. Unifier le statut `sent` -> `transmitted` dans FacturationTab

### Phase 2 : Composants reutilisables

1. Creer `components/ui/Button.jsx` (primary, secondary, text, danger, success)
2. Creer `components/ui/Badge.jsx` (draft, validated, transmitted, paid, rejected, error)
3. Creer `components/ui/EmptyState.jsx` (icone + titre + description)
4. Creer `components/ui/LoadingSpinner.jsx` (taille standardisee)
5. Extraire `invoiceStatusBadge()` dans un composant unique
6. Extraire `fmt()` / `formatCurrency()` dans `utils/formatting.js`
7. Extraire `downloadBlob()` dans `utils/fileDownload.js`
8. Extraire le parser de mois dans `utils/dateFormatting.js`

### Phase 3 : Architecture et state management

1. Creer `CabinetContext` pour les donnees globales (nurses, careLabels, cabinetData)
2. Reduire le prop drilling dans PatientDetail (~23 props -> ~3 props)
3. Regrouper les 12+ state variables de FacturationTab dans un `useReducer`
4. Ajouter `useMemo` sur les listes filtrees (filteredInvoices)
5. Ajouter un Error Boundary global
6. Ajouter un timeout axios (30s)
7. Unifier la gestion d'erreurs (utilitaire `getErrorMessage()`)

### Phase 4 : Standardisation UI

1. Standardiser les tailles d'icones (supprimer tailles impaires)
2. Standardiser les coins arrondis (md pour boutons, lg pour cartes)
3. Standardiser les paddings de modales (p-6 partout)
4. Standardiser le spinner (Loader2, size={16})
5. Standardiser les etats vides (icone size={32}, text-slate-400)
6. Ajouter aria-labels sur les boutons d'action
7. Supprimer les tailles de texte ad-hoc (text-[10px], text-[11px])

### Phase 5 : Documentation

1. Creer `docs/design-system.md` avec la palette, typographie, espacements, composants
2. Documenter les conventions de nommage et les patterns UI

---

## Resume executif

| Categorie | Nombre de problemes | Repartition |
|-----------|---------------------|-------------|
| Code CRITIQUE | 3 | App monolithique, prop drilling, JWT localStorage |
| Code IMPORTANT | 15 | Duplications, state fragmente, pas de tests |
| Code MINEUR | 5 | Imports inutilises, composants single-use |
| UX CRITIQUE | 2 | Statut sent/transmitted, couleurs CTA |
| UX IMPORTANT | 12 | Spinners, etats vides, modales, badges |
| UX MINEUR | 3 | Responsive, champs obligatoires, bouton X |
| UI palette | 3 discordances majeures | slate/gray, emerald/green/teal, orphelines |
| UI composants | 0 abstraction | Aucun Button/Badge/EmptyState reutilisable |
| **Total** | **43 problemes identifies** | |
