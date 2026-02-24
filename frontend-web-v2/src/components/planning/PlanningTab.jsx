import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Lock, ShieldCheck, Calendar, CalendarDays, Locate, Eye, Repeat, RotateCcw } from 'lucide-react';
import { formatDate, getWeekDays, getWeekNumber } from '../../utils/dateTime';

const viewModes = [
  { id: 'month', label: 'Mois', icon: Calendar },
  { id: 'week', label: 'Semaine', icon: CalendarDays },
];

export default function PlanningTab({
  nurses, configs, schedule, daysInMonth,
  currentDate, currentPlanningStatus,
  prevMonth, nextMonth, goToCurrentMonth, togglePlanningStatus,
  getActiveConfigForDate, toggleNurseSlot,
  appointments = [],
  readOnly = false,
  trames = [],
  onApplyTrame,
  onResetPlanning,
}) {
  const [viewMode, setViewMode] = useState('month');
  const [weekRef, setWeekRef] = useState(() => new Date());

  // --- Trame application panel ---
  const [showTramePanel, setShowTramePanel] = useState(false);
  const [trameFormId, setTrameFormId] = useState('');
  const [trameFormStartDate, setTrameFormStartDate] = useState(() => formatDate(new Date()));
  const [trameFormCycles, setTrameFormCycles] = useState(1);
  const [trameFormPersonMap, setTrameFormPersonMap] = useState({});
  const [trameApplying, setTrameApplying] = useState(false);
  const [trameResult, setTrameResult] = useState(null); // { added, errors } or null

  // --- Reset planning ---
  const [resetting, setResetting] = useState(false);

  const selectedTrame = trames.find(t => t.id === trameFormId);

  const openTramePanel = () => {
    setShowTramePanel(true);
    setTrameFormId(trames.length > 0 ? trames[0].id : '');
    setTrameFormStartDate(formatDate(new Date()));
    setTrameFormCycles(1);
    setTrameFormPersonMap({});
    setTrameResult(null);
  };

  const handleTrameIdChange = (id) => {
    setTrameFormId(id);
    setTrameFormPersonMap({});
  };

  const handlePersonMapChange = (personIdx, nurseUserId) => {
    setTrameFormPersonMap(prev => ({ ...prev, [personIdx]: nurseUserId }));
  };

  const trameValidationError = (() => {
    if (!selectedTrame) return 'Sélectionnez une trame.';
    if (!trameFormStartDate) return 'Date de début requise.';
    if (trameFormCycles < 1) return 'Au moins 1 cycle.';
    for (let i = 0; i < selectedTrame.personCount; i++) {
      if (!trameFormPersonMap[i]) return `Assignez un membre pour P${i + 1}.`;
    }
    const assignedIds = Object.values(trameFormPersonMap);
    if (new Set(assignedIds).size !== assignedIds.length) return 'Pas de doublons dans les assignations.';
    return null;
  })();

  const handleApplyTrame = async () => {
    if (trameValidationError || !onApplyTrame) return;
    setTrameApplying(true);
    setTrameResult(null);
    try {
      const result = await onApplyTrame({
        trameId: trameFormId,
        startDate: trameFormStartDate,
        cycleCount: trameFormCycles,
        personMap: trameFormPersonMap,
      });
      setTrameResult(result);
      if (result && result.errors === 0 && result.added > 0) {
        // Auto-close after brief delay on full success
        setTimeout(() => setShowTramePanel(false), 1500);
      }
    } catch (err) {
      console.error('Failed to apply trame:', err);
      setTrameResult({ added: 0, errors: -1 });
    } finally {
      setTrameApplying(false);
    }
  };

  const handleResetPlanning = async () => {
    const periodLabel = viewMode === 'month'
      ? currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : `semaine ${getWeekNumber(weekDays[0])}`;
    const confirmed = window.confirm(
      `Voulez-vous vraiment réinitialiser le planning de ${periodLabel} ?\n\nToutes les assignations seront supprimées. Les RDV existants ne seront pas affectés.`
    );
    if (!confirmed || !onResetPlanning) return;
    setResetting(true);
    try {
      await onResetPlanning(displayDays);
    } catch (err) {
      console.error('Failed to reset planning:', err);
    } finally {
      setResetting(false);
    }
  };

  const weekDays = getWeekDays(weekRef);
  const weekNumber = getWeekNumber(weekDays[0]);

  const prevWeek = useCallback(() => setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7)), []);
  const nextWeek = useCallback(() => setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)), []);

  const displayDays = viewMode === 'month' ? daysInMonth : weekDays;

  const handleToggleSlot = (dateStr, slotId, nurseId) => {
    const isAssigned = schedule[dateStr]?.[slotId]?.includes(nurseId);
    if (isAssigned) {
      const slotAppts = appointments.filter(
        a => a.dateStr === dateStr && a.slotId === slotId && a.nurseId === nurseId
      );
      if (slotAppts.length > 0) {
        const confirmed = window.confirm(
          `Attention : ${slotAppts.length} RDV programmé(s) sur ce créneau.\nVoulez-vous vraiment retirer ce membre ?`
        );
        if (!confirmed) return;
      }
    }
    toggleNurseSlot(dateStr, slotId, nurseId);
  };

  const handleViewChange = (mode) => {
    setViewMode(mode);
    if (mode === 'week') {
      setWeekRef(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') { viewMode === 'month' ? prevMonth() : prevWeek(); }
      else if (e.key === 'ArrowRight') { viewMode === 'month' ? nextMonth() : nextWeek(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, prevMonth, nextMonth, prevWeek, nextWeek]);

  const tableContainerRef = useRef(null);
  const handleTableWheel = useCallback((e) => {
    const el = tableContainerRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center bg-slate-50 p-3 rounded-lg border border-slate-100 gap-2">

        {/* Toggle mois / semaine + Aujourd'hui + readOnly badge */}
        <div className="flex items-center gap-3 flex-wrap justify-center">
          {readOnly && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
              <Eye size={14} /> Consultation
            </span>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              {viewModes.map(m => (
                <button
                  key={m.id}
                  onClick={() => handleViewChange(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === m.id ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <m.icon size={14} /> {m.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => { goToCurrentMonth(); setWeekRef(new Date()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
              title="Aujourd'hui"
            >
              <Locate size={14} /> Aujourd'hui
            </button>
            {!readOnly && trames.length > 0 && (
              <button
                onClick={openTramePanel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200 transition-colors"
                title="Appliquer une trame"
              >
                <Repeat size={14} /> Appliquer une trame
              </button>
            )}
            {!readOnly && (
              <button
                onClick={handleResetPlanning}
                disabled={resetting || currentPlanningStatus === 'validated'}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-red-200 transition-colors"
                title={`Réinitialiser le planning (${viewMode === 'month' ? 'mois' : 'semaine'})`}
              >
                <RotateCcw size={14} className={resetting ? 'animate-spin' : ''} /> {resetting ? 'Réinitialisation...' : 'Réinitialiser'}
              </button>
            )}
          </div>
        </div>

        {/* Navigation mois ou semaine — centré */}
        <div className="flex items-center gap-4">
          <button onClick={viewMode === 'month' ? prevMonth : prevWeek} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-semibold capitalize w-72 text-center">
            {viewMode === 'month'
              ? currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              : <>Semaine {weekNumber} <span className="text-base font-normal text-slate-500">du {weekDays[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} au {weekDays[6].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span></>
            }
          </h2>
          <button onClick={viewMode === 'month' ? nextMonth : nextWeek} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight size={20} /></button>
        </div>
      </div>

      {/* --- Panneau application trame --- */}
      {showTramePanel && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-purple-800 flex items-center gap-2">
              <Repeat size={18} /> Appliquer une trame
            </h3>
            <button onClick={() => setShowTramePanel(false)} className="text-slate-400 hover:text-slate-600 text-sm">Fermer</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Trame</label>
              <select
                value={trameFormId}
                onChange={e => handleTrameIdChange(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
              >
                {trames.map(t => {
                  const cfg = configs.find(c => c.id === t.configId);
                  return (
                    <option key={t.id} value={t.id}>{t.name} ({t.personCount}p · {t.weekCount}s{cfg ? ` · ${cfg.name}` : ''})</option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date de début</label>
              <input
                type="date"
                value={trameFormStartDate}
                onChange={e => setTrameFormStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de cycles</label>
              <input
                type="number"
                min={1}
                max={52}
                value={trameFormCycles}
                onChange={e => setTrameFormCycles(Math.max(1, Number(e.target.value)))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          </div>

          {/* Person → Nurse mapping */}
          {selectedTrame && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">Assignation des positions</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: selectedTrame.personCount }, (_, pIdx) => (
                  <div key={pIdx} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700 w-8">P{pIdx + 1}</span>
                    <select
                      value={trameFormPersonMap[pIdx] || ''}
                      onChange={e => handlePersonMapChange(pIdx, e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    >
                      <option value="">-- Choisir --</option>
                      {nurses.map(n => (
                        <option key={n.userId} value={n.userId}>
                          {n.firstName} {n.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 flex-wrap">
            <button
              onClick={handleApplyTrame}
              disabled={!!trameValidationError || trameApplying}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {trameApplying ? 'Application en cours...' : 'Appliquer'}
            </button>
            <button
              onClick={() => setShowTramePanel(false)}
              className="text-slate-500 hover:text-slate-700 px-4 py-2 text-sm font-medium"
            >
              Annuler
            </button>
            {!trameResult && trameValidationError && (
              <span className="text-xs text-amber-600">{trameValidationError}</span>
            )}
            {trameResult && trameResult.errors === -1 && (
              <span className="text-xs text-red-600 font-medium">Erreur lors de l'application de la trame.</span>
            )}
            {trameResult && trameResult.errors !== -1 && (
              <span className={`text-xs font-medium ${trameResult.errors > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {trameResult.added} assignation(s) ajoutée(s){trameResult.errors > 0 ? `, ${trameResult.errors} erreur(s)` : ''}.
              </span>
            )}
          </div>
        </div>
      )}

      {configs.length === 0 || configs.every(c => c.slots.length === 0) || nurses.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          Veuillez configurer l'équipe et les créneaux.
        </div>
      ) : (
        <div ref={tableContainerRef} onWheel={handleTableWheel} className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                <th className="p-2 border-b-2 border-slate-200 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-20 w-28 shadow-[1px_0_0_0_#e2e8f0] text-sm">Infirmier</th>
                {displayDays.map(date => {
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  const isToday = formatDate(date) === formatDate(new Date());
                  return (
                    <th key={formatDate(date)} className={`p-2 border-b-2 border-slate-200 font-semibold text-center text-xs ${viewMode === 'week' ? 'min-w-[100px]' : 'min-w-[60px]'} ${isWeekend ? 'bg-slate-100' : 'bg-slate-50'}`}>
                      <div className="text-slate-500 capitalize">{date.toLocaleDateString('fr-FR', { weekday: viewMode === 'week' ? 'long' : 'short' })}</div>
                      <div className={`text-lg ${isToday ? 'text-blue-600 font-bold' : 'text-slate-800'}`}>{date.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {nurses.map(nurse => (
                <tr key={nurse.id} className="border-b border-slate-100 hover:bg-slate-50/50 group">
                  <td className="p-2 sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#e2e8f0] group-hover:bg-slate-50/50 transition-colors">
                    <div className="font-medium text-slate-700 flex items-center gap-1.5 text-sm truncate">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${nurse.color.split(' ')[0]}`}></div>
                      {nurse.firstName} {nurse.lastName?.charAt(0)}.
                    </div>
                  </td>
                  {displayDays.map(date => {
                    const dateStr = formatDate(date);
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const activeConfig = getActiveConfigForDate(date);

                    return (
                      <td key={dateStr} className={`p-1 align-middle border-x border-slate-50 ${isWeekend ? 'bg-slate-50/80' : ''}`}>
                        <div className="flex flex-col gap-1 items-center">
                          {activeConfig.slots.map(slot => {
                            const isAssigned = schedule[dateStr]?.[slot.id]?.includes(nurse.userId);
                            const disabled = readOnly || currentPlanningStatus === 'validated';
                            return (
                              <button
                                key={slot.id}
                                onClick={disabled ? undefined : () => handleToggleSlot(dateStr, slot.id, nurse.userId)}
                                disabled={disabled}
                                title={`${slot.name} - ${nurse.firstName} ${nurse.lastName}`}
                                className={`w-full text-[10px] py-1 px-0.5 rounded border transition-all font-medium ${
                                  isAssigned
                                    ? `${nurse.color} ${disabled ? 'opacity-60 cursor-default' : ''}`
                                    : `bg-white border-slate-200 ${disabled ? 'opacity-40 cursor-default text-slate-300' : 'text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`
                                }`}
                              >
                                {viewMode === 'week' ? slot.name : slot.name.substring(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Statut planning — sous le tableau, uniquement en vue mois */}
      {!readOnly && viewMode === 'month' && (
        <div className="flex justify-center">
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200">
            <span className={`flex items-center gap-1.5 text-sm font-medium ${currentPlanningStatus === 'validated' ? 'text-emerald-600' : 'text-amber-600'}`}>
              {currentPlanningStatus === 'validated' ? <ShieldCheck size={16} /> : <Lock size={16} className="opacity-50" />}
              {currentPlanningStatus === 'validated' ? 'Planning Validé' : 'Édition en cours'}
            </span>
            <div className="w-px h-6 bg-slate-200"></div>
            <button
              onClick={togglePlanningStatus}
              className={`text-sm px-3 py-1 rounded font-medium transition-colors ${currentPlanningStatus === 'validated' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'}`}
            >
              {currentPlanningStatus === 'validated' ? 'Déverrouiller' : 'Verrouiller le mois'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
