import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'draft', label: 'Brouillon' },
  { value: 'pending_transcription', label: 'En cours de transcription' },
  { value: 'transcribed', label: 'Transcrit' },
  { value: 'completed', label: 'Complet' },
  { value: 'validated', label: 'Valide' },
];

export default function TransmissionFiltersBar({
  filters,
  onFiltersChange,
  prescriptions = [],
  authors = [],
}) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        onFiltersChange({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const update = (key, value) => {
    onFiltersChange({ ...filters, [key]: value || undefined });
  };

  const hasActiveFilters = filters.prescription_id || filters.author_user_id || filters.status || filters.date_from || filters.date_to || filters.search;

  const resetFilters = () => {
    setSearchInput('');
    onFiltersChange({ patient_id: filters.patient_id });
  };

  return (
    <div className="space-y-3 bg-slate-50 rounded-lg p-4 border border-slate-200">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Rechercher dans les transmissions..."
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Prescription filter */}
        {prescriptions.length > 0 && (
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Ordonnance</label>
            <select
              value={filters.prescription_id || ''}
              onChange={e => update('prescription_id', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Toutes</option>
              {prescriptions.map(p => (
                <option key={p.id} value={p.id}>
                  {p.prescriber_name ? `Dr ${p.prescriber_name}` : 'Ordonnance'} — {p.label || p.act_codes?.join(', ') || ''}
                  {p.start_date ? ` (depuis ${new Date(p.start_date).toLocaleDateString('fr-FR')})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Author filter */}
        {authors.length > 1 && (
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Auteur</label>
            <select
              value={filters.author_user_id || ''}
              onChange={e => update('author_user_id', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Tous</option>
              {authors.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Status filter */}
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Statut</label>
          <select
            value={filters.status || ''}
            onChange={e => update('status', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="min-w-[130px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Du</label>
          <input
            type="date"
            value={filters.date_from || ''}
            onChange={e => update('date_from', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="min-w-[130px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Au</label>
          <input
            type="date"
            value={filters.date_to || ''}
            onChange={e => update('date_to', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs px-3 py-2 text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1"
          >
            <X size={14} /> Reinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
