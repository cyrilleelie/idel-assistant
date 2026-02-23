import { Plus, Trash2, X, Clock, Lock, AlertCircle } from 'lucide-react';

export default function CreneauxTab({
  configs, lockedConfigIds,
  newConfigName, setNewConfigName,
  newConfigDate, setNewConfigDate,
  configError,
  slotFormData, setSlotFormData,
  slotErrors,
  addConfig, removeConfig,
  addSlotToConfig, removeSlotFromConfig,
  readOnly = false,
}) {
  return (
    <div className="max-w-screen-md">
      <h2 className="text-xl font-semibold mb-6 border-b pb-2">Organisations Horaires</h2>

      {!readOnly && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
          <h3 className="font-medium text-blue-800 mb-3 flex items-center gap-2"><Plus size={18}/> Nouvelle organisation</h3>
          <form onSubmit={addConfig} className="flex flex-wrap gap-2">
            <input type="text" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} placeholder="Nom (ex: Horaires d'été)..." className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
              <span className="text-slate-500 text-sm">À partir du:</span>
              <input type="date" value={newConfigDate} onChange={(e) => setNewConfigDate(e.target.value)} className="outline-none text-slate-700 bg-transparent"/>
            </div>
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">Créer</button>
          </form>
          {configError && <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded border border-red-100"><AlertCircle size={16} /> {configError}</div>}
        </div>
      )}

      <div className="space-y-6">
        {[...configs].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map((config) => {
          const currentSlotForm = slotFormData[config.id] || { name: '', startTime: '', endTime: '' };
          const locked = readOnly || lockedConfigIds.has(config.id);
          return (
            <div key={config.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-lg text-slate-800">{config.name}</h4>
                    {lockedConfigIds.has(config.id) && <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full"><Lock size={10} /> Verrouillé</span>}
                  </div>
                  <p className="text-sm text-slate-500">Applicable à partir du {new Date(config.startDate).toLocaleDateString('fr-FR')}</p>
                </div>
                {!readOnly && (
                  <button onClick={() => removeConfig(config.id)} disabled={lockedConfigIds.has(config.id)} className={`p-2 rounded-md transition-colors ${lockedConfigIds.has(config.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}><Trash2 size={18} /></button>
                )}
              </div>
              <div className="p-4">
                <div className="grid gap-2 mb-4">
                  {config.slots.map((slot) => (
                    <div key={slot.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                      <div className="flex flex-col"><span className="font-medium text-slate-700">{slot.name}</span><span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12}/> {slot.startTime} à {slot.endTime}</span></div>
                      {!readOnly && (
                        <button onClick={() => removeSlotFromConfig(config.id, slot.id)} disabled={lockedConfigIds.has(config.id)} className={`p-1.5 rounded-md transition-colors ${lockedConfigIds.has(config.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}><X size={16} /></button>
                      )}
                    </div>
                  ))}
                  {config.slots.length === 0 && (
                    <div className="text-sm text-slate-400 py-2">Aucun créneau configuré.</div>
                  )}
                </div>
                {!readOnly && (
                  <>
                    <form onSubmit={(e) => addSlotToConfig(e, config.id)} className="flex flex-col sm:flex-row gap-2">
                      <input type="text" value={currentSlotForm.name} onChange={(e) => setSlotFormData({...slotFormData, [config.id]: {...currentSlotForm, name: e.target.value}})} disabled={locked} placeholder="Nom (ex: Matin)..." className={`flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${locked ? 'bg-slate-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`} required/>
                      <div className={`flex items-center gap-2 border border-slate-300 rounded-lg px-2 bg-white ${locked ? 'bg-slate-50 cursor-not-allowed opacity-70' : ''}`}>
                        <span className="text-xs text-slate-500 font-medium">De</span>
                        <input type="time" value={currentSlotForm.startTime} onChange={(e) => setSlotFormData({...slotFormData, [config.id]: {...currentSlotForm, startTime: e.target.value}})} disabled={locked} className="outline-none text-sm bg-transparent py-1.5 w-[75px]" required/>
                        <span className="text-xs text-slate-500 font-medium border-l border-slate-200 pl-2">À</span>
                        <input type="time" value={currentSlotForm.endTime} onChange={(e) => setSlotFormData({...slotFormData, [config.id]: {...currentSlotForm, endTime: e.target.value}})} disabled={locked} className="outline-none text-sm bg-transparent py-1.5 w-[75px]" required/>
                      </div>
                      <button type="submit" disabled={locked} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors sm:w-auto w-full ${locked ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>Ajouter</button>
                    </form>
                    {slotErrors[config.id] && <div className="mt-2 text-red-600 text-xs flex items-center gap-1 font-medium"><AlertCircle size={14} /> {slotErrors[config.id]}</div>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
