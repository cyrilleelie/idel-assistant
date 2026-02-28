import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { installFrontendLogger } from './utils/frontendLogger';
installFrontendLogger();
import { Building2, Calendar, Users, Clock } from 'lucide-react';
import { getDaysInMonth, formatDate, doSlotsOverlap, isTimeWithinSlot, getDayOfWeekMondayBased } from './utils/dateTime';
import { defaultConfigs, nurseColors } from './data/defaults';
import { listMembers, inviteMember, updateMember } from './api/cabinet-members';
import { apiToFrontend, frontendToApiUpdate, frontendToApiInvite } from './utils/memberMapper';
import { listPatients, createPatient as apiCreatePatient, updatePatient as apiUpdatePatient, archivePatient as apiArchivePatient } from './api/patients';
import { listAppointments, createAppointment as apiCreateAppointment, cancelAppointment as apiCancelAppointment, updateAppointment as apiUpdateAppointment, completeAppointment as apiCompleteAppointment } from './api/appointments';
import { listCareProtocols, createCareProtocol, updateCareProtocol, deleteCareProtocol } from './api/care-protocols';
import { listPrescriptions, createPrescription as apiCreatePrescription, updatePrescription as apiUpdatePrescription, deletePrescription as apiDeletePrescription, uploadPrescriptionDocument } from './api/prescriptions';
import { fetchMonthSchedule as fetchMonthScheduleApi, toggleScheduleAssignment } from './api/schedule-assignments';
import { patientApiToFrontend, patientFrontendToApiCreate, patientFrontendToApiUpdate } from './utils/patientMapper';
import { protocolApiToFrontend, prescriptionApiToSoin, protocolFrontendToApiCreate, protocolFrontendToApiUpdate, soinToApiCreate, soinToApiUpdate } from './utils/prescriptionMapper';
import { apptApiToFrontend, assignSlotIds, frontendToApiCreate as apptFrontendToApiCreate, frontendToApiUpdate as apptFrontendToApiUpdate } from './utils/appointmentMapper';
import { getUserRole, getUserEmail } from './utils/auth';
import { fetchMe } from './api/auth';
import { fetchCabinet, updateCabinet } from './api/cabinet';
import { listCareLabels } from './api/care-labels';
import { listCareActCodes } from './api/cotation';
import Header from './components/Header';
import InfoBanner from './components/InfoBanner';
import LoginPage from './components/LoginPage';
import PatientsTab from './components/patients/PatientsTab';
import PlanningTab from './components/planning/PlanningTab';
import AgendasTab from './components/agendas/AgendasTab';
import EquipeTab from './components/equipe/EquipeTab';
import CabinetTab from './components/cabinet/CabinetTab';
import CreneauxTab from './components/creneaux/CreneauxTab';
import FacturationTab from './components/facturation/FacturationTab';
import MaTourneeTab from './components/tournee/MaTourneeTab';
import AdministrationScreen from './components/admin/AdministrationScreen';
import RdvModal from './components/modals/RdvModal';

// --- Sub-tab definitions per screen ---
const cabinetTabs = [
  { id: 'cabinet-info', label: 'Cabinet', icon: Building2 },
  { id: 'creneaux', label: 'Administration', icon: Clock },
  { id: 'planning', label: 'Planning', icon: Calendar },
];

const defaultTabForScreen = {
  cabinet: 'cabinet-info',
  patients: null,
  tournee: null,
  agendas: null,
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

  // Care label referential from GET /care-labels/
  const [careLabelEntries, setCareLabelEntries] = useState([]);
  // NGAP act codes from GET /care-catalog/
  const [ngapCodes, setNgapCodes] = useState([]);

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

  const loadCareLabels = useCallback(async () => {
    try {
      const data = await listCareLabels();
      setCareLabelEntries(data);
    } catch (err) {
      console.error('Failed to fetch care labels:', err);
    }
  }, []);

  const loadNgapCodes = useCallback(async () => {
    try {
      const data = await listCareActCodes();
      setNgapCodes(data);
    } catch (err) {
      console.error('Failed to fetch NGAP codes:', err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadMe();
      loadCabinet();
      loadCareLabels();
      loadNgapCodes();
    }
  }, [isAuthenticated, loadMe, loadCabinet, loadCareLabels, loadNgapCodes]);

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
    if (screen === 'facturation') {
      setPendingFacturationCount(0);
    }
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
  const [rdvForm, setRdvForm] = useState({ mode: 'select', patientId: '', newFirstName: '', newLastName: '', startTime: '', endTime: '', careProtocolId: '', locationType: 'home', careLabels: [], actCodes: [] });

  // Facturation automatique : toast de confirmation + badge
  const [completionToast, setCompletionToast] = useState(null); // { message, type: 'success'|'info' }
  const [pendingFacturationCount, setPendingFacturationCount] = useState(0);
  const [rdvError, setRdvError] = useState('');
  const [rdvPrescriptions, setRdvPrescriptions] = useState([]);
  const [rdvPrescriptionsLoading, setRdvPrescriptionsLoading] = useState(false);
  const [patientsWithActivePlans, setPatientsWithActivePlans] = useState(null); // null = loading, Set = loaded

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
  const [initialEditProtocolId, setInitialEditProtocolId] = useState(null);
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({});
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);

  // Navigation programmatique vers un patient (depuis Facturation, etc.)
  // Stocker l'intention dans un ref pour qu'elle survive au reset de l'effet ci-dessous
  const pendingPatientNavRef = useRef(null);

  // Réinitialise la sélection patient à chaque changement d'écran,
  // sauf si une navigation programmatique est en attente (deep-link depuis une autre vue)
  useEffect(() => {
    const pending = pendingPatientNavRef.current;
    pendingPatientNavRef.current = null;
    if (pending) {
      setSelectedPatientId(pending.patientId);
      setPatientSubTab(pending.subTab || 'info');
      setInitialEditProtocolId(pending.protocolId || null);
      const patient = patients.find(p => p.id === pending.patientId);
      if (patient) {
        setPatientForm({ ...patient });
        loadPrescriptionsForPatient(pending.patientId);
      }
    } else {
      setSelectedPatientId(null);
      setPatientSubTab('info');
      setInitialEditProtocolId(null);
    }
  // patients et loadPrescriptionsForPatient sont stables, la dépendance activeScreen suffit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen]);

  // --- PRESCRIPTIONS (Care Protocols + ordonnances liées) ---
  const loadPrescriptionsForPatient = useCallback(async (patientId) => {
    setPrescriptionsLoading(true);
    try {
      const data = await listCareProtocols({ patient_id: patientId });
      // Pour chaque plan, charger les ordonnances (soins) liées
      const mapped = await Promise.all(
        data.items.map(async (protocol) => {
          try {
            const prescData = await listPrescriptions({ care_protocol_id: protocol.id, limit: 10 });
            return protocolApiToFrontend(protocol, prescData.items || []);
          } catch {
            return protocolApiToFrontend(protocol, []);
          }
        })
      );
      setPatientForm(prev => ({ ...prev, prescriptions: mapped }));
    } catch (err) {
      console.error('Failed to fetch prescriptions:', err);
    } finally {
      setPrescriptionsLoading(false);
    }
  }, []);

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
      const data = await fetchMonthScheduleApi(year, month + 1); // API months are 1-based
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

  // Pre-load schedule for current + next 3 months (for prescription planning)
  useEffect(() => {
    if (!isAuthenticated) return;
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      fetchAndSetSchedule(d.getFullYear(), d.getMonth());
    }
  }, [isAuthenticated, fetchAndSetSchedule]);

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
      const data = await listAppointments({ limit: 100 });
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

  // --- PRESCRIPTIONS: save & delete ---
  const savePrescription = useCallback(async (rx, patientId) => {
    // Étape 1 : créer ou mettre à jour le CareProtocol (conteneur)
    let protocolId = rx._apiId;
    let protocolData;
    if (protocolId) {
      const payload = protocolFrontendToApiUpdate(rx);
      protocolData = await updateCareProtocol(protocolId, payload);
    } else {
      const payload = protocolFrontendToApiCreate(rx, patientId);
      protocolData = await createCareProtocol(payload);
      protocolId = protocolData.id;
    }

    // Étape 2 : créer ou mettre à jour chaque soin (Prescription)
    const savedApiPrescriptions = [];
    for (const soin of (rx.soins || [])) {
      let savedPrescription;
      if (soin._prescriptionId) {
        savedPrescription = await apiUpdatePrescription(soin._prescriptionId, soinToApiUpdate(soin));
      } else {
        savedPrescription = await apiCreatePrescription(soinToApiCreate(soin, protocolId, patientId));
      }
      // Upload du document si un fichier est en attente
      if (soin._pendingFile && savedPrescription?.id) {
        try {
          savedPrescription = await uploadPrescriptionDocument(savedPrescription.id, soin._pendingFile);
        } catch (e) {
          console.error('Échec upload document ordonnance:', e);
        }
      }
      savedApiPrescriptions.push(savedPrescription);
    }

    return protocolApiToFrontend(protocolData, savedApiPrescriptions);
  }, []);

  const deletePrescriptionApi = useCallback(async (rxId) => {
    const backendId = rxId.startsWith('rx_') ? rxId.slice(3) : rxId;
    if (backendId.includes('-')) {
      await deleteCareProtocol(backendId);
    }
  }, []);

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
    loadPrescriptionsForPatient(patient.id);
  };

  const closePatientDetail = () => {
    setSelectedPatientId(null);
    setIsEditingPatient(false);
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!patientForm.lastName.trim() || !patientForm.firstName.trim()) return;
    // Preserve prescriptions — patientApiToFrontend resets them to []
    const currentPrescriptions = patientForm.prescriptions || [];
    if (selectedPatientId === 'new') {
      try {
        const payload = patientFrontendToApiCreate(patientForm);
        const created = await apiCreatePatient(payload);
        const mapped = patientApiToFrontend(created);
        setPatients(prev => [...prev, mapped]);
        setSelectedPatientId(mapped.id);
        setPatientForm({ ...mapped, prescriptions: currentPrescriptions });
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
        setPatientForm({ ...mapped, prescriptions: currentPrescriptions });
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

  // --- APPLIQUER UNE TRAME ---
  const trames = cabinetData?.settings?.trames || [];

  const applyTrame = useCallback(async ({ trameId, startDate, cycleCount, personMap }) => {
    // Re-fetch cabinet to get absolute latest trame data (avoids stale state from out-of-order responses)
    let currentTrames = cabinetData?.settings?.trames || [];
    try {
      const freshCabinet = await fetchCabinet();
      setCabinetData(freshCabinet);
      currentTrames = freshCabinet?.settings?.trames || [];
    } catch { /* use cached */ }
    const trame = currentTrames.find(t => t.id === trameId);
    if (!trame) return { added: 0, skipped: 0, errors: 0 };

    const totalWeeks = cycleCount * trame.weekCount;
    // Parse date parts manually to avoid UTC timezone shift from ISO date strings
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd);
    // Align to Monday
    const startDay = start.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    const monday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + mondayOffset);

    // 1. Refresh schedule for affected months to get accurate backend state
    const affectedMonths = new Set();
    for (let week = 0; week < totalWeeks; week++) {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + week * 7 + dayIdx);
        affectedMonths.add(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    // Fetch fresh schedule data
    const freshSchedule = { ...schedule };
    for (const mk of affectedMonths) {
      const [y, m] = mk.split('-').map(Number);
      try {
        const data = await fetchMonthScheduleApi(y, m);
        Object.assign(freshSchedule, data.schedule);
      } catch { /* ignore, use local state */ }
    }

    // 2. Build assignments list using fresh schedule data
    const assignments = [];
    for (let week = 0; week < totalWeeks; week++) {
      const weekInCycle = week % trame.weekCount;
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + week * 7 + dayIdx);
        const dateStr = formatDate(date);
        const dayPattern = trame.pattern?.[weekInCycle]?.[dayIdx];
        if (!dayPattern) continue;

        for (const [slotId, personIndices] of Object.entries(dayPattern)) {
          if (!personIndices || personIndices.length === 0) continue;
          for (const pIdx of personIndices) {
            const nurseUserId = personMap[pIdx];
            if (!nurseUserId) continue;
            const alreadyAssigned = freshSchedule[dateStr]?.[slotId]?.includes(nurseUserId);
            if (!alreadyAssigned) {
              assignments.push({ dateStr, slotId, nurseUserId });
            }
          }
        }
      }
    }

    const result = { added: 0, skipped: assignments.length === 0 ? 1 : 0, errors: 0 };
    if (assignments.length === 0) return result;

    // 3. Optimistic local update
    setSchedule(prev => {
      const next = { ...prev };
      for (const { dateStr, slotId, nurseUserId } of assignments) {
        const daySchedule = next[dateStr] ? { ...next[dateStr] } : {};
        const slotSchedule = daySchedule[slotId] ? [...daySchedule[slotId]] : [];
        if (!slotSchedule.includes(nurseUserId)) {
          slotSchedule.push(nurseUserId);
        }
        daySchedule[slotId] = slotSchedule;
        next[dateStr] = daySchedule;
      }
      return next;
    });

    // 4. Persist each assignment — verify response, re-toggle if accidentally removed
    for (const { dateStr, slotId, nurseUserId } of assignments) {
      try {
        const resp = await toggleScheduleAssignment(nurseUserId, slotId, dateStr);
        if (resp.action === 'removed') {
          // Toggle removed an existing assignment — re-toggle to add it back
          await toggleScheduleAssignment(nurseUserId, slotId, dateStr);
        }
        result.added++;
      } catch {
        result.errors++;
      }
    }

    // 5. Always refresh affected months to sync local state with backend
    for (const mk of affectedMonths) {
      const [y, m] = mk.split('-').map(Number);
      await fetchAndSetSchedule(y, m - 1);
    }

    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabinetData, schedule, fetchAndSetSchedule]);

  // --- RÉINITIALISER LE PLANNING ---
  const resetPlanning = useCallback(async (datesToReset) => {
    if (datesToReset.length === 0) return { removed: 0 };

    // Collect all current assignments for the given dates
    const toRemove = [];
    for (const date of datesToReset) {
      const dateStr = formatDate(date);
      const daySchedule = schedule[dateStr];
      if (!daySchedule) continue;
      for (const [slotId, nurseIds] of Object.entries(daySchedule)) {
        for (const nurseId of nurseIds) {
          toRemove.push({ dateStr, slotId, nurseId });
        }
      }
    }

    if (toRemove.length === 0) return { removed: 0 };

    // Optimistic local clear
    setSchedule(prev => {
      const next = { ...prev };
      for (const date of datesToReset) {
        const dateStr = formatDate(date);
        next[dateStr] = {};
      }
      return next;
    });

    // Persist removals
    let removed = 0;
    for (const { dateStr, slotId, nurseId } of toRemove) {
      try {
        const resp = await toggleScheduleAssignment(nurseId, slotId, dateStr);
        if (resp.action === 'removed') removed++;
        else {
          // Toggle re-added it — toggle again to remove
          await toggleScheduleAssignment(nurseId, slotId, dateStr);
          removed++;
        }
      } catch {
        // ignore individual failures
      }
    }

    // Refresh affected months
    const months = new Set(datesToReset.map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`));
    for (const mk of months) {
      const [y, m] = mk.split('-').map(Number);
      await fetchAndSetSchedule(y, m - 1);
    }

    return { removed };
  }, [schedule, fetchAndSetSchedule]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToCurrentMonth = () => setCurrentDate(new Date());
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());

  // --- LOGIQUE RDV ---
  const loadRdvPrescriptions = useCallback(async (patientId) => {
    if (!patientId) { setRdvPrescriptions([]); return; }
    setRdvPrescriptionsLoading(true);
    try {
      const data = await listCareProtocols({ patient_id: patientId });
      const mapped = await Promise.all(
        data.items.map(async (protocol) => {
          try {
            const prescData = await listPrescriptions({ care_protocol_id: protocol.id, limit: 10 });
            return protocolApiToFrontend(protocol, prescData.items || []);
          } catch {
            return protocolApiToFrontend(protocol, []);
          }
        })
      );
      setRdvPrescriptions(mapped);
    } catch {
      setRdvPrescriptions([]);
    } finally {
      setRdvPrescriptionsLoading(false);
    }
  }, []);

  const openRdvModal = (dateStr, slotId, nurseId) => {
    setRdvModalParams({ dateStr, slotId, nurseId });
    setRdvForm({ mode: 'select', patientId: '', newFirstName: '', newLastName: '', startTime: '', endTime: '', careProtocolId: '', locationType: 'home', careLabels: [], actCodes: [] });
    setRdvPrescriptions([]);
    setRdvError('');
    // Fetch care protocols to determine which patients have active plans (en cours)
    // Backend limit max = 100, so paginate if needed
    setPatientsWithActivePlans(null);
    (async () => {
      try {
        const ids = new Set();
        let skip = 0;
        const pageSize = 100;
        let hasMore = true;
        while (hasMore) {
          const data = await listCareProtocols({ skip, limit: pageSize });
          for (const raw of data.items) {
            if (raw.status !== 'active') continue;
            const rx = protocolApiToFrontend(raw);
            const startDates = rx.soins?.map(s => s.startDate).filter(Boolean).sort() || [];
            const endDates = rx.soins?.map(s => s.endDate).filter(Boolean).sort() || [];
            const minStart = startDates[0];
            const maxEnd = endDates[endDates.length - 1];
            // dateStr (date du RDV) doit être dans [minStart, maxEnd]
            if (minStart && minStart > dateStr) continue;
            if (maxEnd && maxEnd < dateStr) continue;
            ids.add(raw.patient_id);
          }
          skip += pageSize;
          hasMore = skip < data.total;
        }
        setPatientsWithActivePlans(ids);
      } catch {
        setPatientsWithActivePlans(new Set());
      }
    })();
  };

  const editRdv = (appt) => {
    setRdvModalParams({ dateStr: appt.dateStr, slotId: appt.slotId, nurseId: appt.nurseId, editAppt: appt });
    setRdvForm({ mode: 'select', patientId: appt.patientId, newFirstName: '', newLastName: '', startTime: appt.startTime, endTime: appt.endTime, careProtocolId: appt.careProtocolId || '', locationType: appt._apiLocationType || 'home', status: appt.status || 'scheduled', careLabels: appt.careLabels || [], actCodes: appt.actCodes || [] });
    setRdvError('');
    loadRdvPrescriptions(appt.patientId);
  };

  const handleUpdateRdv = async (e) => {
    e.preventDefault();
    setRdvError('');
    const editAppt = rdvModalParams.editAppt;

    if (!rdvForm.startTime || !rdvForm.endTime) { setRdvError("Les horaires sont requis."); return; }
    if (rdvForm.startTime === rdvForm.endTime) { setRdvError("Heures identiques."); return; }

    const config = getActiveConfigForDate(new Date(rdvModalParams.dateStr));
    const slot = config.slots.find(s => s.id === rdvModalParams.slotId);
    if (!slot) return;

    if (!isTimeWithinSlot(rdvForm.startTime, rdvForm.endTime, slot.startTime, slot.endTime)) {
      setRdvError(`Hors créneau (${slot.startTime}-${slot.endTime}).`); return;
    }

    const slotAppts = appointments.filter(a =>
      a.dateStr === rdvModalParams.dateStr && a.slotId === rdvModalParams.slotId
      && a.nurseId === rdvModalParams.nurseId && a.id !== editAppt.id
    );
    if (slotAppts.some(a => doSlotsOverlap(rdvForm.startTime, rdvForm.endTime, a.startTime, a.endTime))) {
      setRdvError("Chevauchement avec un autre RDV."); return;
    }

    try {
      const payload = apptFrontendToApiUpdate({
        dateStr: rdvModalParams.dateStr,
        startTime: rdvForm.startTime,
        endTime: rdvForm.endTime,
        careProtocolId: rdvForm.careProtocolId,
        locationType: rdvForm.locationType,
        status: rdvForm.status,
        actCodes: rdvForm.actCodes,
        careLabels: rdvForm.careLabels,
      });
      const updated = await apiUpdateAppointment(editAppt.id, payload);
      const pMap = new Map(patientsRef.current.map(p => [p.id, p]));
      const mappedAppt = apptApiToFrontend(updated, pMap);
      assignSlotIds([mappedAppt], getActiveConfigForDate);
      setAppointments(prev => prev.map(a => a.id === editAppt.id ? mappedAppt : a));
      setRdvModalParams(null);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (err.response?.status === 409) {
        setRdvError(detail || 'Conflit horaire avec un autre RDV.');
      } else {
        setRdvError(detail || 'Erreur lors de la modification du RDV.');
      }
    }
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

    if (!rdvForm.careProtocolId) { setRdvError("Un plan de soins est requis."); return; }
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
        careProtocolId: rdvForm.careProtocolId || undefined,
        locationType: rdvForm.locationType,
        actCodes: rdvForm.actCodes,
        careLabels: rdvForm.careLabels,
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
  const createAppointmentForPrescription = useCallback(async ({ dateStr, startTime, endTime, nurseId, patientId, careProtocolId, actCodes, careLabels }) => {
    const apptPayload = apptFrontendToApiCreate({ dateStr, startTime, endTime, nurseId, patientId, careProtocolId, actCodes, careLabels });
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
      const updated = await apiCancelAppointment(id, 'Annulé depuis le planning');
      const pMap = new Map(patientsRef.current.map(p => [p.id, p]));
      const mappedAppt = apptApiToFrontend(updated, pMap);
      assignSlotIds([mappedAppt], getActiveConfigForDate);
      setAppointments(prev => prev.map(a => a.id === id ? mappedAppt : a));
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de l\'annulation du RDV.');
    }
  };

  const completeRdv = async (id) => {
    try {
      const updated = await apiCompleteAppointment(id);
      const pMap = new Map(patientsRef.current.map(p => [p.id, p]));
      const mappedAppt = apptApiToFrontend(updated, pMap);
      assignSlotIds([mappedAppt], getActiveConfigForDate);
      setAppointments(prev => prev.map(a => a.id === id ? mappedAppt : a));

      // Feedback facturation automatique
      const ab = updated.auto_billing;
      let toastMsg;
      if (ab?.status === 'created' && ab.invoice_total != null) {
        const total = Number(ab.invoice_total).toFixed(2);
        toastMsg = { message: `RDV terminé · Facture brouillon ${total} € créée`, type: 'success' };
        setPendingFacturationCount(prev => prev + 1);
      } else if (ab?.status === 'skipped') {
        toastMsg = { message: 'RDV terminé · Facture à compléter dans Facturation', type: 'info' };
      } else {
        toastMsg = { message: 'RDV marqué comme terminé', type: 'success' };
      }
      setCompletionToast(toastMsg);
      setTimeout(() => setCompletionToast(null), 4500);
    } catch (err) {
      alert(err.response?.data?.detail || 'Erreur lors de la complétion du RDV.');
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

  // Derive careLabels (string[]), careDurations (label->minutes), careLabelCodeMap (label->act_codes[]) from API entries
  const careLabels = useMemo(() => careLabelEntries.map(e => e.label), [careLabelEntries]);
  const careDurations = useMemo(() => {
    const map = {};
    for (const e of careLabelEntries) map[e.label] = e.default_duration_minutes;
    return map;
  }, [careLabelEntries]);
  const careLabelCodeMap = useMemo(() => {
    const map = {};
    for (const e of careLabelEntries) map[e.label] = e.act_codes;
    return map;
  }, [careLabelEntries]);

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

  // --- readOnly ---
  const isReadOnly = userRole !== 'admin';

  // --- AUTH GUARD ---
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // --- RENDU ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans p-3 md:px-4 md:py-4">
      <div>

        <Header
          activeScreen={activeScreen}
          onScreenChange={handleScreenChange}
          onLogout={handleLogout}
          pendingFacturationCount={pendingFacturationCount}
        />
        <InfoBanner cabinet={meData?.cabinet} user={meData?.user} />

        <main className="bg-white rounded-xl shadow-sm border border-slate-200 min-h-[600px] p-4">

          {activeScreen === 'cabinet' && (
            <nav className="flex justify-center gap-6 border-b border-slate-200 mb-6 -mt-1">
              {cabinetTabs.filter(t => t.id !== 'creneaux' || !isReadOnly).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </nav>
          )}

          {/* --- Patients --- */}
          {activeScreen === 'patients' && (
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
              onSavePrescription={savePrescription}
              onDeletePrescription={deletePrescriptionApi}
              prescriptionsLoading={prescriptionsLoading}
              careLabels={careLabels}
              careDurations={careDurations}
              careLabelCodeMap={careLabelCodeMap}
              cabinetData={cabinetData}
              initialEditProtocolId={initialEditProtocolId}
            />
              )}
            </>
          )}

          {/* --- Ma Tournée --- */}
          {activeScreen === 'tournee' && (
            <MaTourneeTab
              nurses={nurses}
              appointments={appointments}
              schedule={schedule}
              getActiveConfigForDate={getActiveConfigForDate}
              openRdvModal={openRdvModal}
              deleteRdv={deleteRdv}
              editRdv={editRdv}
              completeRdv={completeRdv}
              patients={patients}
              cabinetData={cabinetData}
              meUserId={meData?.user?.id}
            />
          )}

          {/* --- Agenda --- */}
          {activeScreen === 'agendas' && (
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
              editRdv={editRdv}
              completeRdv={completeRdv}
              patients={patients}
              cabinetData={cabinetData}
              fetchScheduleForMonth={fetchAndSetSchedule}
              meUserId={meData?.user?.id}
            />
          )}

          {/* --- Cabinet (info + équipe) --- */}
          {activeScreen === 'cabinet' && activeTab === 'cabinet-info' && (
            <div className="space-y-8">
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
            </div>
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
              trames={trames}
              onApplyTrame={applyTrame}
              onResetPlanning={resetPlanning}
            />
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
              cabinetData={cabinetData}
              onCabinetUpdate={handleCabinetUpdate}
              careLabelEntries={careLabelEntries}
              onReloadCareLabels={loadCareLabels}
              ngapCodes={ngapCodes}
            />
          )}

          {/* --- Facturation --- */}
          {activeScreen === 'facturation' && (
            <FacturationTab
              nurses={nurses}
              onNavigateToPrescription={(patientId, careProtocolId) => {
                pendingPatientNavRef.current = {
                  patientId,
                  subTab: 'prescriptions',
                  protocolId: careProtocolId || null,
                };
                handleScreenChange('patients');
              }}
            />
          )}

          {/* --- Administration --- */}
          {activeScreen === 'administration' && (
            <AdministrationScreen />
          )}

        </main>
      </div>

      {/* --- TOAST FACTURATION AUTO --- */}
      {completionToast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all animate-in slide-in-from-bottom-2 ${
            completionToast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-white'
          }`}
        >
          {completionToast.type === 'success' ? '✅' : 'ℹ️'}
          <span>{completionToast.message}</span>
        </div>
      )}

      {/* --- MODALES --- */}
      <RdvModal
        rdvModalParams={rdvModalParams}
        setRdvModalParams={setRdvModalParams}
        rdvForm={rdvForm}
        setRdvForm={setRdvForm}
        rdvError={rdvError}
        patients={activePatients}
        nurses={nurses}
        handleSaveRdv={handleSaveRdv}
        handleUpdateRdv={handleUpdateRdv}
        rdvPrescriptions={rdvPrescriptions}
        rdvPrescriptionsLoading={rdvPrescriptionsLoading}
        onPatientChange={loadRdvPrescriptions}
        patientsWithActivePlans={patientsWithActivePlans}
      />

    </div>
  );
}
