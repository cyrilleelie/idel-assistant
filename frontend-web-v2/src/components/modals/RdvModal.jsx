import { X, AlertCircle } from 'lucide-react';

export default function RdvModal({
  rdvModalParams, setRdvModalParams,
  rdvForm, setRdvForm,
  rdvError,
  patients,
  handleSaveRdv
}) {
  if (!rdvModalParams) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-lg text-slate-800">Nouveau Rendez-vous</h3>
          <button onClick={() => setRdvModalParams(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSaveRdv} className="p-5 space-y-4">
          {rdvError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium flex gap-2"><AlertCircle size={18} className="shrink-0" /><p>{rdvError}</p></div>}

          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button type="button" onClick={() => setRdvForm({...rdvForm, mode: 'select'})} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${rdvForm.mode === 'select' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Patient existant</button>
            <button type="button" onClick={() => setRdvForm({...rdvForm, mode: 'new'})} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${rdvForm.mode === 'new' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Nouveau patient</button>
          </div>

          {rdvForm.mode === 'select' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sélectionner un patient</label>
              <select value={rdvForm.patientId} onChange={e => setRdvForm({...rdvForm, patientId: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                <option value="" disabled>-- Choisir dans le répertoire --</option>
                {patients.map(p => (
                  <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                <input type="text" value={rdvForm.newLastName} onChange={e => setRdvForm({...rdvForm, newLastName: e.target.value.toUpperCase()})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="DUPONT" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                <input type="text" value={rdvForm.newFirstName} onChange={e => setRdvForm({...rdvForm, newFirstName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none capitalize" placeholder="Jean" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure début</label>
              <input type="time" value={rdvForm.startTime} onChange={e => setRdvForm({...rdvForm, startTime: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" required/>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Heure fin</label>
              <input type="time" value={rdvForm.endTime} onChange={e => setRdvForm({...rdvForm, endTime: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" required/>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setRdvModalParams(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Annuler</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
