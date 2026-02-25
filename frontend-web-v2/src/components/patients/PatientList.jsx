import { useState, useEffect } from 'react';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import PatientCard from './PatientCard';

const statusFilters = [
  { id: 'active', label: 'Actifs' },
  { id: 'inactive', label: 'Inactifs' },
  { id: 'all', label: 'Tous' },
];

const PAGE_SIZE = 12;

export default function PatientList({ patients, patientSearch, setPatientSearch, openNewPatient, openPatientDetail }) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'active' && p.active === false) return false;
    if (statusFilter === 'inactive' && p.active !== false) return false;
    if (!patientSearch) return true;
    const search = patientSearch.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(search) ||
      p.address.toLowerCase().includes(search);
  });

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / PAGE_SIZE));

  // Reset to page 1 when filters or search change
  useEffect(() => { setPage(1); }, [patientSearch, statusFilter]);

  // Keyboard navigation: arrow left/right to change page
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't navigate when typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft') setPage(p => Math.max(1, p - 1));
      if (e.key === 'ArrowRight') setPage(p => Math.min(totalPages, p + 1));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  // Clamp page if filtered results shrink
  const safePage = Math.min(page, totalPages);
  if (safePage !== page) setPage(safePage);

  const start = (safePage - 1) * PAGE_SIZE;
  const paginatedPatients = filteredPatients.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-semibold text-slate-800">Dossiers Patients</h2>
        <div className="flex w-full sm:w-auto gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher un patient..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            />
          </div>
          <button onClick={openNewPatient} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm whitespace-nowrap">
            <Plus size={18} /> Nouveau Patient
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {statusFilters.map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === f.id ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filteredPatients.length > 0 && (
          <span className="text-xs text-slate-400">
            {filteredPatients.length} patient{filteredPatients.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {paginatedPatients.map(patient => (
          <PatientCard key={patient.id} patient={patient} onClick={() => openPatientDetail(patient)} />
        ))}
        {filteredPatients.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            {statusFilter === 'inactive' ? 'Aucun patient inactif.' : statusFilter === 'active' ? 'Aucun patient actif ne correspond à votre recherche.' : 'Aucun patient ne correspond à votre recherche.'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                n === safePage
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
