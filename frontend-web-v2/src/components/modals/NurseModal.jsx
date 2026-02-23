import { X } from 'lucide-react';

export default function NurseModal({
  nurseModalParams, setNurseModalParams,
  nurseForm, setNurseForm,
  handleSaveNurse
}) {
  if (!nurseModalParams) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-lg text-slate-800">{nurseModalParams.mode === 'add' ? 'Ajouter un membre' : 'Modifier la fiche'}</h3>
          <button onClick={() => setNurseModalParams(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={handleSaveNurse} className="p-5 space-y-4">
          <input autoFocus type="text" value={nurseForm.name} onChange={e => setNurseForm({...nurseForm, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom complet" required />
          <select value={nurseForm.role} onChange={e => setNurseForm({...nurseForm, role: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="Titulaire">Titulaire</option>
            <option value="Collaborateur">Collaborateur / Collaboratrice</option>
            <option value="Remplaçant(e)">Remplaçant(e)</option>
          </select>
          <div className="pt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setNurseModalParams(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Annuler</button>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
}
