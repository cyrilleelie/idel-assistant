/**
 * Bulle de message dans le chat agent IA.
 * Supporte un rendu Markdown minimal : **gras** et listes à puces.
 * Iter B : affiche les ToolResultCards quand un outil a retourné un résultat.
 * Iter E : affiche les boutons de feedback au survol des réponses agent.
 */
import { ToolResultCard } from './ToolResultCard';
import MessageFeedback from './MessageFeedback';

/**
 * Convertit du Markdown minimal en éléments React.
 * Supporte : **bold**, listes à puces (- item), sauts de ligne.
 */
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-0.5 my-1">
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      listItems.push(line.slice(2));
    } else {
      flushList();
      if (line.trim() === '') {
        elements.push(<br key={key++} />);
      } else {
        elements.push(<span key={key++}>{renderInline(line)}<br /></span>);
      }
    }
  }
  flushList();

  return elements;
}

/** Rend le gras **texte** en inline. */
function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

/**
 * @param {{
 *   message: {
 *     role: string,
 *     content: string,
 *     timestamp: number,
 *     isStreaming: boolean,
 *     toolResult: {tool: string, data: object}|null,
 *     pendingConfirmation: {id: string, action_type: string, label: string, expires_at: string}|null,
 *   },
 *   onConfirm: (actionId: string) => void,
 *   onCancel: (actionId: string) => void,
 * }} props
 */
export default function ChatMessage({ message, onConfirm, onCancel, sessionId, userMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'} group/msg`}>
        {/* Auteur */}
        <div
          className={`text-xs text-slate-400 mb-1 ${isUser ? 'text-right' : 'text-left'}`}
        >
          {isUser ? 'Vous' : 'Assistant'}
        </div>

        {/* Bulle texte */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-slate-100 text-slate-800 rounded-tl-sm'
          }`}
        >
          {message.content ? (
            renderMarkdown(message.content)
          ) : null}

          {/* Curseur clignotant pendant le streaming */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-slate-500 ml-0.5 animate-pulse rounded-sm align-middle" />
          )}
        </div>

        {/* ToolResultCard (Iter B) — visible uniquement pour les messages assistant */}
        {!isUser && message.toolResult && (
          <ToolResultCard
            tool={message.toolResult.tool}
            data={message.toolResult.data}
            pendingConfirmation={message.pendingConfirmation}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        )}

        {/* Feedback (Iter E) — apparaît au survol, uniquement sur les messages agent terminés */}
        {!isUser && !message.isStreaming && message.content && (
          <MessageFeedback
            message={message}
            sessionId={sessionId}
            userMessage={userMessage}
          />
        )}

        {/* Horodatage */}
        <div
          className={`text-xs text-slate-300 mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}
        >
          {new Date(message.timestamp).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
