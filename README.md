# IDEL Assistant

Application SaaS de gestion de cabinet pour infirmières libérales (IDEL) en France, avec base opérationnelle solide (patients, facturation NGAP, tournées, transmissions, planning) et extensions IA en développement (agent conversationnel, pipeline vocal, secrétaire téléphonique).

> **Statut du projet.** La base de gestion (patients, facturation NGAP, préparation SESAM-Vitale, tournées, transmissions, protocoles de soins, secteurs géographiques) est finalisée et fonctionnelle en environnement de développement. Les extensions IA sont expérimentales et en cours de développement. Le projet n'est pas déployé en production et n'est pas encore utilisé par un cabinet réel. Il a été développé en solo dans le cadre d'un parcours d'apprentissage sur le développement assisté par IA appliqué à un domaine métier exigeant (secteur santé, contraintes RGPD et HDS).

## À quoi sert l'application

Le métier d'infirmière libérale combine des tournées quotidiennes chez les patients, la saisie d'actes cotés selon la nomenclature NGAP, la préparation de Feuilles de Soins Électroniques pour la Sécurité Sociale, et une charge administrative importante entre les patients. IDEL Assistant regroupe ces flux dans une plateforme unifiée disponible sur deux frontends complémentaires :

- Un **dashboard web** au cabinet pour la gestion de fond et la supervision
- Une **application mobile** en tournée, avec synchronisation offline-first pour travailler en zone sans réseau

### Fonctionnalités principales

**Gestion des patients.** Dossier patient complet avec chiffrement applicatif des données sensibles (nom, adresse, pathologies), champs SESAM-Vitale (AMO, AMC, exonérations, rang de naissance), recherche par nom sans déchiffrement via hash HMAC, filtrage et tri, archivage soft-delete réversible.

**Planning et prise de rendez-vous.** Agenda semaine cliquable, création et modification des RDV, moteur de suggestion de créneaux qui propose les 3 meilleures options en fonction du détour kilométrique, du secteur géographique, des préférences horaires et du confort du planning existant.

**Tournée du jour.** Vue chronologique des rendez-vous avec métriques de trajet (distance totale, temps de déplacement estimé), carte interactive avec les stops géolocalisés et les secteurs colorés, détection informative des allers-retours inefficaces.

**Facturation NGAP.** Cotation automatique à la validation d'un rendez-vous, catalogue complet des actes NGAP avec majorations (nuit, dimanche, indemnités kilométriques et forfaitaires), détection BSI multi-IDEL pour éviter la double facturation, workflow brouillon → validée → transmise → payée ou rejetée. Dashboard statistiques mensuelles avec KPIs et graphiques, exports comptables (CSV avec séparateur ; et UTF-8 BOM, FEC selon la norme LPF, récapitulatif trimestriel PDF, journal des recettes).

**Préparation SESAM-Vitale (FSE).** Génération de Feuilles de Soins Électroniques à partir des factures validées, cycle de vie complet (générée → exportée → transmise → rejetée), export par lot (CSV, XML, JSON), PDF individuel ou batch, gestion des champs praticien (ADELI, numéro AM, zone conventionnelle) et cabinet (FINESS, SIREN).

**Transmissions.** Transmissions vocales et écrites entre l'infirmière en tournée et le cabinet. Enregistrement audio depuis le mobile, transcription automatique via STT, structuration en compte-rendu DAR (Données, Actions, Résultats). Cycle de vie complet (brouillon → transcrit → complet → validé), liaison possible avec les ordonnances et les alertes.

**Protocoles de soins.** Définition de protocoles récurrents (type de soin, fréquence, durée), suivi du statut (actif, terminé, suspendu), génération automatique de la série de rendez-vous associée.

**Secteurs géographiques.** Définition de secteurs par codes postaux et communes, affectation automatique des patients aux secteurs, visualisation cartographique avec découpage coloré.

**Application mobile en tournée.** Toutes les fonctionnalités essentielles pour l'infirmière en déplacement : consultation du planning, marquage des rendez-vous réalisés, création de transmissions vocales, consultation et création de patients, préparation de tournée avec synthèse des transmissions récentes. Synchronisation delta offline/online via WatermelonDB pour continuer de travailler en zone sans réseau, puis sync automatique au retour.

## Points techniques principaux

Points sur lesquels la base est solide et opérationnelle :

- **Sécurité applicative** : chiffrement AES-256-GCM au niveau applicatif des colonnes sensibles (nom, adresse, pathologies), recherche par hash HMAC-SHA256 sans déchiffrement, audit trail immutable sur les actions sensibles (table write-only en base).
- **Multi-tenant strict** : isolation par `cabinet_id` via les policies Row Level Security de PostgreSQL, sécurité garantie côté base même si le code applicatif contient un bug.
- **Application mobile offline-first** : synchronisation delta entre l'app React Native et le backend via WatermelonDB, pour permettre à l'infirmière de travailler en tournée même dans une zone sans réseau.
- **Facturation NGAP complète** : catalogue d'actes, cotation avec majorations (nuit, dimanche, indemnités kilométriques), workflow brouillon → validée → transmise → payée, exports comptables (CSV, FEC selon la norme LPF, récapitulatifs trimestriels PDF).

Points en cours de développement expérimental, à consolider avant tout usage réel :

- **Agent conversationnel intégré au dashboard** : premier prototype fonctionnel mais avec plusieurs limites identifiées. Fait l'objet d'une refonte planifiée pour améliorer son utilité opérationnelle.
- **Pipeline vocal STT + TTS** : première version câblée (Whisper, ElevenLabs pour le cloud, faster-whisper et Kokoro en équivalents locaux), à valider en usage réel.
- **Secrétaire téléphonique IA** : prototype technique posé, non validé fonctionnellement, à reprendre.
- **Architecture souveraine cloud ↔ GPU local** : basculement vers un GPU OVH prévu et câblé (LLM Mistral via vLLM, STT et TTS locaux), à valider en usage réel.

## Stack

- **Backend** : Python 3.12, FastAPI async (asyncpg), SQLAlchemy 2.0, Alembic, Pydantic v2, PostgreSQL 16, Redis 7
- **Frontend web** : React 19, Vite 7, Tailwind CSS v4, shadcn/ui, TanStack Query
- **Frontend mobile** : Expo SDK 54, React Native 0.81, TypeScript, WatermelonDB
- **IA** : Anthropic, Mistral (cloud ou vLLM local), Whisper, ElevenLabs, Kokoro
- **Infra** : Docker Compose, GPU OVH T1-45 A10 pour l'hébergement souverain (câblé, non exploité en production)

## Méthodologie de développement

Le projet a été construit en solo selon une approche **spec-driven avec Claude Code** : je conçois les spécifications par phases dans `docs/`, je pilote la génération de code par l'IA, je relis et corrige. Les prompts et les critères de review de chaque phase sont documentés dans `docs/10-methodo-prompts.md` et `docs/11-methodo-reviews.md`.

## Documentation

Pour un aperçu technique détaillé (arborescence complète, procédures de démarrage local, description exhaustive des fonctionnalités, guide de déploiement GPU), voir [`README-TECHNIQUE.md`](README-TECHNIQUE.md).

L'ensemble de la documentation projet (architecture, PRD, guides opérationnels, méthodologie, références métier) est indexé dans [`docs/README.md`](docs/README.md).

## Contact

Cyrille Elie — [cyrille.elie@gmail.com](mailto:cyrille.elie@gmail.com)
