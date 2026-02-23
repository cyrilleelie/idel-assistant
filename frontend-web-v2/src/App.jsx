import React, { useState, useEffect, useMemo } from 'react';
import { getDaysInMonth, formatDate, doSlotsOverlap, isTimeWithinSlot } from './utils/dateTime';
import { defaultNurses, defaultConfigs, defaultPatients, defaultAppointments, nurseColors } from './data/defaults';
import Header from './components/Header';
import TabNav from './components/TabNav';
import PatientsTab from './components/patients/PatientsTab';
import PlanningTab from './components/planning/PlanningTab';
import AgendasTab from './components/agendas/AgendasTab';
import EquipeTab from './components/equipe/EquipeTab';
import CreneauxTab from './components/creneaux/CreneauxTab';
import RdvModal from './components/modals/RdvModal';

export default function App() {
  // --- ÉTATS (State) ---
  const [activeTab, setActiveTab] = useState('patients');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAgendaNurseIds, setSelectedAgendaNurseIds] = useState([]);

  // Liste des infirmiers
  const [nurses, setNurses] = useState(defaultNurses);

  // Configurations horaires
  const [configs, setConfigs] = useState(defaultConfigs);
  // Planning mensuel : { "YYYY-MM-DD": { "slot_id": ["nurse_id_1", "nurse_id_2"] } }
  const [schedule, setSchedule] = useState({});
  const [planningStatuses, setPlanningStatuses] = useState({});

  // RDVs
  const [appointments, setAppointments] = useState(defaultAppointments);
  const [rdvModalParams, setRdvModalParams] = useState(null);
  const [rdvForm, setRdvForm] = useState({ mode: 'select', patientId: '', newFirstName: '', newLastName: '', startTime: '', endTime: '' });
  const [rdvError, setRdvError] = useState('');

  // Infirmiers
  const [selectedNurseId, setSelectedNurseId] = useState(null);
  const [isEditingNurse, setIsEditingNurse] = useState(false);
  const [nurseForm, setNurseForm] = useState({ firstName: '', lastName: '', role: 'Titulaire', phone: '', email: '', color: '' });

  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDate, setNewConfigDate] = useState(formatDate(new Date()));
  const [configError, setConfigError] = useState('');

  const [slotFormData, setSlotFormData] = useState({});
  const [slotErrors, setSlotErrors] = useState({});

  // --- ÉTATS PATIENTS ---
  const [patients, setPatients] = useState(defaultPatients);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientSubTab, setPatientSubTab] = useState('info');
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({});

  // --- LISTES ACTIVES (pour planning, agendas, RDV) ---
  const activeNurses = nurses.filter(n => n.active !== false);
  const activePatients = patients.filter(p => p.active !== false);

  const openNewPatient = () => {
    const newPatient = { firstName: '', lastName: '', phone: '', email: '', address: '', ssn: '', doctorName: '', doctorContact: '', antecedents: '', notes: '', prescriptions: [] };
    setPatientForm(newPatient);
    setSelectedPatientId('new');
    setIsEditingPatient(true);
    setPatientSubTab('info');
  };

  const openPatientDetail = (patient) => {
    setSelectedPatientId(patient.id);
    setPatientForm({ ...patient });
    setIsEditingPatient(false);
    setPatientSubTab('info');
  };

  const closePatientDetail = () => {
    setSelectedPatientId(null);
    setIsEditingPatient(false);
  };

  const handleSavePatient = (e) => {
    e.preventDefault();
    if (!patientForm.lastName.trim() || !patientForm.firstName.trim()) return;

    if (selectedPatientId === 'new') {
      const newId = 'p_' + Date.now();
      setPatients([...patients, { ...patientForm, id: newId }]);
      setSelectedPatientId(newId);
    } else {
      setPatients(patients.map(p => p.id === selectedPatientId ? { ...patientForm, id: selectedPatientId } : p));
    }
    setIsEditingPatient(false);
  };

  const deactivatePatient = (id) => {
    setPatients(patients.map(p => p.id === id ? { ...p, active: false } : p));
    closePatientDetail();
  };
  const reactivatePatient = (id) => {
    setPatients(patients.map(p => p.id === id ? { ...p, active: true } : p));
    setPatientForm(f => ({ ...f, active: true }));
  };

  // --- LOGIQUE INFIRMIERS ---
  const openNurseDetail = (nurse) => {
    setSelectedNurseId(nurse.id);
    setNurseForm({ ...nurse });
    setIsEditingNurse(false);
  };
  const openNewNurse = () => {
    setNurseForm({ firstName: '', lastName: '', role: 'Titulaire', phone: '', email: '', color: nurseColors[0] });
    setSelectedNurseId('new');
    setIsEditingNurse(true);
  };
  const closeNurseDetail = () => {
    setSelectedNurseId(null);
    setIsEditingNurse(false);
  };
  const handleSaveNurse = (e) => {
    e.preventDefault();
    if (!nurseForm.lastName.trim() || !nurseForm.firstName.trim()) return;
    if (selectedNurseId === 'new') {
      const newId = Date.now().toString();
      setNurses([...nurses, { ...nurseForm, id: newId }]);
      setSelectedNurseId(newId);
    } else {
      setNurses(nurses.map(n => n.id === selectedNurseId ? { ...nurseForm, id: selectedNurseId } : n));
    }
    setIsEditingNurse(false);
  };
  const deactivateNurse = (id) => {
    setNurses(nurses.map(n => n.id === id ? { ...n, active: false } : n));
    closeNurseDetail();
  };
  const reactivateNurse = (id) => {
    setNurses(nurses.map(n => n.id === id ? { ...n, active: true } : n));
    setNurseForm(f => ({ ...f, active: true }));
  };

  // --- LOGIQUE CONFIGURATIONS ---
  const addConfig = (e) => {
    e.preventDefault();
    setConfigError('');
    if (!newConfigName.trim() || !newConfigDate) return;
    const monthKey = newConfigDate.substring(0, 7);
    if (planningStatuses[monthKey] === 'validated') { setConfigError('Mois verrouillé.'); return; }
    setConfigs([...configs, { id: 'c' + Date.now().toString(), name: newConfigName, startDate: newConfigDate, slots: [] }]);
    setNewConfigName('');
  };
  const removeConfig = (id) => setConfigs(configs.filter(c => c.id !== id));

  const addSlotToConfig = (e, configId) => {
    e.preventDefault();
    const { name, startTime, endTime } = slotFormData[configId] || {};
    if (!name?.trim() || !startTime || !endTime) return;
    if (startTime === endTime) { setSlotErrors(prev => ({ ...prev, [configId]: "Heures identiques." })); return; }
    const config = configs.find(c => c.id === configId);
    if (config.slots.some(slot => doSlotsOverlap(startTime, endTime, slot.startTime, slot.endTime))) {
      setSlotErrors(prev => ({ ...prev, [configId]: "Chevauchement détecté." })); return;
    }
    setConfigs(configs.map(c => c.id === configId ? { ...c, slots: [...c.slots, { id: 's' + Date.now().toString(), name: name.trim(), startTime, endTime }] } : c));
    setSlotFormData(prev => ({ ...prev, [configId]: { name: '', startTime: '', endTime: '' } }));
    setSlotErrors(prev => ({ ...prev, [configId]: '' }));
  };
  const removeSlotFromConfig = (configId, slotId) => setConfigs(configs.map(c => c.id === configId ? { ...c, slots: c.slots.filter(s => s.id !== slotId) } : c));

  // --- LOGIQUE PLANNING ---
  const getActiveConfigForDate = (date) => {
    const dateStr = formatDate(date);
    const sorted = [...configs].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return sorted.find(c => c.startDate <= dateStr) || sorted[sorted.length - 1] || { slots: [] };
  };

  const toggleNurseSlot = (dateStr, slotId, nurseId) => {
    const monthKey = dateStr.substring(0, 7);
    if (planningStatuses[monthKey] === 'validated') return;
    setSchedule(prev => {
      const daySchedule = prev[dateStr] || {};
      const slotSchedule = daySchedule[slotId] || [];
      if (slotSchedule.includes(nurseId)) return { ...prev, [dateStr]: { ...daySchedule, [slotId]: slotSchedule.filter(id => id !== nurseId) } };
      else return { ...prev, [dateStr]: { ...daySchedule, [slotId]: [...slotSchedule, nurseId] } };
    });
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToCurrentMonth = () => setCurrentDate(new Date());
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());

  // --- LOGIQUE RDV ---
  const openRdvModal = (dateStr, slotId, nurseId) => {
    setRdvModalParams({ dateStr, slotId, nurseId });
    setRdvForm({ mode: 'select', patientId: '', newFirstName: '', newLastName: '', startTime: '', endTime: '' });
    setRdvError('');
  };

  const handleSaveRdv = (e) => {
    e.preventDefault(); setRdvError('');

    let finalPatientId = rdvForm.patientId;
    let finalPatientName = '';

    if (rdvForm.mode === 'new') {
      if (!rdvForm.newLastName.trim() || !rdvForm.newFirstName.trim()) {
        setRdvError("Le nom et le prénom sont requis pour un nouveau patient."); return;
      }
      finalPatientId = 'p_' + Date.now();
      finalPatientName = `${rdvForm.newFirstName} ${rdvForm.newLastName.toUpperCase()}`;

      setPatients(prev => [...prev, {
        id: finalPatientId,
        firstName: rdvForm.newFirstName,
        lastName: rdvForm.newLastName.toUpperCase(),
        phone: '', email: '', address: '', ssn: '', doctorName: '', doctorContact: '', antecedents: '', notes: '', prescriptions: []
      }]);
    } else {
      if (!finalPatientId) {
        setRdvError("Veuillez sélectionner un patient existant."); return;
      }
      const p = patients.find(p => p.id === finalPatientId);
      finalPatientName = `${p.firstName} ${p.lastName.toUpperCase()}`;
    }

    if (!rdvForm.startTime || !rdvForm.endTime) { setRdvError("Les horaires sont requis."); return; }
    if (rdvForm.startTime === rdvForm.endTime) { setRdvError("Heures identiques."); return; }

    const config = getActiveConfigForDate(new Date(rdvModalParams.dateStr));
    const slot = config.slots.find(s => s.id === rdvModalParams.slotId);
    if (!slot) return;

    if (!isTimeWithinSlot(rdvForm.startTime, rdvForm.endTime, slot.startTime, slot.endTime)) {
      setRdvError(`Hors créneau (${slot.startTime}-${slot.endTime}).`); return;
    }

    const slotAppts = appointments.filter(a => a.dateStr === rdvModalParams.dateStr && a.slotId === rdvModalParams.slotId && a.nurseId === rdvModalParams.nurseId);
    if (slotAppts.some(a => doSlotsOverlap(rdvForm.startTime, rdvForm.endTime, a.startTime, a.endTime))) {
      setRdvError("Chevauchement avec un autre RDV."); return;
    }

    setAppointments([...appointments, {
      id: 'rdv_' + Date.now(),
      ...rdvModalParams,
      patientId: finalPatientId,
      patient: finalPatientName,
      startTime: rdvForm.startTime,
      endTime: rdvForm.endTime
    }]);
    setRdvModalParams(null);
  };
  const deleteRdv = (id) => setAppointments(appointments.filter(a => a.id !== id));

  // --- VALEURS CALCULÉES ---
  const workingNursesIds = useMemo(() => {
    const ids = new Set();
    daysInMonth.forEach(date => {
      const daySchedule = schedule[formatDate(date)];
      if (daySchedule) Object.values(daySchedule).forEach(assigned => assigned.forEach(id => ids.add(id)));
    });
    return ids;
  }, [schedule, daysInMonth]);
  const workingNurses = useMemo(() => nurses.filter(n => workingNursesIds.has(n.id) && n.active !== false), [nurses, workingNursesIds]);

  useEffect(() => {
    const validIds = selectedAgendaNurseIds.filter(id => workingNursesIds.has(id));
    if (workingNurses.length > 0 && validIds.length === 0) setSelectedAgendaNurseIds([workingNurses[0].id]);
    else if (validIds.length !== selectedAgendaNurseIds.length) setSelectedAgendaNurseIds(validIds);
  }, [workingNursesIds, workingNurses, selectedAgendaNurseIds]);

  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const currentPlanningStatus = planningStatuses[currentMonthKey] || 'draft';
  const togglePlanningStatus = () => setPlanningStatuses(prev => ({ ...prev, [currentMonthKey]: currentPlanningStatus === 'draft' ? 'validated' : 'draft' }));

  const lockedConfigIds = new Set();
  Object.entries(planningStatuses).forEach(([monthKey, status]) => {
    if (status === 'validated') {
      const [year, month] = monthKey.split('-').map(Number);
      getDaysInMonth(year, month - 1).forEach(day => {
        const config = getActiveConfigForDate(day);
        if (config) lockedConfigIds.add(config.id);
      });
    }
  });

  // --- RENDU ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-screen-2xl mx-auto">

        <Header />
        <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[600px]">

          {activeTab === 'patients' && (
            <PatientsTab
              patients={patients}
              patientSearch={patientSearch}
              setPatientSearch={setPatientSearch}
              selectedPatientId={selectedPatientId}
              patientForm={patientForm}
              setPatientForm={setPatientForm}
              isEditingPatient={isEditingPatient}
              setIsEditingPatient={setIsEditingPatient}
              patientSubTab={patientSubTab}
              setPatientSubTab={setPatientSubTab}
              openNewPatient={openNewPatient}
              openPatientDetail={openPatientDetail}
              closePatientDetail={closePatientDetail}
              handleSavePatient={handleSavePatient}
              deactivatePatient={deactivatePatient}
              reactivatePatient={reactivatePatient}
              appointments={appointments}
              nurses={nurses}
            />
          )}

          {activeTab === 'planning' && (
            <PlanningTab
              nurses={activeNurses}
              configs={configs}
              schedule={schedule}
              daysInMonth={daysInMonth}
              currentDate={currentDate}
              currentPlanningStatus={currentPlanningStatus}
              prevMonth={prevMonth}
              nextMonth={nextMonth}
              goToCurrentMonth={goToCurrentMonth}
              togglePlanningStatus={togglePlanningStatus}
              getActiveConfigForDate={getActiveConfigForDate}
              toggleNurseSlot={toggleNurseSlot}
            />
          )}

          {activeTab === 'agendas' && (
            <AgendasTab
              nurses={nurses}
              workingNurses={workingNurses}
              appointments={appointments}
              schedule={schedule}
              daysInMonth={daysInMonth}
              currentDate={currentDate}
              selectedAgendaNurseIds={selectedAgendaNurseIds}
              setSelectedAgendaNurseIds={setSelectedAgendaNurseIds}
              prevMonth={prevMonth}
              nextMonth={nextMonth}
              getActiveConfigForDate={getActiveConfigForDate}
              openRdvModal={openRdvModal}
              deleteRdv={deleteRdv}
            />
          )}

          {activeTab === 'equipe' && (
            <EquipeTab
              nurses={nurses}
              nurseForm={nurseForm}
              setNurseForm={setNurseForm}
              selectedNurseId={selectedNurseId}
              isEditingNurse={isEditingNurse}
              setIsEditingNurse={setIsEditingNurse}
              openNurseDetail={openNurseDetail}
              openNewNurse={openNewNurse}
              closeNurseDetail={closeNurseDetail}
              handleSaveNurse={handleSaveNurse}
              deactivateNurse={deactivateNurse}
              reactivateNurse={reactivateNurse}
            />
          )}

          {activeTab === 'creneaux' && (
            <CreneauxTab
              configs={configs}
              lockedConfigIds={lockedConfigIds}
              newConfigName={newConfigName}
              setNewConfigName={setNewConfigName}
              newConfigDate={newConfigDate}
              setNewConfigDate={setNewConfigDate}
              configError={configError}
              slotFormData={slotFormData}
              setSlotFormData={setSlotFormData}
              slotErrors={slotErrors}
              addConfig={addConfig}
              removeConfig={removeConfig}
              addSlotToConfig={addSlotToConfig}
              removeSlotFromConfig={removeSlotFromConfig}
            />
          )}

        </main>
      </div>

      {/* --- MODALES --- */}
      <RdvModal
        rdvModalParams={rdvModalParams}
        setRdvModalParams={setRdvModalParams}
        rdvForm={rdvForm}
        setRdvForm={setRdvForm}
        rdvError={rdvError}
        patients={activePatients}
        handleSaveRdv={handleSaveRdv}
      />

    </div>
  );
}
