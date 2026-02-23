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

function emptyPrescription() {
  return {
    id: 'rx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    label: '',
    documents: [],
    startDate: '',
    endDate: '',
    careSchedule: {
      frequency: 'daily',
      customFrequency: '',
      startTime: '',
      endTime: '',
      notes: '',
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
    // Mon + Thu
    while (current <= end) {
      const dow = current.getDay();
      if (dow === 1 || dow === 4) dates.push(toDateStr(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
  if (frequency === '3xweek') {
    // Mon + Wed + Fri
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

// --- PlanningSection component ---

function PlanningSection({ prescription, patientId, nurses, appointments, schedule, configs, getActiveConfigForDate, onCreateAppointment }) {
  const { startDate, endDate, careSchedule } = prescription;
  const { frequency, startTime, endTime } = careSchedule;

  const [selectedNurseByDate, setSelectedNurseByDate] = useState({});
  const [bookingInProgress, setBookingInProgress] = useState(null); // dateStr being booked
  const [bookingError, setBookingError] = useState(null); // { dateStr, message }

  const selectNurse = (dateStr, userId) => {
    setSelectedNurseByDate(prev => ({
      ...prev,
      [dateStr]: prev[dateStr] === userId ? '' : userId,
    }));
  };

  // Build occurrences + classify each as planned or to-plan
  const { planned, toPlan, totalOccurrences } = useMemo(() => {
    if (!startDate || !endDate || !frequency || !startTime || !endTime) {
      return { planned: [], toPlan: [], totalOccurrences: 0 };
    }
    if (frequency === 'custom') {
      return { planned: [], toPlan: [], totalOccurrences: 0 };
    }

    const occurrences = generateOccurrences(startDate, endDate, frequency);
    const limited = occurrences.slice(0, 90);
    const plannedList = [];
    const toPlanList = [];

    // Patient appointments matching this prescription's time window
    const patientAppts = (appointments || []).filter(a => a.patientId === patientId);

    for (const dateStr of limited) {
      const dateObj = new Date(dateStr + 'T00:00:00');

      // Check if an appointment already exists for this date+time+patient
      const existingAppt = patientAppts.find(a =>
        a.dateStr === dateStr && a.startTime === startTime && a.endTime === endTime
      );

      if (existingAppt) {
        const nurse = (nurses || []).find(n => n.userId === existingAppt.nurseId);
        plannedList.push({ dateStr, dateObj, appointment: existingAppt, nurse });
      } else {
        // Find available nurses for this slot
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
                  a => a.dateStr === dateStr && a.nurseId === nurse.userId
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
  }, [startDate, endDate, frequency, startTime, endTime, patientId, nurses, appointments, schedule, configs, getActiveConfigForDate]);

  // Auto-select nurse when only one is available
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const updates = {};
    for (const { dateStr, availableNurses } of toPlan) {
      if (availableNurses.length === 1 && !selectedNurseByDate[dateStr]) {
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
      await onCreateAppointment({ dateStr, startTime, endTime, nurseId, patientId });
      // Clear selection for this date after success
      setSelectedNurseByDate(prev => { const next = { ...prev }; delete next[dateStr]; return next; });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setBookingError({ dateStr, message: detail || 'Erreur lors de la création du RDV.' });
    } finally {
      setBookingInProgress(null);
    }
  };

  const dayName = (d) => d.toLocaleDateString('fr-FR', { weekday: 'short' });
  const dayMonth = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  if (totalOccurrences === 0) return null;

  const remainingCount = toPlan.length;
  const plannedCount = planned.length;

  return (
    <div className="space-y-4">

      {/* Counters */}
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
              const isBooking = bookingInProgress === dateStr;
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

      {totalOccurrences > 90 && (
        <p className="text-xs text-slate-400 italic">Affichage limité aux 90 premières séances.</p>
      )}
    </div>
  );
}

function PrescriptionForm({ prescription, onChange, onCancel, onSave, nurses, appointments, schedule, configs, getActiveConfigForDate, onCreateAppointment, patientId }) {
  const [dragOver, setDragOver] = useState(false);

  const update = (field, value) => {
    onChange({ ...prescription, [field]: value });
  };

  const updateSchedule = (field, value) => {
    onChange({
      ...prescription,
      careSchedule: { ...prescription.careSchedule, [field]: value },
    });
  };

  const handleFiles = (files) => {
    const newDocs = Array.from(files).map(f => ({
      id: 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: f.name,
      size: f.size,
      url: URL.createObjectURL(f),
    }));
    update('documents', [...prescription.documents, ...newDocs]);
  };

  const removeDoc = (docId) => {
    update('documents', prescription.documents.filter(d => d.id !== docId));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const isValid = prescription.label.trim() && prescription.startDate && prescription.endDate;

  const showPlanning = prescription.startDate && prescription.endDate
    && prescription.careSchedule.frequency && prescription.careSchedule.frequency !== 'custom'
    && prescription.careSchedule.startTime && prescription.careSchedule.endTime;

  return (
    <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-5 space-y-5">

      {/* ═══════ SECTION 1 : Ordonnance ═══════ */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
          <ClipboardList size={16} className="text-blue-600" /> Ordonnance
        </h4>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Nom de l'ordonnance *</label>
          <input
            type="text"
            value={prescription.label}
            onChange={e => update('label', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Ex: Pansement post-opératoire, Injections insuline..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de début *</label>
            <input
              type="date"
              value={prescription.startDate}
              onChange={e => update('startDate', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Date de fin *</label>
            <input
              type="date"
              value={prescription.endDate}
              onChange={e => update('endDate', e.target.value)}
              min={prescription.startDate}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence</label>
          <select
            value={prescription.careSchedule.frequency}
            onChange={e => updateSchedule('frequency', e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
          >
            {FREQUENCY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {prescription.careSchedule.frequency === 'custom' && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fréquence personnalisée</label>
            <input
              type="text"
              value={prescription.careSchedule.customFrequency}
              onChange={e => updateSchedule('customFrequency', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              placeholder="Ex: Tous les 2 jours, Lundi et Jeudi..."
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Précisions sur les soins</label>
          <textarea
            value={prescription.careSchedule.notes}
            onChange={e => updateSchedule('notes', e.target.value)}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Détails sur le soin, matériel nécessaire..."
          />
        </div>
      </div>

      {/* ═══════ SECTION 2 : Documents ═══════ */}
      <div className="space-y-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
          <File size={16} className="text-blue-600" /> Documents
        </h4>

        {prescription.documents.length > 0 && (
          <div className="space-y-1">
            {prescription.documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm">
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
          className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-blue-300 bg-white'}`}
          onClick={() => document.getElementById('rx-file-input-' + prescription.id)?.click()}
        >
          <FileUp size={20} className="mx-auto text-slate-400 mb-1" />
          <p className="text-sm text-slate-500">Glisser des fichiers ici ou <span className="text-blue-600 font-medium">parcourir</span></p>
          <input
            id={'rx-file-input-' + prescription.id}
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={e => { if (e.target.files.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </div>
      </div>

      {/* ═══════ SECTION 3 : Planification ═══════ */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">
          <CalendarDays size={16} className="text-blue-600" /> Planification
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Heure de début</label>
            <input
              type="time"
              value={prescription.careSchedule.startTime}
              onChange={e => updateSchedule('startTime', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Heure de fin</label>
            <input
              type="time"
              value={prescription.careSchedule.endTime}
              onChange={e => updateSchedule('endTime', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
        </div>

        {showPlanning ? (
          <PlanningSection
            prescription={prescription}
            patientId={patientId}
            nurses={nurses}
            appointments={appointments}
            schedule={schedule}
            configs={configs}
            getActiveConfigForDate={getActiveConfigForDate}
            onCreateAppointment={onCreateAppointment}
          />
        ) : (
          <p className="text-xs text-slate-400 italic">
            Renseignez les dates, la fréquence et les horaires pour afficher le planning prévisionnel.
          </p>
        )}
      </div>

      {/* ═══════ Actions ═══════ */}
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
        <button onClick={onCancel} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Annuler
        </button>
        <button
          onClick={onSave}
          disabled={!isValid}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Valider l'ordonnance
        </button>
      </div>
    </div>
  );
}

function PrescriptionCard({ prescription, isEditing, onEdit, onDelete, expanded, onToggle }) {
  const isActive = prescription.endDate >= new Date().toISOString().split('T')[0];

  return (
    <div className={`border rounded-lg transition-shadow ${isActive ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/50'}`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          <span className="font-medium text-slate-800 truncate">{prescription.label || 'Sans titre'}</span>
          <span className="text-xs text-slate-500 shrink-0">
            {formatDateFr(prescription.startDate)} — {formatDateFr(prescription.endDate)}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {prescription.documents.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {prescription.documents.length} doc{prescription.documents.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
            {prescription.careSchedule.frequency === 'custom'
              ? (prescription.careSchedule.customFrequency || 'Personnalisé')
              : frequencyLabel(prescription.careSchedule.frequency)}
          </span>
          {prescription.careSchedule.startTime && prescription.careSchedule.endTime && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
              {prescription.careSchedule.startTime}–{prescription.careSchedule.endTime}
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Body (expanded) */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
          {/* Détails programmation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar size={14} className="text-blue-500" />
              <span>{formatDateFr(prescription.startDate)} — {formatDateFr(prescription.endDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <RefreshCw size={14} className="text-blue-500" />
              <span>
                {prescription.careSchedule.frequency === 'custom'
                  ? (prescription.careSchedule.customFrequency || 'Personnalisé')
                  : frequencyLabel(prescription.careSchedule.frequency)}
              </span>
            </div>
            {prescription.careSchedule.startTime && prescription.careSchedule.endTime && (
              <div className="flex items-center gap-2 text-slate-600">
                <Clock size={14} className="text-blue-500" />
                <span>{prescription.careSchedule.startTime}–{prescription.careSchedule.endTime}</span>
              </div>
            )}
          </div>

          {/* Notes soins */}
          {prescription.careSchedule.notes && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                <MessageSquare size={12} /> Précisions soins
              </div>
              <p className="whitespace-pre-wrap">{prescription.careSchedule.notes}</p>
            </div>
          )}

          {/* Documents */}
          {prescription.documents.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1.5">Documents joints</div>
              <div className="space-y-1">
                {prescription.documents.map(doc => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                  >
                    <File size={14} className="text-slate-400" />
                    <span className="truncate">{doc.name}</span>
                    <span className="text-slate-400 text-xs shrink-0">({(doc.size / 1024).toFixed(0)} Ko)</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions édition */}
          {isEditing && (
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={onEdit} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                <Pencil size={14} /> Modifier
              </button>
              <button onClick={onDelete} className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                <Trash2 size={14} /> Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PrescriptionsTab({
  patientForm, setPatientForm, isEditingPatient, setIsEditingPatient,
  nurses, appointments, schedule, configs, getActiveConfigForDate,
  onCreateAppointment, onCancelAppointment
}) {
  const prescriptions = patientForm.prescriptions || [];
  const [expandedId, setExpandedId] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | 'add' | prescriptionId (edit)
  const [formData, setFormData] = useState(null);

  const sortedPrescriptions = [...prescriptions].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const updatePrescriptions = (newList) => {
    setPatientForm({ ...patientForm, prescriptions: newList });
  };

  const startAdd = () => {
    if (!isEditingPatient && setIsEditingPatient) {
      setIsEditingPatient(true);
    }
    setFormData(emptyPrescription());
    setFormMode('add');
  };

  const startEdit = (rx) => {
    setFormData({ ...rx, careSchedule: { ...rx.careSchedule }, documents: [...rx.documents] });
    setFormMode(rx.id);
  };

  const cancelForm = () => {
    setFormMode(null);
    setFormData(null);
  };

  const saveForm = () => {
    if (!formData.label.trim() || !formData.startDate || !formData.endDate) return;
    if (formMode === 'add') {
      updatePrescriptions([...prescriptions, formData]);
    } else {
      updatePrescriptions(prescriptions.map(rx => rx.id === formMode ? formData : rx));
    }
    cancelForm();
  };

  const deletePrescription = (id) => {
    const rx = prescriptions.find(r => r.id === id);
    if (!rx) return;

    const today = toDateStr(new Date());
    const { startTime, endTime } = rx.careSchedule;

    // Find all appointments matching this prescription for this patient
    const matchingAppts = patientForm.id ? (appointments || []).filter(a =>
      a.patientId === patientForm.id
      && a.startTime === startTime
      && a.endTime === endTime
      && a.dateStr >= rx.startDate
      && a.dateStr <= rx.endDate
    ) : [];

    const pastAppts = matchingAppts.filter(a => a.dateStr < today);
    const futureAppts = matchingAppts.filter(a => a.dateStr >= today);

    // If past appointments exist, ask for confirmation
    if (pastAppts.length > 0) {
      const msg = `Cette ordonnance a ${pastAppts.length} RDV déjà réalisé${pastAppts.length > 1 ? 's' : ''}.`
        + (futureAppts.length > 0 ? `\n${futureAppts.length} RDV futur${futureAppts.length > 1 ? 's' : ''} seront également annulé${futureAppts.length > 1 ? 's' : ''}.` : '')
        + '\n\nSupprimer cette ordonnance ?';
      if (!window.confirm(msg)) return;
    }

    updatePrescriptions(prescriptions.filter(r => r.id !== id));
    if (formMode === id) cancelForm();

    // Cancel future appointments
    if (onCancelAppointment) {
      for (const appt of futureAppts) {
        onCancelAppointment(appt.id);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Bouton ajouter (toujours visible sauf formulaire ouvert) */}
      {formMode === null && (
        <button
          onClick={startAdd}
          className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2.5 rounded-lg font-medium transition-colors text-sm w-full justify-center border border-blue-200"
        >
          <Plus size={16} /> Ajouter une ordonnance
        </button>
      )}

      {/* Formulaire ajout */}
      {formMode === 'add' && formData && (
        <PrescriptionForm
          prescription={formData}
          onChange={setFormData}
          onCancel={cancelForm}
          onSave={saveForm}
          nurses={nurses}
          appointments={appointments}
          schedule={schedule}
          configs={configs}
          getActiveConfigForDate={getActiveConfigForDate}
          onCreateAppointment={onCreateAppointment}
          patientId={patientForm.id}
        />
      )}

      {/* Liste des ordonnances */}
      {sortedPrescriptions.length > 0 ? (
        <div className="space-y-2">
          {sortedPrescriptions.map(rx => (
            formMode === rx.id && formData ? (
              <PrescriptionForm
                key={rx.id}
                prescription={formData}
                onChange={setFormData}
                onCancel={cancelForm}
                onSave={saveForm}
                nurses={nurses}
                appointments={appointments}
                schedule={schedule}
                configs={configs}
                getActiveConfigForDate={getActiveConfigForDate}
                onCreateAppointment={onCreateAppointment}
                patientId={patientForm.id}
              />
            ) : (
              <PrescriptionCard
                key={rx.id}
                prescription={rx}
                isEditing={isEditingPatient}
                expanded={expandedId === rx.id}
                onToggle={() => setExpandedId(expandedId === rx.id ? null : rx.id)}
                onEdit={() => startEdit(rx)}
                onDelete={() => deletePrescription(rx.id)}
              />
            )
          ))}
        </div>
      ) : (
        !isEditingPatient && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Aucune ordonnance.
          </div>
        )
      )}

      {/* Empty state quand pas d'ordonnances et pas de formulaire ouvert */}
      {prescriptions.length === 0 && formMode === null && (
        <div className="text-center py-8 text-slate-400 text-sm">
          Aucune ordonnance enregistrée.
        </div>
      )}
    </div>
  );
}
