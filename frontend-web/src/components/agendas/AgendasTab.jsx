import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Clock, Plus, X, Check, Locate, Users, User, Pencil, CheckCircle2, XCircle, CircleDot, AlertTriangle, CalendarOff } from 'lucide-react';
import { formatDate, getWeekDays, getWeekNumber } from '../../utils/dateTime';

const STATUS_FILTERS = [
  { key: 'scheduled', label: 'Planifiés', activeClass: 'bg-primary/10 text-primary border border-primary/20' },
  { key: 'completed', label: 'Réalisés', activeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  { key: 'canceled', label: 'Annulés', activeClass: 'bg-red-50 text-red-600 border border-red-200' },
];

const STATUS_CONFIG = {
  scheduled: { label: 'Planifié', badge: 'bg-primary/10 text-primary', card: 'bg-primary/5 border-l-4 border-primary rounded-lg', icon: CircleDot },
  completed: { label: 'Réalisé', badge: 'bg-emerald-100 text-emerald-700', card: 'bg-emerald-50 border-l-4 border-emerald-500 rounded-lg', icon: CheckCircle2 },
  canceled: { label: 'Annulé', badge: 'bg-red-100 text-red-600', card: 'bg-red-50/40 border-l-4 border-red-300 rounded-lg opacity-60', icon: XCircle },
};

export default function AgendasTab({
  nurses, workingNurses, appointments,
  schedule, daysInMonth, currentDate,
  selectedAgendaNurseIds, setSelectedAgendaNurseIds,
  prevMonth, nextMonth,
  getActiveConfigForDate, openRdvModal, deleteRdv, editRdv, completeRdv,
  patients, cabinetData,
  fetchScheduleForMonth,
  meUserId,
}) {
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [activeStatuses, setActiveStatuses] = useState(() => new Set(['scheduled', 'completed']));

  const toggleStatus = (key) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  };

  const filteredAppointments = useMemo(
    () => appointments.filter(a => activeStatuses.has(a.status)),
    [appointments, activeStatuses],
  );

  const weekDays = getWeekDays(weekRef);
  const weekNumber = getWeekNumber(weekDays[0]);

  // Fetch schedule for all months covered by the displayed week
  useEffect(() => {
    if (!fetchScheduleForMonth) return;
    const months = new Set();
    weekDays.forEach(d => months.add(`${d.getFullYear()}-${d.getMonth()}`));
    months.forEach(key => {
      const [year, month] = key.split('-').map(Number);
      fetchScheduleForMonth(year, month);
    });
  }, [weekDays[0].getTime(), fetchScheduleForMonth]);

  const prevWeek = useCallback(() => setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7)), []);
  const nextWeek = useCallback(() => setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)), []);

  const displayDays = weekDays;

  const nursesWorkingDisplayDays = workingNurses.filter(nurse =>
    displayDays.some(date => {
      const daySchedule = schedule[formatDate(date)];
      if (!daySchedule) return false;
      return Object.values(daySchedule).some(assigned => assigned.includes(nurse.userId));
    })
  );

  const selectAllWorking = () => {
    const ids = nursesWorkingDisplayDays.map(n => n.userId);
    if (ids.length > 0) setSelectedAgendaNurseIds(ids);
  };

  // Auto-select all working nurses on every week change
  useEffect(() => {
    const ids = nursesWorkingDisplayDays.map(n => n.userId);
    if (ids.length > 0) setSelectedAgendaNurseIds(ids);
  }, [weekDays[0].getTime(), nursesWorkingDisplayDays.length]);

  const toggleNurseSelection = (nurseId) => {
    setSelectedAgendaNurseIds(prev =>
      prev.includes(nurseId)
        ? prev.length > 1 ? prev.filter(id => id !== nurseId) : prev
        : [...prev, nurseId]
    );
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') prevWeek();
      else if (e.key === 'ArrowRight') nextWeek();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevWeek, nextWeek]);

  return (
    <div className="space-y-6">
      {/* Toolbar bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center justify-between gap-4">
        {/* Date navigation */}
        <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm bg-white flex items-center">
          <button onClick={prevWeek} className="p-2 hover:bg-slate-50 border-r border-slate-200 transition-colors">
            <ChevronLeft size={18} className="text-slate-600" />
          </button>
          <div className="px-4 py-2 text-sm font-bold text-slate-800 border-r border-slate-200 text-center min-w-[200px]">
            <span className="capitalize">Semaine {weekNumber}</span>
            <span className="text-xs text-slate-500 ml-2">
              {weekDays[0].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} — {weekDays[6].toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
          <button onClick={nextWeek} className="p-2 hover:bg-slate-50 transition-colors">
            <ChevronRight size={18} className="text-slate-600" />
          </button>
        </div>

        {/* Nurse selection as grouped buttons */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden shadow-sm">
          {nursesWorkingDisplayDays.map((nurse, i) => {
            const isSelected = selectedAgendaNurseIds.includes(nurse.userId);
            return (
              <button
                key={nurse.userId}
                onClick={() => toggleNurseSelection(nurse.userId)}
                className={`px-3 py-2 text-xs font-semibold transition-colors ${
                  i < nursesWorkingDisplayDays.length - 1 ? 'border-r border-slate-200' : ''
                } ${isSelected ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {nurse.firstName} {nurse.lastName}
              </button>
            );
          })}
        </div>

        {/* Status filter toggles */}
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map(f => {
            const on = activeStatuses.has(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggleStatus(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${on ? f.activeClass : 'bg-slate-100 text-slate-600 border border-transparent hover:border-slate-300'}`}
              >
                {on && <Check size={10} className="inline mr-1" />}{f.label}
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekRef(new Date())}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md transition-colors"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {nursesWorkingDisplayDays.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-sm">
          <CalendarOff size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium">Aucun infirmier n'est planifie sur cette periode.</p>
        </div>
      ) : (
        <>
          {/* Agendas empiles */}
          <div className="space-y-6">
            {selectedAgendaNurseIds
              .filter(id => nursesWorkingDisplayDays.some(n => n.userId === id))
              .map(nurseId => {
              const nurse = nurses.find(n => n.userId === nurseId);
              if (!nurse) return null;
              return (
                <NurseAgenda
                  key={nurseId}
                  nurse={nurse}
                  displayDays={displayDays}
                  schedule={schedule}
                  appointments={filteredAppointments}
                  getActiveConfigForDate={getActiveConfigForDate}
                  openRdvModal={openRdvModal}
                  deleteRdv={deleteRdv}
                  editRdv={editRdv}
                  completeRdv={completeRdv}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Agenda d'un infirmier (vue semaine uniquement) ---- */
function NurseAgenda({ nurse, displayDays, schedule, appointments, getActiveConfigForDate, openRdvModal, deleteRdv, editRdv, completeRdv }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [collapsedSlots, setCollapsedSlots] = useState(new Set());

  const toggleSlot = (slotKey) => {
    setCollapsedSlots(prev => {
      const next = new Set(prev);
      if (next.has(slotKey)) next.delete(slotKey);
      else next.add(slotKey);
      return next;
    });
  };

  // Collect all slot keys for toggle all
  const allSlotKeys = useMemo(() => {
    const keys = [];
    displayDays.forEach(date => {
      const dateStr = formatDate(date);
      const activeConfig = getActiveConfigForDate(date);
      const workingSlots = activeConfig.slots.filter(slot => schedule[dateStr]?.[slot.id]?.includes(nurse.userId));
      workingSlots.forEach(slot => keys.push(`${dateStr}_${slot.id}`));
    });
    return keys;
  }, [displayDays, schedule, nurse.userId, getActiveConfigForDate]);

  const allCollapsed = allSlotKeys.length > 0 && allSlotKeys.every(k => collapsedSlots.has(k));

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedSlots(new Set());
    } else {
      setCollapsedSlots(new Set(allSlotKeys));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* En-tete */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 shrink-0 flex items-center justify-between">
        <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${nurse.color.split(' ')[0]}`}></div>
          {nurse.firstName} {nurse.lastName}
        </h3>
        {allSlotKeys.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title={allCollapsed ? 'Tout deplier' : 'Tout replier'}
          >
            {allCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {allCollapsed ? 'Tout deplier' : 'Tout replier'}
          </button>
        )}
      </div>

      {/* Day headers row */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/50">
        {displayDays.map(date => {
          const dateStr = formatDate(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isToday = formatDate(date) === formatDate(new Date());
          const activeConfig = getActiveConfigForDate(date);
          const worksToday = activeConfig.slots.some(slot => schedule[dateStr]?.[slot.id]?.includes(nurse.userId));

          return (
            <div key={dateStr} className={`p-4 text-center ${isWeekend ? 'bg-slate-100/50' : ''}`}>
              <div className={`text-xs font-medium uppercase tracking-wider ${isToday || worksToday ? 'text-primary' : 'text-slate-500'}`}>
                {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
              </div>
              <div className={`text-xl font-bold ${isToday ? 'text-primary' : isWeekend ? 'text-slate-400' : 'text-slate-700'}`}>
                {date.getDate()}
              </div>
              {isToday && <div className="w-1.5 h-1.5 bg-primary rounded-full mx-auto mt-1"></div>}
            </div>
          );
        })}
      </div>

      {/* Week body */}
      <div className="grid grid-cols-7 flex-1">
        {displayDays.map(date => {
          const dateStr = formatDate(date);
          const activeConfig = getActiveConfigForDate(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const workingSlots = activeConfig.slots.filter(slot => schedule[dateStr]?.[slot.id]?.includes(nurse.userId));
          const worksToday = workingSlots.length > 0;

          return (
            <div
              key={dateStr}
              className={`border-r last:border-r-0 border-slate-200 flex flex-col min-h-[200px] ${isWeekend && !worksToday ? 'bg-slate-100/50' : 'bg-white'}`}
            >
              {/* Creneaux */}
              <div className="flex-1 p-2 space-y-3 overflow-y-auto">
                {worksToday ? (
                  workingSlots.map(slot => {
                    const slotAppts = appointments.filter(a => a.dateStr === dateStr && a.slotId === slot.id && a.nurseId === nurse.userId);
                    const slotKey = `${dateStr}_${slot.id}`;
                    const isCollapsed = collapsedSlots.has(slotKey);

                    return (
                      <div key={slot.id} className="bg-slate-50 border border-slate-200 rounded-lg flex flex-col">
                        {/* Header cliquable */}
                        <button
                          type="button"
                          onClick={() => toggleSlot(slotKey)}
                          className="flex items-center justify-between w-full px-2 py-1.5 text-left hover:bg-slate-100 rounded-t-lg transition-colors"
                        >
                          <div className="text-[10px] font-bold text-primary uppercase flex items-center gap-1">
                            <Clock size={10} /> {slot.name} ({slot.startTime}-{slot.endTime})
                          </div>
                          <div className="flex items-center gap-1.5">
                            {slotAppts.length > 0 && (
                              <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                {slotAppts.length}
                              </span>
                            )}
                            {isCollapsed ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronUp size={12} className="text-slate-400" />}
                          </div>
                        </button>

                        {/* Contenu (masque si replie) */}
                        {!isCollapsed && (
                          <div className="p-2 pt-0 flex flex-col gap-1.5">
                            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 min-h-[50px]">
                              {slotAppts.length > 0 ? (
                                slotAppts.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(rdv => {
                                  const sc = STATUS_CONFIG[rdv.status] || STATUS_CONFIG.scheduled;
                                  const isScheduled = rdv.status === 'scheduled';
                                  const isCanceled = rdv.status === 'canceled';
                                  return (
                                    <div key={rdv.id} className={`p-2 text-xs shadow-sm group relative ${sc.card}`}>
                                      {confirmDeleteId === rdv.id ? (
                                        <div className="flex flex-col gap-1.5">
                                          <p className="text-slate-600 font-medium">Annuler ce RDV ?</p>
                                          <p className="text-slate-400">{rdv.startTime}-{rdv.endTime} — {rdv.patient}</p>
                                          <div className="flex gap-1.5">
                                            <button onClick={() => { deleteRdv(rdv.id); setConfirmDeleteId(null); }} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded py-1 font-medium transition-colors">Confirmer</button>
                                            <button onClick={() => setConfirmDeleteId(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded py-1 font-medium transition-colors">Retour</button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <div className={`font-semibold flex flex-col gap-0.5 ${isCanceled ? 'text-slate-400' : 'text-slate-700'}`}>
                                            <div className="flex items-center gap-1">
                                              <span className={`text-[10px] font-bold uppercase ${isCanceled ? 'text-slate-400 line-through' : 'text-primary'}`}>
                                                {rdv.startTime} - {rdv.endTime}
                                              </span>
                                            </div>
                                            <span className={`text-xs font-bold text-slate-800 truncate ${isCanceled ? 'line-through text-slate-400' : ''}`}>{rdv.patient}</span>
                                            {rdv.careLabels?.length > 0 && (
                                              <span className={`text-[10px] font-medium truncate ${isCanceled ? 'text-slate-300' : 'text-slate-500'}`}>{rdv.careLabels.join(', ')}</span>
                                            )}
                                            {rdv.actCodes?.length > 0 && (
                                              <div className="flex flex-wrap gap-0.5 mt-0.5">
                                                {rdv.actCodes.map(code => (
                                                  <span key={code} className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">{code}</span>
                                                ))}
                                              </div>
                                            )}
                                            {rdv.alert && (
                                              <div className="flex items-center gap-0.5 mt-0.5">
                                                <AlertTriangle size={9} className="text-amber-500" />
                                                <span className="text-[9px] text-amber-600 font-medium">{rdv.alert}</span>
                                              </div>
                                            )}
                                          </div>
                                          {!isCanceled && (
                                            <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                              <button onClick={() => editRdv(rdv)} title="Modifier" className="text-slate-300 hover:text-primary transition-colors"><Pencil size={12}/></button>
                                              {isScheduled && <button onClick={() => setConfirmDeleteId(rdv.id)} title="Annuler" className="text-slate-300 hover:text-red-500 transition-colors"><X size={12}/></button>}
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="h-full flex flex-col justify-center items-center border border-dashed border-slate-200 rounded-lg bg-white/50 py-3">
                                  <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">Creneau libre</span>
                                </div>
                              )}
                            </div>

                            <button onClick={() => openRdvModal(dateStr, slot.id, nurse.userId)} className="w-full bg-primary hover:bg-primary/90 text-white rounded-lg text-xs py-1.5 font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm">
                              <Plus size={12} /> Ajouter
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-slate-50 flex items-center justify-center h-full min-h-[100px]">
                    <div className="text-center">
                      <CalendarOff size={16} className="mx-auto mb-1 text-slate-300" />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Non travaille</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
