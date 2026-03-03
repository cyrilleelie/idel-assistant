/**
 * Service de communication avec l'agent IA.
 *
 * Construit l'URL WebSocket avec le JWT en query param
 * (les headers HTTP ne sont pas disponibles lors du WS upgrade).
 */

import apiClient from './client';

/**
 * Retourne le token JWT stocké dans localStorage.
 */
function getWsToken() {
  return localStorage.getItem('access_token') || '';
}

/**
 * Construit l'URL WebSocket pour le chat agent.
 *
 * En développement : connexion DIRECTE au backend (ws://localhost:8000).
 * Le proxy WebSocket de Vite est instable (ECONNRESET/ECONNREFUSED),
 * on le contourne donc entièrement pour les WebSocket.
 *
 * En production : même domaine (wss://<domain>).
 *
 * @param {string} sessionId - Identifiant de session unique (non utilisé dans l'URL)
 * @returns {string} URL WebSocket complète
 */
export function buildWsUrl(sessionId) {
  const token = getWsToken();
  if (import.meta.env.DEV) {
    // Connexion directe au backend en développement (bypass proxy Vite)
    return `ws://localhost:8000/api/v1/agent/chat?token=${encodeURIComponent(token)}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/v1/agent/chat?token=${encodeURIComponent(token)}`;
}

/**
 * Récupère le statut de santé de l'agent IA.
 * @returns {Promise<{status: string, llm_reachable: boolean, redis_ok: boolean}>}
 */
export async function getAgentHealth() {
  const { data } = await apiClient.get('/agent/health');
  return data;
}

/**
 * Construit l'URL WebSocket pour le pipeline voix complet.
 * Même logique que buildWsUrl mais pointe sur /agent/voice.
 *
 * @returns {string} URL WebSocket voix
 */
export function buildVoiceWsUrl() {
  const token = getWsToken();
  if (import.meta.env.DEV) {
    return `ws://localhost:8000/api/v1/agent/voice?token=${encodeURIComponent(token)}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/v1/agent/voice?token=${encodeURIComponent(token)}`;
}

/**
 * Transcrit un blob audio via l'endpoint REST POST /agent/transcribe.
 *
 * @param {Blob} audioBlob - Données audio (webm/opus recommandé)
 * @returns {Promise<{text: string, confidence: number, duration_seconds: number, provider: string, warning: string|null}>}
 */
export async function transcribeAudio(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');

  const token = localStorage.getItem('access_token') || '';
  const response = await fetch('/api/v1/agent/transcribe', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Transcription error ${response.status}`);
  }

  return response.json();
}

/**
 * Efface l'historique de session côté Redis.
 * @param {string} sessionId
 */
export async function clearAgentSession(sessionId) {
  try {
    await apiClient.delete(`/agent/session/${sessionId}`);
  } catch {
    // L'endpoint peut ne pas exister — non bloquant
  }
}

/**
 * Enregistre un feedback sur une réponse de l'agent.
 * @param {{
 *   session_id: string,
 *   user_message: string,
 *   agent_response: string,
 *   tool_called?: string|null,
 *   tool_result?: object|null,
 *   rating: 'positive'|'negative',
 *   correction?: string|null,
 *   category?: string|null,
 * }} payload
 * @returns {Promise<{id: string, recorded: boolean}>}
 */
export async function submitFeedback(payload) {
  const { data } = await apiClient.post('/agent/feedback', payload);
  return data;
}

/**
 * Récupère les stats de feedback (30 derniers jours).
 * @returns {Promise<{period_days: number, total: number, positive: number, negative: number, satisfaction_rate: number|null, corrections_available: number}>}
 */
export async function getFeedbackStats() {
  const { data } = await apiClient.get('/agent/feedback/stats');
  return data;
}
