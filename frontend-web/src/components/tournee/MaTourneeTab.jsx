import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, X, Pencil, CheckCircle2, XCircle, CircleDot, Route, Car, Home, Building2, FlaskConical, MapPin, CalendarCheck, Timer, Navigation } from 'lucide-react';
import { formatDate } from '../../utils/dateTime';
import { listCareProtocols } from '../../api/care-protocols';
import { protocolApiToFrontend } from '../../utils/prescriptionMapper';

const TourneeMap = lazy(() => import('../agendas/TourneeMap'));

// ── DEV FLAG — mettre à false pour désactiver le sélecteur d'infirmier ──────
const DEV_NURSE_SWITCHER = true;
// ────────────────────────────────────────────────────────────────────────────

const VISIBLE_STATUSES = new Set(['scheduled', 'completed']);

const STATUS_CONFIG = {
  scheduled: { label: 'Planifié', badge: 'bg-primary/10 text-primary', card: 'bg-white border-slate-200', icon: CircleDot },
  completed: { label: 'Réalisé', badge: 'bg-emerald-100 text-emerald-700', card: 'bg-slate-100 border-slate-200 opacity-70', icon: CheckCircle2 },
  canceled: { label: 'Annulé', badge: 'bg-red-100 text-red-600', card: 'bg-red-50/40 border-red-200 opacity-60', icon: XCircle },
};

export default function MaTourneeTab({
  nurses, appointments, schedule,
  getActiveConfigForDate, openRdvModal, deleteRdv, editRdv, completeRdv,
  patients, cabinetData, meUserId,
}) {
  const [dayRef, setDayRef] = useState(null); // null = not yet initialized
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [slotLegs, setSlotLegs] = useState({}); // { [slotId]: [{distanceText, durationText}] | null }
  const [devSelectedNurseId, setDevSelectedNurseId] = useState(null); // DEV only

  const myNurse = useMemo(() => nurses.find(n => n.userId === meUserId), [nurses, meUserId]);

  // Infirmier affiché : sélection DEV si activée, sinon l'infirmier connecté
  const viewedNurse = useMemo(() => {
    if (DEV_NURSE_SWITCHER && devSelectedNurseId) {
      return nurses.find(n => n.userId === devSelectedNurseId) || myNurse;
    }
    return myNurse;
  }, [nurses, myNurse, devSelectedNurseId]);

  const patientsMap = useMemo(() => {
    const m = new Map();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  // All visible appointments for the viewed nurse (scheduled + completed)
  const myAppointments = useMemo(
    () => appointments.filter(a => a.nurseId === viewedNurse?.userId && VISIBLE_STATUSES.has(a.status)),
    [appointments, viewedNurse?.userId],
  );

  // Sorted unique dates that have appointments
  const datesWithAppts = useMemo(() => {
    const set = new Set(myAppointments.map(a => a.dateStr));
    return [...set].sort();
  }, [myAppointments]);

  // On mount (or when appointments load), jump to today or next day with RDV
  useEffect(() => {
    if (datesWithAppts.length === 0) {
      setDayRef(new Date());
      return;
    }
    const todayStr = formatDate(new Date());
    const target = datesWithAppts.find(d => d >= todayStr) || datesWithAppts[datesWithAppts.length - 1];
    const [y, m, d] = target.split('-').map(Number);
    setDayRef(new Date(y, m - 1, d));
  // Only run on first meaningful load — not on every appointment change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datesWithAppts.length > 0]);

  // Navigate to next/prev day that has appointments, or fallback to +/- 1 day
  const goToDay = useCallback((direction) => {
    setDayRef(current => {
      if (!current) return new Date();
      const currentStr = formatDate(current);
      if (direction === 1) {
        const next = datesWithAppts.find(d => d > currentStr);
        if (next) {
          const [y, m, d] = next.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
      } else {
        const prev = [...datesWithAppts].reverse().find(d => d < currentStr);
        if (prev) {
          const [y, m, d] = prev.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
      }
      // No appointment found in that direction — move by 1 day
      return new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction);
    });
  }, [datesWithAppts]);

  const prevDay = useCallback(() => goToDay(-1), [goToDay]);
  const nextDay = useCallback(() => goToDay(1), [goToDay]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') prevDay();
      else if (e.key === 'ArrowRight') nextDay();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevDay, nextDay]);

  // Memoize dateStr & dayAppts so TourneeMap receives stable array references
  const dateStr = useMemo(() => dayRef ? formatDate(dayRef) : '', [dayRef]);

  const dayAppts = useMemo(
    () => myAppointments.filter(a => a.dateStr === dateStr),
    [myAppointments, dateStr],
  );

  const slotApptMap = useMemo(() => {
    const map = {};
    for (const a of dayAppts) {
      if (!map[a.slotId]) map[a.slotId] = [];
      map[a.slotId].push(a);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [dayAppts]);

  // Fetch care protocols for the day's patients to display soins labels
  const [protocolsMap, setProtocolsMap] = useState(new Map()); // careProtocolId → { soins: [...] }

  const protocolPatientIds = useMemo(() => {
    const ids = new Set();
    for (const a of dayAppts) {
      if (a.careProtocolId) ids.add(a.patientId);
    }
    return [...ids];
  }, [dayAppts]);

  useEffect(() => {
    if (protocolPatientIds.length === 0) {
      setProtocolsMap(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(
      protocolPatientIds.map(pid =>
        listCareProtocols({ patient_id: pid, limit: 100 }).catch(() => ({ items: [] }))
      )
    ).then(results => {
      if (cancelled) return;
      const map = new Map();
      for (const data of results) {
        for (const raw of data.items) {
          map.set(raw.id, protocolApiToFrontend(raw));
        }
      }
      setProtocolsMap(map);
    });
    return () => { cancelled = true; };
  }, [protocolPatientIds]);

  // Compute KPI totals from slotLegs
  const kpiTotals = useMemo(() => {
    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    for (const legs of Object.values(slotLegs)) {
      if (!legs) continue;
      for (const leg of legs) {
        if (leg.distanceText) {
          const km = parseFloat(leg.distanceText.replace(',', '.'));
          if (!isNaN(km)) totalDistanceKm += km;
        }
        if (leg.durationText) {
          const minMatch = leg.durationText.match(/(\d+)/);
          if (minMatch) totalDurationMin += parseInt(minMatch[1], 10);
        }
      }
    }
    const completedCount = dayAppts.filter(a => a.status === 'completed').length;
    const remainingCount = dayAppts.filter(a => a.status === 'scheduled').length;
    return { totalDistanceKm: totalDistanceKm.toFixed(1), totalDurationMin, completedCount, remainingCount, totalCount: dayAppts.length };
  }, [slotLegs, dayAppts]);

  // Flatten all day appointments in chronological order for the timeline
  const allDayApptsFlat = useMemo(() => {
    return [...dayAppts].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [dayAppts]);

  // Determine which appointment is the "current" one (first scheduled)
  const currentApptId = useMemo(() => {
    const first = allDayApptsFlat.find(a => a.status === 'scheduled');
    return first?.id || null;
  }, [allDayApptsFlat]);

  // Build flat legs array matching allDayApptsFlat order
  const flatLegs = useMemo(() => {
    const legs = [];
    // slotLegs is keyed by slotId, each value is an array of legs between consecutive appts in that slot
    // For the flat timeline, we need to rebuild legs across all slots
    // We'll use slotLegs data where available
    for (let i = 0; i < allDayApptsFlat.length - 1; i++) {
      const curr = allDayApptsFlat[i];
      const next = allDayApptsFlat[i + 1];
      // If both in same slot, use the slot's leg data
      if (curr.slotId === next.slotId) {
        const slotAppts = slotApptMap[curr.slotId] || [];
        const currIdx = slotAppts.findIndex(a => a.id === curr.id);
        const leg = slotLegs[curr.slotId]?.[currIdx];
        legs.push(leg || null);
      } else {
        legs.push(null); // cross-slot leg, no data available
      }
    }
    return legs;
  }, [allDayApptsFlat, slotApptMap, slotLegs]);

  // Day label helper
  const dayLabel = useMemo(() => {
    if (!dayRef) return '';
    const today = new Date();
    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
    if (dateStr === todayStr) return "Aujourd'hui";
    if (dateStr === tomorrowStr) return 'Demain';
    return dayRef.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [dayRef, dateStr]);

  if (!dayRef) return null; // waiting for initial date

  if (!myNurse) {
    return (
      <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <Route size={32} className="mx-auto mb-3 text-slate-400" />
        <p className="font-medium text-slate-600">Votre compte n'est pas associé à un membre du cabinet.</p>
        <p className="text-sm mt-1">Demandez à un administrateur de vous ajouter à l'équipe.</p>
      </div>
    );
  }

  // Only show slots that have at least one visible appointment
  const activeConfig = getActiveConfigForDate(dayRef);
  const slotsWithAppts = activeConfig.slots.filter(slot =>
    dayAppts.some(a => a.slotId === slot.id)
  );

  // Format duration for KPI
  const formatDuration = (min) => {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  };

  return (
    <div className="space-y-6">
      {/* Sélecteur infirmier DEV */}
      {DEV_NURSE_SWITCHER && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <FlaskConical size={14} className="text-amber-500 shrink-0" />
          <span className="text-amber-700 font-medium">Dev —</span>
          <span className="text-amber-600">Voir la tournée de :</span>
          <select
            value={devSelectedNurseId || meUserId}
            onChange={e => setDevSelectedNurseId(e.target.value)}
            className="ml-1 border border-amber-300 rounded px-2 py-0.5 bg-white text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {nurses.map(n => (
              <option key={n.userId} value={n.userId}>
                {n.firstName} {n.lastName}{n.userId === meUserId ? ' (moi)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 bg-white shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-primary mb-1">
            <CalendarCheck size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider opacity-70">Rendez-vous</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{kpiTotals.totalCount}</div>
          <div className="text-xs text-slate-500">{kpiTotals.remainingCount} restants aujourd'hui</div>
        </div>
        <div className="rounded-xl p-5 bg-white shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Navigation size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider opacity-70">Distance Totale</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{kpiTotals.totalDistanceKm} km</div>
          <div className="text-xs text-slate-500">trajet estimé</div>
        </div>
        <div className="rounded-xl p-5 bg-white shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 text-primary mb-1">
            <Timer size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider opacity-70">Temps Estimé</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{formatDuration(kpiTotals.totalDurationMin)}</div>
          <div className="text-xs text-slate-500">temps de trajet</div>
        </div>
      </div>

      {/* Contenu du jour — empty state */}
      {slotsWithAppts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
          <Route size={28} className="mx-auto mb-2 text-slate-400" />
          <p className="font-medium text-slate-600">Aucun rendez-vous ce jour</p>
          <p className="text-sm mt-1 text-slate-400">Utilisez les flèches pour naviguer vers un jour avec des RDV.</p>
        </div>
      ) : (
        /* Two-column layout: itinerary (left) + map (right) */
        <div className="flex flex-col lg:flex-row gap-6 flex-1">
          {/* Left column — Itinerary */}
          <div className="w-full lg:w-2/5 flex flex-col gap-4">
            {/* Itinerary header with day navigation */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Itinéraire du jour</h3>
              <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                <button onClick={prevDay} className="p-1.5 hover:bg-white rounded transition-all text-slate-500 hover:text-slate-700">
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 text-sm font-semibold text-slate-700 min-w-[100px] text-center">{dayLabel}</span>
                <button onClick={nextDay} className="p-1.5 hover:bg-white rounded transition-all text-slate-500 hover:text-slate-700">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Full date subtitle */}
            <p className="text-sm text-slate-500 -mt-2 capitalize">
              {dayRef.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              <span className="ml-2 text-xs font-medium text-slate-400">— {viewedNurse.firstName} {viewedNurse.lastName}</span>
            </p>

            {/* Timeline appointment cards */}
            <div className="flex flex-col">
              {allDayApptsFlat.map((rdv, idx) => {
                const isCompleted = rdv.status === 'completed';
                const isCurrent = rdv.id === currentApptId;
                const isCanceled = rdv.status === 'canceled';
                const isScheduled = rdv.status === 'scheduled';
                const sc = STATUS_CONFIG[rdv.status] || STATUS_CONFIG.scheduled;
                const patient = patientsMap.get(rdv.patientId);
                const isOffice = rdv._apiLocationType === 'office';
                const address = isOffice ? cabinetData?.address : patient?.address;
                const soinsLabels = rdv.careLabels?.length > 0 ? rdv.careLabels : [];
                const stepNumber = idx + 1;
                const leg = idx < flatLegs.length ? flatLegs[idx] : null;

                return (
                  <React.Fragment key={rdv.id}>
                    {/* Appointment card */}
                    <div className={`rounded-xl p-4 group relative transition-all ${
                      isCompleted
                        ? 'bg-slate-100 border border-slate-200 opacity-70'
                        : isCurrent
                          ? 'bg-white shadow-md border-2 border-primary ring-4 ring-primary/10'
                          : 'bg-white shadow-sm border border-slate-200 hover:border-primary/50'
                    }`}>
                      {confirmDeleteId === rdv.id ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-slate-600 font-medium">Annuler ce RDV ?</p>
                          <p className="text-slate-400 text-sm">{rdv.startTime}-{rdv.endTime} — {rdv.patient}</p>
                          <div className="flex gap-2">
                            <button onClick={() => { deleteRdv(rdv.id); setConfirmDeleteId(null); }} className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-lg py-1.5 font-medium transition-colors text-sm">Confirmer</button>
                            <button onClick={() => setConfirmDeleteId(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg py-1.5 font-medium transition-colors text-sm">Retour</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          {/* Step circle */}
                          {isCompleted ? (
                            <div className="size-10 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
                              <CheckCircle2 size={20} />
                            </div>
                          ) : isCurrent ? (
                            <div className="size-10 rounded-full bg-primary text-white font-bold flex items-center justify-center shrink-0 text-lg">
                              {stepNumber}
                            </div>
                          ) : (
                            <div className="size-10 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center shrink-0 border border-slate-200 text-lg">
                              {stepNumber}
                            </div>
                          )}

                          {/* Card content */}
                          <div className="flex-1 min-w-0">
                            {/* Time + status */}
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-semibold ${isCompleted ? 'text-slate-400' : isCurrent ? 'text-primary' : 'text-slate-600'}`}>
                                {rdv.startTime} - {rdv.endTime}
                              </span>
                              <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${sc.badge}`}>{sc.label}</span>
                            </div>

                            {/* Patient name */}
                            <div className={`font-bold text-lg mt-0.5 truncate ${isCanceled ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                              {rdv.patient}
                            </div>

                            {/* Soins labels */}
                            {soinsLabels.length > 0 && (
                              <p className={`text-sm truncate mt-0.5 ${isCanceled ? 'text-slate-300' : 'text-slate-400'}`}>{soinsLabels.join(', ')}</p>
                            )}

                            {/* Act codes */}
                            {rdv.actCodes?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {rdv.actCodes.map(code => (
                                  <span key={code} className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">{code}</span>
                                ))}
                              </div>
                            )}

                            {/* Address */}
                            <div className={`flex items-center gap-1.5 mt-1.5 text-sm ${isCanceled ? 'text-slate-300' : 'text-slate-500'}`}>
                              <MapPin size={14} className="shrink-0" />
                              <span className="truncate">
                                {isOffice ? 'Cabinet' : 'Domicile'}
                                {address ? ` — ${address}` : ''}
                              </span>
                            </div>

                            {/* Validate button for current/active appointment */}
                            {isCurrent && (
                              <button
                                onClick={() => completeRdv(rdv.id)}
                                className="mt-3 w-full bg-primary text-white py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                              >
                                Valider
                              </button>
                            )}
                          </div>

                          {/* Hover actions */}
                          {!isCanceled && (
                            <div className="absolute top-3 right-3 hidden group-hover:flex gap-1.5">
                              {isScheduled && !isCurrent && (
                                <button onClick={() => completeRdv(rdv.id)} title="Marquer réalisé" className="text-slate-300 hover:text-emerald-500 transition-colors">
                                  <CheckCircle2 size={16} />
                                </button>
                              )}
                              <button onClick={() => editRdv(rdv)} title="Modifier" className="text-slate-300 hover:text-primary transition-colors">
                                <Pencil size={16} />
                              </button>
                              {isScheduled && (
                                <button onClick={() => setConfirmDeleteId(rdv.id)} title="Annuler" className="text-slate-300 hover:text-red-500 transition-colors">
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Route leg between cards */}
                    {idx < allDayApptsFlat.length - 1 && (
                      <div className="ml-9 border-l-2 border-dashed border-slate-300 h-10 flex items-center px-4">
                        {leg && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
                            <Car size={10} />
                            {leg.distanceText} · {leg.durationText}
                          </span>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

          </div>

          {/* Right column — Map */}
          <div className="flex-1 min-h-[400px]">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
              <Suspense fallback={<div className="flex items-center justify-center h-[400px] text-sm text-slate-400">Chargement carte...</div>}>
                {/* Render one map per slot to preserve existing onLegsReady behavior */}
                {slotsWithAppts.map(slot => {
                  const slotAppts = slotApptMap[slot.id] || [];
                  return (
                    <div key={slot.id} className="h-full">
                      <TourneeMap
                        appointments={slotAppts}
                        patients={patients}
                        cabinetData={cabinetData}
                        slotName={slot.name}
                        onLegsReady={(legs) => setSlotLegs(prev => ({ ...prev, [slot.id]: legs }))}
                      />
                    </div>
                  );
                })}
              </Suspense>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
