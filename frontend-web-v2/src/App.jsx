import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Building2, Calendar, CalendarDays, UserCircle, Users, Clock } from 'lucide-react';
import { getDaysInMonth, formatDate, doSlotsOverlap, isTimeWithinSlot } from './utils/dateTime';
import { defaultConfigs, nurseColors } from './data/defaults';
import { listMembers, inviteMember, updateMember } from './api/cabinet-members';
import { apiToFrontend, frontendToApiUpdate, frontendToApiInvite } from './utils/memberMapper';
import { listPatients, createPatient as apiCreatePatient, updatePatient as apiUpdatePatient, archivePatient as apiArchivePatient } from './api/patients';
import { listAppointments, createAppointment as apiCreateAppointment, cancelAppointment as apiCancelAppointment } from './api/appointments';
import { fetchMonthSchedule, toggleScheduleAssignment } from './api/schedule-assignments';
import { patientApiToFrontend, patientFrontendToApiCreate, patientFrontendToApiUpdate } from './utils/patientMapper';
import { apptApiToFrontend, assignSlotIds, frontendToApiCreate as apptFrontendToApiCreate } from './utils/appointmentMapper';
import { getUserRole, getUserEmail } from './utils/auth';
import { fetchMe } from './api/auth';
import { fetchCabinet, updateCabinet } from './api/cabinet';
import Header from './components/Header';
import InfoBanner from './components/InfoBanner';
import TabNav from './components/TabNav';
import LoginPage from './components/LoginPage';
import PatientsTab from './components/patients/PatientsTab';
import PlanningTab from './components/planning/PlanningTab';
import AgendasTab from './components/agendas/AgendasTab';
import EquipeTab from './components/equipe/EquipeTab';
import CabinetTab from './components/cabinet/CabinetTab';
import CreneauxTab from './components/creneaux/CreneauxTab';
import FacturationTab from './components/facturation/FacturationTab';
import RdvModal from './components/modals/RdvModal';

// --- Sub-tab definitions per screen ---
const soinsTabs = [
  { id: 'patients', label: 'Patients', icon: UserCircle },
  { id: 'agendas', label: 'Agenda', icon: CalendarDays },
];

const cabinetTabs = [
  { id: 'cabinet-info', label: 'Cabinet', icon: Building2 },
  { id: 'equipe', label: 'Équipe', icon: Users },
  { id: 'creneaux', label: 'Administration', icon: Clock },
  { id: 'planning', label: 'Planning', icon: Calendar },
];

const defaultTabForScreen = {
  soins: 'patients',
  cabinet: 'cabinet-info',
  facturation: null,
};

export default function App() {
  // --- AUTH ---
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('access_token'));
  const [userRole, setUserRole] = useState(() => getUserRole());
  const [userEmail, setUserEmail] = useState(() => getUserEmail() || '');

  // Profile data from GET /me (user + cabinet)
  const [meData, setMeData] = useState(null);

  // Full cabinet data from GET /cabinet/
  const [cabinetData, setCabinetData] = useState(null);
  const [cabinetLoading, setCabinetLoading] = useState(false);

  const loadMe = useCallback(async () => {
    try {
      const data = await fetchMe();
      setMeData(data);
      setUserRole(data.user.role);
      setUserEmail(data.user.email);
    } catch (err) {
      console.error('Failed to fetch /me:', err);
    }
  }, []);

  const loadCabinet = useCallback(async () => {
    setCabinetLoading(true);
    try {
      const data = await fetchCabinet();
      setCabinetData(data);
    } catch (err) {
      console.error('Failed to fetch /cabinet:', err);
    } finally {
      setCabinetLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMe();
      loadCabinet();
    }
  }, [isAuthenticated, loadMe, loadCabinet]);

  const handleLogin = useCallback((email) => {
    const role = getUserRole();
    const decodedEmail = getUserEmail() || email;
    setUserEmail(decodedEmail);
    setUserRole(role);
    setIsAuthenticated(true);
    setActiveScreen('cabinet');
    setActiveTab('cabinet-info');
  }, []);

  const handleCabinetUpdate = useCallback(async (payload) => {
    const updated = await updateCabinet(payload);
    setCabinetData(updated);
    // Sync the partial meData.cabinet so InfoBanner stays consistent
    setMeData(prev => prev ? { ...prev, cabinet: { ...prev.cabinet, name: updated.name, address: updated.address } } : prev);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setIsAuthenticated(false);
    setUserEmail('');
    setUserRole(null);
    setMeData(null);
    setCabinetData(null);
    setActiveScreen('cabinet');
  }, []);

  // Listen for forced logout from the API client (expired refresh token)
  useEffect(() => {
    const onForceLogout = () => handleLogout();
    window.addEventListener('auth:logout', onForceLogout);
    return () => window.removeEventListener('auth:logout', onForceLogout);
  }, [handleLogout]);

  // --- NAVIGATION ---
  const [activeScreen, setActiveScreen] = useState('cabinet');
  const [activeTab, setActiveTab] = useState('cabinet-info');

  const handleScreenChange = useCallback((screen) => {
    setActiveScreen(screen);
    setActiveTab(defaultTabForScreen[screen]);
  }, []);

  // --- ÉTATS (State) ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAgendaNurseIds, setSelectedAgendaNurseIds] = useState([]);

  // Liste des infirmiers — fetched from API
  const [nurses, setNurses] = useState([]);
  const [nursesLoading, setNursesLoading] = useState(false);
  const [nursesError, setNursesError] = useState('');

  // Configurations horaires
  const [configs, setConfigs] = useState(defaultConfigs);
  const [schedule, setSchedule] = useState({});
  const [planningStatuses, setPlanningStatuses] = useState({});

  // RDVs
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
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
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [patientsError, setPatientsError] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientSubTab, setPatientSubTab] = useState('info');
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({});

  // --- SORT NURSES BY ROLE: Titulaire → Collaborateur → Remplaçant(e) ---
  const roleOrder = { 'Titulaire': 0, 'Collaborateur': 1, 'Remplaçant(e)': 2 };
  const sortByRole = (list) => [...list].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9));

  // --- FETCH NURSES FROM API ---
  const fetchNurses = useCallback(async () => {
    setNursesLoading(true);
    setNursesError('');
    try {
      const data = await listMembers(true);
      setNurses(sortByRole(data.items.map(apiToFrontend)));
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setNursesError('Impossible de charger les membres du cabinet.');
    } finally {
      setNursesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchNurses();
    }
  }, [isAuthenticated, fetchNurses]);

  // --- FETCH PATIENTS FROM API ---
  const fetchPatients = useCallback(async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const data = await listPatients({ status: 'all', limit: 100 });
      setPatients(data.items.map(patientApiToFrontend));
    } catch (err) {
      console.error('Failed to fetch patients:', err);
      setPatientsError('Impossible de charger les patients.');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPatients();
    }
  }, [isAuthenticated, fetchPatients]);

  // --- FETCH SCHEDULE FROM API ---
  const fetchAndSetSchedule = useCallback(async (year, month) => {
    try {
      const data = await fetchMonthSchedule(year, month + 1); // API months are 1-based
      setSchedule(prev => ({ ...prev, ...data.schedule }));
    } catch (err) {
      console.error('Failed to fetch schedule:', err);
    }
  }, []);

  const scheduleYear = currentDate.getFullYear();
  const scheduleMonth = currentDate.getMonth();

  useEffect(() => {
    if (isAuthenticated) {
      fetchAndSetSchedule(scheduleYear, scheduleMonth);
    }
  }, [isAuthenticated, scheduleYear, scheduleMonth, fetchAndSetSchedule]);

  // --- LOGIQUE PLANNING (defined early — used by fetchAppointments) ---
  const getActiveConfigForDate = (date) => {
    const dateStr = formatDate(date);
    const sorted = [...configs].sort((a, b) => b.startDate.localeCompare(a.startDate));
    return sorted.find(c => c.startDate <= dateStr) || sorted[sorted.length - 1] || { slots: [] };
  };

  // --- FETCH APPOINTMENTS FROM API ---
  const patientsRef = useRef(patients);
  patientsRef.current = patients;

  const fetchAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    try {
      const data = await listAppointments({ status: 'scheduled', limit: 200 });
      const pMap = new Map(patientsRef.current.map(p => [p.id, p]));
      const mapped = data.items.map(a => apptApiToFrontend(a, pMap));
      assignSlotIds(mapped, getActiveConfigForDate);
      setAppointments(mapped);
    } catch (err) {
      console.error('Failed to fetch appointments:', err);
    } finally {
      setAppointmentsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getActiveConfigForDate]);

  useEffect(() => {
    if (isAuthenticated && patients.length > 0) {
      fetchAppointments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, patients.length > 0]);

  // Re-assign slotIds when configs change
  useEffect(() => {
    if (appointments.length > 0) {
      setAppointments(prev => {
        const updated = prev.map(a => ({ ...a }));
        assignSlotIds(updated, getActiveConfigForDate);
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs]);

  // --- LISTES ACTIVES ---
  const activeNurses = nurses.filter(n => n.active !== false);
  const activePatients = patients.filter(p => p.active !== false);

  const openNewPatient = () => {
    setPatientForm({ firstName: '', lastName: '', phone: '', email: '', address: '', ssn: '', doctorName: '', doctorContact: '', antecedents: '', notes: '', prescriptions: [] });
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

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!patientForm.lastName.trim() || !patientForm.firstName.trim()) return;
    if (selectedPatientId === 'new') {
      try {
        const payload = patientFrontendToApiCreate(patientForm);
        const created = await apiCreatePatient(payload);
        const mapped = patientApiToFrontend(created);
        setPatients(prev => [...prev, mapped]);
        setSelectedPatientId(mapped.id);
        setPatientForm(mapped);
      } catch (err) {
        alert(err.response?.data?.detail || 'Erreur lors de la création du patient.');
        return;
      }
    } else {
      try {
        const payload = patientFrontendToApiUpdate(patientForm);
        const updated = await apiUpdatePatient(selectedPatientId, payload);
        const mapped = patientApiToFrontend(updated);
        setPatients(prev => prev.map(p => p.id === selectedPatientId ? mapped : p));
        setPatientForm(mapped);
        // Update patient names in existing appointments
        setAppointments(prev => prev.map(a =>
          a.patientId === selectedPatientId
            ? { ...a, patient: `${mapped.firstName} ${mapped.lastName.toUpperCase()}` }
            : a
        ));
      } catch (err) {
        alert(err.response?.data?.detail || 'Erreur lors de la mise à jour du patient.');
        return;
      }
    }
    setIsEditingPatient(false);
  };

  const deactivatePatient = async (id) => {
    try {
      await apiArchivePatient(id, 'Archivé depuis le cabinet');
      setPatients(prev => prev.map(p => p.id === id ? { ...p, active: false } : p));
      closePatientDetail();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'archivage du patient.');
    }
  };
  const reactivatePatient = async (id) => {
    try {
      const updated = await apiUpdatePatient(id, { status: 'active' });
      const mapped = patientApiToFrontend(updated);
      setPatients(prev => prev.map(p => p.id === id ? mapped : p));
      setPatientForm(mapped);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la réactivation du patient.');
    }
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

  const handleSaveNurse = async (e) => {
    e.preventDefault();
    if (selectedNurseId === 'new') {
      if (!nurseForm.email?.trim()) return;
      try {
        const payload = frontendToApiInvite(nurseForm);
        const created = await inviteMember(payload);
        const mapped = apiToFrontend(created);
        setNurses((prev) => sortByRole([...prev, mapped]));
        setSelectedNurseId(mapped.id);
        setIsEditingNurse(false);
      } catch (err) {
        alert(err.response?.data?.detail || "Erreur lors de l'invitation.");
      }
    } else {
      try {
        const payload = frontendToApiUpdate(nurseForm);
        const updated = await updateMember(selectedNurseId, payload);
        const mapped = apiToFrontend(updated);
        setNurses((prev) => sortByRole(prev.map((n) => (n.id === selectedNurseId ? mapped : n))));
        setNurseForm(mapped);
        setIsEditingNurse(false);
      } catch (err) {
        alert(err.response?.data?.detail || 'Erreur lors de la mise à jour.');
      }
    }
  };

  const deactivateNurse = async (id) => {
    try {
      const updated = await updateMember(id, { is_active: false });
      const mapped = apiToFrontend(updated);
      setNurses((prev) => prev.map((n) => (n.id === id ? mapped : n)));
      closeNurseDetail();
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la désactivation.');
    }
  };

  const reactivateNurse = async (id) => {
    try {
      const updated = await updateMember(id, { is_active: true });
      const mapped = apiToFrontend(updated);
      setNurses((prev) => prev.map((n) => (n.id === id ? mapped : n)));
      setNurseForm(mapped);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la réactivation.');
    }
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

  const toggleNurseSlot = (dateStr, slotId, nurseId) => {
    const monthKey = dateStr.substring(0, 7);
    if (planningStatuses[monthKey] === 'validated') return;

    // Optimistic local update
    setSchedule(prev => {
      const daySchedule = prev[dateStr] || {};
      const slotSchedule = daySchedule[slotId] || [];
      if (slotSchedule.includes(nurseId)) return { ...prev, [dateStr]: { ...daySchedule, [slotId]: slotSchedule.filter(id => id !== nurseId) } };
      else return { ...prev, [dateStr]: { ...daySchedule, [slotId]: [...slotSchedule, nurseId] } };
    });

    // Persist to backend — rollback on error
    toggleScheduleAssignment(nurseId, slotId, dateStr).catch(err => {
      console.error('Failed to toggle schedule assignment:', err);
      // Rollback: refetch the month
      const [y, m] = monthKey.split('-').map(Number);
      fetchAndSetSchedule(y, m - 1);
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

  const handleSaveRdv = async (e) => {
    e.preventDefault(); setRdvError('');
    let finalPatientId = rdvForm.patientId;
    let finalPatientName = '';

    if (rdvForm.mode === 'new') {
      if (!rdvForm.newLastName.trim() || !rdvForm.newFirstName.trim()) {
        setRdvError("Le nom et le prénom sont requis pour un nouveau patient."); return;
      }
      // Create patient via API first
      try {
        const patientPayload = patientFrontendToApiCreate({
          firstName: rdvForm.newFirstName,
          lastName: rdvForm.newLastName.toUpperCase(),
        });
        const createdPatient = await apiCreatePatient(patientPayload);
        const mappedPatient = patientApiToFrontend(createdPatient);
        setPatients(prev => [...prev, mappedPatient]);
        finalPatientId = mappedPatient.id;
        finalPatientName = `${mappedPatient.firstName} ${mappedPatient.lastName.toUpperCase()}`;
      } catch (err) {
        setRdvError(err.response?.data?.detail || 'Erreur lors de la création du patient.');
        return;
      }
    } else {
      if (!finalPatientId) { setRdvError("Veuillez sélectionner un patient existant."); return; }
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

    // Create appointment via API
    try {
      const apptPayload = apptFrontendToApiCreate({
        dateStr: rdvModalParams.dateStr,
        startTime: rdvForm.startTime,
        endTime: rdvForm.endTime,
        nurseId: rdvModalParams.nurseId,
        patientId: finalPatientId,
      });
      const createdAppt = await apiCreateAppointment(apptPayload);
      const pMap = new Map(patientsRef.current.map(p => [p.id, p]));
      const mappedAppt = apptApiToFrontend(createdAppt, pMap);
      mappedAppt.slotId = rdvModalParams.slotId;
      // Override patient name in case patientsRef is stale for new patient
      if (!mappedAppt.patient || mappedAppt.patient === '(Patient inconnu)') {
        mappedAppt.patient = finalPatientName;
      }
      setAppointments(prev => [...prev, mappedAppt]);
      setRdvModalParams(null);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setRdvError(detail || 'Conflit horaire avec un autre RDV.');
      } else {
        setRdvError(detail || 'Erreur lors de la création du RDV.');
      }
    }
  };

  // Generic appointment creation callable from PrescriptionsTab
  const createAppointmentForPrescription = useCallback(async ({ dateStr, startTime, endTime, nurseId, patientId }) => {
    const apptPayload = apptFrontendToApiCreate({ dateStr, startTime, endTime, nurseId, patientId });
    const createdAppt = await apiCreateAppointment(apptPayload);
    const pMap = new Map(patientsRef.current.map(p => [p.id, p]));
    const mappedAppt = apptApiToFrontend(createdAppt, pMap);
    assignSlotIds([mappedAppt], getActiveConfigForDate);
    setAppointments(prev => [...prev, mappedAppt]);
    return mappedAppt;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getActiveConfigForDate]);

  const deleteRdv = async (id) => {
    try {
      await apiCancelAppointment(id, 'Annulé depuis le planning');
      setAppointments(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'annulation du RDV.');
    }
  };

  // --- VALEURS CALCULÉES ---
  // Scan ALL loaded schedule data (not just current month) so that
  // Agendas still works when currentDate is on a different month.
  const workingNursesIds = useMemo(() => {
    const ids = new Set();
    for (const daySchedule of Object.values(schedule)) {
      for (const assigned of Object.values(daySchedule)) {
        for (const id of assigned) ids.add(id);
      }
    }
    return ids;
  }, [schedule]);
  const workingNurses = useMemo(() => nurses.filter(n => workingNursesIds.has(n.userId) && n.active !== false), [nurses, workingNursesIds]);

  useEffect(() => {
    const validIds = selectedAgendaNurseIds.filter(id => workingNursesIds.has(id));
    if (workingNurses.length > 0 && validIds.length === 0) setSelectedAgendaNurseIds([workingNurses[0].userId]);
    else if (validIds.length !== selectedAgendaNurseIds.length) setSelectedAgendaNurseIds(validIds);
  }, [workingNursesIds, workingNurses, selectedAgendaNurseIds]);

  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const currentPlanningStatus = planningStatuses[currentMonthKey] || 'draft';
  const togglePlanningStatus = () => setPlanningStatuses(prev => ({ ...prev, [currentMonthKey]: currentPlanningStatus === 'draft' ? 'validated' : 'draft' }));

  const lockedConfigIds = new Set();
  Object.entries(planningStatuses).forEach(([monthKey, st]) => {
    if (st === 'validated') {
      const [year, month] = monthKey.split('-').map(Number);
      getDaysInMonth(year, month - 1).forEach(day => {
        const config = getActiveConfigForDate(day);
        if (config) lockedConfigIds.add(config.id);
      });
    }
  });

  // --- Tabs & readOnly ---
  const visibleTabs = activeScreen === 'cabinet' ? cabinetTabs : activeScreen === 'soins' ? soinsTabs : [];
  const isReadOnly = userRole !== 'admin';

  // --- AUTH GUARD ---
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // --- RENDU ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-screen-2xl mx-auto">

        <Header activeScreen={activeScreen} onScreenChange={handleScreenChange} onLogout={handleLogout} />
        <InfoBanner cabinet={meData?.cabinet} user={meData?.user} />
        {visibleTabs.length > 0 && (
          <TabNav tabs={visibleTabs} activeTab={activeTab} setActiveTab={setActiveTab} />
        )}

        <main className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[600px]">

          {/* --- Soins --- */}
          {activeScreen === 'soins' && activeTab === 'patients' && (
            <>
              {patientsLoading && (
                <div className="text-center py-12 text-slate-500">Chargement des patients...</div>
              )}
              {patientsError && (
                <div className="text-center py-12">
                  <p className="text-red-600 mb-4">{patientsError}</p>
                  <button onClick={fetchPatients} className="text-blue-600 hover:underline text-sm">Réessayer</button>
                </div>
              )}
              {!patientsLoading && !patientsError && (
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
              schedule={schedule}
              configs={configs}
              getActiveConfigForDate={getActiveConfigForDate}
              onCreateAppointment={createAppointmentForPrescription}
              onCancelAppointment={deleteRdv}
            />
              )}
            </>
          )}

          {activeScreen === 'soins' && activeTab === 'agendas' && (
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

          {/* --- Cabinet --- */}
          {activeScreen === 'cabinet' && activeTab === 'cabinet-info' && (
            <>
              {cabinetLoading && (
                <div className="text-center py-12 text-slate-500">Chargement des informations...</div>
              )}
              {!cabinetLoading && (
                <CabinetTab
                  cabinet={cabinetData}
                  onUpdate={handleCabinetUpdate}
                  readOnly={isReadOnly}
                />
              )}
            </>
          )}

          {activeScreen === 'cabinet' && activeTab === 'planning' && (
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
              appointments={appointments}
              readOnly={isReadOnly}
            />
          )}

          {activeScreen === 'cabinet' && activeTab === 'equipe' && (
            <>
              {nursesLoading && (
                <div className="text-center py-12 text-slate-500">Chargement des membres...</div>
              )}
              {nursesError && (
                <div className="text-center py-12">
                  <p className="text-red-600 mb-4">{nursesError}</p>
                  <button onClick={fetchNurses} className="text-blue-600 hover:underline text-sm">Réessayer</button>
                </div>
              )}
              {!nursesLoading && !nursesError && (
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
                  readOnly={isReadOnly}
                />
              )}
            </>
          )}

          {activeScreen === 'cabinet' && activeTab === 'creneaux' && (
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
              readOnly={isReadOnly}
            />
          )}

          {/* --- Facturation --- */}
          {activeScreen === 'facturation' && (
            <FacturationTab />
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
