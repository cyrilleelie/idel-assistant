import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import NurseCard from './NurseCard';
import NurseDetail from './NurseDetail';

const statusFilters = [
  { id: 'active', label: 'Actifs' },
  { id: 'inactive', label: 'Inactifs' },
  { id: 'all', label: 'Tous' },
];

export default function EquipeTab({
  nurses, nurseForm, setNurseForm,
  selectedNurseId, isEditingNurse, setIsEditingNurse,
  openNurseDetail, openNewNurse, closeNurseDetail,
  handleSaveNurse, deactivateNurse, reactivateNurse,
  readOnly = false,
}) {
  const [statusFilter, setStatusFilter] = useState('active');

  const filteredNurses = nurses.filter(n => {
    if (statusFilter === 'active' && n.active === false) return false;
    if (statusFilter === 'inactive' && n.active !== false) return false;
    return true;
  });

  return (
    <div>

      {/* Vue liste */}
      {!selectedNurseId && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex justify-center items-center gap-4 border-b border-slate-200 pb-4">
            <h2 className="text-xl font-semibold">Équipe</h2>
            {!readOnly && (
              <button onClick={openNewNurse} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
                <UserPlus size={18} /> Ajouter un membre
              </button>
            )}
          </div>

          <div className="flex justify-center">
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
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {filteredNurses.map(nurse => (
              <NurseCard key={nurse.id} nurse={nurse} onClick={() => openNurseDetail(nurse)} />
            ))}
            {filteredNurses.length === 0 && (
              <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300 w-full">
                {statusFilter === 'inactive' ? 'Aucun membre inactif.' : 'Aucun membre actif.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vue détail */}
      {selectedNurseId && (
        <NurseDetail
          selectedNurseId={selectedNurseId}
          nurseForm={nurseForm}
          setNurseForm={setNurseForm}
          isEditingNurse={isEditingNurse}
          setIsEditingNurse={setIsEditingNurse}
          closeNurseDetail={closeNurseDetail}
          handleSaveNurse={handleSaveNurse}
          deactivateNurse={deactivateNurse}
          reactivateNurse={reactivateNurse}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
