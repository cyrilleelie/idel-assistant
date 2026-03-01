/**
 * Card de cotation NGAP — résultat de analyser_et_coter.
 * Affiche les lignes de cotation avec confirmation.
 */
import { useState } from 'react';
import { ConfirmationTimer } from '../ToolResultCard';

export default function CotationCard({ data, pending, onConfirm, onCancel }) {
  const [expired, setExpired] = useState(false);
  const { lignes = [], total = 0, actes_detectes = [], explications = [], auto_corrections = [] } = data;

  return (
    <div className="bg-white rounded-xl border border-blue-200 shadow-sm border-l-4 border-l-blue-500 p-4 mt-2 text-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">💰</span>
        <span className="font-semibold text-blue-800">Cotation NGAP</span>
        <span className="ml-auto text-xs text-gray-400">{actes_detectes.join(', ')}</span>
      </div>

      {/* Table des lignes */}
      <table className="w-full text-xs mb-3">
        <thead>
          <tr className="text-gray-400 border-b border-gray-100">
            <th className="text-left pb-1 font-medium">Code</th>
            <th className="text-left pb-1 font-medium">Libellé</th>
            <th className="text-right pb-1 font-medium">Montant</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-gray-50">
              <td className="py-1 font-mono text-blue-700">{l.code}</td>
              <td className="py-1 text-gray-600 max-w-[120px] truncate">{l.label}</td>
              <td className="py-1 text-right font-medium">{l.montant.toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="pt-2 font-semibold text-gray-800">Total</td>
            <td className="pt-2 text-right font-bold text-blue-700">{total.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>

      {/* Explications / corrections */}
      {auto_corrections.length > 0 && (
        <div className="mb-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1">
          {auto_corrections.map((c, i) => <div key={i}>⚠️ {c}</div>)}
        </div>
      )}
      {explications.length > 0 && (
        <div className="mb-3 text-xs text-gray-400">
          {explications.map((e, i) => <div key={i}>ℹ {e}</div>)}
        </div>
      )}

      {/* Confirmation */}
      {pending && (
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Créer le brouillon de facture ?</span>
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
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition-colors"
              >
                ✓ Créer la facture
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
