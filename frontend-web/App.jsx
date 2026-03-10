import React, { useState } from 'react';
import { 
  Calendar, Users, Clock, Plus, Trash2, 
  ChevronLeft, ChevronRight, X, UserPlus, CalendarDays,
  Lock, ShieldCheck, AlertCircle, Edit, Phone, Mail,
  UserCircle, FileText, History, ArrowLeft, Search, Activity, MapPin, Stethoscope
} from 'lucide-react';

// --- UTILITAIRES DE DATES ET HORAIRES ---
const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (date) => {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const doSlotsOverlap = (start1, end1, start2, end2) => {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  const getIntervals = (start, end) => {
    if (start < end) return [[start, end]];
    if (start === end) return []; 
    return [[start, 1440], [0, end]]; 
  };

  const int1 = getIntervals(s1, e1);
  const int2 = getIntervals(s2, e2);

  for (const [aStart, aEnd] of int1) {
    for (const [bStart, bEnd] of int2) {
      if (Math.max(aStart, bStart) < Math.min(aEnd, bEnd)) {
        return true; 
      }
    }
  }
  return false;
};

const isTimeWithinSlot = (start, end, boundStart, boundEnd) => {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const bs = timeToMinutes(boundStart);
  const be = timeToMinutes(boundEnd);

  const isRdvOvernight = s >= e;
  const isSlotOvernight = bs >= be;

  if (!isSlotOvernight) {
    if (isRdvOvernight) return false; 
    return s >= bs && e <= be;
  } else {
    if (isRdvOvernight) {
      return s >= bs && e <= be;
    } else {
      return (s >= bs && e > s) || (e <= be && e > s);
    }
  }
};

// --- COMPOSANT PRINCIPAL ---
export default function App() {
  // --- ÉTATS (State) ---
  const [activeTab, setActiveTab] = useState('patients'); // Ouvert sur patients pour tester
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAgendaNurseId, setSelectedAgendaNurseId] = useState(null);

  // Liste des infirmiers
  const [nurses, setNurses] = useState([
    { id: '1', name: 'Alice Dupont', role: 'Titulaire', phone: '06 12 34 56 78', email: 'alice.d@cabinet.fr', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: '2', name: 'Benoît Martin', role: 'Collaborateur', phone: '06 98 76 54 32', email: 'benoit.m@cabinet.fr', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  ]);

  // Configurations horaires
  const [configs, setConfigs] = useState([
    {
      id: 'c1',
      name: 'Organisation Standard',
      startDate: '2024-01-01',
      slots: [
        { id: 'c1_s1', name: 'Matin', startTime: '06:00', endTime: '13:00' },
        { id: 'c1_s2', name: 'Soir', startTime: '16:00', endTime: '20:00' }
      ]
    }
  ]);
  // Planning mensuel : { "YYYY-MM-DD": { "slot_id": ["nurse_id_1", "nurse_id_2"] } }
  const [schedule, setSchedule] = useState({});
  const [planningStatuses, setPlanningStatuses] = useState({});

  // RDVs
  const [appointments, setAppointments] = useState([
    { id: 'rdv_1', dateStr: formatDate(new Date()), slotId: 'c1_s1', nurseId: '1', patientId: 'p1', patient: 'Jean DUPONT', startTime: '08:00', endTime: '08:30' }
  ]);
  const [rdvModalParams, setRdvModalParams] = useState(null);
  const [rdvForm, setRdvForm] = useState({ mode: 'select', patientId: '', newFirstName: '', newLastName: '', startTime: '', endTime: '' });
  const [rdvError, setRdvError] = useState('');

  // Infirmiers
  const [nurseModalParams, setNurseModalParams] = useState(null); 
  const [nurseForm, setNurseForm] = useState({ name: '', role: 'Titulaire', phone: '', email: '', color: '' });
  
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigDate, setNewConfigDate] = useState(formatDate(new Date()));
  const [configError, setConfigError] = useState('');
  
  const [slotFormData, setSlotFormData] = useState({}); 
  const [slotErrors, setSlotErrors] = useState({}); 

  // --- NOUVEAUX ÉTATS POUR LES PATIENTS ---
  const [patients, setPatients] = useState([
    { 
      id: 'p1', firstName: 'Jean', lastName: 'DUPONT', phone: '06 11 22 33 44', email: 'jean.dupont@email.com', 
      address: '12 Rue de la Paix, 75000 Paris', ssn: '1 80 12 75 123 456 78', 
      doctorName: 'Dr. Michel Lefevre', doctorContact: '01 45 67 89 00', 
      antecedents: 'Diabète de type 2 (diagnostiqué en 2018)\nHypertension artérielle sous traitement.', 
      notes: 'Patient parfois anxieux lors des prises de sang. Prévoir un peu de temps pour rassurer.' 
    }
  ]);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientSubTab, setPatientSubTab] = useState('info'); // 'info', 'medical', 'history'
  const [isEditingPatient, setIsEditingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({});

  // --- LOGIQUE MÉTIER PATIENTS ---
  const filteredPatients = patients.filter(p => 
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.address.toLowerCase().includes(patientSearch.toLowerCase())
  );

  const openNewPatient = () => {
    const newPatient = { firstName: '', lastName: '', phone: '', email: '', address: '', ssn: '', doctorName: '', doctorContact: '', antecedents: '', notes: '' };
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

  const deletePatient = (id) => {
    setPatients(patients.filter(p => p.id !== id));
    closePatientDetail();
  };

  // --- AUTRES LOGIQUES EXISTANTES ---
  const addNurse = (e) => { /* ... */ };
  const removeNurse = (id) => { setNurses(nurses.filter(n => n.id !== id)); };
  const handleSaveNurse = (e) => {
    e.preventDefault();
    if (!nurseForm.name.trim()) return;
    if (nurseModalParams.mode === 'edit') setNurses(nurses.map(n => n.id === nurseModalParams.id ? { ...nurseForm, id: n.id } : n));
    else setNurses([...nurses, { ...nurseForm, id: Date.now().toString() }]);
    setNurseModalParams(null);
  };
  const openNurseModal = (nurse = null) => {
    if (nurse) { setNurseForm({ ...nurse }); setNurseModalParams({ mode: 'edit', id: nurse.id }); } 
    else {
      const colors = ['bg-blue-100 text-blue-800 border-blue-200', 'bg-emerald-100 text-emerald-800 border-emerald-200'];
      setNurseForm({ name: '', role: 'Titulaire', phone: '', email: '', color: colors[0] });
      setNurseModalParams({ mode: 'add', id: null });
    }
  };

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
  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());

  const openRdvModal = (dateStr, slotId, nurseId) => {
    setRdvModalParams({ dateStr, slotId, nurseId }); 
    setRdvForm({ mode: 'select', patientId: '', newFirstName: '', newLastName: '', startTime: '', endTime: '' }); 
    setRdvError('');
  };

  const handleSaveRdv = (e) => {
    e.preventDefault(); setRdvError('');
    
    let finalPatientId = rdvForm.patientId;
    let finalPatientName = '';

    // 1. Gérer la création ou sélection du patient
    if (rdvForm.mode === 'new') {
      if (!rdvForm.newLastName.trim() || !rdvForm.newFirstName.trim()) {
        setRdvError("Le nom et le prénom sont requis pour un nouveau patient."); return;
      }
      finalPatientId = 'p_' + Date.now();
      finalPatientName = `${rdvForm.newFirstName} ${rdvForm.newLastName.toUpperCase()}`;
      
      // Enregistrer le nouveau patient à la volée dans la base
      setPatients(prev => [...prev, {
        id: finalPatientId,
        firstName: rdvForm.newFirstName,
        lastName: rdvForm.newLastName.toUpperCase(),
        phone: '', email: '', address: '', ssn: '', doctorName: '', doctorContact: '', antecedents: '', notes: ''
      }]);
    } else {
      if (!finalPatientId) {
        setRdvError("Veuillez sélectionner un patient existant."); return;
      }
      const p = patients.find(p => p.id === finalPatientId);
      finalPatientName = `${p.firstName} ${p.lastName.toUpperCase()}`;
    }

    // 2. Valider les horaires
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
    
    // 3. Créer le RDV avec la bonne clé étrangère
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

  const workingNursesIds = new Set();
  daysInMonth.forEach(date => {
    const daySchedule = schedule[formatDate(date)];
    if (daySchedule) Object.values(daySchedule).forEach(assigned => assigned.forEach(id => workingNursesIds.add(id)));
  });
  const workingNurses = nurses.filter(n => workingNursesIds.has(n.id));
  if (workingNurses.length > 0 && !workingNursesIds.has(selectedAgendaNurseId)) setSelectedAgendaNurseId(workingNurses[0].id);
  else if (workingNurses.length === 0 && selectedAgendaNurseId !== null) setSelectedAgendaNurseId(null);

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
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Calendar className="text-blue-600" size={32} />
            IDEL Planning Pro
          </h1>
          <p className="text-slate-500 mt-1">Gérez l'équipe, les créneaux, les patients et le planning mensuel.</p>
        </header>

        {/* Navigation */}
        <nav className="flex space-x-2 mb-6 bg-white p-1 rounded-lg shadow-sm border border-slate-200 inline-flex flex-wrap gap-y-2">
          <button onClick={() => setActiveTab('planning')} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'planning' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Calendar size={18} /> Planning
          </button>
          <button onClick={() => setActiveTab('agendas')} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'agendas' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <CalendarDays size={18} /> Agendas RDV
          </button>
          <button onClick={() => setActiveTab('patients')} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'patients' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <UserCircle size={18} /> Patients
          </button>
          <button onClick={() => setActiveTab('equipe')} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'equipe' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Users size={18} /> Équipe
          </button>
          <button onClick={() => setActiveTab('creneaux')} className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'creneaux' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Clock size={18} /> Créneaux
          </button>
        </nav>

        {/* Contenu des onglets */}
        <main className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-h-[600px]">
          
          {/* ONGLET : PATIENTS */}
          {activeTab === 'patients' && (
            <div className="max-w-5xl mx-auto">
              
              {/* Vue 1 : LISTE DES PATIENTS */}
              {!selectedPatientId && (
                <div className="space-y-6 animate-in fade-in duration-300">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 border-b border-slate-200 pb-4">
                    <h2 className="text-xl font-semibold text-slate-800">Dossiers Patients</h2>
                    <div className="flex w-full sm:w-auto gap-3">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="text" 
                          placeholder="Rechercher un patient..." 
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                        />
                      </div>
                      <button onClick={openNewPatient} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm whitespace-nowrap">
                        <Plus size={18} /> Nouveau Patient
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPatients.map(patient => (
                      <div key={patient.id} onClick={() => openPatientDetail(patient)} className="bg-slate-50 border border-slate-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 uppercase">{patient.lastName} <span className="capitalize font-medium">{patient.firstName}</span></h3>
                            <span className="text-xs text-slate-500">{patient.ssn || 'SSN non renseigné'}</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-sm text-slate-600">
                          {patient.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400"/> {patient.phone}</div>}
                          {patient.address && <div className="flex items-start gap-2"><MapPin size={14} className="text-slate-400 mt-0.5 shrink-0"/> <span className="line-clamp-1">{patient.address}</span></div>}
                        </div>
                      </div>
                    ))}
                    {filteredPatients.length === 0 && (
                      <div className="col-span-full text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        Aucun patient ne correspond à votre recherche.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Vue 2 : DÉTAIL D'UN PATIENT */}
              {selectedPatientId && (
                <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full">
                  
                  {/* Header Patient */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
                    <div className="flex items-center gap-4">
                      <button onClick={closePatientDetail} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                      </button>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl border border-blue-200">
                          {patientForm.firstName?.charAt(0) || '?'}{patientForm.lastName?.charAt(0) || '?'}
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-slate-800 uppercase">
                            {patientForm.lastName || 'Nouveau'} <span className="capitalize font-medium">{patientForm.firstName || 'Patient'}</span>
                          </h2>
                          {!isEditingPatient && <span className="text-sm text-slate-500">Dossier N° {selectedPatientId === 'new' ? '---' : selectedPatientId.replace('p_', '')}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-16 md:ml-0">
                      {!isEditingPatient ? (
                        <>
                          <button onClick={() => deletePatient(selectedPatientId)} className="text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                            <Trash2 size={16}/> Supprimer
                          </button>
                          <button onClick={() => setIsEditingPatient(true)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
                            <Edit size={16}/> Modifier
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => selectedPatientId === 'new' ? closePatientDetail() : setIsEditingPatient(false)} className="text-slate-600 hover:bg-slate-100 px-4 py-2 rounded-lg font-medium transition-colors">
                            Annuler
                          </button>
                          <button onClick={handleSavePatient} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                            Enregistrer
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sous-onglets */}
                  <div className="flex gap-1 border-b border-slate-200 mb-6">
                    <button onClick={() => setPatientSubTab('info')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${patientSubTab === 'info' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <UserCircle size={16}/> Informations
                    </button>
                    <button onClick={() => setPatientSubTab('medical')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${patientSubTab === 'medical' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      <Activity size={16}/> Dossier de soins
                    </button>
                    <button onClick={() => setPatientSubTab('history')} disabled={selectedPatientId === 'new'} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${patientSubTab === 'history' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'}`}>
                      <History size={16}/> Historique
                    </button>
                  </div>

                  {/* Contenu Sous-onglets */}
                  <div className="flex-1 overflow-y-auto pb-8">
                    
                    {/* INFO TAB */}
                    {patientSubTab === 'info' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Identité & Contact */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Identité & Contact</h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Nom *</label>
                              {isEditingPatient ? <input type="text" value={patientForm.lastName} onChange={e => setPatientForm({...patientForm, lastName: e.target.value.toUpperCase()})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="DUPONT" /> : <div className="text-sm font-medium uppercase">{patientForm.lastName || '-'}</div>}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Prénom *</label>
                              {isEditingPatient ? <input type="text" value={patientForm.firstName} onChange={e => setPatientForm({...patientForm, firstName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none capitalize" placeholder="Jean" /> : <div className="text-sm font-medium capitalize">{patientForm.firstName || '-'}</div>}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Adresse complète</label>
                            {isEditingPatient ? <input type="text" value={patientForm.address} onChange={e => setPatientForm({...patientForm, address: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="12 rue de la Paix, 75000 Paris" /> : <div className="text-sm text-slate-700 flex items-start gap-2"><MapPin size={16} className="text-slate-400 shrink-0"/> {patientForm.address || '-'}</div>}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Téléphone</label>
                              {isEditingPatient ? <input type="tel" value={patientForm.phone} onChange={e => setPatientForm({...patientForm, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="06..." /> : <div className="text-sm text-slate-700 flex items-center gap-2"><Phone size={16} className="text-slate-400"/> {patientForm.phone || '-'}</div>}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                              {isEditingPatient ? <input type="email" value={patientForm.email} onChange={e => setPatientForm({...patientForm, email: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="@" /> : <div className="text-sm text-slate-700 flex items-center gap-2"><Mail size={16} className="text-slate-400"/> {patientForm.email || '-'}</div>}
                            </div>
                          </div>
                        </div>

                        {/* Données Médicales */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Administratif Médical</h3>
                          <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">N° Sécurité Sociale</label>
                            {isEditingPatient ? <input type="text" value={patientForm.ssn} onChange={e => setPatientForm({...patientForm, ssn: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none tracking-widest" placeholder="1 80 12 75..." /> : <div className="text-sm font-mono tracking-widest text-slate-800">{patientForm.ssn || '-'}</div>}
                          </div>
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-3">
                            <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2"><Stethoscope size={16} className="text-blue-600"/> Médecin Traitant</h4>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Nom du médecin</label>
                              {isEditingPatient ? <input type="text" value={patientForm.doctorName} onChange={e => setPatientForm({...patientForm, doctorName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" placeholder="Dr. ..." /> : <div className="text-sm font-medium">{patientForm.doctorName || '-'}</div>}
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">Contact cabinet</label>
                              {isEditingPatient ? <input type="text" value={patientForm.doctorContact} onChange={e => setPatientForm({...patientForm, doctorContact: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white" placeholder="Tel ou Email..." /> : <div className="text-sm text-slate-600">{patientForm.doctorContact || '-'}</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* MEDICAL TAB (Dossier de soins) */}
                    {patientSubTab === 'medical' && (
                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><FileText size={18} className="text-blue-600"/> Antécédents médicaux connus</label>
                          {isEditingPatient ? (
                            <textarea value={patientForm.antecedents} onChange={e => setPatientForm({...patientForm, antecedents: e.target.value})} rows={5} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Allergies, pathologies lourdes, opérations récentes..."></textarea>
                          ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 whitespace-pre-wrap min-h-[100px]">
                              {patientForm.antecedents || <span className="text-amber-700/60 italic">Aucun antécédent renseigné.</span>}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><UserCircle size={18} className="text-blue-600"/> Notes internes cabinet</label>
                          {isEditingPatient ? (
                            <textarea value={patientForm.notes} onChange={e => setPatientForm({...patientForm, notes: e.target.value})} rows={4} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Codes porte, habitudes du patient, précautions particulières..."></textarea>
                          ) : (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[80px]">
                              {patientForm.notes || <span className="text-slate-400 italic">Aucune note.</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* HISTORY TAB */}
                    {patientSubTab === 'history' && (
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">Historique des passages planifiés</h3>
                        
                        {/* On utilise maintenant le vrai patientId (clé étrangère) pour la liaison ! */}
                        {appointments.filter(a => a.patientId === patientForm.id).length > 0 ? (
                          <div className="space-y-3">
                            {appointments
                              .filter(a => a.patientId === patientForm.id)
                              .sort((a, b) => new Date(b.dateStr) - new Date(a.dateStr)) // Plus récent en premier
                              .map(rdv => {
                                const nurse = nurses.find(n => n.id === rdv.nurseId);
                                return (
                                  <div key={rdv.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm transition-shadow">
                                    <div className="flex items-center gap-4">
                                      <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-center font-bold">
                                        <div className="text-xs uppercase opacity-80">{new Date(rdv.dateStr).toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                                        <div className="text-lg">{new Date(rdv.dateStr).getDate()}</div>
                                      </div>
                                      <div>
                                        <div className="font-medium text-slate-800 capitalize">{new Date(rdv.dateStr).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</div>
                                        <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                          <Clock size={14}/> {rdv.startTime} - {rdv.endTime}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                                      <div className={`w-2 h-2 rounded-full ${nurse?.color.split(' ')[0] || 'bg-slate-400'}`}></div>
                                      <span className="text-sm font-medium text-slate-700">{nurse?.name || 'Infirmier inconnu'}</span>
                                    </div>
                                  </div>
                                )
                              })}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            Aucun rendez-vous trouvé dans l'agenda pour ce patient.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* LES AUTRES ONGLETS EXISTANTS (inchangés dans leur logique) */}
          {activeTab === 'planning' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={prevMonth} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft size={20} /></button>
                  <h2 className="text-xl font-semibold capitalize w-48 text-center">
                    {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </h2>
                  <button onClick={nextMonth} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight size={20} /></button>
                </div>
                
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
                    {currentPlanningStatus === 'validated' ? 'Déverrouiller' : 'Valider le mois'}
                  </button>
                </div>
              </div>

              {configs.length === 0 || configs.every(c => c.slots.length === 0) || nurses.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  Veuillez configurer l'équipe et les créneaux.
                </div>
              ) : (
                <div className="overflow-x-auto pb-4">
                  <table className="w-full text-left border-collapse min-w-max">
                    <thead>
                      <tr>
                        <th className="p-3 border-b-2 border-slate-200 font-semibold text-slate-600 sticky left-0 bg-slate-50 z-20 w-48 shadow-[1px_0_0_0_#e2e8f0]">Infirmier</th>
                        {daysInMonth.map(date => {
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          return (
                            <th key={formatDate(date)} className={`p-2 border-b-2 border-slate-200 font-semibold text-center text-xs min-w-[60px] ${isWeekend ? 'bg-slate-100' : 'bg-slate-50'}`}>
                              <div className="text-slate-500 capitalize">{date.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                              <div className="text-lg text-slate-800">{date.getDate()}</div>
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
                              {nurse.name}
                            </div>
                          </td>
                          {daysInMonth.map(date => {
                            const dateStr = formatDate(date);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            const activeConfig = getActiveConfigForDate(date);
                            
                            return (
                              <td key={dateStr} className={`p-1 align-middle border-x border-slate-50 ${isWeekend ? 'bg-slate-50/80' : ''}`}>
                                <div className="flex flex-col gap-1 items-center">
                                  {activeConfig.slots.map(slot => {
                                    const isAssigned = schedule[dateStr]?.[slot.id]?.includes(nurse.id);
                                    return (
                                      <button
                                        key={slot.id}
                                        onClick={() => toggleNurseSlot(dateStr, slot.id, nurse.id)}
                                        disabled={currentPlanningStatus === 'validated'}
                                        title={`${slot.name} - ${nurse.name}`}
                                        className={`w-full text-[10px] py-1 px-0.5 rounded border transition-all font-medium ${
                                          isAssigned ? `${nurse.color} ${currentPlanningStatus === 'validated' ? 'opacity-60 cursor-not-allowed' : ''}` : `bg-white border-slate-200 ${currentPlanningStatus === 'validated' ? 'opacity-40 cursor-not-allowed text-slate-300' : 'text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`
                                        }`}
                                      >
                                        {slot.name.substring(0, 3)}
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
          )}

          {activeTab === 'agendas' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 mb-6">
                <button onClick={prevMonth} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronLeft size={20} /></button>
                <h2 className="text-xl font-semibold capitalize">
                  {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </h2>
                <button onClick={nextMonth} className="p-2 hover:bg-white rounded shadow-sm border border-transparent hover:border-slate-200 transition-all"><ChevronRight size={20} /></button>
              </div>

              {workingNurses.length === 0 ? (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  Aucun infirmier n'est planifié pour ce mois-ci.
                </div>
              ) : (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="w-full md:w-64 shrink-0 space-y-2">
                    <h3 className="font-semibold text-slate-700 mb-3 border-b pb-2">Infirmiers en tournée</h3>
                    {workingNurses.map(nurse => (
                      <button key={nurse.id} onClick={() => setSelectedAgendaNurseId(nurse.id)} className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${selectedAgendaNurseId === nurse.id ? 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-200' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'}`}>
                        <div className={`w-4 h-4 rounded-full ${nurse.color.split(' ')[0]}`}></div>
                        <span className="font-medium">{nurse.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col">
                    {selectedAgendaNurseId && (
                      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-[600px]">
                        <div className="p-4 border-b border-slate-200 bg-slate-50 rounded-t-xl flex justify-between items-center shrink-0">
                          <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                            <CalendarDays className="text-blue-600" size={20} /> Agenda de {nurses.find(n => n.id === selectedAgendaNurseId)?.name}
                          </h3>
                        </div>
                        
                        <div className="flex-1 overflow-x-auto flex">
                          {daysInMonth.map(date => {
                            const dateStr = formatDate(date);
                            const activeConfig = getActiveConfigForDate(date);
                            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                            const workingSlots = activeConfig.slots.filter(slot => schedule[dateStr]?.[slot.id]?.includes(selectedAgendaNurseId));
                            const worksToday = workingSlots.length > 0;

                            return (
                              <div key={dateStr} className={`min-w-[240px] border-r border-slate-200 flex flex-col ${isWeekend ? 'bg-slate-50/50' : 'bg-white'}`}>
                                <div className={`p-3 border-b border-slate-200 text-center sticky top-0 z-10 ${worksToday ? 'bg-blue-50/80 border-blue-100' : 'bg-slate-50'}`}>
                                  <div className={`text-xs font-medium uppercase ${worksToday ? 'text-blue-600' : 'text-slate-500'}`}>{date.toLocaleDateString('fr-FR', { weekday: 'short' })}</div>
                                  <div className={`text-2xl font-bold ${worksToday ? 'text-blue-700' : 'text-slate-700'}`}>{date.getDate()}</div>
                                </div>

                                <div className="flex-1 p-3 space-y-4 overflow-y-auto">
                                  {worksToday ? (
                                    workingSlots.map(slot => {
                                      const slotAppts = appointments.filter(a => a.dateStr === dateStr && a.slotId === slot.id && a.nurseId === selectedAgendaNurseId);
                                      return (
                                        <div key={slot.id} className="bg-blue-50 border border-blue-200 rounded-lg p-2 flex flex-col gap-2 shadow-sm min-h-[140px]">
                                          <div className="text-xs font-semibold text-blue-800 flex items-center justify-between">
                                            <span className="flex items-center gap-1"><Clock size={12} /> {slot.name} ({slot.startTime}-{slot.endTime})</span>
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
                                          
                                          <button onClick={() => openRdvModal(dateStr, slot.id, selectedAgendaNurseId)} className="w-full bg-white hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 hover:border-blue-600 rounded text-xs py-1.5 font-medium transition-colors flex items-center justify-center gap-1">
                                            <Plus size={14} /> Ajouter RDV
                                          </button>
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="h-full flex items-center justify-center"><span className="text-xs text-slate-400 italic">Non travaillé</span></div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'equipe' && (
            <div className="max-w-5xl">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="text-xl font-semibold">Fiches Infirmiers</h2>
                <button onClick={() => openNurseModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm">
                  <UserPlus size={18} /> Ajouter un membre
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {nurses.map(nurse => (
                  <div key={nurse.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <div className={`h-2 ${nurse.color.split(' ')[0]}`}></div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${nurse.color}`}>{nurse.name.charAt(0)}</div>
                          <div>
                            <h3 className="font-bold text-slate-800">{nurse.name}</h3>
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{nurse.role}</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openNurseModal(nurse)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"><Edit size={16} /></button>
                          <button onClick={() => removeNurse(nurse.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div className="space-y-2 mt-auto text-sm text-slate-600">
                        {nurse.phone && <div className="flex items-center gap-2"><Phone size={14} className="text-slate-400" /> <span>{nurse.phone}</span></div>}
                        {nurse.email && <div className="flex items-center gap-2"><Mail size={14} className="text-slate-400" /> <span>{nurse.email}</span></div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'creneaux' && (
            <div className="max-w-3xl">
              <h2 className="text-xl font-semibold mb-6 border-b pb-2">Organisations Horaires</h2>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
                <h3 className="font-medium text-blue-800 mb-3 flex items-center gap-2"><Plus size={18}/> Nouvelle organisation</h3>
                <form onSubmit={addConfig} className="flex flex-wrap gap-2">
                  <input type="text" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} placeholder="Nom (ex: Horaires d'été)..." className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"/>
                  <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-lg px-3 py-2">
                    <span className="text-slate-500 text-sm">À partir du:</span>
                    <input type="date" value={newConfigDate} onChange={(e) => setNewConfigDate(e.target.value)} className="outline-none text-slate-700 bg-transparent"/>
                  </div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">Créer</button>
                </form>
                {configError && <div className="mt-3 flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded border border-red-100"><AlertCircle size={16} /> {configError}</div>}
              </div>

              <div className="space-y-6">
                {[...configs].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).map((config) => {
                  const currentSlotForm = slotFormData[config.id] || { name: '', startTime: '', endTime: '' };
                  return (
                    <div key={config.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-lg text-slate-800">{config.name}</h4>
                            {lockedConfigIds.has(config.id) && <span className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full"><Lock size={10} /> Verrouillé</span>}
                          </div>
                          <p className="text-sm text-slate-500">Applicable à partir du {new Date(config.startDate).toLocaleDateString('fr-FR')}</p>
                        </div>
                        <button onClick={() => removeConfig(config.id)} disabled={lockedConfigIds.has(config.id)} className={`p-2 rounded-md transition-colors ${lockedConfigIds.has(config.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}><Trash2 size={18} /></button>
                      </div>
                      <div className="p-4">
                        <div className="grid gap-2 mb-4">
                          {config.slots.map((slot) => (
                            <div key={slot.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                              <div className="flex flex-col"><span className="font-medium text-slate-700">{slot.name}</span><span className="text-xs text-slate-500 flex items-center gap-1"><Clock size={12}/> {slot.startTime} à {slot.endTime}</span></div>
                              <button onClick={() => removeSlotFromConfig(config.id, slot.id)} disabled={lockedConfigIds.has(config.id)} className={`p-1.5 rounded-md transition-colors ${lockedConfigIds.has(config.id) ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}><X size={16} /></button>
                            </div>
                          ))}
                        </div>
                        <form onSubmit={(e) => addSlotToConfig(e, config.id)} className="flex flex-col sm:flex-row gap-2">
                          <input type="text" value={currentSlotForm.name} onChange={(e) => setSlotFormData({...slotFormData, [config.id]: {...currentSlotForm, name: e.target.value}})} disabled={lockedConfigIds.has(config.id)} placeholder="Nom (ex: Matin)..." className={`flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${lockedConfigIds.has(config.id) ? 'bg-slate-50 cursor-not-allowed' : 'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'}`} required/>
                          <div className={`flex items-center gap-2 border border-slate-300 rounded-lg px-2 bg-white ${lockedConfigIds.has(config.id) ? 'bg-slate-50 cursor-not-allowed opacity-70' : ''}`}>
                            <span className="text-xs text-slate-500 font-medium">De</span>
                            <input type="time" value={currentSlotForm.startTime} onChange={(e) => setSlotFormData({...slotFormData, [config.id]: {...currentSlotForm, startTime: e.target.value}})} disabled={lockedConfigIds.has(config.id)} className="outline-none text-sm bg-transparent py-1.5 w-[75px]" required/>
                            <span className="text-xs text-slate-500 font-medium border-l border-slate-200 pl-2">À</span>
                            <input type="time" value={currentSlotForm.endTime} onChange={(e) => setSlotFormData({...slotFormData, [config.id]: {...currentSlotForm, endTime: e.target.value}})} disabled={lockedConfigIds.has(config.id)} className="outline-none text-sm bg-transparent py-1.5 w-[75px]" required/>
                          </div>
                          <button type="submit" disabled={lockedConfigIds.has(config.id)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors sm:w-auto w-full ${lockedConfigIds.has(config.id) ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>Ajouter</button>
                        </form>
                        {slotErrors[config.id] && <div className="mt-2 text-red-600 text-xs flex items-center gap-1 font-medium"><AlertCircle size={14} /> {slotErrors[config.id]}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </main>
      </div>

      {/* --- MODALES --- */}
      {rdvModalParams && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-lg text-slate-800">Nouveau Rendez-vous</h3>
              <button onClick={() => setRdvModalParams(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveRdv} className="p-5 space-y-4">
              {rdvError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium flex gap-2"><AlertCircle size={18} className="shrink-0" /><p>{rdvError}</p></div>}
              
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button type="button" onClick={() => setRdvForm({...rdvForm, mode: 'select'})} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${rdvForm.mode === 'select' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Patient existant</button>
                <button type="button" onClick={() => setRdvForm({...rdvForm, mode: 'new'})} className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${rdvForm.mode === 'new' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}>Nouveau patient</button>
              </div>

              {rdvForm.mode === 'select' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sélectionner un patient</label>
                  <select value={rdvForm.patientId} onChange={e => setRdvForm({...rdvForm, patientId: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                    <option value="" disabled>-- Choisir dans le répertoire --</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom</label>
                    <input type="text" value={rdvForm.newLastName} onChange={e => setRdvForm({...rdvForm, newLastName: e.target.value.toUpperCase()})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none uppercase" placeholder="DUPONT" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Prénom</label>
                    <input type="text" value={rdvForm.newFirstName} onChange={e => setRdvForm({...rdvForm, newFirstName: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none capitalize" placeholder="Jean" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Heure début</label>
                  <input type="time" value={rdvForm.startTime} onChange={e => setRdvForm({...rdvForm, startTime: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" required/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Heure fin</label>
                  <input type="time" value={rdvForm.endTime} onChange={e => setRdvForm({...rdvForm, endTime: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" required/>
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setRdvModalParams(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Annuler</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {nurseModalParams && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="font-semibold text-lg text-slate-800">{nurseModalParams.mode === 'add' ? 'Ajouter un membre' : 'Modifier la fiche'}</h3>
              <button onClick={() => setNurseModalParams(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveNurse} className="p-5 space-y-4">
              <input autoFocus type="text" value={nurseForm.name} onChange={e => setNurseForm({...nurseForm, name: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nom complet" required />
              <select value={nurseForm.role} onChange={e => setNurseForm({...nurseForm, role: e.target.value})} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Titulaire">Titulaire</option>
                <option value="Collaborateur">Collaborateur / Collaboratrice</option>
                <option value="Remplaçant(e)">Remplaçant(e)</option>
              </select>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setNurseModalParams(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Annuler</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}