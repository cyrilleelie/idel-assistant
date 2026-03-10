import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import LoadingSpinner from '../ui/LoadingSpinner';
import {
  listTransmissions,
  updateTransmission,
  validateTransmission,
  regenerateSynthesis,
  updateTransmissionPrescriptions,
} from '../../api/transmissions';
import { listPrescriptions } from '../../api/prescriptions';
import TransmissionCard from './TransmissionCard';
import TransmissionFiltersBar from './TransmissionFiltersBar';
import TransmissionEditDialog from './TransmissionEditDialog';
import TransmissionValidateDialog from './TransmissionValidateDialog';
import TransmissionPrescriptionsDialog from './TransmissionPrescriptionsDialog';

const PAGE_SIZE = 20;

function groupByMonth(transmissions) {
  const groups = {};
  for (const t of transmissions) {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, items: [] };
    groups[key].items.push(t);
  }
  // Sort by key descending
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, v]) => v);
}

export default function TransmissionsTab({ patientId, nurses = [], initialPrescriptionFilter }) {
  const [filters, setFilters] = useState({
    patient_id: patientId,
    ...(initialPrescriptionFilter ? { prescription_id: initialPrescriptionFilter } : {}),
  });
  const [transmissions, setTransmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const [prescriptions, setPrescriptions] = useState([]);

  // Dialogs
  const [editTarget, setEditTarget] = useState(null);
  const [validateTarget, setValidateTarget] = useState(null);
  const [prescDialogTarget, setPrescDialogTarget] = useState(null);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Reset filters when patient changes
  useEffect(() => {
    setFilters({
      patient_id: patientId,
      ...(initialPrescriptionFilter ? { prescription_id: initialPrescriptionFilter } : {}),
    });
  }, [patientId]);

  // Apply initialPrescriptionFilter when it changes
  useEffect(() => {
    if (initialPrescriptionFilter) {
      setFilters(f => ({ ...f, prescription_id: initialPrescriptionFilter }));
    }
  }, [initialPrescriptionFilter]);

  // Load prescriptions for filter dropdown
  useEffect(() => {
    listPrescriptions({ patient_id: patientId, limit: 100 })
      .then(res => setPrescriptions(res.items || []))
      .catch(() => {});
  }, [patientId]);

  // Load transmissions
  const fetchData = useCallback(async (resetOffset = true) => {
    try {
      if (resetOffset) setLoading(true);
      else setLoadingMore(true);

      const currentOffset = resetOffset ? 0 : offset;
      const res = await listTransmissions({ ...filters, skip: currentOffset, limit: PAGE_SIZE });

      if (resetOffset) {
        setTransmissions(res.items || []);
        setOffset(PAGE_SIZE);
      } else {
        setTransmissions(prev => [...prev, ...(res.items || [])]);
        setOffset(prev => prev + PAGE_SIZE);
      }
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load transmissions:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, offset]);

  // Fetch on filter change
  useEffect(() => {
    fetchData(true);
  }, [filters]);

  // Author name lookup
  const getAuthorName = (idelId) => {
    const n = nurses.find(n => n.id === idelId);
    return n ? `${n.first_name || ''} ${n.last_name || ''}`.trim() : null;
  };

  // Actions
  const handleSaveEdit = async (id, text, shouldRegenerate) => {
    await updateTransmission(id, { transcription: text });
    if (shouldRegenerate) {
      await regenerateSynthesis(id);
      showToast('Transmission corrigee, synthese IA en cours...', 'info');
    } else {
      showToast('Transmission corrigee');
    }
    fetchData(true);
  };

  const handleValidate = async (id) => {
    await validateTransmission(id);
    showToast('Transmission validee');
    fetchData(true);
  };

  const handleRegenerate = async (t) => {
    try {
      await regenerateSynthesis(t.id);
      showToast('Synthese IA en cours de regeneration...', 'info');
      fetchData(true);
    } catch (err) {
      showToast('Erreur lors de la regeneration', 'error');
    }
  };

  const handleSavePrescriptions = async (id, prescriptionIds) => {
    await updateTransmissionPrescriptions(id, prescriptionIds);
    showToast('Ordonnances liees mises a jour');
    fetchData(true);
  };

  // Stats
  const countByStatus = (s) => transmissions.filter(t => t.status === s).length;
  const monthGroups = groupByMonth(transmissions);
  const hasMore = transmissions.length < total;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-white shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        }`}>
          {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'} {toast.message}
        </div>
      )}

      {/* Filters */}
      <TransmissionFiltersBar
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Stats line */}
      {!loading && total > 0 && (
        <p className="text-sm text-slate-500">
          {total} transmission{total > 1 ? 's' : ''}
          {countByStatus('validated') > 0 && ` · ${countByStatus('validated')} validee${countByStatus('validated') > 1 ? 's' : ''}`}
          {(countByStatus('pending_transcription') + countByStatus('pending_synthesis')) > 0 && ` · ${countByStatus('pending_transcription') + countByStatus('pending_synthesis')} en cours`}
        </p>
      )}

      {/* Loading state */}
      {loading && <LoadingSpinner />}

      {/* Empty state */}
      {!loading && transmissions.length === 0 && (() => {
        const hasActiveFilters = !!(filters.search || filters.prescription_id || filters.status || filters.author_user_id || filters.date_from);
        return (
          <div>
            <EmptyState
              icon={FileText}
              title={hasActiveFilters ? 'Aucune transmission ne correspond aux filtres.' : 'Aucune transmission pour ce patient.'}
            />
            {hasActiveFilters && (
              <div className="text-center -mt-8">
                <button
                  onClick={() => setFilters({ patient_id: patientId })}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Reinitialiser les filtres
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Timeline grouped by month */}
      {!loading && monthGroups.map((group, gi) => (
        <div key={gi}>
          <div className="flex items-center gap-3 my-4">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{group.label}</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>
          <div className="space-y-3">
            {group.items.map(t => (
              <TransmissionCard
                key={t.id}
                transmission={t}
                authorName={getAuthorName(t.idel_id)}
                onEdit={() => setEditTarget(t)}
                onValidate={() => setValidateTarget(t)}
                onRegenerateSynthesis={() => handleRegenerate(t)}
                onManagePrescriptions={() => setPrescDialogTarget(t)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load more */}
      {hasMore && !loading && (
        <div className="text-center pt-2">
          <button
            onClick={() => fetchData(false)}
            disabled={loadingMore}
            className="text-sm text-blue-600 hover:text-blue-800 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 mx-auto"
          >
            {loadingMore && <Loader2 size={14} className="animate-spin" />}
            {loadingMore ? 'Chargement...' : `Charger plus (${transmissions.length}/${total})`}
          </button>
        </div>
      )}

      {/* Dialogs */}
      <TransmissionEditDialog
        transmission={editTarget}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
      />
      <TransmissionValidateDialog
        transmission={validateTarget}
        open={!!validateTarget}
        onClose={() => setValidateTarget(null)}
        onConfirm={handleValidate}
      />
      <TransmissionPrescriptionsDialog
        transmission={prescDialogTarget}
        patientPrescriptions={prescriptions}
        open={!!prescDialogTarget}
        onClose={() => setPrescDialogTarget(null)}
        onSave={handleSavePrescriptions}
      />
    </div>
  );
}
