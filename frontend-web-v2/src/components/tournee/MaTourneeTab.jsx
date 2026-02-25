import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, Clock, Plus, X, Pencil, CheckCircle2, XCircle, CircleDot, Route, Car, Home, Building2 } from 'lucide-react';
import { formatDate } from '../../utils/dateTime';
import { listCareProtocols } from '../../api/care-protocols';
import { protocolApiToFrontend } from '../../utils/prescriptionMapper';

const TourneeMap = lazy(() => import('../agendas/TourneeMap'));

const VISIBLE_STATUSES = new Set(['scheduled', 'completed']);

const STATUS_CONFIG = {
  scheduled: { label: 'Planifié', badge: 'bg-blue-100 text-blue-700', card: 'bg-white border-blue-100', icon: CircleDot },
  completed: { label: 'Réalisé', badge: 'bg-emerald-100 text-emerald-700', card: 'bg-emerald-50/60 border-emerald-200', icon: CheckCircle2 },
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

  const myNurse = useMemo(() => nurses.find(n => n.userId === meUserId), [nurses, meUserId]);

  const patientsMap = useMemo(() => {
    const m = new Map();
    for (const p of patients) m.set(p.id, p);
    return m;
  }, [patients]);

  // All visible appointments for this nurse (scheduled + completed)
  const myAppointments = useMemo(
    () => appointments.filter(a => a.nurseId === myNurse?.userId && VISIBLE_STATUSES.has(a.status)),
    [appointments, myNurse?.userId],
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
  // (avoids infinite re-render loop: onLegsReady → setState → new array ref → useEffect → API call → onLegsReady)
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

  if (!dayRef) return null; // waiting for initial date

  if (!myNurse) {
    return (
      <div className="text-center py-16 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
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

  return (
    <div className="space-y-6">
      {/* Navigation jour — date centrée */}
      <div className="flex items-center justify-center bg-slate-50 p-3 rounded-lg border border-slate-100 gap-4">
        <button onClick={prevDay} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft size={20} /></button>
        <h2 className="text-xl font-semibold capitalize w-72 text-center">
          {dayRef.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={nextDay} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight size={20} /></button>
      </div>

      {/* Contenu du jour */}
      {slotsWithAppts.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
          <Route size={28} className="mx-auto mb-2 text-slate-400" />
          <p className="font-medium text-slate-600">Aucun rendez-vous ce jour</p>
          <p className="text-sm mt-1 text-slate-400">Utilisez les flèches pour naviguer vers un jour avec des RDV.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
          {/* En-tête infirmier */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl">
            <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${myNurse.color.split(' ')[0]}`}></div>
              {myNurse.firstName} {myNurse.lastName}
              <span className="ml-2 text-sm font-normal text-slate-400">{dayAppts.length} RDV</span>
              <span className="ml-auto text-xs font-medium text-slate-400 flex items-center gap-1"><Route size={14} /> Itinéraire</span>
            </h3>
          </div>

          {/* Un bloc par créneau : liste RDV (gauche) + carte (droite) */}
          <div className="divide-y divide-slate-200">
            {slotsWithAppts.map(slot => {
              const slotAppts = slotApptMap[slot.id] || [];

              return (
                <div key={slot.id} className="flex flex-col lg:flex-row">
                  {/* Liste RDV du créneau */}
                  <div className="lg:w-[35%] p-3 border-r border-slate-100">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex flex-col gap-2 shadow-sm">
                      <div className="text-xs font-semibold text-blue-800 flex items-center gap-1">
                        <Clock size={12} /> {slot.name} ({slot.startTime}-{slot.endTime})
                        <span className="ml-auto text-blue-500 font-normal">{slotAppts.length} RDV</span>
                      </div>

                      <div className="flex flex-col gap-1">
                        {slotAppts.map((rdv, i) => {
                          const leg = i > 0 ? slotLegs[slot.id]?.[i - 1] : null;
                          const sc = STATUS_CONFIG[rdv.status] || STATUS_CONFIG.scheduled;
                          const isScheduled = rdv.status === 'scheduled';
                          const isCanceled = rdv.status === 'canceled';
                          return (
                            <React.Fragment key={rdv.id}>
                            {leg && (
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 py-0.5 px-2">
                                <Car size={12} />
                                <span>{leg.distanceText}</span>
                                <span>·</span>
                                <span>{leg.durationText}</span>
                              </div>
                            )}
                            <div className={`rounded border p-2 text-xs shadow-sm group relative ${sc.card}`}>
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
                                  {(() => {
                                    const protocol = rdv.careProtocolId ? protocolsMap.get(rdv.careProtocolId) : null;
                                    const soinsLabels = protocol?.soins?.map(s => s.label).filter(Boolean) || [];
                                    const isOffice = rdv._apiLocationType === 'office';
                                    const patient = patientsMap.get(rdv.patientId);
                                    const address = isOffice ? cabinetData?.address : patient?.address;
                                    return (
                                      <div className={`flex flex-col gap-0.5 mt-1 text-[10px] ${isCanceled ? 'text-slate-300' : 'text-slate-400'}`}>
                                        {soinsLabels.length > 0 && (
                                          <span className="truncate">{soinsLabels.join(', ')}</span>
                                        )}
                                        <div className="flex items-center gap-1">
                                          {isOffice ? <Building2 size={10} className="shrink-0" /> : <Home size={10} className="shrink-0" />}
                                          <span className="font-medium">{isOffice ? 'Cabinet' : 'Domicile'}</span>
                                          {address && (
                                            <>
                                              <span>—</span>
                                              <span className="truncate">{address}</span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
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
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <button onClick={() => openRdvModal(dateStr, slot.id, myNurse.userId)} className="w-full bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded text-xs py-1.5 font-medium transition-colors flex items-center justify-center gap-1">
                        <Plus size={14} /> Ajouter RDV
                      </button>
                    </div>
                  </div>

                  {/* Carte du créneau */}
                  <div className="flex-1 p-3">
                    <Suspense fallback={<div className="flex items-center justify-center h-[400px] text-sm text-slate-400">Chargement carte...</div>}>
                      <TourneeMap
                        appointments={slotAppts}
                        patients={patients}
                        cabinetData={cabinetData}
                        slotName={slot.name}
                        onLegsReady={(legs) => setSlotLegs(prev => ({ ...prev, [slot.id]: legs }))}
                      />
                    </Suspense>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
