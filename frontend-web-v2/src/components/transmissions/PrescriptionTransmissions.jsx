import { useState, useEffect } from 'react';
import { ArrowRight, FileText } from 'lucide-react';
import { getTransmissionsForPrescription } from '../../api/transmissions';
import TransmissionCard from './TransmissionCard';

export default function PrescriptionTransmissions({
  prescriptionId,
  maxItems = 3,
  onViewAll,
}) {
  const [transmissions, setTransmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prescriptionId) return;
    setLoading(true);
    getTransmissionsForPrescription(prescriptionId, { limit: maxItems })
      .then(res => {
        setTransmissions(res.items || []);
        setTotal(res.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [prescriptionId, maxItems]);

  if (loading) {
    return (
      <div className="mt-3 space-y-2">
        <div className="h-3 bg-slate-200 rounded animate-pulse w-1/3" />
        <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
      </div>
    );
  }

  if (transmissions.length === 0) {
    return (
      <p className="mt-3 text-xs text-slate-400 italic">
        Aucune transmission liee a cette ordonnance.
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
        <FileText size={12} /> Transmissions recentes
      </p>
      <div className="space-y-2">
        {transmissions.map(t => (
          <TransmissionCard key={t.id} transmission={t} compact />
        ))}
      </div>
      {total > maxItems && onViewAll && (
        <button
          onClick={() => onViewAll(prescriptionId)}
          className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          Voir les {total} transmissions liees <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
