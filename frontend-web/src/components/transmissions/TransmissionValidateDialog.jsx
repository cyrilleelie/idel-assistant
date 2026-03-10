import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function TransmissionValidateDialog({ transmission, open, onClose, onConfirm }) {
  const [confirming, setConfirming] = useState(false);

  if (!open || !transmission) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm(transmission.id);
      onClose();
    } catch {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Valider cette transmission ?</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Une transmission validee ne peut plus etre modifiee. La transcription et la synthese IA seront figees.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {confirming ? 'Validation...' : 'Valider definitivement'}
          </button>
        </div>
      </div>
    </div>
  );
}
