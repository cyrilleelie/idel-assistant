import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, X, Clock, Lock, AlertCircle, Tag, Repeat, Save } from 'lucide-react';

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
  cabinetData,
  onCabinetUpdate,
}) {
  const careLabels = cabinetData?.settings?.care_labels || [];
  const serverTrames = cabinetData?.settings?.trames || [];
  const [newLabel, setNewLabel] = useState('');
  const [labelError, setLabelError] = useState('');

  // --- Trames: local state + explicit save ---
  const [localTrames, setLocalTrames] = useState(serverTrames);
  const [tramesDirty, setTramesDirty] = useState(false);

  // Sync from server when serverTrames changes (initial load, external changes)
  // but NOT when we have unsaved local changes
  useEffect(() => {
    if (!tramesDirty) {
      setLocalTrames(serverTrames);
    }
  }, [serverTrames, tramesDirty]);

  const saveTrames = useCallback(() => {
    onCabinetUpdate({ settings: { trames: localTrames } });
    setTramesDirty(false);
  }, [onCabinetUpdate, localTrames]);

  const [newTrameName, setNewTrameName] = useState('');
  const [newTrameConfigId, setNewTrameConfigId] = useState('');
  const [newTramePersonCount, setNewTramePersonCount] = useState(2);
  const [newTrameWeekCount, setNewTrameWeekCount] = useState(2);
  const [trameError, setTrameError] = useState('');

  const personCssColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7',
    '#06b6d4', '#f97316', '#14b8a6', '#ec4899', '#6366f1',
  ];
  const getPersonCssColor = (idx) => personCssColors[idx % personCssColors.length];

  const createTrame = () => {
    const trimmed = newTrameName.trim();
    setTrameError('');
    if (!trimmed) { setTrameError('Le nom est requis.'); return; }
    if (!newTrameConfigId) { setTrameError('Sélectionnez une organisation horaire.'); return; }
    const selectedConfig = configs.find(c => c.id === newTrameConfigId);
    if (!selectedConfig || selectedConfig.slots.length === 0) { setTrameError('L\'organisation choisie n\'a pas de créneaux.'); return; }
    if (localTrames.length >= 20) { setTrameError('Maximum 20 trames.'); return; }
    const pattern = {};
    for (let w = 0; w < newTrameWeekCount; w++) {
      pattern[w] = {};
      for (let d = 0; d < 7; d++) {
        pattern[w][d] = {};
        for (const slot of selectedConfig.slots) {
          pattern[w][d][slot.id] = [];
        }
      }
    }
    const newTrame = {
      id: 'trame_' + Date.now(),
      name: trimmed,
      configId: newTrameConfigId,
      personCount: newTramePersonCount,
      weekCount: newTrameWeekCount,
      pattern,
    };
    const newList = [...localTrames, newTrame];
    setLocalTrames(newList);
    // Save creation immediately
    onCabinetUpdate({ settings: { trames: newList } });
    setNewTrameName('');
  };

  const deleteTrame = (trameId) => {
    const newList = localTrames.filter(t => t.id !== trameId);
    setLocalTrames(newList);
    setTramesDirty(false);
    // Save deletion immediately
    onCabinetUpdate({ settings: { trames: newList } });
  };

  const toggleTrameCell = (trameId, weekIdx, dayIdx, slotId, personIdx) => {
    setLocalTrames(prev => prev.map(t => {
      if (t.id !== trameId) return t;
      const newPattern = JSON.parse(JSON.stringify(t.pattern));
      const daySlots = newPattern[weekIdx]?.[dayIdx] || {};
      const current = daySlots[slotId] || [];
      if (current.includes(personIdx)) {
        daySlots[slotId] = current.filter(p => p !== personIdx);
      } else {
        daySlots[slotId] = [...current, personIdx].sort((a, b) => a - b);
      }
      if (!newPattern[weekIdx]) newPattern[weekIdx] = {};
      newPattern[weekIdx][dayIdx] = daySlots;
      return { ...t, pattern: newPattern };
    }));
    setTramesDirty(true);
  };

  const addLabel = () => {
    const trimmed = newLabel.trim();
    setLabelError('');
    if (!trimmed) return;
    if (trimmed.length > 100) { setLabelError('Maximum 100 caractères.'); return; }
    if (careLabels.includes(trimmed)) { setLabelError('Ce libellé existe déjà.'); return; }
    if (careLabels.length >= 50) { setLabelError('Maximum 50 libellés.'); return; }
    const updated = [...careLabels, trimmed];
    onCabinetUpdate({ settings: { care_labels: updated } });
    setNewLabel('');
  };

  const removeLabel = (label) => {
    const updated = careLabels.filter(l => l !== label);
    onCabinetUpdate({ settings: { care_labels: updated } });
  };

  return (
    <div className="max-w-screen-md mx-auto">
      <h2 className="text-xl font-semibold mb-6 border-b pb-2 flex items-center gap-2"><Clock size={20} className="text-blue-600" /> Organisations Horaires</h2>

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

      {/* ═══════ Trames (patterns de planning) ═══════ */}
      <h2 className="text-xl font-semibold mt-10 mb-6 border-b pb-2 flex items-center gap-2">
        <Repeat size={20} className="text-blue-600" /> Trames
        {tramesDirty && (
          <button
            onClick={saveTrames}
            className="flex items-center gap-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded-full transition-colors"
          >
            <Save size={12} /> Enregistrer
          </button>
        )}
      </h2>

      <p className="text-sm text-slate-500 mb-4">
        Définissez des patterns de rotation hebdomadaire (ex: 2 personnes alternent chaque semaine), puis appliquez-les au planning.
      </p>

      {/* Create trame form */}
      {!readOnly && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
          <h3 className="font-medium text-blue-800 mb-3 flex items-center gap-2"><Plus size={18}/> Nouvelle trame</h3>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-600 mb-1">Nom</label>
              <input
                type="text"
                value={newTrameName}
                onChange={e => setNewTrameName(e.target.value)}
                placeholder="Rotation 2 semaines..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                maxLength={60}
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-slate-600 mb-1">Organisation horaire</label>
              <select
                value={newTrameConfigId}
                onChange={e => setNewTrameConfigId(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">-- Choisir --</option>
                {configs.filter(c => c.slots.length > 0).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.slots.map(s => s.name).join(', ')})</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-600 mb-1">Personnes</label>
              <select
                value={newTramePersonCount}
                onChange={e => setNewTramePersonCount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-xs text-slate-600 mb-1">Semaines</label>
              <select
                value={newTrameWeekCount}
                onChange={e => setNewTrameWeekCount(Number(e.target.value))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {Array.from({ length: 8 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button
              onClick={createTrame}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              Créer
            </button>
          </div>
          {trameError && (
            <div className="mt-2 flex items-center gap-1 text-red-600 text-xs font-medium">
              <AlertCircle size={14} /> {trameError}
            </div>
          )}
        </div>
      )}

      {/* Trames list */}
      <div className="space-y-4 mb-6">
        {localTrames.length === 0 && (
          <span className="text-sm text-slate-400 italic">Aucune trame configurée.</span>
        )}
        {localTrames.map(trame => {
          const dayLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
          const linkedConfig = configs.find(c => c.id === trame.configId);
          const trameSlots = linkedConfig?.slots || [];
          return (
            <div key={trame.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-slate-800">{trame.name}</h4>
                  <p className="text-xs text-slate-500">
                    {trame.personCount} personne(s) · {trame.weekCount} semaine(s)
                    {linkedConfig ? ` · ${linkedConfig.name}` : ' · (organisation supprimée)'}
                  </p>
                </div>
                {!readOnly && (
                  <button onClick={() => deleteTrame(trame.id)} className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              <div className="p-4 overflow-x-auto">
                {trameSlots.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">Organisation horaire introuvable ou sans créneaux.</p>
                ) : (
                  <table className="border-collapse text-sm">
                    <thead>
                      {/* Row 1: day names spanning across slots */}
                      <tr>
                        <th className="px-2 py-1" style={{ minWidth: 80 }}></th>
                        {dayLabels.map(d => (
                          <th
                            key={d}
                            colSpan={trameSlots.length}
                            className="px-1 py-1 text-xs text-slate-500 font-medium text-center border-l border-slate-100 first:border-l-0"
                          >
                            {d}
                          </th>
                        ))}
                      </tr>
                      {/* Row 2: slot names repeated for each day */}
                      <tr>
                        <th className="px-2 py-0.5"></th>
                        {dayLabels.map(d =>
                          trameSlots.map((slot, sIdx) => (
                            <th
                              key={`${d}-${slot.id}`}
                              className={`px-1 py-0.5 text-[10px] text-slate-400 font-medium text-center ${sIdx === 0 ? 'border-l border-slate-100' : ''}`}
                            >
                              {slot.name.substring(0, 4)}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: trame.weekCount }, (_, wIdx) =>
                        Array.from({ length: trame.personCount }, (_, pIdx) => (
                          <tr
                            key={`${wIdx}-${pIdx}`}
                            className={pIdx === 0 ? 'border-t border-slate-200' : ''}
                          >
                            <td className="px-2 py-0.5 text-xs font-medium text-right whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                {pIdx === 0 && <span className="text-slate-400">S{wIdx + 1}</span>}
                                {pIdx > 0 && <span className="text-transparent">S{wIdx + 1}</span>}
                                <span
                                  className="inline-flex items-center justify-center px-1 h-4 rounded text-[10px] font-bold text-white"
                                  style={{ backgroundColor: getPersonCssColor(pIdx) }}
                                >
                                  P{pIdx + 1}
                                </span>
                              </span>
                            </td>
                            {dayLabels.map((_, dIdx) =>
                              trameSlots.map((slot, sIdx) => {
                                const assigned = trame.pattern?.[wIdx]?.[dIdx]?.[slot.id] || [];
                                const isChecked = assigned.includes(pIdx);
                                return (
                                  <td
                                    key={`${dIdx}-${slot.id}`}
                                    className={`px-0.5 py-0.5 text-center ${sIdx === 0 ? 'border-l border-slate-100' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={!readOnly ? () => toggleTrameCell(trame.id, wIdx, dIdx, slot.id, pIdx) : undefined}
                                      disabled={readOnly}
                                      className="w-4 h-4 rounded border-slate-300 cursor-pointer disabled:cursor-default"
                                      style={{ accentColor: getPersonCssColor(pIdx) }}
                                      title={`S${wIdx + 1} P${pIdx + 1} — ${dayLabels[dIdx]} ${slot.name}`}
                                    />
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════ Libellés de soins ═══════ */}
      <h2 className="text-xl font-semibold mt-10 mb-6 border-b pb-2 flex items-center gap-2">
        <Tag size={20} className="text-blue-600" /> Libellés de soins
      </h2>

      <p className="text-sm text-slate-500 mb-4">
        Définissez les libellés proposés lors de la création d'une ordonnance (ex: Pansement, Injection insuline...).
      </p>

      {/* Tags list */}
      <div className="flex flex-wrap gap-2 mb-4">
        {careLabels.length === 0 && (
          <span className="text-sm text-slate-400 italic">Aucun libellé configuré.</span>
        )}
        {careLabels.map(label => (
          <span key={label} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1.5 rounded-full text-sm font-medium">
            {label}
            {!readOnly && (
              <button
                onClick={() => removeLabel(label)}
                className="text-blue-400 hover:text-red-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Add label form */}
      {!readOnly && (
        <div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLabel(); } }}
              placeholder="Nouveau libellé..."
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              maxLength={100}
            />
            <button
              onClick={addLabel}
              disabled={!newLabel.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Ajouter
            </button>
          </div>
          {labelError && (
            <div className="mt-2 flex items-center gap-1 text-red-600 text-xs font-medium">
              <AlertCircle size={14} /> {labelError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
