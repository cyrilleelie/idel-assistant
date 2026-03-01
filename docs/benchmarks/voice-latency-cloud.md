# Benchmarks latence voix — pipeline cloud (itération C)

## Objectif

Ce document mesure les temps de latence du pipeline vocal cloud :
**audio dictée → transcription → LLM → réponse vocale**.

Ces mesures servent de **référence de comparaison** pour l'itération D
(pipeline self-hosted faster-whisper + Kokoro, sans GPU cloud).

---

## Configuration mesurée

| Composant      | Implémentation           | Provider        |
|----------------|--------------------------|-----------------|
| STT            | `WhisperCloudSTT`        | OpenAI Whisper API |
| LLM            | `MistralCloudProvider`   | mistral-large-latest |
| TTS            | `ElevenLabsTTS`          | ElevenLabs API |
| Réseau         | Connexion bureau ADSL/Fibre | — |

---

## Scénarios et cibles

| Scénario | Cible | Résultat mesuré |
|---|---|---|
| Transcription audio 10s → texte (Whisper) | < 3s | *à mesurer* |
| Transcription → premier token LLM | < 1s après transcript | *à mesurer* |
| Premier token LLM → premier chunk audio TTS | < 500ms | *à mesurer* |
| **Total voix → premier mot entendu** | **< 4s** | **_à mesurer_** |

---

## Méthodologie de mesure

Pour mesurer les latences réelles, utiliser la console développeur du navigateur
(onglet Réseau) ou les logs backend avec timestamps :

### Côté frontend
```javascript
// Dans VoiceInput.jsx, ajouter des timestamps :
console.time('stt-request');
const response = await fetch('/api/v1/agent/transcribe', ...);
console.timeEnd('stt-request');  // Latence STT complète
```

### Côté backend
Les logs incluent automatiquement la durée de transcription Whisper :
```
DEBUG Whisper transcription en 1.82s, 47 chars
```

---

## Résultats mesurés

> **À compléter lors des premiers tests en production.**

### Test 1 — Dictée courte (~5s)
- Contenu : "Pansement complexe chez M. Dupont, 8 km"
- Durée audio : 5s
- Transcription Whisper : ___ ms
- Premier token LLM : ___ ms après transcript
- Premier chunk TTS : ___ ms après premier token
- **Total voix → premier mot entendu : ___ ms**

### Test 2 — Transmission courte (~15s)
- Contenu : dictée d'une transmission DAR standard
- Durée audio : 15s
- Transcription Whisper : ___ ms
- Premier token LLM : ___ ms après transcript
- Premier chunk TTS : ___ ms après premier token
- **Total voix → premier mot entendu : ___ ms**

### Test 3 — Question simple (~3s)
- Contenu : "Quels sont mes RDV aujourd'hui ?"
- Durée audio : 3s
- Transcription Whisper : ___ ms
- Premier token LLM (sans outil) : ___ ms
- Premier chunk TTS : ___ ms
- **Total voix → premier mot entendu : ___ ms**

---

## Analyse des goulots d'étranglement

Les principaux facteurs de latence dans l'ordre :

1. **Transcription Whisper API** (~1-3s selon durée audio)
   - Whisper traite l'audio en une seule passe (pas de streaming STT)
   - La durée est proportionnelle à la longueur de l'audio
   - Amélioration en itération D : faster-whisper local, résultat quasi-immédiat

2. **LLM Mistral** (~0.5-1s pour premier token)
   - Mistral large est rapide pour les réponses courtes
   - Le streaming phrase par phrase réduit la latence perçue

3. **TTS ElevenLabs** (~200ms TTFB selon la doc ElevenLabs)
   - Streaming natif : premier chunk audio disponible rapidement
   - Amélioration en itération D : Kokoro local, TTFB < 100ms

---

## Comparaison prévue avec itération D (self-hosted)

| Scénario | Itération C (cloud) | Itération D (local) | Gain estimé |
|---|---|---|---|
| STT 10s audio | ~2s | ~0.5s | -75% |
| TTS TTFB | ~200ms | ~50ms | -75% |
| **Total latence perçue** | **~4s** | **~1s** | **-75%** |

L'itération D supprime aussi le transfert des données audio vers OpenAI,
résolvant définitivement la contrainte HDS.

---

## Notes HDS

- **Itération C** : l'audio transite par OpenAI (DPA à signer avant production)
- **Itération D** : le STT tourne sur l'infra OVH HDS → aucune donnée hors périmètre
- La pseudonymisation pré-LLM est maintenue dans les deux itérations
- L'audit trail `agent_audit_log` enregistre la durée audio (pas le contenu) pour chaque transcription
