/**
 * Boutons de feedback sur une réponse de l'agent IA.
 *
 * Visible au survol de chaque message assistant (hors streaming).
 * - 👍 → envoie un feedback positif (1 clic)
 * - 👎 → ouvre un champ de correction (texte libre)
 *
 * Itération E — Fine-tuning / boucle de feedback terrain.
 */
import { useState } from 'react';
import { submitFeedback } from '../../api/agentService';

/**
 * Détecte la catégorie d'un message agent depuis le contexte.
 */
function detectCategory(message) {
  if (!message.toolResult) return null;
  const tool = message.toolResult.tool;
  if (tool === 'analyser_et_coter') return 'cotation';
  if (tool === 'structurer_transmission') return 'transmission';
  if (tool === 'proposer_creneaux_geooptimises') return 'planning';
  if (tool === 'interpreter_ordonnance') return 'ordonnance';
  if (tool === 'reoptimize_tournee') return 'tournee';
  return 'general';
}

export default function MessageFeedback({ message, sessionId, userMessage }) {
  const [state, setState] = useState('idle'); // idle | sent_positive | correcting | sent_negative
  const [correction, setCorrection] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (rating, correctionText) => {
    setIsSubmitting(true);
    try {
      await submitFeedback({
        session_id: sessionId,
        user_message: userMessage || '',
        agent_response: message.content || '',
        tool_called: message.toolResult?.tool || null,
        tool_result: message.toolResult?.data || null,
        rating,
        correction: correctionText || null,
        category: detectCategory(message),
      });
      setState(rating === 'positive' ? 'sent_positive' : 'sent_negative');
    } catch (error) {
      console.error('Feedback error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Feedback déjà envoyé
  if (state === 'sent_positive') {
    return <span className="text-xs text-green-500 opacity-60 ml-2">Merci !</span>;
  }
  if (state === 'sent_negative') {
    return <span className="text-xs text-gray-400 opacity-60 ml-2">Correction enregistrée</span>;
  }

  // Modal de correction ouverte
  if (state === 'correcting') {
    return (
      <div className="mt-2 border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm">
        <p className="font-medium text-gray-700 mb-1 text-xs">
          Quelle aurait été la bonne réponse ?
        </p>
        <div className="text-xs text-gray-400 mb-2 line-clamp-2">
          Agent : {message.content?.slice(0, 150)}
          {message.content?.length > 150 ? '...' : ''}
        </div>
        <textarea
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
          placeholder="Tape la réponse correcte..."
          className="w-full border rounded px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
          rows={3}
          autoFocus
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handleSubmit('negative', correction)}
            disabled={!correction.trim() || isSubmitting}
            className="flex-1 bg-blue-500 text-white text-xs py-1.5 rounded hover:bg-blue-600 disabled:opacity-40"
          >
            {isSubmitting ? 'Envoi...' : 'Enregistrer'}
          </button>
          <button
            onClick={() => setState('idle')}
            className="px-3 text-gray-400 hover:text-gray-600 text-xs"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  // Boutons de feedback (apparaissent au survol du groupe parent)
  return (
    <div className="flex items-center gap-1.5 mt-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150">
      <button
        onClick={() => handleSubmit('positive')}
        className="text-gray-300 hover:text-green-500 transition-colors text-xs p-0.5"
        title="Bonne réponse"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        onClick={() => setState('correcting')}
        className="text-gray-300 hover:text-red-400 transition-colors text-xs p-0.5"
        title="Réponse incorrecte — corriger"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </div>
  );
}
