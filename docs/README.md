# Documentation IDEL Assistant

Ce dossier regroupe la documentation technique, fonctionnelle et méthodologique du projet. Cet index t'oriente vers les documents pertinents selon ton objectif de lecture.

## Vue d'ensemble rapide (lecture 5 minutes)

Si tu veux comprendre le projet en 5 minutes, lis dans l'ordre :

1. Le [README](../README.md) à la racine du repo pour le pitch et les points principaux
2. Le début de [`02-architecture-backend.md`](02-architecture-backend.md) pour la vision technique

## Documentation de référence

Documents qui décrivent le "quoi" et le "comment" du produit fini.

- [`01-produit-specifications.md`](01-produit-specifications.md) : Product Requirements Document. User stories, endpoints API, flows métier. Document fonctionnel de référence.
- [`02-architecture-backend.md`](02-architecture-backend.md) : architecture technique de référence. Clean Architecture 3 couches, ADR (Architecture Decision Records), modèle de données.
- [`02b-architecture-tournees.md`](02b-architecture-tournees.md) : addendum architecture v1.1. Refonte de l'optimisation de tournées (abandon du VRPTW au profit d'un moteur de suggestion de créneaux). Contient les ADR-008 et 009.
- [`03-architecture-frontend.md`](03-architecture-frontend.md) : architecture frontend v1.0. Stratégie mobile-first + dashboard web, ADR-010 à 013.

## Références métier

Règles et cadres du domaine santé libérale.

- [`05-metier-facturation-ngap.md`](05-metier-facturation-ngap.md) : règles de facturation NGAP (nomenclature des actes professionnels), majorations, indemnités kilométriques.
- [`06-metier-sesam-vitale.md`](06-metier-sesam-vitale.md) : feuille de route pour l'homologation SESAM-Vitale.

## Guides opérationnels

Documents utiles pour installer, faire tourner ou étendre le projet.

- [`04-guide-setup-dev.md`](04-guide-setup-dev.md) : guide setup développeur (Windows 11).
- [`07-ia-fine-tuning.md`](07-ia-fine-tuning.md) : guide pour le fine-tuning d'un modèle spécialisé sur la terminologie médicale française.
- [`08-benchmark-voice-latency.md`](08-benchmark-voice-latency.md) : mesures de latence du pipeline vocal en configuration cloud.
- [`09-runbook-gpu-deployment.md`](09-runbook-gpu-deployment.md) : runbook de déploiement sur infrastructure GPU (OVH T1-45 A10).

## Méthodologie de développement

Documents qui explicitent l'approche de construction du projet.

- [`10-methodo-prompts.md`](10-methodo-prompts.md) : prompts séquentiels utilisés avec Claude Code pour la génération de code, avec patterns attendus et checkpoints de validation par phase.
- [`11-methodo-reviews.md`](11-methodo-reviews.md) : critères de review appliqués systématiquement après chaque phase de génération, pour valider la qualité du code IA-généré avant de passer à la phase suivante.

Ces deux documents illustrent la méthodologie spec-driven du projet : je conçois les spécifications par phases, je pilote la génération, et je valide selon des critères formalisés en amont.
