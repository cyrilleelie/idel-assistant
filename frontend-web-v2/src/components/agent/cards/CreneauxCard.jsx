/**
 * Card de créneaux géo-optimisés — résultat de proposer_creneaux_geooptimises.
 * Cliquer sur un créneau confirme directement.
 */
import { useState } from 'react';
import { ConfirmationTimer } from '../ToolResultCard';

export default function CreneauxCard({ data, pending, onConfirm, onCancel }) {
  const [expired, setExpired] = useState(false);
  const [selected, setSelected] = useState(null);
  const { best_slots = [], care_type = '', duree_minutes = 30 } = data;

  const handleSlotClick = (slot, idx) => {
    if (expired || !pending) return;
    setSelected(idx);
    onConfirm(pending.id);
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-violet-500 p-4 mt-2 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📅</span>
        <span className="font-semibold text-violet-800">Créneaux disponibles</span>
        <span className="ml-auto text-xs text-gray-400">{care_type || 'soin'} — {duree_minutes} min</span>
      </div>

      {best_slots.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-2">Aucun créneau disponible</p>
      ) : (
        <div className="space-y-2 mb-3">
          {best_slots.map((slot, idx) => (
            <button
              key={idx}
              disabled={expired || selected !== null}
              onClick={() => handleSlotClick(slot, idx)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-colors
                ${selected === idx
                  ? 'border-violet-500 bg-violet-50'
                  : expired || selected !== null
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 hover:border-violet-300 hover:bg-violet-50 cursor-pointer'
                }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  {slot.recommended && <span className="text-amber-400 text-xs">⭐</span>}
                  <span className="text-xs font-semibold text-gray-800">{formatDate(slot.date)}</span>
                  <span className="text-xs text-gray-600">{slot.start} — {slot.end}</span>
                </div>
                <span className="text-xs text-gray-400">{slot.proximity_label}</span>
              </div>
              <div className="text-right">
                <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full"
                    style={{ width: `${Math.round((slot.proximity_score || 0) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-300">{Math.round((slot.proximity_score || 0) * 100)}%</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {pending && !expired && selected === null && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">Cliquer sur un créneau pour confirmer</span>
          <ConfirmationTimer expiresAt={pending.expires_at} onExpire={() => setExpired(true)} />
        </div>
      )}
      {expired && (
        <p className="text-xs text-gray-400 text-center">⏳ Délai dépassé — reformule ta demande</p>
      )}
    </div>
  );
}
