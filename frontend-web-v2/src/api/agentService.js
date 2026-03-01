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
 * En développement : ws://localhost:8000 (via proxy Vite)
 * En production : wss://<domain>
 *
 * @param {string} sessionId - Identifiant de session unique
 * @returns {string} URL WebSocket complète
 */
export function buildWsUrl(sessionId) {
  const token = getWsToken();
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host; // localhost:5173 en dev → proxy Vite vers :8000
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
