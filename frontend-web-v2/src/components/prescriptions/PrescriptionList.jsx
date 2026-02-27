import { useState, useEffect } from 'react';
import { FileText, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Pencil } from 'lucide-react';
import { listPrescriptions, renewPrescription } from '../../api/prescriptions';
import PrescriptionDetail from './PrescriptionDetail';
import PrescriptionForm from './PrescriptionForm';

function formatDateFr(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function StatusBadge({ status, daysRemaining }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> Active
      </span>
    );
  }
  if (status === 'expiring') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" />
        Expire dans {daysRemaining ?? '?'} jour{daysRemaining > 1 ? 's' : ''}
      </span>
    );
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
        <AlertTriangle className="w-3 h-3" /> Expirée
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        Terminée
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
        <XCircle className="w-3 h-3" /> Annulée
      </span>
    );
  }
  return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500">{status}</span>;
}

/**
 * Liste des ordonnances d'un patient.
 *
 * Props:
 *   - patientId: UUID (obligatoire)
 *   - patientDoctor: { name, rpps_number } (optionnel) — médecin traitant pour pré-remplissage
 */
export default function PrescriptionList({ patientId, patientDoctor = null }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [editingPrescription, setEditingPrescription] = useState(null);
  const [renewingId, setRenewingId] = useState(null);

  const load = async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listPrescriptions({ patient_id: patientId, limit: 100 });
      setPrescriptions(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError('Erreur lors du chargement des ordonnances');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [patientId]);

  const handleRenew = async (prescription) => {
    if (renewingId) return;
    const ok = window.confirm(
      `Renouveler l'ordonnance "${prescription.care_description}" ?\n\n` +
      `La nouvelle ordonnance commencera le lendemain de la fin de l'actuelle.`
    );
    if (!ok) return;
    setRenewingId(prescription.id);
    try {
      await renewPrescription(prescription.id, {});
      load();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors du renouvellement');
    } finally {
      setRenewingId(null);
    }
  };

  if (editingPrescription) {
    return (
      <PrescriptionForm
        patientId={editingPrescription.patient_id}
        prescription={editingPrescription}
        onSave={() => { setEditingPrescription(null); load(); }}
        onCancel={() => setEditingPrescription(null)}
      />
    );
  }

  if (selectedId) {
    return (
      <PrescriptionDetail
        prescriptionId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Ordonnances</h3>
          {total > 0 && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{total}</span>
          )}
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
          title="Rafraîchir"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Erreur */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-8 text-slate-400 text-sm">Chargement...</div>
      )}

      {/* Empty state */}
      {!loading && !error && prescriptions.length === 0 && (
        <div className="text-center py-10 text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aucune ordonnance enregistrée</p>
          <p className="text-xs mt-1">Les ordonnances sont créées depuis les plans de soins</p>
        </div>
      )}

      {/* Liste */}
      {!loading && prescriptions.length > 0 && (
        <div className="space-y-2">
          {prescriptions.map(p => (
            <div
              key={p.id}
              className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={p.status} daysRemaining={p.days_remaining} />
                    {p.current_renewal > 0 && (
                      <span className="text-xs text-slate-400">
                        Renouvellement {p.current_renewal}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-800 mt-1.5 leading-snug">
                    {p.care_description}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Dr. {p.prescriber_name}
                    {p.prescriber_rpps && ` · RPPS ${p.prescriber_rpps}`}
                    {' · '}{formatDateFr(p.prescription_date)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Du {formatDateFr(p.start_date)}
                    {p.end_date ? ` au ${formatDateFr(p.end_date)}` : ' (durée indéterminée)'}
                    {p.duration_days ? ` · ${p.duration_days} jours` : ''}
                    {p.frequency ? ` · ${p.frequency}` : ''}
                  </p>
                  {p.act_codes?.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-1.5">
                      {p.act_codes.map(c => (
                        <span key={c} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {p.invoices_count > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      {p.invoices_count} facture{p.invoices_count > 1 ? 's' : ''} générée{p.invoices_count > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0 items-end">
                  <button
                    onClick={() => setSelectedId(p.id)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    Voir
                  </button>
                  {p.status !== 'canceled' && (
                    <button
                      onClick={() => setEditingPrescription(p)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
                    >
                      <Pencil className="w-3 h-3" /> Modifier
                    </button>
                  )}
                  {(p.status === 'expiring' || p.status === 'expired') && p.max_renewals > 0 && (
                    <button
                      onClick={() => handleRenew(p)}
                      disabled={renewingId === p.id}
                      className="text-xs text-amber-600 hover:text-amber-800 font-medium disabled:opacity-50"
                    >
                      {renewingId === p.id ? '...' : 'Renouveler'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
