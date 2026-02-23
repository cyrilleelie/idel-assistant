import { useState, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, CalendarClock, Clock, Plus, X, Check, Locate, Users } from 'lucide-react';
import { formatDate, getWeekDays, getWeekNumber } from '../../utils/dateTime';

const viewModes = [
  { id: 'week', label: 'Semaine', icon: CalendarDays },
  { id: 'day', label: 'Jour', icon: CalendarClock },
];

export default function AgendasTab({
  nurses, workingNurses, appointments,
  schedule, daysInMonth, currentDate,
  selectedAgendaNurseIds, setSelectedAgendaNurseIds,
  prevMonth, nextMonth,
  getActiveConfigForDate, openRdvModal, deleteRdv
}) {
  const [viewMode, setViewMode] = useState('week');
  const [weekRef, setWeekRef] = useState(() => new Date());
  const [dayRef, setDayRef] = useState(() => new Date());

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
      return Object.values(daySchedule).some(assigned => assigned.includes(nurse.id));
    })
  );

  const selectAllWorking = () => {
    const ids = nursesWorkingDisplayDays.map(n => n.id);
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

      {workingNurses.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          Aucun infirmier n'est planifié pour ce mois-ci.
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
                  nursesWorkingDisplayDays.every(n => selectedAgendaNurseIds.includes(n.id))
                    ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Users size={14} /> Tous
              </button>
            )}
            {workingNurses.map(nurse => {
              const isSelected = selectedAgendaNurseIds.includes(nurse.id);
              return (
                <button
                  key={nurse.id}
                  onClick={() => toggleNurseSelection(nurse.id)}
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
            {selectedAgendaNurseIds.map(nurseId => {
              const nurse = nurses.find(n => n.id === nurseId);
              if (!nurse) return null;
              return (
                <NurseAgenda
                  key={nurseId}
                  nurse={nurse}
                  displayDays={displayDays}
                  viewMode={viewMode}
                  schedule={schedule}
                  appointments={appointments}
                  getActiveConfigForDate={getActiveConfigForDate}
                  openRdvModal={openRdvModal}
                  deleteRdv={deleteRdv}
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
function NurseAgenda({ nurse, displayDays, viewMode, schedule, appointments, getActiveConfigForDate, openRdvModal, deleteRdv }) {
  const isDay = viewMode === 'day';
  const isWeek = viewMode === 'week';

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
      {/* En-tête */}
      <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
        <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
          <div className={`w-4 h-4 rounded-full ${nurse.color.split(' ')[0]}`}></div>
          {nurse.firstName} {nurse.lastName}
        </h3>
      </div>

      {/* Grille des jours */}
      <div className={`flex ${isDay ? '' : 'overflow-x-auto'}`}>
        {displayDays.map(date => {
          const dateStr = formatDate(date);
          const activeConfig = getActiveConfigForDate(date);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const isToday = formatDate(date) === formatDate(new Date());
          const workingSlots = activeConfig.slots.filter(slot => schedule[dateStr]?.[slot.id]?.includes(nurse.id));
          const worksToday = workingSlots.length > 0;

          return (
            <div
              key={dateStr}
              className={`${isDay ? 'flex-1' : isWeek ? 'min-w-[180px] flex-1' : 'min-w-[240px]'} border-r last:border-r-0 border-slate-200 flex flex-col ${isWeekend ? 'bg-slate-50/50' : 'bg-white'}`}
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
                    const slotAppts = appointments.filter(a => a.dateStr === dateStr && a.slotId === slot.id && a.nurseId === nurse.id);
                    return (
                      <div key={slot.id} className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex flex-col gap-2 shadow-sm min-h-[140px]">
                        <div className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                          <Clock size={12} /> {slot.name} ({slot.startTime}-{slot.endTime})
                        </div>

                        <div className="flex-1 overflow-y-auto flex flex-col gap-1 min-h-[60px]">
                          {slotAppts.length > 0 ? (
                            slotAppts.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(rdv => (
                              <div key={rdv.id} className="bg-white rounded border border-blue-100 p-2 text-xs shadow-sm group relative">
                                <div className="font-semibold text-slate-700 flex flex-col gap-0.5">
                                  <span className="text-blue-600 shrink-0 font-bold">{rdv.startTime} - {rdv.endTime}</span>
                                  <span className="truncate">{rdv.patient}</span>
                                </div>
                                <button onClick={() => deleteRdv(rdv.id)} className="absolute top-1 right-1 text-slate-300 hover:text-red-500 hidden group-hover:block transition-colors"><X size={14}/></button>
                              </div>
                            ))
                          ) : (
                            <div className="h-full flex flex-col justify-center items-center border border-dashed border-blue-200 rounded bg-white/50">
                              <span className="text-[10px] text-blue-400/80 uppercase font-medium tracking-wider">Créneau libre</span>
                            </div>
                          )}
                        </div>

                        <button onClick={() => openRdvModal(dateStr, slot.id, nurse.id)} className="w-full bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded text-xs py-1.5 font-medium transition-colors flex items-center justify-center gap-1">
                          <Plus size={14} /> Ajouter RDV
                        </button>
                      </div>
                    );
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
  );
}
