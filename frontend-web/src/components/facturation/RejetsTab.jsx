import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
  Plus,
  Trash2,
  X,
  ChevronDown,
} from 'lucide-react';
import { listRejectedInvoices, rejectInvoice, correctAndResubmit } from '../../api/invoices';
import { formatAmount } from '../../utils/formatting';
import LoadingSpinner from '../ui/LoadingSpinner';
import ErrorBanner from '../ui/ErrorBanner';
import EmptyState from '../ui/EmptyState';

const REJECTION_CODES = [
  { code: 'R01', label: 'R01 — Acte non remboursable' },
  { code: 'R02', label: 'R02 — Ordonnance manquante ou invalide' },
  { code: 'R03', label: 'R03 — Patient non assuré' },
  { code: 'R04', label: 'R04 — Doublon de facturation' },
  { code: 'R05', label: 'R05 — Numéro de facture incorrect' },
  { code: 'R06', label: 'R06 — Montant incorrect' },
  { code: 'R07', label: 'R07 — Acte incompatible' },
  { code: 'R08', label: 'R08 — Période non couverte' },
  { code: 'R09', label: 'R09 — Prestataire non autorisé' },
  { code: 'R99', label: 'R99 — Autre motif' },
];

function RejectionBadge({ correctionInvoiceId }) {
  if (correctionInvoiceId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
        <CheckCircle size={10} /> Corrigé
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
      <AlertCircle size={10} /> Non corrigé
    </span>
  );
}

function EmptyLine() {
  return {
    act_code: '',
    act_label: '',
    coefficient: '1',
    base_rate: '0.00',
    quantity: '1',
    supplements: null,
  };
}

function LineEditor({ lines, onChange }) {
  const addLine = () => onChange([...lines, EmptyLine()]);

  const removeLine = (idx) => onChange(lines.filter((_, i) => i !== idx));

  const updateLine = (idx, field, value) => {
    onChange(lines.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-600">Lignes d'actes</p>
        <button
          type="button"
          onClick={addLine}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          <Plus size={11} /> Ajouter
        </button>
      </div>
      {lines.length === 0 && (
        <p className="text-xs text-slate-400 italic">Aucune ligne. Ajoutez au moins un acte.</p>
      )}
      {lines.map((line, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 mb-0.5">Code</label>
            <input
              type="text"
              value={line.act_code}
              onChange={e => updateLine(idx, 'act_code', e.target.value)}
              placeholder="AMI4"
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="col-span-4">
            <label className="block text-[10px] text-slate-400 mb-0.5">Libellé</label>
            <input
              type="text"
              value={line.act_label}
              onChange={e => updateLine(idx, 'act_label', e.target.value)}
              placeholder="Acte médico-infirmier"
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 mb-0.5">Coeff.</label>
            <input
              type="number"
              value={line.coefficient}
              onChange={e => updateLine(idx, 'coefficient', e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-[10px] text-slate-400 mb-0.5">Tarif</label>
            <input
              type="number"
              value={line.base_rate}
              onChange={e => updateLine(idx, 'base_rate', e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="col-span-1">
            <label className="block text-[10px] text-slate-400 mb-0.5">Qté</label>
            <input
              type="number"
              value={line.quantity}
              onChange={e => updateLine(idx, 'quantity', e.target.value)}
              step="1"
              min="1"
              className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="col-span-1 flex justify-end pb-0.5">
            <button
              type="button"
              onClick={() => removeLine(idx)}
              className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
      {lines.length > 0 && (
        <div className="flex justify-end">
          <span className="text-xs font-semibold text-slate-700">
            Total estimé : {lines.reduce((sum, l) => {
              return sum + (Number(l.coefficient) * Number(l.base_rate) * Number(l.quantity));
            }, 0).toFixed(2)} €
          </span>
        </div>
      )}
    </div>
  );
}

export default function RejetsTab({ onNavigateToJour, onRejetsCountChange }) {
  const [rejets, setRejets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Formulaire de correction inline
  const [correctingId, setCorrectingId] = useState(null);
  const [correctionLines, setCorrectionLines] = useState([]);
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState(null);

  // Modal signalement rejet
  const [signalingId, setSignalingId] = useState(null);
  const [signalingReason, setSignalingReason] = useState('');
  const [signalingCode, setSignalingCode] = useState('');
  const [signalingSubmitting, setSignalingSubmitting] = useState(false);

  const loadRejets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listRejectedInvoices();
      setRejets(data || []);
      const uncorrected = (data || []).filter(r => !r.correction_invoice_id);
      onRejetsCountChange?.(uncorrected.length);
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors du chargement des rejets');
    } finally {
      setLoading(false);
    }
  }, [onRejetsCountChange]);

  useEffect(() => { loadRejets(); }, [loadRejets]);

  const openCorrection = (item) => {
    setCorrectingId(item.invoice.id);
    // Pré-remplit les lignes depuis la facture originale
    setCorrectionLines(
      (item.invoice.lines || []).map(l => ({
        act_code: l.act_code,
        act_label: l.act_label,
        coefficient: String(l.coefficient),
        base_rate: String(l.base_rate),
        quantity: String(l.quantity),
        supplements: l.supplements || null,
      }))
    );
    setCorrectionError(null);
    setSignalingId(null);
  };

  const closeCorrection = () => {
    setCorrectingId(null);
    setCorrectionLines([]);
    setCorrectionError(null);
  };

  const handleCorrect = async (invoiceId) => {
    if (correctionLines.length === 0) {
      setCorrectionError('Ajoutez au moins une ligne d\'acte');
      return;
    }
    setCorrectionSubmitting(true);
    setCorrectionError(null);
    try {
      await correctAndResubmit(invoiceId, {
        lines: correctionLines.map(l => ({
          act_code: l.act_code,
          act_label: l.act_label,
          coefficient: l.coefficient,
          base_rate: l.base_rate,
          quantity: l.quantity,
          supplements: l.supplements,
        })),
      });
      closeCorrection();
      loadRejets();
    } catch (err) {
      setCorrectionError(err.response?.data?.detail || 'Erreur lors de la correction');
    } finally {
      setCorrectionSubmitting(false);
    }
  };

  const openSignaling = (item) => {
    setSignalingId(item.invoice.id);
    setSignalingReason('');
    setSignalingCode('');
    setCorrectingId(null);
  };

  const handleSignal = async () => {
    if (!signalingReason) return;
    setSignalingSubmitting(true);
    try {
      await rejectInvoice(signalingId, {
        rejection_reason: signalingReason,
        rejection_code: signalingCode || undefined,
      });
      setSignalingId(null);
      loadRejets();
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur signalement');
    } finally {
      setSignalingSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size={26} />;
  }

  return (
    <div className="space-y-4">
      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {rejets.length === 0 ? (
        <EmptyState icon={CheckCircle} title="Aucune facture rejetée" description="Toutes les factures sont en ordre." />
      ) : (
        <div className="space-y-3">
          {rejets.map((item) => {
            const inv = item.invoice;
            const isCorrigee = !!item.correction_invoice_id;
            const isCorrectingThis = correctingId === inv.id;
            const isSignalingThis = signalingId === inv.id;

            return (
              <div key={inv.id} className={`bg-white rounded-xl border overflow-hidden ${isCorrigee ? 'border-orange-200' : 'border-red-200'}`}>
                {/* Entête de la carte rejet */}
                <div className={`px-5 py-4 ${isCorrigee ? 'bg-orange-50/50' : 'bg-red-50/40'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isCorrigee ? 'bg-orange-100' : 'bg-red-100'}`}>
                        <FileText size={14} className={isCorrigee ? 'text-orange-600' : 'text-red-600'} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{inv.invoice_number || 'Facture'}</p>
                          <RejectionBadge correctionInvoiceId={item.correction_invoice_id} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Soins du {inv.care_date} · <span className="font-medium text-slate-700">{formatAmount(inv.total_amount)} €</span>
                        </p>
                        {inv.rejection_reason && (
                          <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded bg-red-100 text-red-700 text-xs">
                            <AlertCircle size={10} />
                            {inv.rejection_code && <span className="font-mono font-semibold">{inv.rejection_code}</span>}
                            {inv.rejection_reason}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!isCorrigee && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => isCorrectingThis ? closeCorrection() : openCorrection(item)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                            isCorrectingThis
                              ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                              : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'
                          }`}
                        >
                          {isCorrectingThis ? <><X size={11} /> Fermer</> : 'Corriger'}
                        </button>
                        <button
                          onClick={() => isSignalingThis ? setSignalingId(null) : openSignaling(item)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                            isSignalingThis
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          {isSignalingThis ? 'Fermer' : 'Signaler'}
                        </button>
                      </div>
                    )}
                    {isCorrigee && (
                      <span className="text-xs text-orange-600 font-medium flex-shrink-0">
                        Correction créée
                      </span>
                    )}
                  </div>
                </div>

                {/* Lignes originales */}
                {!isCorrectingThis && !isSignalingThis && inv.lines?.length > 0 && (
                  <div className="px-5 py-3 border-t border-slate-100">
                    <p className="text-xs text-slate-400 mb-2">Lignes d'actes originales</p>
                    <div className="space-y-1">
                      {inv.lines.map((line) => (
                        <div key={line.id} className="flex items-center gap-3 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">{line.act_code}</span>
                          <span className="text-slate-600 flex-1">{line.act_label}</span>
                          <span className="text-slate-500">{formatAmount(line.line_total)} €</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Formulaire de correction inline */}
                {isCorrectingThis && (
                  <div className="px-5 py-4 border-t border-blue-100 bg-blue-50/30">
                    <p className="text-xs font-semibold text-blue-700 mb-3">Nouvelle facture corrective</p>
                    {correctionError && (
                      <div className="mb-3 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-2">
                        <AlertCircle size={12} /> {correctionError}
                      </div>
                    )}
                    <LineEditor lines={correctionLines} onChange={setCorrectionLines} />
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        onClick={closeCorrection}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 rounded hover:bg-slate-200 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleCorrect(inv.id)}
                        disabled={correctionSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {correctionSubmitting ? <RefreshCw size={11} className="animate-spin" /> : null}
                        {correctionSubmitting ? 'Création...' : 'Créer la facture corrective'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulaire de signalement inline */}
                {isSignalingThis && (
                  <div className="px-5 py-4 border-t border-amber-100 bg-amber-50/30">
                    <p className="text-xs font-semibold text-amber-700 mb-3">Mettre à jour le motif de rejet</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Code rejet</label>
                        <select
                          value={signalingCode}
                          onChange={e => setSignalingCode(e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                        >
                          <option value="">— Sélectionner un code —</option>
                          {REJECTION_CODES.map(c => (
                            <option key={c.code} value={c.code}>{c.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Motif libre *</label>
                        <textarea
                          value={signalingReason}
                          onChange={e => setSignalingReason(e.target.value)}
                          rows={2}
                          placeholder="Décrivez le motif de rejet..."
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 resize-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <button
                        onClick={() => setSignalingId(null)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 rounded hover:bg-slate-200 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleSignal}
                        disabled={signalingSubmitting || !signalingReason}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                      >
                        {signalingSubmitting ? <RefreshCw size={11} className="animate-spin" /> : null}
                        {signalingSubmitting ? 'Envoi...' : 'Enregistrer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
