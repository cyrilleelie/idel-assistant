import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, X, Clock, Lock, AlertCircle, Tag, Repeat, Save, MapPin, Search, ChevronDown, Pencil } from 'lucide-react';
import { createCareLabel, updateCareLabel as apiUpdateCareLabel, deleteCareLabel as apiDeleteCareLabel } from '../../api/care-labels';

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
  careLabelEntries = [],
  onReloadCareLabels,
  ngapCodes = [],
}) {
  const serverTrames = cabinetData?.settings?.trames;

  // --- Care label admin state ---
  const [clForm, setClForm] = useState({ label: '', actCodes: [], durationMinutes: '', category: 'technique' });
  const [clEditId, setClEditId] = useState(null);
  const [clError, setClError] = useState('');
  const [clSaving, setClSaving] = useState(false);
  const [clFilter, setClFilter] = useState('');

  // --- Trames: local state + explicit save ---
  const [localTrames, setLocalTrames] = useState(serverTrames || []);
  const [dirtyTrameIds, setDirtyTrameIds] = useState(new Set());

  // Sync from server when serverTrames changes (initial load, external changes)
  // but NOT when we have unsaved local changes
  const serverTramRef = useRef(serverTrames);
  useEffect(() => {
    if (serverTrames !== serverTramRef.current) {
      serverTramRef.current = serverTrames;
      if (dirtyTrameIds.size === 0 && serverTrames) {
        setLocalTrames(serverTrames);
      }
    }
  }, [serverTrames, dirtyTrameIds]);

  const saveTrame = useCallback((trameId) => {
    onCabinetUpdate({ settings: { trames: localTrames } });
    setDirtyTrameIds(prev => {
      const next = new Set(prev);
      next.delete(trameId);
      return next;
    });
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

  // --- Secteurs géographiques (nouvelle version) ---
  const sectors = cabinetData?.settings?.sectors || [];
  const slotSubdivisions = cabinetData?.settings?.slot_subdivisions || {};

  // Sector creation
  const [newSectorName, setNewSectorName] = useState('');
  const [newSectorColor, setNewSectorColor] = useState('#3b82f6');

  // Commune autocomplete per sector
  const [communeSearch, setCommuneSearch] = useState({});   // { sectorId: query }
  const [communeResults, setCommuneResults] = useState({}); // { sectorId: results[] }
  const [communeFocused, setCommuneFocused] = useState(null); // sectorId or null
  const communeDebounceRef = useRef({});

  // Subdivision section
  const [subdivConfigId, setSubdivConfigId] = useState('');

  // Collapsible sections
  const [horairesOpen, setHorairesOpen] = useState(true);
  const [tramesOpen, setTramsOpen] = useState(false);
  const [secteursOpen, setSecteursOpen] = useState(false);
  const [soinsOpen, setSoinsOpen] = useState(false);

  const sectorColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#a855f7',
    '#06b6d4', '#f97316', '#14b8a6', '#ec4899', '#6366f1',
  ];

  // --- Sector CRUD ---
  const addSector = () => {
    const trimmed = newSectorName.trim();
    if (!trimmed) return;
    if (sectors.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) return;
    const newSec = {
      id: 'sec_' + Date.now(),
      name: trimmed,
      color: newSectorColor,
      communes: [],
    };
    onCabinetUpdate({ settings: { sectors: [...sectors, newSec] } });
    setNewSectorName('');
    // Cycle to next color
    const currentIdx = sectorColors.indexOf(newSectorColor);
    setNewSectorColor(sectorColors[(currentIdx + 1) % sectorColors.length]);
  };

  const removeSector = (sectorId) => {
    const updatedSectors = sectors.filter(s => s.id !== sectorId);
    // Clean up subdivisions referencing this sector
    const updatedSubdivisions = JSON.parse(JSON.stringify(slotSubdivisions));
    for (const configId of Object.keys(updatedSubdivisions)) {
      for (const slotId of Object.keys(updatedSubdivisions[configId])) {
        updatedSubdivisions[configId][slotId] = updatedSubdivisions[configId][slotId].map(sub =>
          sub.sectorId === sectorId ? { ...sub, sectorId: '' } : sub
        );
      }
    }
    onCabinetUpdate({ settings: { sectors: updatedSectors, slot_subdivisions: updatedSubdivisions } });
  };

  // --- Commune autocomplete ---
  const searchCommunes = useCallback((sectorId, query) => {
    setCommuneSearch(prev => ({ ...prev, [sectorId]: query }));
    if (communeDebounceRef.current[sectorId]) {
      clearTimeout(communeDebounceRef.current[sectorId]);
    }
    if (!query || query.length < 2) {
      setCommuneResults(prev => ({ ...prev, [sectorId]: [] }));
      return;
    }
    communeDebounceRef.current[sectorId] = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&boost=population&limit=7&fields=nom,code,codesPostaux`
        );
        if (res.ok) {
          const data = await res.json();
          setCommuneResults(prev => ({ ...prev, [sectorId]: data }));
        }
      } catch {
        // Silently fail - user can retry
      }
    }, 300);
  }, []);

  const addCommuneToSector = (sectorId, commune) => {
    const updatedSectors = sectors.map(s => {
      if (s.id !== sectorId) return s;
      if (s.communes.some(c => c.code === commune.code)) return s;
      return { ...s, communes: [...s.communes, { nom: commune.nom, code: commune.code, codesPostaux: commune.codesPostaux || [] }] };
    });
    onCabinetUpdate({ settings: { sectors: updatedSectors } });
    setCommuneSearch(prev => ({ ...prev, [sectorId]: '' }));
    setCommuneResults(prev => ({ ...prev, [sectorId]: [] }));
  };

  const removeCommuneFromSector = (sectorId, communeCode) => {
    const updatedSectors = sectors.map(s => {
      if (s.id !== sectorId) return s;
      return { ...s, communes: s.communes.filter(c => c.code !== communeCode) };
    });
    onCabinetUpdate({ settings: { sectors: updatedSectors } });
  };

  // --- Subdivision CRUD ---
  const addSubdivision = (configId, slotId, slot) => {
    const updated = JSON.parse(JSON.stringify(slotSubdivisions));
    if (!updated[configId]) updated[configId] = {};
    if (!updated[configId][slotId]) updated[configId][slotId] = [];
    updated[configId][slotId].push({
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      startTime: slot.startTime,
      endTime: slot.endTime,
      sectorId: '',
    });
    onCabinetUpdate({ settings: { slot_subdivisions: updated } });
  };

  const updateSubdivision = (configId, slotId, subId, field, value) => {
    const updated = JSON.parse(JSON.stringify(slotSubdivisions));
    const subs = updated[configId]?.[slotId];
    if (!subs) return;
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    sub[field] = value;
    onCabinetUpdate({ settings: { slot_subdivisions: updated } });
  };

  const removeSubdivision = (configId, slotId, subId) => {
    const updated = JSON.parse(JSON.stringify(slotSubdivisions));
    if (!updated[configId]?.[slotId]) return;
    updated[configId][slotId] = updated[configId][slotId].filter(s => s.id !== subId);
    if (updated[configId][slotId].length === 0) delete updated[configId][slotId];
    if (updated[configId] && Object.keys(updated[configId]).length === 0) delete updated[configId];
    onCabinetUpdate({ settings: { slot_subdivisions: updated } });
  };

  // --- Coverage calculation ---
  const timeToMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const minutesToTime = (m) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  const getSlotCoverage = (configId, slotId, slot) => {
    const subs = slotSubdivisions[configId]?.[slotId] || [];
    if (subs.length === 0) return { status: 'empty', gaps: [{ start: slot.startTime, end: slot.endTime }], overlaps: [], percent: 0 };

    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    const slotDuration = slotEnd - slotStart;
    if (slotDuration <= 0) return { status: 'empty', gaps: [], overlaps: [], percent: 0 };

    // Sort subs by start time
    const sorted = [...subs]
      .map(s => ({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) }))
      .filter(s => s.end > s.start)
      .sort((a, b) => a.start - b.start);

    // Detect overlaps
    const overlaps = [];
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].start < sorted[i].end) {
          overlaps.push({
            start: minutesToTime(sorted[j].start),
            end: minutesToTime(Math.min(sorted[i].end, sorted[j].end)),
          });
        }
      }
    }

    // Merge intervals and find gaps
    const merged = [];
    for (const s of sorted) {
      const cStart = Math.max(s.start, slotStart);
      const cEnd = Math.min(s.end, slotEnd);
      if (cEnd <= cStart) continue;
      if (merged.length > 0 && cStart <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, cEnd);
      } else {
        merged.push({ start: cStart, end: cEnd });
      }
    }

    const gaps = [];
    let cursor = slotStart;
    for (const m of merged) {
      if (m.start > cursor) {
        gaps.push({ start: minutesToTime(cursor), end: minutesToTime(m.start) });
      }
      cursor = m.end;
    }
    if (cursor < slotEnd) {
      gaps.push({ start: minutesToTime(cursor), end: minutesToTime(slotEnd) });
    }

    const coveredMinutes = merged.reduce((sum, m) => sum + (m.end - m.start), 0);
    const percent = Math.round((coveredMinutes / slotDuration) * 100);

    let status = 'complete';
    if (overlaps.length > 0) status = 'overlap';
    else if (gaps.length > 0) status = 'gaps';

    return { status, gaps, overlaps, percent };
  };

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
    setDirtyTrameIds(prev => {
      const next = new Set(prev);
      next.delete(trameId);
      return next;
    });
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
    setDirtyTrameIds(prev => new Set(prev).add(trameId));
  };

  const CARE_CATEGORIES = [
    { value: 'pansement', label: 'Pansement' },
    { value: 'injection', label: 'Injection' },
    { value: 'perfusion', label: 'Perfusion' },
    { value: 'prelevement', label: 'Prélèvement' },
    { value: 'bsi', label: 'BSI' },
    { value: 'technique', label: 'Technique' },
    { value: 'surveillance', label: 'Surveillance' },
    { value: 'palliatif', label: 'Palliatif' },
    { value: 'hygiene', label: 'Hygiène' },
    { value: 'divers', label: 'Divers' },
  ];

  const resetClForm = () => {
    setClForm({ label: '', actCodes: [], durationMinutes: '', category: 'technique' });
    setClEditId(null);
    setClError('');
  };

  const startEditCareLabel = (entry) => {
    setClForm({
      label: entry.label,
      actCodes: entry.act_codes || [],
      durationMinutes: entry.default_duration_minutes || '',
      category: entry.category || 'technique',
    });
    setClEditId(entry.id);
    setClError('');
  };

  const saveCareLabel = async () => {
    const trimmed = clForm.label.trim();
    setClError('');
    if (!trimmed) { setClError('Le libellé est obligatoire.'); return; }
    if (trimmed.length > 200) { setClError('Maximum 200 caractères.'); return; }
    if (!clForm.durationMinutes || Number(clForm.durationMinutes) < 1) { setClError('La durée est obligatoire (min 1 min).'); return; }

    setClSaving(true);
    try {
      const payload = {
        label: trimmed,
        act_codes: clForm.actCodes,
        default_duration_minutes: Number(clForm.durationMinutes),
        category: clForm.category,
      };
      if (clEditId) {
        await apiUpdateCareLabel(clEditId, payload);
      } else {
        await createCareLabel(payload);
      }
      resetClForm();
      if (onReloadCareLabels) await onReloadCareLabels();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setClError(detail || 'Erreur lors de la sauvegarde.');
    } finally {
      setClSaving(false);
    }
  };

  const removeCareLabel = async (id) => {
    try {
      await apiDeleteCareLabel(id);
      if (onReloadCareLabels) await onReloadCareLabels();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setClError(detail || 'Erreur lors de la suppression.');
    }
  };

  return (
    <div className="max-w-screen-md mx-auto">
      <button onClick={() => setHorairesOpen(v => !v)} className="w-full text-xl font-semibold mb-6 border-b pb-2 flex items-center gap-2">
        <Clock size={20} className="text-blue-600" /> Organisations Horaires
        <ChevronDown size={18} className={`ml-auto text-slate-400 transition-transform ${horairesOpen ? '' : '-rotate-90'}`} />
      </button>

      {horairesOpen && <>{!readOnly && (
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
      </div></>}

      {/* ═══════ Trames (patterns de planning) ═══════ */}
      <button onClick={() => setTramsOpen(v => !v)} className="w-full text-xl font-semibold mt-10 mb-6 border-b pb-2 flex items-center gap-2">
        <Repeat size={20} className="text-blue-600" /> Trames
        <ChevronDown size={18} className={`ml-auto text-slate-400 transition-transform ${tramesOpen ? '' : '-rotate-90'}`} />
      </button>

      {tramesOpen && <><p className="text-sm text-slate-500 mb-4">
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
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800">{trame.name}</h4>
                    {dirtyTrameIds.has(trame.id) && (
                      <button
                        onClick={() => saveTrame(trame.id)}
                        className="flex items-center gap-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-0.5 rounded-full transition-colors"
                      >
                        <Save size={12} /> Enregistrer
                      </button>
                    )}
                  </div>
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
      </div></>}

      {/* ═══════ Secteurs géographiques ═══════ */}
      <button onClick={() => setSecteursOpen(v => !v)} className="w-full text-xl font-semibold mt-10 mb-6 border-b pb-2 flex items-center gap-2">
        <MapPin size={20} className="text-blue-600" /> Secteurs géographiques
        <ChevronDown size={18} className={`ml-auto text-slate-400 transition-transform ${secteursOpen ? '' : '-rotate-90'}`} />
      </button>

      {secteursOpen && <><p className="text-sm text-slate-500 mb-4">
        Définissez vos secteurs géographiques, puis découpez vos créneaux horaires pour les associer à ces secteurs.
      </p>

      {/* ── Partie A : Définition des secteurs ── */}
      <div className="mb-8">
        <h3 className="font-medium text-slate-700 mb-3">Secteurs existants</h3>

        {sectors.length === 0 && (
          <p className="text-sm text-slate-400 italic mb-4">Aucun secteur défini.</p>
        )}

        <div className="space-y-3 mb-4">
          {sectors.map(sector => (
            <div key={sector.id} className="border border-slate-200 rounded-lg p-3 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: sector.color }} />
                  <span className="font-medium text-slate-800">{sector.name}</span>
                  <span className="text-xs text-slate-400">({sector.communes.length} commune{sector.communes.length !== 1 ? 's' : ''})</span>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeSector(sector.id)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Supprimer ce secteur"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Commune chips */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {sector.communes.map(commune => (
                  <span
                    key={commune.code}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700"
                  >
                    {commune.nom} ({commune.codesPostaux?.[0] || commune.code})
                    {!readOnly && (
                      <button
                        onClick={() => removeCommuneFromSector(sector.id, commune.code)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </span>
                ))}
                {sector.communes.length === 0 && (
                  <span className="text-xs text-slate-400 italic">Aucune commune</span>
                )}
              </div>

              {/* Commune autocomplete input */}
              {!readOnly && (
                <div className="relative">
                  <div className="flex items-center gap-1.5">
                    <Search size={14} className="text-slate-400" />
                    <input
                      type="text"
                      value={communeSearch[sector.id] || ''}
                      onChange={e => searchCommunes(sector.id, e.target.value)}
                      onFocus={() => setCommuneFocused(sector.id)}
                      onBlur={() => setTimeout(() => setCommuneFocused(null), 200)}
                      placeholder="Ajouter une commune..."
                      className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                  {communeFocused === sector.id && (communeResults[sector.id] || []).length > 0 && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {(communeResults[sector.id] || [])
                        .filter(c => !sector.communes.some(sc => sc.code === c.code))
                        .map(commune => (
                          <button
                            key={commune.code}
                            type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              addCommuneToSector(sector.id, commune);
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 transition-colors flex justify-between items-center"
                          >
                            <span>{commune.nom}</span>
                            <span className="text-xs text-slate-400">{commune.codesPostaux?.[0] || commune.code}</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* New sector form */}
        {!readOnly && (
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="block text-xs text-slate-600 mb-1">Nom du secteur</label>
              <input
                type="text"
                value={newSectorName}
                onChange={e => setNewSectorName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSector(); } }}
                placeholder="Ex: Secteur Nord..."
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-600 mb-1">Couleur</label>
              <div className="flex gap-1">
                {sectorColors.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewSectorColor(color)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${newSectorColor === color ? 'border-slate-800 scale-110' : 'border-transparent hover:border-slate-300'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={addSector}
              disabled={!newSectorName.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Créer
            </button>
          </div>
        )}
      </div>

      {/* ── Partie B : Découpage temporel des créneaux ── */}
      <div className="mb-8">
        <h3 className="font-medium text-slate-700 mb-3 flex items-center gap-2">
          <Clock size={16} className="text-slate-500" /> Découpage des créneaux par secteur
        </h3>

        {configs.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Créez d'abord une organisation horaire.</p>
        ) : (
          <>
            <div className="mb-4">
              <label className="block text-xs text-slate-600 mb-1 font-medium">Organisation horaire</label>
              <select
                value={subdivConfigId}
                onChange={e => setSubdivConfigId(e.target.value)}
                className="w-full sm:w-auto min-w-[280px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">-- Sélectionner --</option>
                {configs.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slots.length} créneau{c.slots.length > 1 ? 'x' : ''})
                  </option>
                ))}
              </select>
            </div>

            {subdivConfigId && (() => {
              const selectedConfig = configs.find(c => c.id === subdivConfigId);
              if (!selectedConfig) return null;
              const slots = selectedConfig.slots;
              if (slots.length === 0) return <p className="text-sm text-slate-400 italic">Cette organisation n'a aucun créneau.</p>;

              return (
                <div className="space-y-4">
                  {slots.map(slot => {
                    const subs = slotSubdivisions[subdivConfigId]?.[slot.id] || [];
                    const coverage = getSlotCoverage(subdivConfigId, slot.id, slot);

                    return (
                      <div key={slot.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                        {/* Slot header */}
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-medium text-slate-700">{slot.name}</span>
                            <span className="text-xs text-slate-400 ml-2">({slot.startTime} – {slot.endTime})</span>
                          </div>
                        </div>

                        {/* Subdivisions table */}
                        {subs.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-100">
                                  <th className="text-left px-4 py-1.5 text-xs font-medium text-slate-500">De</th>
                                  <th className="text-left px-4 py-1.5 text-xs font-medium text-slate-500">À</th>
                                  <th className="text-left px-4 py-1.5 text-xs font-medium text-slate-500">Secteur</th>
                                  {!readOnly && <th className="w-10"></th>}
                                </tr>
                              </thead>
                              <tbody>
                                {subs.map(sub => {
                                  const linkedSector = sectors.find(s => s.id === sub.sectorId);
                                  return (
                                    <tr key={sub.id} className="border-b last:border-b-0 border-slate-50">
                                      <td className="px-4 py-1.5">
                                        {readOnly ? (
                                          <span className="text-slate-700">{sub.startTime}</span>
                                        ) : (
                                          <input
                                            type="time"
                                            value={sub.startTime}
                                            onChange={e => updateSubdivision(subdivConfigId, slot.id, sub.id, 'startTime', e.target.value)}
                                            className="border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-[100px]"
                                          />
                                        )}
                                      </td>
                                      <td className="px-4 py-1.5">
                                        {readOnly ? (
                                          <span className="text-slate-700">{sub.endTime}</span>
                                        ) : (
                                          <input
                                            type="time"
                                            value={sub.endTime}
                                            onChange={e => updateSubdivision(subdivConfigId, slot.id, sub.id, 'endTime', e.target.value)}
                                            className="border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-[100px]"
                                          />
                                        )}
                                      </td>
                                      <td className="px-4 py-1.5">
                                        {readOnly ? (
                                          <span className="flex items-center gap-1.5">
                                            {linkedSector && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: linkedSector.color }} />}
                                            <span className={linkedSector ? 'text-slate-700' : 'text-slate-400'}>
                                              {linkedSector?.name || '—'}
                                            </span>
                                          </span>
                                        ) : (
                                          <select
                                            value={sub.sectorId}
                                            onChange={e => updateSubdivision(subdivConfigId, slot.id, sub.id, 'sectorId', e.target.value)}
                                            className="border border-slate-200 rounded px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[160px]"
                                          >
                                            <option value="">-- Secteur --</option>
                                            {sectors.map(s => (
                                              <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                          </select>
                                        )}
                                      </td>
                                      {!readOnly && (
                                        <td className="px-2 py-1.5 text-center">
                                          <button
                                            onClick={() => removeSubdivision(subdivConfigId, slot.id, sub.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                          >
                                            <X size={14} />
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Add subdivision button */}
                        {!readOnly && (
                          <div className="px-4 py-2 border-t border-slate-100">
                            <button
                              onClick={() => addSubdivision(subdivConfigId, slot.id, slot)}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 transition-colors"
                            >
                              <Plus size={14} /> Ajouter un sous-créneau
                            </button>
                          </div>
                        )}

                        {/* Coverage bar */}
                        <div className={`px-4 py-2 text-xs font-medium flex items-center gap-2 border-t ${
                          coverage.status === 'complete' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          coverage.status === 'overlap' ? 'bg-red-50 text-red-700 border-red-100' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {coverage.status === 'complete' && (
                            <>Couverture complète ({slot.startTime}–{slot.endTime})</>
                          )}
                          {coverage.status === 'overlap' && (
                            <>Chevauchement{coverage.overlaps.length > 1 ? 's' : ''} détecté{coverage.overlaps.length > 1 ? 's' : ''} : {coverage.overlaps.map(o => `${o.start}–${o.end}`).join(', ')}</>
                          )}
                          {coverage.status === 'gaps' && (
                            <>Non couvert : {coverage.gaps.map(g => `${g.start}–${g.end}`).join(', ')} ({coverage.percent}% couvert)</>
                          )}
                          {coverage.status === 'empty' && (
                            <>Aucun sous-créneau défini ({slot.startTime}–{slot.endTime})</>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </div></>}

      {/* ═══════ Libellés de soins ═══════ */}
      <button onClick={() => setSoinsOpen(v => !v)} className="w-full text-xl font-semibold mt-10 mb-6 border-b pb-2 flex items-center gap-2">
        <Tag size={20} className="text-blue-600" /> Référentiel de soins
        <ChevronDown size={18} className={`ml-auto text-slate-400 transition-transform ${soinsOpen ? '' : '-rotate-90'}`} />
      </button>

      {soinsOpen && <><p className="text-sm text-slate-500 mb-4">
        Libellés proposés à l'autocomplétion lors de la création d'un plan de soins. Chaque libellé est associé à un code NGAP et une durée par défaut.
        Les libellés système ne sont pas modifiables. Vous pouvez ajouter des libellés personnalisés pour votre cabinet.
      </p>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={clFilter}
            onChange={e => setClFilter(e.target.value)}
            placeholder="Filtrer par libellé, catégorie ou code..."
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* Labels table */}
      {careLabelEntries.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-4">Aucun libellé configuré.</p>
      ) : (() => {
        const q = clFilter.toLowerCase();
        const filtered = q
          ? careLabelEntries.filter(e =>
              e.label.toLowerCase().includes(q) ||
              e.category.toLowerCase().includes(q) ||
              (e.act_codes || []).some(c => c.toLowerCase().includes(q))
            )
          : careLabelEntries;
        return (
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Libellé</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 w-36">Code NGAP</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 w-24">Durée</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600 w-28">Catégorie</th>
                  {!readOnly && <th className="w-20"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => {
                  const editing = !readOnly && clEditId === entry.id;
                  return (
                    <tr key={entry.id} className={`border-b border-slate-100 ${editing ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                      {/* Libellé */}
                      <td className="px-4 py-2">
                        {editing ? (
                          <input
                            type="text"
                            value={clForm.label}
                            onChange={e => setClForm({ ...clForm, label: e.target.value })}
                            maxLength={200}
                            className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                        ) : (
                          <span className="font-medium text-slate-800">
                            {entry.label}
                            {entry.is_system && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full font-normal">système</span>}
                          </span>
                        )}
                      </td>
                      {/* Code NGAP */}
                      <td className="px-4 py-2">
                        {editing ? (
                          <select
                            value={(clForm.actCodes && clForm.actCodes[0]) || ''}
                            onChange={e => setClForm({ ...clForm, actCodes: e.target.value ? [e.target.value] : [] })}
                            className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          >
                            <option value="">—</option>
                            {ngapCodes.map(act => (
                              <option key={act.id} value={act.code}>{act.code}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-slate-600 font-mono text-xs">{(entry.act_codes || []).join(', ') || '—'}</span>
                        )}
                      </td>
                      {/* Durée */}
                      <td className="px-4 py-2">
                        {editing ? (
                          <input
                            type="number"
                            min="1"
                            max="480"
                            value={clForm.durationMinutes}
                            onChange={e => setClForm({ ...clForm, durationMinutes: e.target.value })}
                            className="w-20 border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          />
                        ) : (
                          <span className="text-slate-600">{entry.default_duration_minutes} min</span>
                        )}
                      </td>
                      {/* Catégorie */}
                      <td className="px-4 py-2">
                        {editing ? (
                          <select
                            value={clForm.category}
                            onChange={e => setClForm({ ...clForm, category: e.target.value })}
                            className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                          >
                            {CARE_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full capitalize">{entry.category}</span>
                        )}
                      </td>
                      {/* Actions */}
                      {!readOnly && (
                        <td className="px-2 py-2 text-center">
                          {editing ? (
                            <span className="inline-flex gap-1">
                              <button
                                onClick={saveCareLabel}
                                disabled={clSaving || !clForm.label.trim()}
                                className="text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 transition-colors p-1"
                                title="Enregistrer"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={resetClForm}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                                title="Annuler"
                              >
                                <X size={14} />
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex gap-1">
                              <button
                                onClick={() => startEditCareLabel(entry)}
                                className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                title="Modifier"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => removeCareLabel(entry.id)}
                                className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={readOnly ? 4 : 5} className="px-4 py-4 text-center text-slate-400 italic text-sm">Aucun résultat pour « {clFilter} »</td></tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })()}

      {clEditId && clError && (
        <div className="mb-4 flex items-center gap-1 text-red-600 text-xs font-medium">
          <AlertCircle size={14} /> {clError}
        </div>
      )}

      {/* Add new care label form (only when NOT editing an existing one) */}
      {!readOnly && !clEditId && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-medium text-slate-700 mb-3 text-sm">Ajouter un libellé</h3>
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Libellé *</label>
              <input
                type="text"
                value={clForm.label}
                onChange={e => setClForm({ ...clForm, label: e.target.value })}
                placeholder="Ex: Pansement spécifique..."
                maxLength={200}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Code NGAP</label>
              <select
                value={(clForm.actCodes && clForm.actCodes[0]) || ''}
                onChange={e => setClForm({ ...clForm, actCodes: e.target.value ? [e.target.value] : [] })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">-- Aucun --</option>
                {ngapCodes.map(act => (
                  <option key={act.id} value={act.code}>{act.code} — {act.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Durée (min) *</label>
              <input
                type="number"
                min="1"
                max="480"
                value={clForm.durationMinutes}
                onChange={e => setClForm({ ...clForm, durationMinutes: e.target.value })}
                placeholder="Ex: 15"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Catégorie</label>
              <select
                value={clForm.category}
                onChange={e => setClForm({ ...clForm, category: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {CARE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveCareLabel}
              disabled={clSaving || !clForm.label.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {clSaving ? 'Enregistrement...' : 'Ajouter'}
            </button>
          </div>
          {clError && (
            <div className="mt-2 flex items-center gap-1 text-red-600 text-xs font-medium">
              <AlertCircle size={14} /> {clError}
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}
