/**
 * Hook de gestion du WebSocket pour le chat agent IA.
 *
 * Protocole serveur (Iter B) :
 *   {"type": "token",                "content": "..."}
 *   {"type": "end",                  "usage": {...}}
 *   {"type": "error",                "message": "..."}
 *   {"type": "tool_result",          "tool": "...", "data": {...}}
 *   {"type": "confirmation_required","action": {"id","action_type","label","expires_at"}}
 *
 * Protocole client (Iter B) :
 *   {"type": "text",    "content": "...", "session_id": "..."}
 *   {"type": "confirm", "action_id": "...", "session_id": "..."}
 *   {"type": "cancel",  "action_id": "...", "session_id": "..."}
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { buildWsUrl } from '../api/agentService';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

/**
 * @typedef {Object} ChatMessage
 * @property {string} id                   - UUID unique
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {number} timestamp            - Date.now()
 * @property {boolean} isStreaming
 * @property {{tool: string, data: object}|null} toolResult
 * @property {{id: string, action_type: string, label: string, expires_at: string}|null} pendingConfirmation
 */

/**
 * @returns {{
 *   messages: ChatMessage[],
 *   isConnected: boolean,
 *   isStreaming: boolean,
 *   error: string|null,
 *   sendMessage: (text: string) => void,
 *   confirmAction: (actionId: string) => void,
 *   cancelAction: (actionId: string) => void,
 *   clearHistory: () => void,
 *   connect: () => void,
 *   disconnect: () => void,
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
                toolResult: null,
                pendingConfirmation: null,
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
        } else if (data.type === 'tool_result') {
          // Attacher le résultat d'outil au dernier message assistant
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
              const updated = { ...prev[lastIdx], toolResult: { tool: data.tool, data: data.data } };
              return [...prev.slice(0, lastIdx), updated];
            }
            return prev;
          });
        } else if (data.type === 'confirmation_required') {
          // Attacher la confirmation en attente au dernier message assistant
          setMessages((prev) => {
            const lastIdx = prev.length - 1;
            if (lastIdx >= 0 && prev[lastIdx].role === 'assistant') {
              const updated = { ...prev[lastIdx], pendingConfirmation: data.action };
              return [...prev.slice(0, lastIdx), updated];
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
          toolResult: null,
          pendingConfirmation: null,
        },
      ]);

      setIsStreaming(true);
      setError(null);
      // Nouveau protocole Iter B : type "text"
      wsRef.current.send(JSON.stringify({ type: 'text', content: trimmed, session_id: sessionId }));
    },
    [sessionId]
  );

  /** Confirme une action en attente. */
  const confirmAction = useCallback(
    (actionId) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      setIsStreaming(true);
      setError(null);
      wsRef.current.send(JSON.stringify({ type: 'confirm', action_id: actionId, session_id: sessionId }));
    },
    [sessionId]
  );

  /** Annule une action en attente. */
  const cancelAction = useCallback(
    (actionId) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      setIsStreaming(true);
      setError(null);
      wsRef.current.send(JSON.stringify({ type: 'cancel', action_id: actionId, session_id: sessionId }));
      // Retirer la pendingConfirmation du message concerné
      setMessages((prev) =>
        prev.map((msg) =>
          msg.pendingConfirmation?.id === actionId
            ? { ...msg, pendingConfirmation: null }
            : msg
        )
      );
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
    confirmAction,
    cancelAction,
    clearHistory,
    connect,
    disconnect,
    sessionId,
  };
}
