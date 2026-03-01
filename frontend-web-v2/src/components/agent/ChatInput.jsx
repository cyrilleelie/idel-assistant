/**
 * Zone de saisie du chat agent IA.
 * Enter = envoyer, Shift+Enter = nouvelle ligne.
 */
import { useRef, useState } from 'react';
import { Send } from 'lucide-react';

const MAX_CHARS = 2000;

/**
 * @param {{
 *   onSend: (text: string) => void,
 *   disabled: boolean,
 *   placeholder?: string,
 * }} props
 */
export default function ChatInput({ onSend, disabled, placeholder }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  const canSend = text.trim().length > 0 && !disabled && text.length <= MAX_CHARS;

  const handleSend = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const remaining = MAX_CHARS - text.length;

  return (
    <div className="border-t border-gray-200 bg-white p-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'L\'assistant répond...' : (placeholder || 'Posez votre question...')}
            disabled={disabled}
            rows={1}
            className={`w-full resize-none rounded-xl border px-3 py-2 text-sm leading-relaxed outline-none transition-colors
              max-h-32 overflow-y-auto
              ${disabled
                ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-800 border-gray-300 focus:border-blue-400'
              }`}
            style={{ minHeight: '38px', height: 'auto' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          {/* Compteur caractères */}
          {text.length > MAX_CHARS * 0.8 && (
            <span
              className={`absolute bottom-1.5 right-2 text-xs ${
                remaining < 0 ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {remaining}
            </span>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          title="Envoyer (Entrée)"
          className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors
            ${canSend
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            }`}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-1">Shift+Entrée pour aller à la ligne</p>
    </div>
  );
}
