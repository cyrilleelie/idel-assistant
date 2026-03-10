/**
 * Card d'interprétation d'ordonnance — résultat de interpreter_ordonnance.
 */
import { useState } from 'react';
import { ConfirmationTimer } from '../ToolResultCard';

export default function OrdonnanceCard({ data, pending, onConfirm, onCancel }) {
  const [expired, setExpired] = useState(false);
  const {
    actes = [],
    total_visites = 0,
    montant_total_estime = 0,
    date_debut = '',
    observations = '',
  } = data;

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-teal-500 p-4 mt-2 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">📄</span>
        <span className="font-semibold text-teal-800">Interprétation ordonnance</span>
        {date_debut && (
          <span className="ml-auto text-xs text-slate-400">Début {formatDate(date_debut)}</span>
        )}
      </div>

      {/* Actes */}
      <div className="space-y-2 mb-3">
        {actes.map((a, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="font-mono text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded shrink-0">{a.code_ngap}</span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-700 truncate">{a.description}</div>
              <div className="text-slate-400">{a.frequence} — {a.nb_visites} visites</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-medium text-slate-700">{(a.montant_estime || 0).toFixed(2)} €</div>
            </div>
          </div>
        ))}
      </div>

      {/* Observations */}
      {observations && (
        <div className="mb-3 text-xs text-slate-500 bg-slate-50 rounded px-2 py-1.5">
          ℹ {observations}
        </div>
      )}

      {/* Totaux */}
      <div className="flex items-center justify-between text-xs mb-3 border-t border-slate-100 pt-2">
        <span className="text-slate-500">{total_visites} RDV à planifier</span>
        <span className="font-bold text-teal-700">{montant_total_estime.toFixed(2)} € estimés</span>
      </div>

      {/* Confirmation */}
      {pending && (
        <div className="border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500">Créer les {total_visites} RDV ?</span>
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
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
              >
                ✓ Créer les {total_visites} RDV
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
