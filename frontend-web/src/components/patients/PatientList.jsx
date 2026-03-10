import { useState, useEffect } from 'react';
import { Search, UserPlus, ChevronLeft, ChevronRight, Edit, ToggleLeft, ToggleRight, AlertTriangle } from 'lucide-react';
import { listCareProtocols } from '../../api/care-protocols';

const statusFilters = [
  { id: 'all', label: 'Tous' },
  { id: 'active', label: 'Actifs' },
  { id: 'inactive', label: 'Inactifs' },
];

const PAGE_SIZE = 12;

export default function PatientList({ patients, patientSearch, setPatientSearch, openNewPatient, openPatientDetail, selectedPatientId, deactivatePatient, reactivatePatient, setPatientSubTab }) {
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [toggleAlert, setToggleAlert] = useState(null); // { patientId, message }
  const [toggleLoading, setToggleLoading] = useState(null); // patientId

  const handleToggleActive = async (e, patient) => {
    e.stopPropagation();
    const isInactive = patient.active === false;

    if (isInactive) {
      // Reactivate — no check needed
      await reactivatePatient(patient.id);
      return;
    }

    // Deactivate — check for active care protocols
    setToggleLoading(patient.id);
    try {
      const data = await listCareProtocols({ patient_id: patient.id, status: 'active', limit: 1 });
      if (data.items && data.items.length > 0) {
        setToggleAlert({ patientId: patient.id, message: `${patient.firstName} ${patient.lastName} a des plans de soins actifs. Terminez-les avant de désactiver le patient.` });
        // Open drawer on prescriptions section
        setPatientSubTab('prescriptions');
        openPatientDetail(patient);
      } else {
        const ok = window.confirm(`Désactiver ${patient.firstName} ${patient.lastName} ?`);
        if (ok) await deactivatePatient(patient.id);
      }
    } catch {
      const ok = window.confirm(`Désactiver ${patient.firstName} ${patient.lastName} ?`);
      if (ok) await deactivatePatient(patient.id);
    } finally {
      setToggleLoading(null);
    }
  };

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

  // Extract commune from address (last part after comma usually)
  const extractCommune = (address) => {
    if (!address) return '-';
    const parts = address.split(',').map(s => s.trim());
    if (parts.length >= 2) {
      // Try to get city from last part (might have postal code)
      const last = parts[parts.length - 1];
      const cityMatch = last.match(/\d{5}\s+(.+)/);
      if (cityMatch) return cityMatch[1];
      return last;
    }
    return address.length > 30 ? address.substring(0, 30) + '...' : address;
  };

  const formatBirthDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const age = now.getFullYear() - d.getFullYear() - (
        now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0
      );
      return { date: d.toLocaleDateString('fr-FR'), age };
    } catch {
      return { date: dateStr, age: null };
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Annuaire des Patients</h1>
          <p className="text-slate-500 text-sm">Gerez votre base de patients et leurs dossiers medicaux</p>
        </div>
        <button
          onClick={openNewPatient}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-colors whitespace-nowrap"
        >
          <UserPlus size={18} /> Nouveau patient
        </button>
      </div>

      {/* Filters bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un patient..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-colors"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {statusFilters.map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
                statusFilter === f.id
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Alert banner */}
      {toggleAlert && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{toggleAlert.message}</p>
          </div>
          <button onClick={() => setToggleAlert(null)} className="text-amber-400 hover:text-amber-600 text-sm font-bold shrink-0">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Date de naissance</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Commune</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Telephone</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedPatients.map(patient => {
              const isSelected = selectedPatientId === patient.id;
              const isInactive = patient.active === false;
              const birthInfo = formatBirthDate(patient._apiBirthDate);

              return (
                <tr
                  key={patient.id}
                  onClick={() => openPatientDetail(patient)}
                  className={`
                    hover:bg-primary/5 transition-colors cursor-pointer
                    ${isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}
                    ${isInactive ? 'opacity-60' : ''}
                  `}
                >
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isInactive
                          ? 'bg-slate-200 text-slate-500'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {patient.firstName?.charAt(0)}{patient.lastName?.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 uppercase text-sm truncate">
                            {patient.lastName}
                          </span>
                          <span className="text-sm text-slate-700 capitalize truncate">
                            {patient.firstName}
                          </span>
                          {isInactive && (
                            <span className="shrink-0 text-[10px] uppercase font-bold tracking-wider bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                              Inactif
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">{patient.ssn || 'SSN non renseigne'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {birthInfo.date && birthInfo.date !== '-' ? (
                      <div>
                        <span className="text-sm text-slate-700">{birthInfo.date}</span>
                        {birthInfo.age !== null && (
                          <span className="text-xs text-slate-400 ml-1.5">({birthInfo.age} ans)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm text-slate-600 truncate block max-w-[160px]">
                      {extractCommune(patient.address)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-sm text-slate-600">{patient.phone || '-'}</span>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); openPatientDetail(patient); }}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        title="Modifier"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={(e) => handleToggleActive(e, patient)}
                        disabled={toggleLoading === patient.id}
                        className={`p-1.5 rounded-md transition-colors ${
                          toggleLoading === patient.id
                            ? 'text-slate-300 cursor-wait'
                            : isInactive
                              ? 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              : 'text-emerald-500 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                        title={isInactive ? 'Réactiver le patient' : 'Désactiver le patient'}
                      >
                        {isInactive ? <ToggleLeft size={15} /> : <ToggleRight size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredPatients.length === 0 && (
          <div className="text-center py-16 text-slate-500 bg-slate-50">
            <p className="text-sm">
              {statusFilter === 'inactive'
                ? 'Aucun patient inactif.'
                : statusFilter === 'active'
                  ? 'Aucun patient actif ne correspond a votre recherche.'
                  : 'Aucun patient ne correspond a votre recherche.'
              }
            </p>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 flex items-center justify-between border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Affichage de {start + 1}-{Math.min(start + PAGE_SIZE, filteredPatients.length)} sur {filteredPatients.length} patients
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {generatePageNumbers(safePage, totalPages).map((n, i) =>
                n === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-sm">...</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`min-w-[32px] h-8 rounded-md text-sm font-medium transition-colors ${
                      n === safePage
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-slate-600 border border-slate-200 hover:bg-white'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-slate-500 hover:bg-white border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Generate compact page numbers with ellipsis for large page counts
function generatePageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}
