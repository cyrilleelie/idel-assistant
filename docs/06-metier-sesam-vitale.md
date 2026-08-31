# Roadmap Homologation SESAM-Vitale — IDEL Assistant

> **Statut actuel :** Module FSE en infrastructure (Itération 8) — **Non homologué**
>
> **Version document :** 1.0 — 2026-03-01

---

## Contexte

SESAM-Vitale est le système d'information de l'Assurance Maladie permettant la création et la transmission électronique des Feuilles de Soins (FSE). Pour une application de santé comme IDEL Assistant, l'homologation SESAM-Vitale est obligatoire avant toute télétransmission réelle à la CPAM.

L'itération 8 pose les fondations techniques (entité FSE, exports CSV/XML/JSON, PDF feuille de soins) en vue de l'homologation officielle.

---

## Périmètre de l'itération 8 (actuel)

✅ Implémenté :
- Entité `Fse` (domaine) avec cycle de vie : `generated → exported → transmitted → rejected`
- `GenerateFseUseCase` : conversion facture validée → FSE
- Exports : CSV (compatible Excel), XML (pseudo-SESAM), JSON (APIs tierces)
- PDF feuille de soins (inspiré CERFA S3110, usage interne uniquement)
- API REST : 6 endpoints FSE (`/generate`, `/`, `/export`, `/{id}/pdf`, `/batch-pdf`, `/mark-transmitted`)
- Frontend : onglet "Transmission" avec workflow 3 étapes (Générer → Exporter → Suivi)
- Champs patient : NIR, organisme AMO/AMC, type d'exonération, rang de naissance
- Champs utilisateur : ADELI, numéro AM, zone conventionnelle
- Champs cabinet : FINESS, SIREN, SIRET

⚠️ Limitations actuelles (non-homologué) :
- Le NIR patient n'est pas transmis dans la FSE (vide) — le déchiffrement AES-256 n'est pas intégré dans le générateur FSE pour éviter la circulation du NIR en clair dans les flux internes
- Le format XML ne respecte pas le schéma XSD officiel SESAM-Vitale (PS-GIE SESAM-Vitale)
- Pas de lecteur carte Vitale / CPS (Carte de Professionnel de Santé)
- Pas de signature électronique PSC (Pro Santé Connect)
- Pas de canal de transmission B2 (réseau ADEL/SESAM-Vitale)

---

## Plan d'homologation en 4 phases

### Phase 1 — Conformité technique (3–4 mois)

**Objectif :** Aligner les structures de données sur les spécifications officielles.

| Action | Détail | Priorité |
|--------|--------|----------|
| Obtenir les specs SESAM-Vitale | Adhésion à GIE SESAM-Vitale, accès au SESAM-Vitale Reference Kit | CRITIQUE |
| Format XML conforme XSD | Implémenter le schéma XSD officiel de la FSE (version 1.40+) | CRITIQUE |
| Gestion du NIR sécurisée | Intégrer le déchiffrement NIR dans un service isolé (HSM ou TEE) | CRITIQUE |
| Nomenclature NGAP/CCAM | Vérifier la correspondance codes actes ↔ codes SESAM-Vitale | HAUTE |
| Lot FSE numéroté | Numérotation conforme (RPPS + séquence + clé de contrôle) | HAUTE |

### Phase 2 — Intégration carte Vitale et CPS (2–3 mois)

**Objectif :** Lecture des cartes pour alimentation automatique des données patient et signature professionnelle.

| Action | Détail | Priorité |
|--------|--------|----------|
| Intégration lecteur carte Vitale | SDK SESAM-Vitale pour lecture NFC/PC/SC (côté frontend mobile) | CRITIQUE |
| Intégration CPS | Authentification professionnelle via carte CPS (signature FSE) | CRITIQUE |
| Pro Santé Connect (PSC) | Fédération d'identité professionnelle via PSC (alternative CPS logicielle) | HAUTE |
| Tests avec cartes de test | Jeu de données SESAM-Vitale fourni par GIE SESAM-Vitale | HAUTE |

### Phase 3 — Homologation GIE SESAM-Vitale (4–6 mois)

**Objectif :** Obtenir le certificat d'homologation (nécessaire avant toute télétransmission réelle).

| Étape | Description |
|-------|-------------|
| Dossier d'homologation | Constitution du dossier technique (architecture, schémas, flux) |
| Tests de conformité | Exécuter la suite de tests officielle GIE SESAM-Vitale (200+ cas de test) |
| Audit sécurité | Conformité HDS, chiffrement, protection du NIR, audit trail |
| Certification ASIP Santé | Homologation de la solution en tant que logiciel de facturation agréé |
| Référencement CPAM | Mise sur la liste des logiciels reconnus par l'Assurance Maladie |

**Contact GIE SESAM-Vitale :**
- Site officiel : https://www.sesam-vitale.fr
- Formulaire adhésion éditeur : via l'espace partenaires GIE

### Phase 4 — Déploiement pilote et passage en production (2–3 mois)

**Objectif :** Déploiement contrôlé avec quelques cabinets partenaires avant ouverture générale.

| Étape | Description |
|-------|-------------|
| Pilote 5 cabinets | Transmission réelle en environnement de recette CPAM |
| Formation utilisateurs | Guide d'utilisation de l'onglet Transmission |
| Support FSE | Procédure de gestion des rejets CPAM |
| Passage en production | Mise à disposition de la fonctionnalité à tous les abonnés |

---

## Architecture cible pour la télétransmission

```
Frontend (onglet Transmission)
    │
    ▼
API IDEL Assistant (/fse/generate, /fse/export)
    │
    ▼
FSE Generator (domain service)
    │  ← Lit les données patient/idel/cabinet/prescription depuis la BDD
    │  ← Déchiffre le NIR via KeyManager (service isolé)
    ▼
FSE SignatureService (à créer - Phase 2)
    │  ← Signe avec CPS ou PSC
    ▼
Canal de transmission B2 (à créer - Phase 3)
    │  ← Protocole SESAM-Vitale officiel
    ▼
Serveur CPAM (Assurance Maladie)
    │
    ▼
ARL (Accusé de Réception Logique) → /fse/mark-transmitted / arl_received_at
```

---

## Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|--------|------------|
| Délai d'homologation GIE (>6 mois) | Haute | Fort | Prévoir un partenariat avec un éditeur certifié (sous-traitance) |
| Évolution des specs SESAM-Vitale | Moyenne | Moyen | S'abonner aux alertes GIE SESAM-Vitale |
| Coût adhésion GIE élevé | Moyenne | Moyen | Négocier le statut "éditeur en développement" |
| Non-conformité RGPD sur le NIR | Faible | Très fort | HSM ou service isolé pour le NIR, jamais en clair dans les logs |

---

## Budget estimatif

| Poste | Estimation |
|-------|------------|
| Adhésion GIE SESAM-Vitale | 3 000–8 000 € / an |
| Développement Phase 1+2 | 3–5 mois·développeur |
| Tests d'homologation | 40–80 jours (équipe GIE) |
| Maintenance annuelle | 10–15% du coût de dev initial |

---

## Ressources

- **GIE SESAM-Vitale** : https://www.sesam-vitale.fr
- **ASIP Santé / ANS** : https://www.esante.gouv.fr
- **Référentiel NGAP** : https://www.ameli.fr/infirmier/exercice-liberal/remuneration/consultations-et-actes/ngap
- **Pro Santé Connect** : https://www.proSanteConnect.fr
- **HDS (Hébergeur de Données de Santé)** : https://esante.gouv.fr/produits-services/hds

---

*Ce document sera mis à jour à chaque étape franchie du processus d'homologation.*
