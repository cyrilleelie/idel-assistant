/**
 * Card de transmission DAR — résultat de structurer_transmission.
 */
import { useState } from 'react';
import { ConfirmationTimer } from '../ToolResultCard';

export default function TransmissionCard({ data, pending, onConfirm, onCancel }) {
  const [expired, setExpired] = useState(false);
  const [editing, setEditing] = useState(false);
  const { dar = {}, alertes = [], has_alerts = false } = data;

  const Section = ({ title, content }) => {
    if (!content) return null;
    return (
      <div className="mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
        <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">{content}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-emerald-500 p-4 mt-2 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📋</span>
        <span className="font-semibold text-emerald-800">Transmission DAR</span>
      </div>

      {/* Alertes cliniques */}
      {has_alerts && alertes.length > 0 && (
        <div className="mb-3 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
          {alertes.map((a, i) => (
            <div key={i} className="text-xs text-orange-700 font-medium">⚠️ {a}</div>
          ))}
        </div>
      )}

      {/* DAR */}
      <div className="bg-slate-50 rounded-lg p-3 mb-3 space-y-2">
        <Section title="D — Données" content={dar.D} />
        <Section title="A — Actions" content={dar.A} />
        <Section title="R — Résultats" content={dar.R} />
      </div>

      {/* Constantes vitales */}
      {dar.constantes && Object.values(dar.constantes).some(Boolean) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(dar.constantes).map(([k, v]) =>
            v ? (
              <span key={k} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                {k}: {v}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Confirmation */}
      {pending && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Enregistrer cette transmission ?</span>
            {!expired && (
              <ConfirmationTimer expiresAt={pending.expires_at} onExpire={() => setExpired(true)} />
            )}
          </div>
          {expired ? (
            <p className="text-xs text-slate-400 text-center">⏳ Délai dépassé — reformule ta demande</p>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onConfirm(pending.id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
              >
                ✓ Enregistrer
              </button>
              <button
                onClick={() => onCancel(pending.id)}
                className="text-xs text-slate-500 hover:text-slate-700 py-1.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
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
