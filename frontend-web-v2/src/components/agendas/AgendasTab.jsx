import { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarClock, Clock, Plus, X, Check, Locate, Users, Pencil, CheckCircle2, Filter, XCircle, CircleDot, Route } from 'lucide-react';
import { formatDate, getWeekDays, getWeekNumber } from '../../utils/dateTime';

const TourneeMap = lazy(() => import('./TourneeMap'));

const STATUS_FILTERS = [
  { key: 'scheduled', label: 'Planifiés', activeClass: 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm' },
  { key: 'completed', label: 'Réalisés', activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm' },
  { key: 'canceled', label: 'Annulés', activeClass: 'bg-red-50 text-red-600 border-red-300 shadow-sm' },
];

const STATUS_CONFIG = {
  scheduled: { label: 'Planifié', badge: 'bg-blue-100 text-blue-700', card: 'bg-white border-blue-100', icon: CircleDot },
  completed: { label: 'Réalisé', badge: 'bg-emerald-100 text-emerald-700', card: 'bg-emerald-50/60 border-emerald-200', icon: CheckCircle2 },
  canceled: { label: 'Annulé', badge: 'bg-red-100 text-red-600', card: 'bg-red-50/40 border-red-200 opacity-60', icon: XCircle },
};

const viewModes = [
  { id: 'week', label: 'Semaine', icon: CalendarDays },
  { id: 'day', label: 'Jour', icon: CalendarClock },
];

export default function AgendasTab({
  nurses, workingNurses, appointments,
  schedule, daysInMonth, currentDate,
  selectedAgendaNurseIds, setSelectedAgendaNurseIds,
  prevMonth, nextMonth,
  getActiveConfigForDate, openRdvModal, deleteRdv, editRdv, completeRdv,
  patients, cabinetData,
}) {
  const [viewMode, setViewMode] = useState('week');
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [dayRef, setDayRef] = useState(() => new Date());
  const [activeStatuses, setActiveStatuses] = useState(() => new Set(['scheduled', 'completed']));

  const toggleStatus = (key) => {
    setActiveStatuses(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); } // keep at least 1
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

  const prevWeek = useCallback(() => setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() - 7)), []);
  const nextWeek = useCallback(() => setWeekRef(w => new Date(w.getFullYear(), w.getMonth(), w.getDate() + 7)), []);
  const prevDay = useCallback(() => setDayRef(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)), []);
  const nextDay = useCallback(() => setDayRef(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)), []);

  const displayDays = viewMode === 'week' ? weekDays : [dayRef];

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

  const handleViewChange = (mode) => {
    setViewMode(mode);
    if (mode === 'week') setWeekRef(new Date());
    if (mode === 'day') setDayRef(new Date());
  };

  const toggleNurseSelection = (nurseId) => {
    setSelectedAgendaNurseIds(prev =>
      prev.includes(nurseId)
        ? prev.length > 1 ? prev.filter(id => id !== nurseId) : prev
        : [...prev, nurseId]
    );
  };

  const navLabel = () => {
    if (viewMode === 'week') return `Semaine ${weekNumber}`;
    return dayRef.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const navPrev = viewMode === 'week' ? prevWeek : prevDay;
  const navNext = viewMode === 'week' ? nextWeek : nextDay;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') navPrev();
      else if (e.key === 'ArrowRight') navNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navPrev, navNext]);

  return (
    <div className="space-y-6">
      {/* Barre de navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 gap-4">
        <div className="flex items-center gap-4">
          <button onClick={navPrev} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-semibold capitalize w-72 text-center">{navLabel()}</h2>
          <button onClick={navNext} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight size={20} /></button>
          <button
            onClick={() => { setWeekRef(new Date()); setDayRef(new Date()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
            title="Aujourd'hui"
          >
            <Locate size={14} /> Aujourd'hui
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            {STATUS_FILTERS.map(f => {
              const on = activeStatuses.has(f.key);
              return (
                <button
                  key={f.key}
                  onClick={() => toggleStatus(f.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${on ? f.activeClass : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                  {on && <Check size={12} />} {f.label}
                </button>
              );
            })}
          </div>
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
        </div>
      </div>

      {nursesWorkingDisplayDays.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          Aucun infirmier n'est planifié sur cette période.
        </div>
      ) : (
        <>
          {/* Sélection des agendas */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-500 mr-1">Agendas :</span>
            {nursesWorkingDisplayDays.length > 1 && (
              <button
                onClick={selectAllWorking}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  nursesWorkingDisplayDays.every(n => selectedAgendaNurseIds.includes(n.userId))
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Users size={14} /> Tous
              </button>
            )}
            {nursesWorkingDisplayDays.map(nurse => {
              const isSelected = selectedAgendaNurseIds.includes(nurse.userId);
              return (
                <button
                  key={nurse.userId}
                  onClick={() => toggleNurseSelection(nurse.userId)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${isSelected ? `${nurse.color} border-current shadow-sm` : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                >
                  {isSelected && <Check size={14} />}
                  {nurse.firstName} {nurse.lastName}
                </button>
              );
            })}
          </div>

          {/* Agendas empilés */}
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
                  viewMode={viewMode}
                  schedule={schedule}
                  appointments={filteredAppointments}
                  getActiveConfigForDate={getActiveConfigForDate}
                  openRdvModal={openRdvModal}
                  deleteRdv={deleteRdv}
                  editRdv={editRdv}
                  completeRdv={completeRdv}
                  patients={patients || []}
                  cabinetData={cabinetData}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Agenda d'un infirmier ---- */
function NurseAgenda({ nurse, displayDays, viewMode, schedule, appointments, getActiveConfigForDate, openRdvModal, deleteRdv, editRdv, completeRdv, patients, cabinetData }) {
  const isDay = viewMode === 'day';
  const isWeek = viewMode === 'week';
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // In day view, compute working slots for the map panel
  const dayDate = isDay ? displayDays[0] : null;
  const dayDateStr = dayDate ? formatDate(dayDate) : null;
  const dayConfig = dayDate ? getActiveConfigForDate(dayDate) : null;
  const dayWorkingSlots = dayConfig ? dayConfig.slots.filter(slot => schedule[dayDateStr]?.[slot.id]?.includes(nurse.userId)) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
      {/* En-tête */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
        <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${nurse.color.split(' ')[0]}`}></div>
          {nurse.firstName} {nurse.lastName}
          {isDay && dayWorkingSlots.length > 0 && (
            <span className="ml-auto text-xs font-medium text-slate-400 flex items-center gap-1"><Route size={14} /> Itinéraire</span>
          )}
        </h3>
      </div>

      {/* Content */}
      <div className="flex flex-col">
        {/* Agenda column (week) / Day header + slot rows (day) */}
        <div className={`${isWeek ? 'flex overflow-x-auto flex-1' : 'flex flex-col'}`}>
          {displayDays.map(date => {
            const dateStr = formatDate(date);
            const activeConfig = getActiveConfigForDate(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = formatDate(date) === formatDate(new Date());
            const workingSlots = activeConfig.slots.filter(slot => schedule[dateStr]?.[slot.id]?.includes(nurse.userId));
            const worksToday = workingSlots.length > 0;

            return (
              <div
                key={dateStr}
                className={`${isDay ? '' : isWeek ? 'min-w-[180px] flex-1' : 'min-w-[240px]'} ${isWeek ? 'border-r last:border-r-0 border-slate-200' : ''} flex flex-col ${isWeekend ? 'bg-slate-50/50' : 'bg-white'}`}
              >
                {/* En-tête du jour */}
                <div className={`p-3 border-b border-slate-200 text-center ${worksToday ? 'bg-blue-50/80 border-blue-100' : 'bg-slate-50'}`}>
                  <div className={`text-xs font-medium uppercase ${worksToday ? 'text-blue-600' : 'text-slate-500'}`}>
                    {date.toLocaleDateString('fr-FR', { weekday: isDay ? 'long' : isWeek ? 'short' : 'short' })}
                  </div>
                  <div className={`text-2xl font-bold ${isToday ? 'text-blue-600' : worksToday ? 'text-blue-700' : 'text-slate-700'}`}>{date.getDate()}</div>
                  {isDay && <div className="text-xs text-slate-400 capitalize">{date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>}
                </div>

                {/* Créneaux */}
                <div className="flex-1 p-3 space-y-4 overflow-y-auto">
                  {worksToday ? (
                    workingSlots.map(slot => {
                      const slotAppts = appointments.filter(a => a.dateStr === dateStr && a.slotId === slot.id && a.nurseId === nurse.userId);

                      const slotCard = (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex flex-col gap-2 shadow-sm min-h-[140px]">
                          <div className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                            <Clock size={12} /> {slot.name} ({slot.startTime}-{slot.endTime})
                          </div>

                          <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-[60px]">
                            {slotAppts.length > 0 ? (
                              slotAppts.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(rdv => {
                                const sc = STATUS_CONFIG[rdv.status] || STATUS_CONFIG.scheduled;
                                const isScheduled = rdv.status === 'scheduled';
                                const isCanceled = rdv.status === 'canceled';
                                return (
                                <div key={rdv.id} className={`rounded border p-2 text-xs shadow-sm group relative ${sc.card}`}>
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
                                        <div className="flex items-center gap-1.5">
                                          <span className={`shrink-0 font-bold ${isCanceled ? 'text-slate-400 line-through' : 'text-blue-600'}`}>{rdv.startTime} - {rdv.endTime}</span>
                                          <span className={`text-[9px] font-semibold uppercase px-1 py-0.5 rounded ${sc.badge}`}>{sc.label}</span>
                                        </div>
                                        <span className={`truncate ${isCanceled ? 'line-through' : ''}`}>{rdv.patient}</span>
                                      </div>
                                      {!isCanceled && (
                                        <div className="absolute top-1 right-1 hidden group-hover:flex gap-1">
                                          {isScheduled && <button onClick={() => completeRdv(rdv.id)} title="Marquer réalisé" className="text-slate-300 hover:text-emerald-500 transition-colors"><CheckCircle2 size={14}/></button>}
                                          <button onClick={() => editRdv(rdv)} title="Modifier" className="text-slate-300 hover:text-blue-500 transition-colors"><Pencil size={14}/></button>
                                          {isScheduled && <button onClick={() => setConfirmDeleteId(rdv.id)} title="Annuler" className="text-slate-300 hover:text-red-500 transition-colors"><X size={14}/></button>}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                                );
                              })
                            ) : (
                              <div className="h-full flex flex-col justify-center items-center border border-dashed border-blue-200 rounded bg-white/50">
                                <span className="text-[10px] text-blue-400/80 uppercase font-medium tracking-wider">Créneau libre</span>
                              </div>
                            )}
                          </div>

                          <button onClick={() => openRdvModal(dateStr, slot.id, nurse.userId)} className="w-full bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded text-xs py-1.5 font-medium transition-colors flex items-center justify-center gap-1">
                            <Plus size={14} /> Ajouter RDV
                          </button>
                        </div>
                      );

                      if (isDay) {
                        return (
                          <div key={slot.id} className="flex flex-col lg:flex-row gap-3 items-stretch">
                            <div className="lg:w-[30%] shrink-0">{slotCard}</div>
                            <div className="flex-1">
                              <Suspense fallback={<div className="flex items-center justify-center aspect-square text-sm text-slate-400">Chargement carte...</div>}>
                                <TourneeMap
                                  appointments={slotAppts}
                                  patients={patients}
                                  cabinetData={cabinetData}
                                  slotName={`${slot.name} (${slot.startTime}-${slot.endTime})`}
                                />
                              </Suspense>
                            </div>
                          </div>
                        );
                      }

                      return <div key={slot.id}>{slotCard}</div>;
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center min-h-[100px]"><span className="text-xs text-slate-400 italic">Non travaillé</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
