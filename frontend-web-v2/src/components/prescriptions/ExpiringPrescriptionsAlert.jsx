import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';
import { getExpiringPrescriptions } from '../../api/prescriptions';

function formatDateFr(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Bandeau d'alerte pour les ordonnances expirant bientôt.
 * Se charge automatiquement. Peut être réduit par l'utilisateur.
 *
 * Props:
 *   - daysAhead: number (défaut 7) — nombre de jours pour l'alerte
 *   - onSelectPrescription(id): callback optionnel pour naviguer vers une ordonnance
 */
export default function ExpiringPrescriptionsAlert({ daysAhead = 7, onSelectPrescription }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getExpiringPrescriptions(daysAhead)
      .then(data => { if (mounted) setItems(Array.isArray(data) ? data : []); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [daysAhead]);

  if (loading || dismissed || items.length === 0) return null;

  const expired = items.filter(i => i.prescription?.status === 'expired' || i.days_remaining < 0);
  const expiring = items.filter(i => i.prescription?.status === 'expiring' || (i.days_remaining >= 0));

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800">
            {items.length} ordonnance{items.length > 1 ? 's' : ''} à surveiller
          </span>
          {expired.length > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {expired.length} expirée{expired.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-amber-100 text-amber-500"
            title={expanded ? 'Réduire' : 'Développer'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-amber-100 text-amber-400"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenu déroulable */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {items.map(item => {
            const p = item.prescription;
            const isExpired = p?.status === 'expired' || item.days_remaining < 0;
            return (
              <div
                key={p?.id}
                className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-sm border ${
                  isExpired
                    ? 'bg-red-50 border-red-100'
                    : 'bg-white border-amber-100'
                }`}
              >
                <div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mr-2 ${
                    isExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isExpired ? (
                      <><AlertTriangle className="w-3 h-3" /> Expirée</>
                    ) : (
                      <><Clock className="w-3 h-3" /> {item.days_remaining} j restant{item.days_remaining > 1 ? 's' : ''}</>
                    )}
                  </span>
                  <span className="font-medium text-slate-700">{item.patient_name}</span>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {p?.care_description}
                    {p?.end_date ? ` · Fin : ${formatDateFr(p.end_date)}` : ''}
                  </p>
                  {item.invoices_count > 0 && (
                    <p className="text-xs text-slate-400">{item.invoices_count} facture{item.invoices_count > 1 ? 's' : ''}</p>
                  )}
                </div>
                {onSelectPrescription && p?.id && (
                  <button
                    onClick={() => onSelectPrescription(p.id)}
                    className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Voir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
