import { useState, useEffect } from 'react';
import { X, CreditCard, RefreshCw, AlertCircle } from 'lucide-react';
import { listUnpaidInvoices, markInvoicesPaid } from '../../api/invoices';

function fmt(v) { return Number(v ?? 0).toFixed(2); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MarkPaidModal({ period, preselectedInvoice, onClose, onSuccess }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [reference, setReference] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (preselectedInvoice) {
          // Pré-sélection d'une seule facture
          setInvoices([preselectedInvoice]);
          setSelectedIds(new Set([preselectedInvoice.id]));
        } else {
          const data = await listUnpaidInvoices({ limit: 100 });
          const items = Array.isArray(data) ? data : data.items || [];
          setInvoices(items);
          setSelectedIds(new Set(items.map(i => i.id)));
        }
      } catch {
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [preselectedInvoice]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedTotal = invoices
    .filter(i => selectedIds.has(i.id))
    .reduce((sum, i) => sum + Number(i.total_amount ?? 0), 0);

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await markInvoicesPaid({
        invoice_ids: [...selectedIds],
        payment_date: paymentDate,
        payment_reference: reference || undefined,
      });
      if (result.errors?.length > 0 && result.marked_paid === 0) {
        setError(result.errors.join(' | '));
      } else {
        onSuccess?.();
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement du paiement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-800">Enregistrer un paiement</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Liste des factures */}
          {loading ? (
            <div className="flex justify-center py-6">
              <RefreshCw size={22} className="animate-spin text-slate-300" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucune facture en attente de paiement</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {invoices.map((inv) => (
                <label
                  key={inv.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedIds.has(inv.id)
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inv.id)}
                    onChange={() => toggleSelect(inv.id)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{inv.invoice_number || '—'}</p>
                    <p className="text-xs text-slate-500">{inv.care_date}</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{fmt(inv.total_amount)} €</span>
                </label>
              ))}
            </div>
          )}

          {/* Total sélectionné */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between text-sm font-semibold text-slate-700 bg-slate-50 rounded-lg px-4 py-2.5">
              <span>Total sélectionné ({selectedIds.size})</span>
              <span className="text-emerald-700">{selectedTotal.toFixed(2)} €</span>
            </div>
          )}

          {/* Date de paiement */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de paiement *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={e => setPaymentDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          {/* Référence */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Référence (optionnel)</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="Ex : VIREMENT-2026-03"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedIds.size === 0 || !paymentDate}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
            {submitting ? 'Enregistrement...' : `Valider le paiement`}
          </button>
        </div>
      </div>
    </div>
  );
}
