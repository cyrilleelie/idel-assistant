/**
 * Card de réoptimisation de tournée — résultat de reoptimize_tournee.
 */
import { useState } from 'react';
import { ConfirmationTimer } from '../ToolResultCard';

export default function TourneeReoptCard({ data, pending, onConfirm, onCancel }) {
  const [expired, setExpired] = useState(false);
  const { avant = {}, apres = {}, economies = {}, nouveau_ordre = [], cancelled_stop = {} } = data;

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-amber-500 p-4 mt-2 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🗺️</span>
        <span className="font-semibold text-amber-800">Réoptimisation tournée</span>
      </div>

      {/* Stop annulé */}
      {cancelled_stop.order && (
        <div className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-3">
          ✗ Passage #{cancelled_stop.order} retiré
        </div>
      )}

      {/* Métriques avant/après */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Avant</div>
          <div className="text-sm font-semibold text-gray-700">{avant.total_stops || 0} arrêts</div>
          <div className="text-xs text-gray-500">{avant.distance_km || 0} km</div>
          <div className="text-xs text-gray-400">{avant.duration_min || 0} min</div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className="text-green-600 text-xs font-semibold">-{economies.distance_km || 0} km</div>
          <div className="text-green-600 text-xs">-{economies.duration_min || 0} min</div>
          <span className="text-gray-300 text-lg">→</span>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Après</div>
          <div className="text-sm font-semibold text-green-700">{apres.total_stops || 0} arrêts</div>
          <div className="text-xs text-green-600">{apres.distance_km || 0} km</div>
          <div className="text-xs text-green-500">{apres.duration_min || 0} min</div>
        </div>
      </div>

      {/* Nouvel ordre */}
      {nouveau_ordre.length > 0 && (
        <div className="mb-3 space-y-0.5">
          <div className="text-xs text-gray-400 mb-1">Nouvel ordre de passages</div>
          {nouveau_ordre.map((s, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs py-0.5 ${s.changed ? 'text-amber-700' : 'text-gray-600'}`}>
              <span className="w-5 text-right font-mono text-gray-400">{s.order}.</span>
              {s.changed && <span className="text-amber-400">✦</span>}
              <span className="font-mono text-gray-400 text-xs">{s.appointment_id.slice(0, 8)}…</span>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation */}
      {pending && (
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Valider la réoptimisation ?</span>
            {!expired && (
              <ConfirmationTimer expiresAt={pending.expires_at} onExpire={() => setExpired(true)} />
            )}
          </div>
          {expired ? (
            <p className="text-xs text-gray-400 text-center">⏳ Délai dépassé — reformule ta demande</p>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm(pending.id)}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
              >
                ✓ Valider
              </button>
              <button
                onClick={() => onCancel(pending.id)}
                className="text-xs text-gray-500 hover:text-gray-700 py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ✗ Annuler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
