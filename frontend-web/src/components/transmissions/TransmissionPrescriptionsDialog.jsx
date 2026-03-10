import { useState } from 'react';
import { X, Save, Tag } from 'lucide-react';

export default function TransmissionPrescriptionsDialog({
  transmission,
  patientPrescriptions = [],
  open,
  onClose,
  onSave,
}) {
  const autoResolved = (transmission?.prescriptions || []).filter(p => p.is_auto_resolved);
  const manualLinked = (transmission?.prescriptions || []).filter(p => !p.is_auto_resolved);
  const autoIds = new Set(autoResolved.map(p => p.id));
  const initialManualIds = new Set(manualLinked.map(p => p.id));

  const [selectedIds, setSelectedIds] = useState(initialManualIds);
  const [saving, setSaving] = useState(false);

  if (!open || !transmission) return null;

  const toggleId = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Prescriptions available for manual linking (exclude auto-resolved ones)
  const available = patientPrescriptions.filter(p => !autoIds.has(p.id));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(transmission.id, [...selectedIds]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Tag size={18} /> Ordonnances liees
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Auto-resolved links */}
        {autoResolved.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500 mb-2">Liaisons automatiques (depuis le RDV)</p>
            {autoResolved.map(p => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 px-2 bg-slate-50 rounded mb-1 text-sm text-slate-600">
                <input type="checkbox" checked disabled className="rounded border-slate-300 opacity-50" />
                <span>{p.prescriber_name ? `Dr ${p.prescriber_name}` : 'Ordonnance'} — {p.label || p.care_type_codes?.join(', ') || ''}</span>
                <span className="text-xs text-slate-400 ml-auto">[auto]</span>
              </div>
            ))}
          </div>
        )}

        {/* Manual links */}
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Liaisons manuelles</p>
          {available.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Aucune autre ordonnance disponible pour ce patient.</p>
          ) : (
            available.map(p => (
              <label key={p.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-slate-50 rounded cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(p.id)}
                  onChange={() => toggleId(p.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">
                  {p.prescriber_name ? `Dr ${p.prescriber_name}` : 'Ordonnance'} — {p.label || p.act_codes?.join(', ') || ''}
                  {p.start_date ? ` (depuis ${new Date(p.start_date).toLocaleDateString('fr-FR')})` : ''}
                </span>
              </label>
            ))
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
