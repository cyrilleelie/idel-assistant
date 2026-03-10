import { AlertCircle, X } from 'lucide-react';

export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200">
      <AlertCircle size={16} />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="hover:text-red-900 flex-shrink-0" aria-label="Fermer l'erreur">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
