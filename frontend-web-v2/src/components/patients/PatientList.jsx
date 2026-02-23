import { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import PatientCard from './PatientCard';

const statusFilters = [
  { id: 'active', label: 'Actifs' },
  { id: 'inactive', label: 'Inactifs' },
  { id: 'all', label: 'Tous' },
];

export default function PatientList({ patients, patientSearch, setPatientSearch, openNewPatient, openPatientDetail }) {
  const [statusFilter, setStatusFilter] = useState('active');

  const filteredPatients = patients.filter(p => {
    if (statusFilter === 'active' && p.active === false) return false;
    if (statusFilter === 'inactive' && p.active !== false) return false;
    if (!patientSearch) return true;
    const search = patientSearch.toLowerCase();
    return `${p.firstName} ${p.lastName}`.toLowerCase().includes(search) ||
      p.address.toLowerCase().includes(search);
  });

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPatients.map(patient => (
          <PatientCard key={patient.id} patient={patient} onClick={() => openPatientDetail(patient)} />
        ))}
        {filteredPatients.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            {statusFilter === 'inactive' ? 'Aucun patient inactif.' : statusFilter === 'active' ? 'Aucun patient actif ne correspond à votre recherche.' : 'Aucun patient ne correspond à votre recherche.'}
          </div>
        )}
      </div>
    </div>
  );
}
