/**
 * Bulle de message dans le chat agent IA.
 * Supporte un rendu Markdown minimal : **gras** et listes à puces.
 */

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
 *   message: {role: string, content: string, timestamp: number, isStreaming: boolean}
 * }} props
 */
export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Auteur */}
        <div
          className={`text-xs text-gray-400 mb-1 ${isUser ? 'text-right' : 'text-left'}`}
        >
          {isUser ? 'Vous' : '🤖 Assistant'}
        </div>

        {/* Bulle */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-800 rounded-tl-sm'
          }`}
        >
          {message.content ? (
            renderMarkdown(message.content)
          ) : null}

          {/* Curseur clignotant pendant le streaming */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-gray-500 ml-0.5 animate-pulse rounded-sm align-middle" />
          )}
        </div>

        {/* Horodatage */}
        <div
          className={`text-xs text-gray-300 mt-0.5 ${isUser ? 'text-right' : 'text-left'}`}
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
