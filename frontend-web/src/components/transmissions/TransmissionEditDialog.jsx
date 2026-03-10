import { useState } from 'react';
import { X, Save } from 'lucide-react';

export default function TransmissionEditDialog({ transmission, open, onClose, onSave }) {
  const [text, setText] = useState(transmission?.transcription || '');
  const [regenerate, setRegenerate] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!open || !transmission) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(transmission.id, text, regenerate);
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800">Corriger la transmission</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-3">
          Transmission du {new Date(transmission.created_at).toLocaleDateString('fr-FR')} a {new Date(transmission.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>

        <div className="mb-3">
          <label className="block text-sm font-medium text-slate-700 mb-1">Transcription</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={8}
            maxLength={5000}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
          />
          <p className="text-xs text-slate-400 text-right mt-1">{text.length}/5000</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={regenerate}
            onChange={e => setRegenerate(e.target.checked)}
            className="rounded border-slate-300"
          />
          Regenerer la synthese IA apres correction
        </label>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer la correction'}
          </button>
        </div>
      </div>
    </div>
  );
}
