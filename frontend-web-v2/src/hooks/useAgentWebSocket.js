/**
 * Hook de gestion du WebSocket pour le chat agent IA.
 *
 * Protocole serveur :
 *   {"type": "token",  "content": "..."}  → token de texte (streaming)
 *   {"type": "end",    "usage": {...}}    → fin de génération
 *   {"type": "error",  "message": "..."} → erreur
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildWsUrl } from '../api/agentService';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

/**
 * @typedef {Object} ChatMessage
 * @property {string} id         - UUID unique
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {number} timestamp  - Date.now()
 * @property {boolean} isStreaming
 */

/**
 * @returns {{
 *   messages: ChatMessage[],
 *   isConnected: boolean,
 *   isStreaming: boolean,
 *   error: string|null,
 *   sendMessage: (text: string) => void,
 *   clearHistory: () => void,
 *   sessionId: string,
 * }}
 */
export function useAgentWebSocket() {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const wsRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const url = buildWsUrl(sessionId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttemptsRef.current = 0;
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      setIsStreaming(false);

      // Codes 4001/4003 = auth error, pas de reconnexion
      if (event.code === 4001 || event.code === 4003) {
        setError('Erreur d\'authentification. Veuillez vous reconnecter.');
        return;
      }

      // Reconnexion automatique (max 3 tentatives)
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      setIsConnected(false);
      setIsStreaming(false);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'token') {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + data.content },
              ];
            }
            // Premier token — créer la bulle assistant
            return [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data.content,
                timestamp: Date.now(),
                isStreaming: true,
              },
            ];
          });
        } else if (data.type === 'end') {
          setIsStreaming(false);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant') {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
        } else if (data.type === 'error') {
          setIsStreaming(false);
          setError(data.message || 'Erreur de l\'assistant');
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === 'assistant' && last.isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
        }
      } catch {
        // Ignorer les messages malformés
      }
    };
  }, [sessionId]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimerRef.current);
    reconnectAttemptsRef.current = MAX_RECONNECT_ATTEMPTS; // bloquer la reconnexion
    wsRef.current?.close();
  }, []);

  const sendMessage = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      // Ajouter le message utilisateur localement
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: trimmed,
          timestamp: Date.now(),
          isStreaming: false,
        },
      ]);

      setIsStreaming(true);
      setError(null);
      wsRef.current.send(JSON.stringify({ message: trimmed, session_id: sessionId }));
    },
    [sessionId]
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  // Nettoyage à l'unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    messages,
    isConnected,
    isStreaming,
    error,
    sendMessage,
    clearHistory,
    connect,
    disconnect,
    sessionId,
  };
}
