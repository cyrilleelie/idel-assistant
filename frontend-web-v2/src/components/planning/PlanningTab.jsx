import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Lock, ShieldCheck, Calendar, CalendarDays, Locate, Eye } from 'lucide-react';
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
}) {
  const [viewMode, setViewMode] = useState('month');
  const [weekRef, setWeekRef] = useState(() => new Date());

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
      <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 gap-4">

        {/* Navigation mois ou semaine */}
        <div className="flex items-center gap-4">
          <button onClick={viewMode === 'month' ? prevMonth : prevWeek} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft size={20} /></button>
          <h2 className="text-xl font-semibold capitalize w-56 text-center">
            {viewMode === 'month'
              ? currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
              : <>Semaine {weekNumber}</>
            }
          </h2>
          <button onClick={viewMode === 'month' ? nextMonth : nextWeek} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight size={20} /></button>
          <button
            onClick={() => { goToCurrentMonth(); setWeekRef(new Date()); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors"
            title="Aujourd'hui"
          >
            <Locate size={14} /> Aujourd'hui
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Consultation badge in readOnly mode */}
          {readOnly && (
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
              <Eye size={14} /> Consultation
            </span>
          )}

          {/* Statut planning — uniquement en vue mois, masqué en readOnly */}
          {!readOnly && viewMode === 'month' && (
            <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
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
          )}

          {/* Toggle mois / semaine */}
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

      {configs.length === 0 || configs.every(c => c.slots.length === 0) || nurses.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          Veuillez configurer l'équipe et les créneaux.
        </div>
      ) : (
        <div ref={tableContainerRef} onWheel={handleTableWheel} className="overflow-x-auto pb-4">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                <th className="p-3 border-b-2 border-slate-200 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-20 w-48 shadow-[1px_0_0_0_#e2e8f0]">Infirmier</th>
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
                  <td className="p-3 sticky left-0 bg-white z-10 shadow-[1px_0_0_0_#e2e8f0] group-hover:bg-slate-50/50 transition-colors">
                    <div className="font-medium text-slate-700 flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${nurse.color.split(' ')[0]}`}></div>
                      {nurse.firstName} {nurse.lastName}
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
    </div>
  );
}
