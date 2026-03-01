/**
 * Panneau de chat glissant (drawer) pour l'agent IA.
 * S'ouvre depuis la droite, occupe toute la hauteur.
 * Iter B : mode selector (5 onglets) + support ToolResultCards.
 */
import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';

import AgentStatusBadge from './AgentStatusBadge';
import ChatInput from './ChatInput';
import ChatMessage from './ChatMessage';
import { useAgentWebSocket } from '../../hooks/useAgentWebSocket';

const MODES = [
  {
    id: 'general',
    label: 'Général',
    icon: '💬',
    placeholder: 'Posez votre question...',
    suggestions: [
      "Quels sont mes RDV aujourd'hui ?",
      "Quel est le tarif d'un AMI 2 ?",
      "Combien de factures en attente ?",
    ],
  },
  {
    id: 'facturation',
    label: 'Facturation',
    icon: '💰',
    placeholder: 'Ex: Cote un pansement complexe avec 12km, M. Dupont',
    suggestions: [
      "Cote un pansement complexe escarre, 8km, 7h30",
      "Combien de factures rejetées ce mois-ci ?",
      "Statistiques de facturation de mars 2026",
    ],
  },
  {
    id: 'transmission',
    label: 'Transmission',
    icon: '📋',
    placeholder: 'Dictez votre transmission ici...',
    suggestions: [
      "Rédige une transmission : pansement complexe réalisé, patient algique...",
      "Structure ce DAR : TA 140/90, FC 88, glycémie 1.8g/L...",
      "Transmission pour Mme Martin, soin de stomie",
    ],
  },
  {
    id: 'planning',
    label: 'Planning',
    icon: '📅',
    placeholder: 'Ex: Trouve un créneau pour M. Dupont, pansement 30min',
    suggestions: [
      "Propose un créneau pour M. Dupont, pansement complexe",
      "Quels créneaux disponibles demain matin ?",
      "RDV de la semaine prochaine",
    ],
  },
  {
    id: 'tournee',
    label: 'Tournée',
    icon: '🗺️',
    placeholder: 'Ex: Mme Dupont a annulé son RDV de 9h',
    suggestions: [
      "Réoptimise ma tournée, Mme Dupont a annulé",
      "Résumé de ma tournée du jour",
      "Combien de km prévus aujourd'hui ?",
    ],
  },
];

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
    confirmAction,
    cancelAction,
    clearHistory,
    connect,
    disconnect,
  } = useAgentWebSocket();

  const [activeMode, setActiveMode] = useState('general');
  const messagesEndRef = useRef(null);

  const currentMode = MODES.find((m) => m.id === activeMode) || MODES[0];

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
          w-full sm:w-[420px] transition-transform duration-300 ease-in-out
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
              onClick={clearHistory}
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

        {/* Mode selector */}
        <div className="flex border-b border-gray-100 bg-gray-50 overflow-x-auto shrink-0">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setActiveMode(mode.id)}
              className={`flex items-center gap-1 px-3 py-2 text-xs whitespace-nowrap transition-colors shrink-0
                ${activeMode === mode.id
                  ? 'border-b-2 border-blue-500 text-blue-700 bg-white font-medium'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white'
                }`}
            >
              <span>{mode.icon}</span>
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        {/* Zone messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-4xl mb-3">{currentMode.icon}</div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Mode {currentMode.label}
              </p>
              <p className="text-xs text-gray-400 mb-4">
                {currentMode.placeholder}
              </p>
              <div className="space-y-2 w-full">
                {currentMode.suggestions.map((suggestion) => (
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
            <ChatMessage
              key={msg.id}
              message={msg}
              onConfirm={confirmAction}
              onCancel={cancelAction}
            />
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
        <ChatInput
          onSend={sendMessage}
          disabled={!isConnected || isStreaming}
          placeholder={messages.length === 0 ? currentMode.placeholder : undefined}
        />
      </div>
    </>
  );
}
