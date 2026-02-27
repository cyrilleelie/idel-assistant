import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, AlertTriangle, Clock, Check, RefreshCw, Pencil } from 'lucide-react';
import { getPrescription, getPrescriptionInvoices, renewPrescription } from '../../api/prescriptions';
import PrescriptionForm from './PrescriptionForm';

function formatDateFr(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatMoney(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
}

function StatusBadge({ status, daysRemaining }) {
  const map = {
    active: { cls: 'bg-green-100 text-green-700', label: 'Active', Icon: Check },
    expiring: { cls: 'bg-amber-100 text-amber-700', label: `Expire dans ${daysRemaining ?? '?'} jour${daysRemaining > 1 ? 's' : ''}`, Icon: Clock },
    expired: { cls: 'bg-red-100 text-red-700', label: 'Expirée', Icon: AlertTriangle },
    completed: { cls: 'bg-slate-100 text-slate-500', label: 'Terminée', Icon: null },
    canceled: { cls: 'bg-slate-100 text-slate-500', label: 'Annulée', Icon: null },
  };
  const s = map[status] || { cls: 'bg-slate-100 text-slate-500', label: status, Icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${s.cls}`}>
      {s.Icon && <s.Icon className="w-3.5 h-3.5" />}
      {s.label}
    </span>
  );
}

function InvoiceStatusBadge({ status }) {
  const map = {
    draft: 'bg-slate-100 text-slate-500',
    validated: 'bg-green-100 text-green-700',
    transmitted: 'bg-blue-100 text-blue-700',
    paid: 'bg-emerald-100 text-emerald-700',
    canceled: 'bg-red-100 text-red-600',
    rejected: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  );
}

/**
 * Détail complet d'une ordonnance.
 *
 * Props:
 *   - prescriptionId: UUID
 *   - onBack(): callback pour revenir à la liste
 */
export default function PrescriptionDetail({ prescriptionId, onBack }) {
  const [prescription, setPrescription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [renewing, setRenewing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, inv] = await Promise.all([
        getPrescription(prescriptionId),
        getPrescriptionInvoices(prescriptionId),
      ]);
      setPrescription(p);
      setInvoices(Array.isArray(inv) ? inv : []);
    } catch {
      setError('Impossible de charger l\'ordonnance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [prescriptionId]);

  const handleRenew = async () => {
    if (renewing) return;
    const ok = window.confirm(
      'Renouveler cette ordonnance ?\n\nL\'ancienne sera marquée comme terminée et une nouvelle sera créée.'
    );
    if (!ok) return;
    setRenewing(true);
    try {
      await renewPrescription(prescriptionId, {});
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors du renouvellement');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-slate-400 text-sm">Chargement...</div>
    );
  }

  if (error || !prescription) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Retour
        </button>
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
          {error || 'Ordonnance introuvable'}
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <PrescriptionForm
        patientId={prescription.patient_id}
        prescription={prescription}
        onSave={() => { setEditing(false); load(); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // Calcul de la barre de progression
  const totalEstimated = prescription.duration_days || null;
  const progress = totalEstimated && invoices.length > 0
    ? Math.min(100, Math.round((invoices.length / totalEstimated) * 100))
    : null;

  const canRenew = (prescription.status === 'expiring' || prescription.status === 'expired') &&
    (prescription.max_renewals === 0 || prescription.current_renewal < prescription.max_renewals);

  return (
    <div className="space-y-5">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Retour aux ordonnances
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {prescription.status !== 'canceled' && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              <Pencil className="w-3.5 h-3.5" /> Modifier
            </button>
          )}
          {canRenew && (
            <button
              onClick={handleRenew}
              disabled={renewing}
              className="flex items-center gap-1 px-4 py-1.5 bg-amber-500 text-white text-sm rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {renewing ? 'Renouvellement...' : 'Renouveler'}
            </button>
          )}
        </div>
      </div>

      {/* Statut */}
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-indigo-500" />
        <div>
          <StatusBadge status={prescription.status} daysRemaining={prescription.days_remaining} />
        </div>
        {prescription.current_renewal > 0 && (
          <span className="text-sm text-slate-400">Renouvellement n°{prescription.current_renewal}</span>
        )}
      </div>

      {/* Alerte si expiration proche ou dépassée */}
      {prescription.status === 'expiring' && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-700">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Cette ordonnance expire dans <strong>{prescription.days_remaining} jour{prescription.days_remaining > 1 ? 's' : ''}</strong>.
            {canRenew ? ' Pensez à demander un renouvellement au médecin.' : ''}
          </span>
        </div>
      )}
      {prescription.status === 'expired' && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Cette ordonnance est expirée depuis le <strong>{formatDateFr(prescription.end_date)}</strong>.
            Les factures émises après cette date pourraient être rejetées par la CPAM.
          </span>
        </div>
      )}

      {/* Informations principales */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Prescripteur</h4>
          <p className="text-sm font-medium text-slate-800">Dr. {prescription.prescriber_name}</p>
          {prescription.prescriber_rpps && (
            <p className="text-xs text-slate-400 mt-0.5">RPPS : {prescription.prescriber_rpps}</p>
          )}
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Soins prescrits</h4>
          <p className="text-sm text-slate-700">{prescription.care_description}</p>
          {prescription.frequency && (
            <p className="text-xs text-slate-400 mt-1">Fréquence : {prescription.frequency}</p>
          )}
          {prescription.act_codes?.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-2">
              {prescription.act_codes.map(c => (
                <span key={c} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Période</h4>
            <p className="text-sm text-slate-700">
              Du {formatDateFr(prescription.start_date)}
              {prescription.end_date ? ` au ${formatDateFr(prescription.end_date)}` : ' (indéterminée)'}
            </p>
            {prescription.duration_days && (
              <p className="text-xs text-slate-400">{prescription.duration_days} jours prescrits</p>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Date ordonnance</h4>
            <p className="text-sm text-slate-700">{formatDateFr(prescription.prescription_date)}</p>
          </div>
        </div>

        {prescription.max_renewals > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Renouvellements</h4>
            <p className="text-sm text-slate-700">
              {prescription.current_renewal} / {prescription.max_renewals} effectué(s)
            </p>
          </div>
        )}

        {prescription.notes && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Notes</h4>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{prescription.notes}</p>
          </div>
        )}
      </div>

      {/* Barre de progression des séances */}
      {invoices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Avancement des soins
          </h4>
          {progress !== null ? (
            <>
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>{invoices.length} séance{invoices.length > 1 ? 's' : ''} facturée{invoices.length > 1 ? 's' : ''}</span>
                <span>{totalEstimated} jour{totalEstimated > 1 ? 's' : ''} prescrits</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{progress}% réalisé</p>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              {invoices.length} facture{invoices.length > 1 ? 's' : ''} générée{invoices.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Liste des factures */}
      {invoices.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">
            Factures associées ({invoices.length})
          </h4>
          <div className="space-y-2">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <span className="text-sm font-mono text-slate-700">{inv.invoice_number || 'Brouillon'}</span>
                  <span className="text-xs text-slate-400 ml-2">{formatDateFr(inv.care_date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <InvoiceStatusBadge status={inv.status} />
                  <span className="text-sm font-medium text-slate-700">{formatMoney(inv.total_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoices.length === 0 && (
        <div className="bg-white border border-slate-100 rounded-xl p-5 text-center text-slate-400 text-sm">
          Aucune facture générée pour cette ordonnance
        </div>
      )}

      {/* Lien document */}
      {prescription.document_url && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Document scanné</h4>
          <a
            href={prescription.document_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:underline"
          >
            Voir l'ordonnance originale
          </a>
        </div>
      )}
    </div>
  );
}
