import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Trash2, ChevronDown, ChevronUp, FileUp, X, File,
  Calendar, Clock, RefreshCw, MessageSquare, Pencil, Users,
  ClipboardList, CalendarDays, Check, Loader2
} from 'lucide-react';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: '1x / jour' },
  { value: '2xday', label: '2x / jour' },
  { value: '3xday', label: '3x / jour' },
  { value: 'weekly', label: '1x / semaine' },
  { value: '2xweek', label: '2x / semaine' },
  { value: '3xweek', label: '3x / semaine' },
  { value: 'custom', label: 'Personnalisé' },
];

function frequencyLabel(freq) {
  return FREQUENCY_OPTIONS.find(o => o.value === freq)?.label || freq;
}

function formatDateFr(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function emptySoin() {
  return {
    id: 'soin_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: '',
    startDate: '',
    endDate: '',
    frequency: 'daily',
    customFrequency: '',
    notes: '',
    documents: [],
  };
}

function emptyCarePlan() {
  return {
    id: 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    soins: [emptySoin()],
    careSchedule: {
      startTime: '',
      endTime: '',
    },
  };
}

// --- Occurrence generation helpers ---

function generateOccurrences(startDate, endDate, frequency) {
  const dates = [];
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start) || isNaN(end) || start > end) return dates;

  let current = new Date(start);
  const dayStep = {
    'daily': 1,
    '2xday': 1,
    '3xday': 1,
    'weekly': 7,
    '2xweek': null,
    '3xweek': null,
  };

  if (frequency === '2xweek') {
    while (current <= end) {
      const dow = current.getDay();
      if (dow === 1 || dow === 4) dates.push(toDateStr(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
  if (frequency === '3xweek') {
    while (current <= end) {
      const dow = current.getDay();
      if (dow === 1 || dow === 3 || dow === 5) dates.push(toDateStr(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  const step = dayStep[frequency];
  if (!step) return dates;

  while (current <= end) {
    dates.push(toDateStr(current));
    current.setDate(current.getDate() + step);
  }
  return dates;
}

/**
 * Generate the union of occurrences from all soins in a care plan.
 * Each soin generates its own occurrences, then we merge + dedupe + sort.
 */
function generateUnionOccurrences(soins) {
  const allDates = new Set();
  for (const soin of soins) {
    if (!soin.startDate || !soin.endDate || !soin.frequency || soin.frequency === 'custom') continue;
    const dates = generateOccurrences(soin.startDate, soin.endDate, soin.frequency);
    for (const d of dates) allDates.add(d);
  }
  return [...allDates].sort();
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function slotsOverlap(s1, e1, s2, e2) {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(s2) < timeToMinutes(e1);
}

// Helper: get plan-level dates from soins
function getPlanDates(soins) {
  const starts = soins.map(s => s.startDate).filter(Boolean).sort();
  const ends = soins.map(s => s.endDate).filter(Boolean).sort();
  return {
    startDate: starts[0] || '',
    endDate: ends[ends.length - 1] || '',
  };
}

// Helper: get plan-level label from soins
function getPlanLabel(soins) {
  return soins.map(s => s.label?.trim()).filter(Boolean).join(', ') || 'Sans titre';
}

// Helper: count total documents across soins
function totalDocuments(soins) {
  return soins.reduce((sum, s) => sum + (s.documents?.length || 0), 0);
}

// --- PlanningSection component ---

function PlanningSection({ plan, patientId, nurses, appointments, schedule, configs, getActiveConfigForDate, onCreateAppointment, onEnsureSaved }) {
  const { soins, careSchedule } = plan;
  const { startTime, endTime } = careSchedule;

  const [selectedNurseByDate, setSelectedNurseByDate] = useState({});
  const [bookingInProgress, setBookingInProgress] = useState(null); // dateStr | 'bulk'
  const [bookingError, setBookingError] = useState(null);
  const [bulkProgress, setBulkProgress] = useState(null); // { done, total, errors } | null

  const selectNurse = (dateStr, userId) => {
    setSelectedNurseByDate(prev => ({
      ...prev,
      [dateStr]: prev[dateStr] === userId ? '' : userId,
    }));
  };

  // Build occurrences from union of all soins + classify each as planned or to-plan
  const { planned, toPlan, totalOccurrences } = useMemo(() => {
    if (!startTime || !endTime || !soins || soins.length === 0) {
      return { planned: [], toPlan: [], totalOccurrences: 0 };
    }

    // Check if all soins are custom frequency (can't generate occurrences)
    const allCustom = soins.every(s => s.frequency === 'custom' || !s.startDate || !s.endDate);
    if (allCustom) {
      return { planned: [], toPlan: [], totalOccurrences: 0 };
    }

    const occurrences = generateUnionOccurrences(soins);
    const limited = occurrences.slice(0, 90);
    const plannedList = [];
    const toPlanList = [];

    const patientAppts = (appointments || []).filter(a => a.patientId === patientId && a.status === 'scheduled');

    for (const dateStr of limited) {
      const dateObj = new Date(dateStr + 'T00:00:00');

      const existingAppt = patientAppts.find(a =>
        a.dateStr === dateStr && a.startTime === startTime && a.endTime === endTime
      );

      if (existingAppt) {
        const nurse = (nurses || []).find(n => n.userId === existingAppt.nurseId);
        plannedList.push({ dateStr, dateObj, appointment: existingAppt, nurse });
      } else {
        const config = getActiveConfigForDate ? getActiveConfigForDate(dateObj) : null;
        const daySchedule = schedule?.[dateStr] || {};
        const availableNurses = [];

        if (config?.slots && nurses) {
          for (const slot of config.slots) {
            if (timeToMinutes(slot.startTime) <= timeToMinutes(startTime) &&
                timeToMinutes(slot.endTime) >= timeToMinutes(endTime)) {
              const assignedIds = daySchedule[slot.id] || [];
              for (const userId of assignedIds) {
                const nurse = nurses.find(n => n.userId === userId && n.active !== false);
                if (!nurse) continue;
                const nurseAppts = (appointments || []).filter(
                  a => a.dateStr === dateStr && a.nurseId === nurse.userId && a.status === 'scheduled'
                );
                const hasConflict = nurseAppts.some(a => slotsOverlap(startTime, endTime, a.startTime, a.endTime));
                if (!hasConflict && !availableNurses.find(n => n.userId === nurse.userId)) {
                  availableNurses.push(nurse);
                }
              }
            }
          }
        }

        toPlanList.push({ dateStr, dateObj, availableNurses });
      }
    }

    return { planned: plannedList, toPlan: toPlanList, totalOccurrences: occurrences.length };
  }, [soins, startTime, endTime, patientId, nurses, appointments, schedule, configs, getActiveConfigForDate]);

  // Auto-select first available nurse for each slot
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const updates = {};
    for (const { dateStr, availableNurses } of toPlan) {
      if (availableNurses.length >= 1 && !selectedNurseByDate[dateStr]) {
        updates[dateStr] = availableNurses[0].userId;
      }
    }
    if (Object.keys(updates).length > 0) {
      setSelectedNurseByDate(prev => ({ ...prev, ...updates }));
    }
  }, [toPlan]);

  const handleBook = async (dateStr) => {
    const nurseId = selectedNurseByDate[dateStr];
    if (!nurseId || !onCreateAppointment || !patientId) return;

    setBookingInProgress(dateStr);
    setBookingError(null);
    try {
      let protocolId = plan._apiId || null;
      if (!protocolId && onEnsureSaved) {
        protocolId = await onEnsureSaved();
      }
      await onCreateAppointment({ dateStr, startTime, endTime, nurseId, patientId, careProtocolId: protocolId });
      setSelectedNurseByDate(prev => { const next = { ...prev }; delete next[dateStr]; return next; });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setBookingError({ dateStr, message: detail || 'Erreur lors de la création du RDV.' });
    } finally {
      setBookingInProgress(null);
    }
  };

  // Book all toPlan slots that have a selected nurse
  const handleBookAll = async () => {
    if (!onCreateAppointment || !patientId) return;

    const bookable = toPlan.filter(({ dateStr, availableNurses }) =>
      selectedNurseByDate[dateStr] && availableNurses.length > 0
    );
    if (bookable.length === 0) return;

    setBookingInProgress('bulk');
    setBookingError(null);
    setBulkProgress({ done: 0, total: bookable.length, errors: [] });

    // Ensure prescription is saved first
    let protocolId = plan._apiId || null;
    if (!protocolId && onEnsureSaved) {
      try {
        protocolId = await onEnsureSaved();
      } catch {
        setBookingError({ dateStr: '', message: 'Impossible de sauvegarder le plan de soins.' });
        setBookingInProgress(null);
        setBulkProgress(null);
        return;
      }
    }

    const errors = [];
    let done = 0;
    for (const { dateStr } of bookable) {
      const nurseId = selectedNurseByDate[dateStr];
      try {
        await onCreateAppointment({ dateStr, startTime, endTime, nurseId, patientId, careProtocolId: protocolId });
        setSelectedNurseByDate(prev => { const next = { ...prev }; delete next[dateStr]; return next; });
      } catch (err) {
        const detail = err.response?.data?.detail;
        errors.push({ dateStr, message: detail || 'Erreur' });
      }
      done++;
      setBulkProgress({ done, total: bookable.length, errors });
    }

    setBookingInProgress(null);
    if (errors.length > 0) {
      setBookingError({ dateStr: '', message: `${errors.length} erreur${errors.length > 1 ? 's' : ''} sur ${bookable.length} RDV.` });
    }
    // Keep bulkProgress visible briefly then clear
    setTimeout(() => setBulkProgress(null), 2000);
  };

  const dayName = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short' });
  const dayMonth = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  if (totalOccurrences === 0) return null;

  const remainingCount = toPlan.length;
  const plannedCount = planned.length;
  const bookableCount = toPlan.filter(({ dateStr, availableNurses }) =>
    selectedNurseByDate[dateStr] && availableNurses.length > 0
  ).length;
  const isBulkBooking = bookingInProgress === 'bulk';

  return (
    <div className="space-y-4">

      {/* Counters + Tout programmer */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {totalOccurrences} séance{totalOccurrences > 1 ? 's' : ''} au total
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
          <Check size={12} /> {plannedCount} planifié{plannedCount > 1 ? 's' : ''}
        </span>
        {remainingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
            {remainingCount} restant{remainingCount > 1 ? 's' : ''}
          </span>
        )}
        {bookableCount > 0 && (
          <button
            onClick={handleBookAll}
            disabled={isBulkBooking}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors ml-auto"
          >
            {isBulkBooking ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {bulkProgress ? `${bulkProgress.done}/${bulkProgress.total}` : 'En cours...'}
              </>
            ) : (
              <>
                <CalendarDays size={12} />
                Tout programmer ({bookableCount})
              </>
            )}
          </button>
        )}
      </div>

      {/* Already planned appointments */}
      {planned.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">RDV planifiés</div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {planned.map(({ dateStr, dateObj, nurse }) => (
              <div key={dateStr} className="flex items-center gap-3 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-200 text-sm">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <div className="w-24 shrink-0 font-medium text-slate-700 capitalize">
                  {dayName(dateObj)} {dayMonth(dateObj)}
                </div>
                <div className="text-slate-500 shrink-0">
                  {startTime}–{endTime}
                </div>
                {nurse && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${nurse.color?.split(' ').slice(0, 2).join(' ') || 'bg-slate-100 text-slate-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${nurse.color?.split(' ')[0] || 'bg-slate-400'}`} />
                    {nurse.firstName} {nurse.lastName}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* To-plan occurrences */}
      {toPlan.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">Séances à planifier</div>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {toPlan.map(({ dateStr, dateObj, availableNurses }) => {
              const isBooking = bookingInProgress === dateStr || isBulkBooking;
              const error = bookingError?.dateStr === dateStr ? bookingError.message : null;
              const selectedNurse = selectedNurseByDate[dateStr] || '';

              return (
                <div key={dateStr} className="bg-white rounded-lg px-3 py-2 border border-slate-200 text-sm space-y-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-24 shrink-0 font-medium text-slate-700 capitalize">
                      {dayName(dateObj)} {dayMonth(dateObj)}
                    </div>
                    <div className="text-slate-500 shrink-0">
                      {startTime}–{endTime}
                    </div>

                    {availableNurses.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {availableNurses.map(n => {
                            const isSelected = selectedNurse === n.userId;
                            return (
                              <button
                                key={n.userId}
                                type="button"
                                onClick={() => !isBooking && selectNurse(dateStr, n.userId)}
                                disabled={isBooking}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 ${
                                  isSelected
                                    ? 'ring-2 ring-blue-500 ring-offset-1 border-blue-400 bg-blue-50 text-blue-800'
                                    : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${n.color?.split(' ')[0] || 'bg-slate-400'}`} />
                                {n.firstName}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => handleBook(dateStr)}
                          disabled={!selectedNurse || isBooking}
                          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-1 rounded-lg text-xs font-medium transition-colors shrink-0"
                        >
                          {isBooking ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Prendre RDV
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-amber-600 italic">Aucun membre disponible</span>
                    )}
                  </div>
                  {error && (
                    <p className="text-xs text-red-600">{error}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk booking error */}
      {bookingError?.dateStr === '' && bookingError.message && (
        <p className="text-xs text-red-600 font-medium">{bookingError.message}</p>
      )}

      {totalOccurrences > 90 && (
        <p className="text-xs text-slate-400 italic">Affichage limité aux 90 premières séances.</p>
      )}
    </div>
  );
}

// --- SoinFormItem: individual soin inside CarePlanForm ---

function SoinFormItem({ soin, index, onChange, onRemove, canRemove, careLabels = [] }) {
  const [dragOver, setDragOver] = useState(false);
  const [showLabelSuggestions, setShowLabelSuggestions] = useState(false);

  const update = (field, value) => {
    onChange({ ...soin, [field]: value });
  };

  const handleFiles = (files) => {
    const newDocs = Array.from(files).map(f => ({
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: f.name,
      size: f.size,
      url: URL.createObjectURL(f),
    }));
    update('documents', [...(soin.documents || []), ...newDocs]);
  };

  const removeDoc = (docId) => {
    update('documents', (soin.documents || []).filter(d => d.id !== docId));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="border border-slate-200 bg-white rounded-lg p-4 space-y-3 relative">
      {/* Header with number + remove button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Soin {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
            title="Supprimer ce soin"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Nom du soin */}
      <div className="relative">
        <label className="block text-xs font-medium text-slate-600 mb-1">Nom du soin *</label>
        <input
          type="text"
          value={soin.label}
          onChange={e => { update('label', e.target.value); setShowLabelSuggestions(true); }}
          onFocus={() => setShowLabelSuggestions(true)}
          onBlur={() => setTimeout(() => setShowLabelSuggestions(false), 150)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          placeholder="Ex: Pansement post-opératoire, Injection insuline..."
          autoComplete="off"
        />
        {showLabelSuggestions && careLabels.length > 0 && (() => {
          const query = soin.label.toLowerCase();
          const filtered = careLabels.filter(l => l.toLowerCase().includes(query));
          if (filtered.length === 0) return null;
          if (filtered.length === 1 && filtered[0].toLowerCase() === query) return null;
          return (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(label => (
                <li
                  key={label}
                  onMouseDown={() => { update('label', label); setShowLabelSuggestions(false); }}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 hover:text-blue-700 transition-colors"
                >
                  {label}
                </li>
              ))}
            </ul>
          );
        })()}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date de début *</label>
          <input
            type="date"
            value={soin.startDate}
            onChange={e => update('startDate', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin *</label>
          <input
            type="date"
            value={soin.endDate}
            onChange={e => update('endDate', e.target.value)}
            min={soin.startDate}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          />
        </div>
      </div>

      {/* Fréquence */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence</label>
        <select
          value={soin.frequency}
          onChange={e => update('frequency', e.target.value)}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
        >
          {FREQUENCY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {soin.frequency === 'custom' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence personnalisée</label>
          <input
            type="text"
            value={soin.customFrequency}
            onChange={e => update('customFrequency', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Ex: Tous les 2 jours, Lundi et Jeudi..."
          />
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Précisions sur le soin</label>
        <textarea
          value={soin.notes}
          onChange={e => update('notes', e.target.value)}
          rows={2}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          placeholder="Détails, matériel nécessaire..."
        />
      </div>

      {/* Documents */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-600">Documents</label>

        {(soin.documents || []).length > 0 && (
          <div className="space-y-1">
            {soin.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <File size={14} className="text-slate-400 shrink-0" />
                  <span className="truncate">{doc.name}</span>
                  <span className="text-slate-400 text-xs shrink-0">({(doc.size / 1024).toFixed(0)} Ko)</span>
                </div>
                <button onClick={() => removeDoc(doc.id)} className="text-red-400 hover:text-red-600 shrink-0 ml-2">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-3 text-center transition-colors cursor-pointer ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 bg-slate-50'}`}
          onClick={() => document.getElementById('soin-file-input-' + soin.id)?.click()}
        >
          <FileUp size={16} className="mx-auto text-slate-400 mb-0.5" />
          <p className="text-xs text-slate-500">Glisser ou <span className="text-blue-600 font-medium">parcourir</span></p>
          <input
            id={'soin-file-input-' + soin.id}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>
    </div>
  );
}

// --- CarePlanForm component ---

function CarePlanForm({ plan, onChange, onCancel, onSave, saving, saveError, nurses, appointments, schedule, configs, getActiveConfigForDate, onCreateAppointment, patientId, careLabels = [], onEnsureSaved }) {
  const updateSoin = (index, updatedSoin) => {
    const newSoins = [...plan.soins];
    newSoins[index] = updatedSoin;
    onChange({ ...plan, soins: newSoins });
  };

  const removeSoin = (index) => {
    const newSoins = plan.soins.filter((_, i) => i !== index);
    onChange({ ...plan, soins: newSoins });
  };

  const addSoin = () => {
    if (plan.soins.length >= 5) return;
    onChange({ ...plan, soins: [...plan.soins, emptySoin()] });
  };

  const updateSchedule = (field, value) => {
    onChange({
      ...plan,
      careSchedule: { ...plan.careSchedule, [field]: value },
    });
  };

  // Validation: at least 1 soin with label + dates
  const isValid = plan.soins.some(s => s.label.trim() && s.startDate && s.endDate);

  // Show planning if at least one soin has valid dates+frequency and times are set
  const hasValidSoin = plan.soins.some(s => s.startDate && s.endDate && s.frequency && s.frequency !== 'custom');
  const showPlanning = hasValidSoin && plan.careSchedule.startTime && plan.careSchedule.endTime;

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-5 space-y-5">

      {/* ═══════ SECTION 1 : Soins ═══════ */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
          <ClipboardList size={16} className="text-blue-600" /> Soins
        </h4>

        <div className="space-y-3">
          {plan.soins.map((soin, index) => (
            <SoinFormItem
              key={soin.id}
              soin={soin}
              index={index}
              onChange={(updated) => updateSoin(index, updated)}
              onRemove={() => removeSoin(index)}
              canRemove={plan.soins.length > 1}
              careLabels={careLabels}
            />
          ))}
        </div>

        {plan.soins.length < 5 && (
          <button
            type="button"
            onClick={addSoin}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center border border-dashed border-blue-300"
          >
            <Plus size={14} /> Ajouter un soin ({plan.soins.length}/5)
          </button>
        )}
      </div>

      {/* ═══════ SECTION 2 : Planification ═══════ */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
          <CalendarDays size={16} className="text-blue-600" /> Planification
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Heure de début</label>
            <input
              type="time"
              value={plan.careSchedule.startTime}
              onChange={e => updateSchedule('startTime', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Heure de fin</label>
            <input
              type="time"
              value={plan.careSchedule.endTime}
              onChange={e => updateSchedule('endTime', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>

        {showPlanning ? (
          <PlanningSection
            plan={plan}
            patientId={patientId}
            nurses={nurses}
            appointments={appointments}
            schedule={schedule}
            configs={configs}
            getActiveConfigForDate={getActiveConfigForDate}
            onCreateAppointment={onCreateAppointment}
            onEnsureSaved={onEnsureSaved}
          />
        ) : (
          <p className="text-xs text-slate-400 italic">
            Renseignez les dates, la fréquence et les horaires pour afficher le planning prévisionnel.
          </p>
        )}
      </div>

      {/* ═══════ Actions ═══════ */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        {saveError && (
          <p className="text-sm text-red-600 text-right">{saveError}</p>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={saving} className="text-slate-600 hover:bg-slate-100 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={!isValid || saving}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? 'Enregistrement...' : 'Valider le plan de soins'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- CarePlanCard component ---

function CarePlanCard({ plan, isEditing, onEdit, onDelete, expanded, onToggle, appointments, nurses, patientId }) {
  const { soins, careSchedule } = plan;
  const { startTime, endTime } = careSchedule;
  const { startDate, endDate } = getPlanDates(soins);
  const planLabel = getPlanLabel(soins);
  const isActive = endDate >= new Date().toISOString().split('T')[0];
  const docCount = totalDocuments(soins);

  // Compute associated appointments and remaining count
  const { matchingAppts, totalOccurrences, plannedCount, remainingCount } = useMemo(() => {
    if (!patientId || !startDate || !endDate || !startTime || !endTime) {
      return { matchingAppts: [], totalOccurrences: 0, plannedCount: 0, remainingCount: 0 };
    }

    const patientAppts = (appointments || []).filter(a => a.patientId === patientId && a.status === 'scheduled');
    const matching = patientAppts.filter(a => {
      if (a.careProtocolId && plan._apiId) {
        return a.careProtocolId === plan._apiId;
      }
      return a.startTime === startTime && a.endTime === endTime
        && a.dateStr >= startDate && a.dateStr <= endDate;
    });

    // Check if all soins are custom
    const allCustom = soins.every(s => s.frequency === 'custom' || !s.frequency || !s.startDate || !s.endDate);
    if (allCustom) {
      return { matchingAppts: [...matching].sort((a, b) => a.dateStr.localeCompare(b.dateStr)), totalOccurrences: 0, plannedCount: matching.length, remainingCount: 0 };
    }

    const occurrences = generateUnionOccurrences(soins);
    const matchedDates = new Set(matching.map(a => a.dateStr));
    const planned = occurrences.filter(d => matchedDates.has(d)).length;

    return {
      matchingAppts: [...matching].sort((a, b) => a.dateStr.localeCompare(b.dateStr)),
      totalOccurrences: occurrences.length,
      plannedCount: planned,
      remainingCount: occurrences.length - planned,
    };
  }, [plan, soins, appointments, patientId, startDate, endDate, startTime, endTime]);

  const hasStats = totalOccurrences > 0 || plannedCount > 0;
  const allPlanned = hasStats && remainingCount === 0;
  const today = toDateStr(new Date());
  const isTerminee = endDate < today && matchingAppts.length === 0;

  return (
    <div className={`border rounded-lg transition-shadow ${isTerminee ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 bg-white'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          {isTerminee ? (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 shrink-0">Terminé</span>
          ) : (
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">En cours</span>
          )}
          <span className="font-medium text-slate-800 truncate">{planLabel}</span>
          <span className="text-xs text-slate-500 shrink-0">
            {formatDateFr(startDate)} — {formatDateFr(endDate)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {hasStats && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${allPlanned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {plannedCount}/{totalOccurrences} RDV{remainingCount > 0 && <span className="ml-1 opacity-75">({remainingCount} restant{remainingCount > 1 ? 's' : ''})</span>}
            </span>
          )}
          {docCount > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {docCount} doc{docCount > 1 ? 's' : ''}
            </span>
          )}
          {/* Per-soin frequency badges */}
          {soins.length === 1 ? (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {soins[0].frequency === 'custom'
                ? (soins[0].customFrequency || 'Personnalisé')
                : frequencyLabel(soins[0].frequency)}
            </span>
          ) : (
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {soins.length} soins
            </span>
          )}
          {startTime && endTime && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              {startTime}–{endTime}
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Body (expanded) */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">

          {/* Détails par soin */}
          {soins.map((soin, idx) => (
            <div key={soin.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase">Soin {idx + 1}</span>
                <span className="font-medium text-sm text-slate-800">{soin.label || 'Sans titre'}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar size={14} className="text-blue-500" />
                  <span>{formatDateFr(soin.startDate)} — {formatDateFr(soin.endDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <RefreshCw size={14} className="text-blue-500" />
                  <span>
                    {soin.frequency === 'custom'
                      ? (soin.customFrequency || 'Personnalisé')
                      : frequencyLabel(soin.frequency)}
                  </span>
                </div>
              </div>
              {soin.notes && (
                <div className="text-sm text-slate-600">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-0.5">
                    <MessageSquare size={12} /> Notes
                  </div>
                  <p className="whitespace-pre-wrap">{soin.notes}</p>
                </div>
              )}
              {(soin.documents || []).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Documents</div>
                  <div className="space-y-1">
                    {soin.documents.map(doc => (
                      <a
                        key={doc.id}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        <File size={14} className="text-slate-400" />
                        <span className="truncate">{doc.name}</span>
                        <span className="text-slate-400 text-xs shrink-0">({(doc.size / 1024).toFixed(0)} Ko)</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Horaire du plan */}
          {startTime && endTime && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={14} className="text-blue-500" />
              <span>Créneau : {startTime}–{endTime}</span>
            </div>
          )}

          {/* RDV associés */}
          {(matchingAppts.length > 0 || (hasStats && remainingCount > 0)) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <CalendarDays size={12} /> Rendez-vous
                </div>
                {hasStats && (
                  <span className={`text-xs font-medium ${allPlanned ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {plannedCount} programmé{plannedCount > 1 ? 's' : ''} / {totalOccurrences}
                    {remainingCount > 0 && ` — ${remainingCount} restant${remainingCount > 1 ? 's' : ''}`}
                  </span>
                )}
              </div>
              {matchingAppts.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {matchingAppts.map(appt => {
                    const nurse = (nurses || []).find(n => n.userId === appt.nurseId);
                    return (
                      <div key={appt.id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-1.5 text-sm">
                        <span className="text-slate-500 font-mono text-xs w-20 shrink-0">{formatDateFr(appt.dateStr)}</span>
                        <span className="text-blue-600 font-medium text-xs w-24 shrink-0">{appt.startTime}–{appt.endTime}</span>
                        {nurse && (
                          <span className="text-slate-600 text-xs truncate">{nurse.firstName} {nurse.lastName}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">Aucun RDV programmé</p>
              )}
            </div>
          )}

          {/* Actions édition */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={onEdit} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
              <Pencil size={14} /> Modifier
            </button>
            <button onClick={onDelete} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
              <Trash2 size={14} /> Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main PrescriptionsTab component ---

export default function PrescriptionsTab({
  patientForm, setPatientForm, isEditingPatient, setIsEditingPatient,
  nurses, appointments, schedule, configs, getActiveConfigForDate,
  onCreateAppointment, onCancelAppointment,
  onSavePrescription, onDeletePrescription, prescriptionsLoading,
  careLabels
}) {
  const prescriptions = patientForm.prescriptions || [];
  const [expandedId, setExpandedId] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | 'add' | planId (edit)
  const [formData, setFormData] = useState(null);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Sort by earliest soin startDate (descending)
  const sortedPrescriptions = [...prescriptions].sort((a, b) => {
    const aStart = getPlanDates(a.soins || []).startDate || '';
    const bStart = getPlanDates(b.soins || []).startDate || '';
    return bStart.localeCompare(aStart);
  });

  const updatePrescriptions = (newList) => {
    setPatientForm({ ...patientForm, prescriptions: newList });
  };

  const startAdd = () => {
    if (!isEditingPatient && setIsEditingPatient) {
      setIsEditingPatient(true);
    }
    setFormData(emptyCarePlan());
    setFormMode('add');
  };

  const startEdit = (rx) => {
    setFormData({
      ...rx,
      soins: rx.soins.map(s => ({ ...s, documents: [...(s.documents || [])] })),
      careSchedule: { ...rx.careSchedule },
    });
    setFormMode(rx.id);
  };

  const cancelForm = () => {
    setFormMode(null);
    setFormData(null);
    setSaveError('');
  };

  // Auto-save the plan to backend (called on first booking attempt if not yet persisted)
  const ensurePlanSaved = async () => {
    if (formData._apiId) return formData._apiId;
    if (!onSavePrescription || !patientForm.id) return null;
    const hasValidSoin = formData.soins.some(s => s.label.trim() && s.startDate && s.endDate);
    if (!hasValidSoin) return null;

    const saved = await onSavePrescription(formData, patientForm.id);
    setFormData(prev => ({ ...prev, _apiId: saved._apiId, id: saved.id }));
    if (formMode === 'add') {
      updatePrescriptions([...prescriptions, saved]);
      setFormMode(saved.id);
    } else {
      updatePrescriptions(prescriptions.map(rx => rx.id === formMode ? saved : rx));
    }
    return saved._apiId;
  };

  const saveForm = async () => {
    const hasValidSoin = formData.soins.some(s => s.label.trim() && s.startDate && s.endDate);
    if (!hasValidSoin) return;
    setSaveError('');
    setSavingPrescription(true);
    try {
      if (onSavePrescription && patientForm.id) {
        const saved = await onSavePrescription(formData, patientForm.id);
        if (formMode === 'add') {
          updatePrescriptions([...prescriptions, saved]);
        } else {
          updatePrescriptions(prescriptions.map(rx => rx.id === formMode ? saved : rx));
        }
      } else {
        if (formMode === 'add') {
          updatePrescriptions([...prescriptions, formData]);
        } else {
          updatePrescriptions(prescriptions.map(rx => rx.id === formMode ? formData : rx));
        }
      }
      cancelForm();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setSaveError(detail || 'Erreur lors de l\'enregistrement du plan de soins.');
    } finally {
      setSavingPrescription(false);
    }
  };

  const deletePlan = async (id) => {
    const rx = prescriptions.find(r => r.id === id);
    if (!rx) return;

    const today = toDateStr(new Date());
    const { startTime, endTime } = rx.careSchedule;
    const { startDate, endDate } = getPlanDates(rx.soins || []);

    const matchingAppts = patientForm.id ? (appointments || []).filter(a => {
      if (a.patientId !== patientForm.id || a.status !== 'scheduled') return false;
      if (a.careProtocolId && rx._apiId) {
        return a.careProtocolId === rx._apiId;
      }
      return a.startTime === startTime
        && a.endTime === endTime
        && a.dateStr >= startDate
        && a.dateStr <= endDate;
    }) : [];

    const pastAppts = matchingAppts.filter(a => a.dateStr < today);
    const futureAppts = matchingAppts.filter(a => a.dateStr >= today);

    if (pastAppts.length > 0) {
      const msg = `Ce plan de soins a ${pastAppts.length} RDV déjà réalisé${pastAppts.length > 1 ? 's' : ''}.`
        + (futureAppts.length > 0 ? `\n${futureAppts.length} RDV futur${futureAppts.length > 1 ? 's' : ''} seront également annulé${futureAppts.length > 1 ? 's' : ''}.` : '')
        + '\n\nSupprimer ce plan de soins ?';
      if (!window.confirm(msg)) return;
    }

    if (onDeletePrescription && rx._apiId) {
      try {
        await onDeletePrescription(rx.id);
      } catch (err) {
        alert(err.response?.data?.detail || 'Erreur lors de la suppression du plan de soins.');
        return;
      }
    }

    updatePrescriptions(prescriptions.filter(r => r.id !== id));
    if (formMode === id) cancelForm();

    if (onCancelAppointment && futureAppts.length > 0) {
      await Promise.allSettled(
        futureAppts.map(appt => onCancelAppointment(appt.id))
      );
    }
  };

  if (prescriptionsLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500 gap-2">
        <Loader2 size={18} className="animate-spin" />
        Chargement des plans de soins...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bouton ajouter */}
      {formMode === null && (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm w-full justify-center border border-blue-200"
        >
          <Plus size={16} /> Ajouter un plan de soins
        </button>
      )}

      {/* Formulaire ajout */}
      {formMode === 'add' && formData && (
        <CarePlanForm
          plan={formData}
          onChange={setFormData}
          onCancel={cancelForm}
          onSave={saveForm}
          saving={savingPrescription}
          saveError={saveError}
          nurses={nurses}
          appointments={appointments}
          schedule={schedule}
          configs={configs}
          getActiveConfigForDate={getActiveConfigForDate}
          onCreateAppointment={onCreateAppointment}
          patientId={patientForm.id}
          careLabels={careLabels}
          onEnsureSaved={ensurePlanSaved}
        />
      )}

      {/* Liste des plans de soins */}
      {sortedPrescriptions.length > 0 ? (
        <div className="space-y-2">
          {sortedPrescriptions.map(rx => (
            formMode === rx.id && formData ? (
              <CarePlanForm
                key={rx.id}
                plan={formData}
                onChange={setFormData}
                onCancel={cancelForm}
                onSave={saveForm}
                saving={savingPrescription}
                saveError={saveError}
                nurses={nurses}
                appointments={appointments}
                schedule={schedule}
                configs={configs}
                getActiveConfigForDate={getActiveConfigForDate}
                onCreateAppointment={onCreateAppointment}
                patientId={patientForm.id}
                careLabels={careLabels}
                onEnsureSaved={ensurePlanSaved}
              />
            ) : (
              <CarePlanCard
                key={rx.id}
                plan={rx}
                isEditing={isEditingPatient}
                expanded={expandedId === rx.id}
                onToggle={() => setExpandedId(expandedId === rx.id ? null : rx.id)}
                onEdit={() => startEdit(rx)}
                onDelete={() => deletePlan(rx.id)}
                appointments={appointments}
                nurses={nurses}
                patientId={patientForm.id}
              />
            )
          ))}
        </div>
      ) : (
        !isEditingPatient && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Aucun plan de soins.
          </div>
        )
      )}

      {/* Empty state */}
      {prescriptions.length === 0 && formMode === null && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Aucun plan de soins enregistré.
        </div>
      )}
    </div>
  );
}
