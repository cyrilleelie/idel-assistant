import { useState, useEffect } from 'react';
import { FileText, RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Pencil, ExternalLink, FileWarning } from 'lucide-react';
import { listPrescriptions, createPrescription } from '../../api/prescriptions';
import client from '../../api/client';
import PrescriptionForm from './PrescriptionForm';
import PrescriptionTransmissions from '../transmissions/PrescriptionTransmissions';

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
export default function PrescriptionList({ patientId, patientDoctor = null, onViewTransmissions }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
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

  const handleOpenDocument = async (prescription) => {
    try {
      const response = await client.get(`/prescriptions/${prescription.id}/document`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: response.headers['content-type'] });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      alert('Impossible d\'ouvrir le document.');
    }
  };

  const handleRenew = async (prescription) => {
    if (renewingId) return;
    const ok = window.confirm(
      `Renouveler l'ordonnance "${prescription.label || prescription.care_description || 'Ordonnance'}" ?\n\n` +
      `Une nouvelle ordonnance sera créée avec les mêmes paramètres (sans les dates ni le document).`
    );
    if (!ok) return;
    setRenewingId(prescription.id);
    try {
      const today = new Date().toISOString().split('T')[0];
      await createPrescription({
        patient_id: prescription.patient_id,
        label: prescription.label || '',
        care_label_code: prescription.care_label_code || null,
        duration_minutes: prescription.duration_minutes || 30,
        frequency_display: prescription.frequency_display || 'daily',
        custom_frequency: prescription.custom_frequency || '',
        preferred_slot: prescription.preferred_slot || '',
        recurrence_rule: prescription.recurrence_rule || '',
        care_location: prescription.care_location || 'domicile',
        prescriber_name: prescription.prescriber_name || null,
        prescriber_rpps: prescription.prescriber_rpps || null,
        prescription_date: today,
        start_date: today,
        duration_days: prescription.duration_days || null,
        care_description: prescription.care_description || null,
        act_codes: prescription.act_codes || [],
        frequency: prescription.frequency || null,
        max_renewals: prescription.max_renewals || 0,
        notes: prescription.notes || null,
      });
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
                    {p.label || 'Ordonnance'}
                  </p>
                  {(p.care_description || p.notes) && (
                    <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                      {p.care_description || p.notes}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    Dr. {p.prescriber_name}
                    {p.prescriber_rpps && ` · RPPS ${p.prescriber_rpps}`}
                    {' · Prescrit le '}{formatDateFr(p.prescription_date)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Du {formatDateFr(p.start_date)}
                    {p.end_date ? ` au ${formatDateFr(p.end_date)}` : ' (durée indéterminée)'}
                    {p.duration_days ? ` · ${p.duration_days} jours` : ''}
                    {p.frequency ? ` · ${p.frequency}` : ''}
                  </p>
                  {p.document_url ? (
                    <button
                      type="button"
                      onClick={() => handleOpenDocument(p)}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {p.document_filename || 'Voir le document'}
                    </button>
                  ) : (
                    <p className="inline-flex items-center gap-1 text-xs text-amber-600 mt-1.5">
                      <FileWarning className="w-3 h-3" />
                      Document manquant
                    </p>
                  )}
                  {p.invoices_count > 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      {p.invoices_count} facture{p.invoices_count > 1 ? 's' : ''} générée{p.invoices_count > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0 items-end">
                  {p.status !== 'canceled' && p.status !== 'expired' && (
                    <button
                      onClick={() => setEditingPrescription(p)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-medium"
                    >
                      <Pencil className="w-3 h-3" /> Modifier
                    </button>
                  )}
                  {p.status === 'expired' && (
                    <button
                      onClick={() => handleRenew(p)}
                      disabled={renewingId === p.id}
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {renewingId === p.id ? '...' : 'Renouveler'}
                    </button>
                  )}
                </div>
              </div>
              <PrescriptionTransmissions
                prescriptionId={p.id}
                maxItems={3}
                onViewAll={onViewTransmissions}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
