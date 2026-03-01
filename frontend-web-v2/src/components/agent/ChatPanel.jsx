/**
 * Panneau de chat glissant (drawer) pour l'agent IA.
 * S'ouvre depuis la droite, occupe toute la hauteur.
 */
import { useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';

import AgentStatusBadge from './AgentStatusBadge';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { useAgentWebSocket } from '../../hooks/useAgentWebSocket';

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 * }} props
 */
export default function ChatPanel({ isOpen, onClose }) {
  const {
    messages,
    isConnected,
    isStreaming,
    error,
    sendMessage,
    clearHistory,
    connect,
    disconnect,
  } = useAgentWebSocket();

  const messagesEndRef = useRef(null);

  // Connexion/déconnexion selon l'état ouvert/fermé
  useEffect(() => {
    if (isOpen) {
      connect();
    } else {
      disconnect();
    }
  }, [isOpen, connect, disconnect]);

  // Auto-scroll vers le bas à chaque nouveau message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const status = isConnected ? 'online' : 'offline';

  const handleNewConversation = () => {
    clearHistory();
  };

  return (
    <>
      {/* Overlay semi-transparent */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl
          w-full sm:w-96 transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label="Assistant IA"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-lg">🤖</span>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Assistant IA</h2>
              <AgentStatusBadge status={status} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              title="Nouvelle conversation"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              title="Fermer"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zone messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-4xl mb-3">🏥</div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Bonjour ! Je suis votre assistant IDEL.
              </p>
              <p className="text-xs text-gray-400">
                Posez-moi des questions sur vos patients, rendez-vous, facturation ou codes NGAP.
              </p>
              <div className="mt-4 space-y-2 w-full">
                {[
                  'Quels sont mes RDV aujourd\'hui ?',
                  'Quel est le tarif d\'un AMI 2 ?',
                  'Combien de factures en attente ?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    disabled={!isConnected || isStreaming}
                    className="w-full text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2
                      text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Erreur */}
          {error && (
            <div className="mx-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              ⚠️ {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={!isConnected || isStreaming} />
      </div>
    </>
  );
}
