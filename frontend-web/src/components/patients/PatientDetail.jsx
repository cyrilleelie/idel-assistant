import { useState, useEffect } from 'react';
import {
  ArrowLeft, UserMinus, UserPlus, Edit, UserCircle, Activity,
  MapPin, Phone, Mail, Stethoscope, FileText, ClipboardList, ScrollText, MessageSquare,
  Calendar, Users, AlertTriangle, ChevronDown, ShieldCheck
} from 'lucide-react';
import PrescriptionsTab from './PrescriptionsTab';
import PrescriptionList from '../prescriptions/PrescriptionList';
import DoctorAutocomplete from '../common/DoctorAutocomplete';
import AddressAutocomplete from '../common/AddressAutocomplete';
import TransmissionsTab from '../transmissions/TransmissionsTab';
import { listPrescriptions } from '../../api/prescriptions';

export default function PatientDetail({
  selectedPatientId, patientForm, setPatientForm,
  isEditingPatient, setIsEditingPatient,
  patientSubTab, setPatientSubTab,
  closePatientDetail, handleSavePatient, deactivatePatient, reactivatePatient,
  appointments, nurses, schedule, configs, getActiveConfigForDate,
  onCreateAppointment, onCancelAppointment,
  onSavePrescription, onDeletePrescription, prescriptionsLoading,
  careLabels, careDurations, careLabelCodeMap,
  cabinetData, patients,
  initialEditProtocolId,
  isDrawerMode = false
}) {
  const isInactive = patientForm.active === false;
  const [transmissionPreFilter, setTransmissionPreFilter] = useState(null);

  const navigateToTransmissions = (prescriptionId) => {
    setTransmissionPreFilter(prescriptionId);
    setPatientSubTab('transmissions');
  };

  const subTabs = [
    { id: 'info', label: 'Informations', icon: UserCircle },
    { id: 'prescriptions', label: 'Plans de soins', icon: ClipboardList },
    { id: 'ordonnances', label: 'Ordonnances', icon: ScrollText },
    { id: 'transmissions', label: 'Transmissions', icon: MessageSquare },
  ];

  // Collapsible sections state for drawer mode
  const defaultSections = { info: true, couverture: false, prescriptions: false, ordonnances: false, transmissions: false };
  const [openSections, setOpenSections] = useState(() => {
    if (patientSubTab && patientSubTab !== 'info') {
      return { info: false, couverture: false, prescriptions: false, ordonnances: false, transmissions: false, [patientSubTab]: true };
    }
    return defaultSections;
  });
  const toggleSection = (id) => setOpenSections(prev => {
    const wasOpen = prev[id];
    // Accordion: close all others, toggle the clicked one
    const next = { info: false, couverture: false, prescriptions: false, ordonnances: false, transmissions: false };
    next[id] = !wasOpen;
    return next;
  });

  // Section counts
  const [ordonnancesCount, setOrdonnancesCount] = useState(0);
  const prescriptionsCount = (patientForm.prescriptions || []).filter(rx => {
    if (rx.status === 'completed') return false;
    const ends = (rx.soins || []).map(s => s.endDate).filter(Boolean).sort();
    const endDate = ends[ends.length - 1] || '';
    return endDate >= new Date().toISOString().split('T')[0];
  }).length;

  // Eagerly fetch active ordonnances count when patient changes
  useEffect(() => {
    if (!patientForm.id) return;
    listPrescriptions({ patient_id: patientForm.id, limit: 100 })
      .then(data => {
        const items = data.items || [];
        const activeCount = items.filter(p => p.status === 'active' || p.status === 'expiring').length;
        setOrdonnancesCount(activeCount);
      })
      .catch(() => {});
  }, [patientForm.id]);

  // React to external navigation (e.g. from Facturation → Ordonnances)
  useEffect(() => {
    if (patientSubTab && patientSubTab !== 'info') {
      setOpenSections({ info: false, couverture: false, prescriptions: false, ordonnances: false, transmissions: false, [patientSubTab]: true });
    }
  }, [patientSubTab, selectedPatientId]);

  const drawerSections = [
    { id: 'info', label: 'Informations', icon: UserCircle },
    { id: 'couverture', label: 'Couverture Sante', icon: ShieldCheck },
    { id: 'prescriptions', label: 'Plans de soins', icon: ClipboardList },
    { id: 'ordonnances', label: 'Ordonnances', icon: ScrollText },
    { id: 'transmissions', label: 'Transmissions', icon: MessageSquare },
  ];

  // Drawer mode: collapsible sections, no tabs
  if (isDrawerMode) {
    return (
      <>
        {/* Action bar (edit/save/deactivate) */}
        <div className="px-4 py-2 border-b border-slate-100 bg-white flex items-center justify-end gap-2">
          {!isEditingPatient ? (
            <>
              {isInactive ? (
                <button onClick={() => reactivatePatient(selectedPatientId)} className="text-emerald-600 hover:bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                  <UserPlus size={14}/> Reactiver
                </button>
              ) : (
                <button onClick={() => deactivatePatient(selectedPatientId)} className="text-amber-600 hover:bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
                  <UserMinus size={14}/> Desactiver
                </button>
              )}
              <button onClick={() => setIsEditingPatient(true)} className="bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
                <Edit size={14}/> Modifier
              </button>
            </>
          ) : (
            <>
              <button onClick={() => selectedPatientId === 'new' ? closePatientDetail() : setIsEditingPatient(false)} className="text-slate-600 hover:bg-slate-100 px-3 py-1 rounded-lg text-xs font-medium transition-colors">
                Annuler
              </button>
              <button onClick={handleSavePatient} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm">
                Enregistrer
              </button>
            </>
          )}
        </div>

        {/* Collapsible sections */}
        <div className="flex-1 overflow-y-auto">
          {drawerSections.map(section => {
            const Icon = section.icon;
            const isOpen = openSections[section.id];
            return (
              <div key={section.id} className="border-b border-slate-200">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full px-5 py-3 flex items-center gap-2.5 hover:bg-slate-50 transition-colors"
                >
                  <Icon size={16} className="text-primary" />
                  <span className="text-sm font-semibold text-slate-800">{section.label}</span>
                  {section.id === 'prescriptions' && prescriptionsCount > 0 && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{prescriptionsCount}</span>
                  )}
                  {section.id === 'ordonnances' && ordonnancesCount > 0 && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{ordonnancesCount}</span>
                  )}
                  <ChevronDown size={15} className={`ml-auto text-slate-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pt-2 pb-5">
                    {renderDrawerSection({
                      sectionId: section.id,
                      patientForm, setPatientForm, isEditingPatient, setIsEditingPatient,
                      selectedPatientId, appointments, nurses, schedule, configs, getActiveConfigForDate,
                      onCreateAppointment, onCancelAppointment,
                      onSavePrescription, onDeletePrescription, prescriptionsLoading,
                      careLabels, careDurations, careLabelCodeMap,
                      cabinetData, patients, initialEditProtocolId,
                      onOrdonnancesCountChange: setOrdonnancesCount,
                      navigateToTransmissions: (prescriptionId) => {
                        setTransmissionPreFilter(prescriptionId);
                        setOpenSections(prev => ({ info: false, couverture: false, prescriptions: false, ordonnances: false, transmissions: true }));
                      },
                      transmissionPreFilter,
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </>
    );
  }

  // Full-page mode (fallback, kept for compatibility)
  return (
    <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full">
      {/* Header Patient */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <button onClick={closePatientDetail} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl border border-primary/20">
              {patientForm.firstName?.charAt(0) || '?'}{patientForm.lastName?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 uppercase">
                {patientForm.lastName || 'Nouveau'} <span className="capitalize font-medium">{patientForm.firstName || 'Patient'}</span>
              </h2>
              {!isEditingPatient && selectedPatientId !== 'new' && <span className="text-sm text-slate-500">Dossier patient</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-16 md:ml-0">
          {!isEditingPatient ? (
            <>
              {isInactive ? (
                <button onClick={() => reactivatePatient(selectedPatientId)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <UserPlus size={16}/> Reactiver
                </button>
              ) : (
                <button onClick={() => deactivatePatient(selectedPatientId)} className="text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <UserMinus size={16}/> Desactiver
                </button>
              )}
              <button onClick={() => setIsEditingPatient(true)} className="bg-primary/10 text-primary hover:bg-primary/20 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2">
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

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'transmissions') setTransmissionPreFilter(null);
                setPatientSubTab(tab.id);
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                patientSubTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={16}/> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-8">
        {renderTabContent({
          patientSubTab, patientForm, setPatientForm, isEditingPatient, setIsEditingPatient,
          selectedPatientId, appointments, nurses, schedule, configs, getActiveConfigForDate,
          onCreateAppointment, onCancelAppointment,
          onSavePrescription, onDeletePrescription, prescriptionsLoading,
          careLabels, careDurations, careLabelCodeMap,
          cabinetData, patients, initialEditProtocolId,
          navigateToTransmissions, transmissionPreFilter,
          isDrawerMode: false,
        })}
      </div>
    </div>
  );
}

// Shared tab content renderer
function renderTabContent({
  patientSubTab, patientForm, setPatientForm, isEditingPatient, setIsEditingPatient,
  selectedPatientId, appointments, nurses, schedule, configs, getActiveConfigForDate,
  onCreateAppointment, onCancelAppointment,
  onSavePrescription, onDeletePrescription, prescriptionsLoading,
  careLabels, careDurations, careLabelCodeMap,
  cabinetData, patients, initialEditProtocolId,
  navigateToTransmissions, transmissionPreFilter,
  isDrawerMode,
}) {
  // INFO TAB
  if (patientSubTab === 'info') {
    if (isDrawerMode && !isEditingPatient) {
      return <DrawerInfoView patientForm={patientForm} />;
    }
    return (
      <div className={isDrawerMode ? 'space-y-6' : 'grid grid-cols-1 md:grid-cols-2 gap-8'}>
        {/* Identity & Contact */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Identite & Contact</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nom *</label>
              {isEditingPatient ? <input type="text" value={patientForm.lastName} onChange={e => setPatientForm({...patientForm, lastName: e.target.value.toUpperCase()})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none uppercase" placeholder="DUPONT" /> : <div className="text-sm font-medium uppercase">{patientForm.lastName || '-'}</div>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Prenom *</label>
              {isEditingPatient ? <input type="text" value={patientForm.firstName} onChange={e => setPatientForm({...patientForm, firstName: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none capitalize" placeholder="Jean" /> : <div className="text-sm font-medium capitalize">{patientForm.firstName || '-'}</div>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Adresse complete</label>
            {isEditingPatient ? <AddressAutocomplete value={patientForm.address} onChange={address => setPatientForm({...patientForm, address})} placeholder="12 rue de la Paix, 75000 Paris" /> : <div className="text-sm text-slate-700 flex items-start gap-2"><MapPin size={16} className="text-slate-400 shrink-0"/> {patientForm.address || '-'}</div>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Telephone</label>
              {isEditingPatient ? <input type="tel" value={patientForm.phone} onChange={e => setPatientForm({...patientForm, phone: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="06..." /> : <div className="text-sm text-slate-700 flex items-center gap-2"><Phone size={16} className="text-slate-400"/> {patientForm.phone || '-'}</div>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              {isEditingPatient ? <input type="email" value={patientForm.email} onChange={e => setPatientForm({...patientForm, email: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="@" /> : <div className="text-sm text-slate-700 flex items-center gap-2"><Mail size={16} className="text-slate-400"/> {patientForm.email || '-'}</div>}
            </div>
          </div>
        </div>

        {/* Medical data */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-slate-100 pb-2">Administratif Medical</h3>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">N. Securite Sociale (NIR)</label>
            {isEditingPatient ? <input type="text" value={patientForm.ssn} onChange={e => setPatientForm({...patientForm, ssn: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none tracking-widest" placeholder="1 80 12 75 000 000 00" maxLength={15} /> : <div className="text-sm font-mono tracking-widest text-slate-800">{patientForm.ssn || '-'}</div>}
          </div>

          {/* SESAM-Vitale section */}
          <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-3">
            <h4 className="font-medium text-sm text-primary flex items-center gap-2">
              Assurance Maladie (SESAM-Vitale)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Code organisme AMO</label>
                {isEditingPatient ? (
                  <input type="text" value={patientForm.amo_code || ''} onChange={e => setPatientForm({...patientForm, amo_code: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none" placeholder="750100001" maxLength={9} />
                ) : <div className="text-sm font-mono text-slate-700">{patientForm.amo_code || '-'}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Centre gestionnaire</label>
                {isEditingPatient ? (
                  <input type="text" value={patientForm.amo_center || ''} onChange={e => setPatientForm({...patientForm, amo_center: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="CPAM Paris" />
                ) : <div className="text-sm text-slate-700">{patientForm.amo_center || '-'}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Type d'exoneration</label>
                {isEditingPatient ? (
                  <select value={patientForm.exoneration_type || ''} onChange={e => setPatientForm({...patientForm, exoneration_type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none bg-white">
                    <option value="">Aucune</option>
                    <option value="ALD">ALD (Affection Longue Duree)</option>
                    <option value="MAT">MAT (Maternite)</option>
                    <option value="AT">AT (Accident du Travail)</option>
                    <option value="100">100% (autres cas)</option>
                  </select>
                ) : <div className="text-sm text-slate-700">{patientForm.exoneration_type || 'Aucune'}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Rang de naissance</label>
                {isEditingPatient ? (
                  <input type="number" value={patientForm.birth_rank || ''} onChange={e => setPatientForm({...patientForm, birth_rank: e.target.value ? parseInt(e.target.value) : null})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="1" min={1} max={9} />
                ) : <div className="text-sm text-slate-700">{patientForm.birth_rank || '-'}</div>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-primary/10">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Mutuelle (code AMC)</label>
                {isEditingPatient ? (
                  <input type="text" value={patientForm.amc_code || ''} onChange={e => setPatientForm({...patientForm, amc_code: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Code AMC" maxLength={10} />
                ) : <div className="text-sm font-mono text-slate-700">{patientForm.amc_code || '-'}</div>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nom de la mutuelle</label>
                {isEditingPatient ? (
                  <input type="text" value={patientForm.amc_name || ''} onChange={e => setPatientForm({...patientForm, amc_name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="MGEN, Harmonie..." />
                ) : <div className="text-sm text-slate-700">{patientForm.amc_name || '-'}</div>}
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-500 mb-1">N. contrat AMC</label>
                {isEditingPatient ? (
                  <input type="text" value={patientForm.amc_contract || ''} onChange={e => setPatientForm({...patientForm, amc_contract: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Numero de contrat" />
                ) : <div className="text-sm font-mono text-slate-700">{patientForm.amc_contract || '-'}</div>}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-3">
            <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2"><Stethoscope size={16} className="text-primary"/> Medecin Traitant</h4>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Nom du medecin</label>
              {isEditingPatient ? (
                <DoctorAutocomplete
                  value={{ name: patientForm.doctorName, rpps_number: patientForm.doctorRpps || null }}
                  onChange={({ name, rpps_number }) => setPatientForm({ ...patientForm, doctorName: name, doctorRpps: rpps_number || '' })}
                  placeholder="Dr. ..."
                />
              ) : (
                <div className="text-sm font-medium flex items-center gap-2">
                  {patientForm.doctorName || '-'}
                  {patientForm.doctorRpps && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded border border-emerald-200">RPPS</span>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Contact cabinet</label>
              {isEditingPatient ? <input type="text" value={patientForm.doctorContact} onChange={e => setPatientForm({...patientForm, doctorContact: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none bg-white" placeholder="Tel ou Email..." /> : <div className="text-sm text-slate-600">{patientForm.doctorContact || '-'}</div>}
            </div>
          </div>

          {/* Dossier de soins (merged from former medical tab) */}
          <div className="space-y-4 mt-6">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><FileText size={18} className="text-primary"/> Antecedents medicaux connus</label>
              {isEditingPatient ? (
                <textarea value={patientForm.antecedents} onChange={e => setPatientForm({...patientForm, antecedents: e.target.value})} rows={4} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Allergies, pathologies lourdes, operations recentes..."></textarea>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900 whitespace-pre-wrap min-h-[60px]">
                  {patientForm.antecedents || <span className="text-amber-700/60 italic">Aucun antecedent renseigne.</span>}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2"><UserCircle size={18} className="text-primary"/> Notes internes cabinet</label>
              {isEditingPatient ? (
                <textarea value={patientForm.notes} onChange={e => setPatientForm({...patientForm, notes: e.target.value})} rows={3} className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="Codes porte, habitudes du patient, precautions particulieres..."></textarea>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 whitespace-pre-wrap min-h-[60px]">
                  {patientForm.notes || <span className="text-slate-400 italic">Aucune note.</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PRESCRIPTIONS TAB
  if (patientSubTab === 'prescriptions') {
    return (
      <PrescriptionsTab
        patientForm={patientForm}
        setPatientForm={setPatientForm}
        isEditingPatient={isEditingPatient}
        setIsEditingPatient={setIsEditingPatient}
        nurses={nurses}
        appointments={appointments}
        schedule={schedule}
        configs={configs}
        getActiveConfigForDate={getActiveConfigForDate}
        onCreateAppointment={onCreateAppointment}
        onCancelAppointment={onCancelAppointment}
        onSavePrescription={onSavePrescription}
        onDeletePrescription={onDeletePrescription}
        prescriptionsLoading={prescriptionsLoading}
        careLabels={careLabels}
        careDurations={careDurations}
        careLabelCodeMap={careLabelCodeMap}
        cabinetData={cabinetData}
        patients={patients}
        initialEditProtocolId={initialEditProtocolId}
      />
    );
  }

  // ORDONNANCES TAB
  if (patientSubTab === 'ordonnances' && patientForm.id) {
    return (
      <PrescriptionList
        patientId={patientForm.id}
        patientDoctor={patientForm.doctorName ? { name: patientForm.doctorName, rpps_number: patientForm.doctorRpps || null } : null}
        onViewTransmissions={navigateToTransmissions}
      />
    );
  }

  // TRANSMISSIONS TAB
  if (patientSubTab === 'transmissions' && patientForm.id) {
    return (
      <TransmissionsTab
        patientId={patientForm.id}
        nurses={nurses}
        initialPrescriptionFilter={transmissionPreFilter}
      />
    );
  }

  return null;
}

// Drawer collapsible section renderer
function renderDrawerSection({
  sectionId, patientForm, setPatientForm, isEditingPatient, setIsEditingPatient,
  selectedPatientId, appointments, nurses, schedule, configs, getActiveConfigForDate,
  onCreateAppointment, onCancelAppointment,
  onSavePrescription, onDeletePrescription, prescriptionsLoading,
  careLabels, careDurations, careLabelCodeMap,
  cabinetData, patients, initialEditProtocolId,
  navigateToTransmissions, transmissionPreFilter,
  onOrdonnancesCountChange,
}) {
  if (sectionId === 'info') {
    return <DrawerInfoView patientForm={patientForm} setPatientForm={setPatientForm} isEditing={isEditingPatient} />;
  }

  if (sectionId === 'couverture') {
    return <DrawerCouvertureView patientForm={patientForm} setPatientForm={setPatientForm} isEditing={isEditingPatient} />;
  }

  if (sectionId === 'prescriptions') {
    return (
      <PrescriptionsTab
        patientForm={patientForm}
        setPatientForm={setPatientForm}
        isEditingPatient={isEditingPatient}
        setIsEditingPatient={setIsEditingPatient}
        nurses={nurses}
        appointments={appointments}
        schedule={schedule}
        configs={configs}
        getActiveConfigForDate={getActiveConfigForDate}
        onCreateAppointment={onCreateAppointment}
        onCancelAppointment={onCancelAppointment}
        onSavePrescription={onSavePrescription}
        onDeletePrescription={onDeletePrescription}
        prescriptionsLoading={prescriptionsLoading}
        careLabels={careLabels}
        careDurations={careDurations}
        careLabelCodeMap={careLabelCodeMap}
        cabinetData={cabinetData}
        patients={patients}
        initialEditProtocolId={initialEditProtocolId}
      />
    );
  }

  if (sectionId === 'ordonnances' && patientForm.id) {
    return (
      <PrescriptionList
        patientId={patientForm.id}
        patientDoctor={patientForm.doctorName ? { name: patientForm.doctorName, rpps_number: patientForm.doctorRpps || null } : null}
        onViewTransmissions={navigateToTransmissions}
        onTotalChange={onOrdonnancesCountChange}
      />
    );
  }

  if (sectionId === 'transmissions' && patientForm.id) {
    return (
      <TransmissionsTab
        patientId={patientForm.id}
        nurses={nurses}
        initialPrescriptionFilter={transmissionPreFilter}
      />
    );
  }

  return <p className="text-sm text-slate-400 italic">Enregistrez le patient pour acceder a cette section.</p>;
}

// Drawer-specific info view (read + edit) — contact, identity, medical, notes
function DrawerInfoView({ patientForm, setPatientForm, isEditing = false }) {
  const pathologies = patientForm.antecedents ? patientForm.antecedents.split('\n').filter(Boolean) : [];
  const set = (field, value) => setPatientForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="space-y-4">
      {/* Quick info cards - 2 col grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Phone size={14} className="text-primary" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Telephone</span>
          </div>
          {isEditing
            ? <input type="tel" value={patientForm.phone} onChange={e => set('phone', e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="06..." />
            : <p className="text-sm font-semibold text-slate-800">{patientForm.phone || '-'}</p>
          }
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Mail size={14} className="text-primary" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase">Email</span>
          </div>
          {isEditing
            ? <input type="email" value={patientForm.email} onChange={e => set('email', e.target.value)} className="w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary/30 outline-none" placeholder="@" />
            : <p className="text-sm font-semibold text-slate-800">{patientForm.email || '-'}</p>
          }
        </div>
      </div>

      {/* Identity */}
      {isEditing && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Nom</label>
            <input type="text" value={patientForm.lastName} onChange={e => set('lastName', e.target.value.toUpperCase())} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none uppercase" placeholder="DUPONT" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">Prenom</label>
            <input type="text" value={patientForm.firstName} onChange={e => set('firstName', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none capitalize" placeholder="Jean" />
          </div>
        </div>
      )}

      {/* Address */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={14} className="text-primary" />
          <span className="text-[11px] font-semibold text-slate-400 uppercase">Adresse</span>
        </div>
        {isEditing
          ? <AddressAutocomplete value={patientForm.address} onChange={address => set('address', address)} placeholder="12 rue de la Paix, 75000 Paris" />
          : <p className="text-sm text-slate-700">{patientForm.address || '-'}</p>
        }
      </div>

      {/* Medical info */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Informations medicales</h4>

        <div>
          <span className="text-[11px] text-slate-400 font-medium">Medecin traitant</span>
          {isEditing
            ? <DoctorAutocomplete
                value={{ name: patientForm.doctorName, rpps_number: patientForm.doctorRpps || null }}
                onChange={({ name, rpps_number }) => setPatientForm({ ...patientForm, doctorName: name, doctorRpps: rpps_number || '' })}
                placeholder="Dr. ..."
              />
            : patientForm.doctorName
              ? <p className="text-sm font-medium text-slate-800 flex items-center gap-1.5">
                  <Stethoscope size={13} className="text-primary" />
                  {patientForm.doctorName}
                  {patientForm.doctorRpps && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1 py-0.5 rounded">RPPS</span>}
                </p>
              : <p className="text-xs text-slate-400 italic">Non renseigne</p>
          }
        </div>

        {isEditing ? (
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Contact cabinet</span>
            <input type="text" value={patientForm.doctorContact} onChange={e => set('doctorContact', e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none mt-1" placeholder="Tel ou Email..." />
          </div>
        ) : patientForm.doctorContact ? (
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Contact cabinet</span>
            <p className="text-sm text-slate-700">{patientForm.doctorContact}</p>
          </div>
        ) : null}

        <div>
          <span className="text-[11px] text-slate-400 font-medium">Antecedents medicaux</span>
          {isEditing
            ? <textarea value={patientForm.antecedents} onChange={e => set('antecedents', e.target.value)} rows={3} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary/30 outline-none mt-1" placeholder="Allergies, pathologies..." />
            : pathologies.length > 0
              ? <div className="flex flex-wrap gap-1.5 mt-1">
                  {pathologies.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">{p}</span>
                  ))}
                </div>
              : <p className="text-xs text-slate-400 italic">Aucun</p>
          }
        </div>
      </div>

      {/* Notes internes */}
      {isEditing ? (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-600 uppercase">Notes internes</span>
          </div>
          <textarea value={patientForm.notes} onChange={e => set('notes', e.target.value)} rows={3} className="w-full border border-amber-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-300/30 outline-none bg-amber-50" placeholder="Codes porte, habitudes du patient..." />
        </div>
      ) : patientForm.notes ? (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={13} className="text-amber-600" />
            <span className="text-[11px] font-semibold text-amber-600 uppercase">Notes internes</span>
          </div>
          <p className="text-sm text-amber-800 italic whitespace-pre-wrap">{patientForm.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

// Drawer-specific couverture sante view — Carte Vitale + Mutuelle cards
function DrawerCouvertureView({ patientForm, setPatientForm, isEditing = false }) {
  const set = (field, value) => setPatientForm(prev => ({ ...prev, [field]: value }));

  const hasVitale = !!(patientForm.ssn || patientForm.amo_code);
  const hasMutuelle = !!(patientForm.amc_name || patientForm.amc_code || patientForm.amc_contract);

  const ci = "w-full bg-white/20 border border-white/30 rounded px-2 py-1 text-sm placeholder-white/50 outline-none focus:border-white/60 focus:bg-white/25 transition-colors";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* Carte Vitale */}
        <div className={`relative overflow-hidden rounded-xl text-white shadow-lg ${hasVitale || isEditing ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-slate-300 to-slate-400'}`} style={isEditing ? undefined : { aspectRatio: '1.586' }}>
          <div className={`${isEditing ? '' : 'absolute inset-0'} p-3 flex flex-col`}>
            <div className="flex justify-between items-start">
              <FileText size={20} className="opacity-80" />
              <span className="text-[8px] font-bold tracking-widest uppercase opacity-80">Carte Vitale</span>
            </div>
            {isEditing ? (
              <div className="flex-1 flex flex-col justify-center gap-1.5 mt-1">
                <div>
                  <p className="text-[8px] opacity-70">N. Securite Sociale</p>
                  <input type="text" value={patientForm.ssn || ''} onChange={e => set('ssn', e.target.value)} placeholder="1 80 12 75 000 00" maxLength={15} style={{ fontFamily: 'monospace', letterSpacing: '0.1em', fontSize: '10px' }} className={ci} />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[7px] opacity-70">Organisme</p>
                    <input type="text" value={patientForm.amo_code || ''} onChange={e => set('amo_code', e.target.value)} placeholder="750100001" maxLength={9} style={{ fontFamily: 'monospace', fontSize: '9px' }} className={ci} />
                  </div>
                  <div>
                    <p className="text-[7px] opacity-70">Centre</p>
                    <input type="text" value={patientForm.amo_center || ''} onChange={e => set('amo_center', e.target.value)} placeholder="CPAM" style={{ fontSize: '9px' }} className={ci} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[7px] opacity-70">Exoneration</p>
                    <select value={patientForm.exoneration_type || ''} onChange={e => set('exoneration_type', e.target.value)} style={{ fontSize: '9px' }} className={ci}>
                      <option value="" className="text-slate-800">Aucune</option>
                      <option value="ALD" className="text-slate-800">ALD</option>
                      <option value="MAT" className="text-slate-800">MAT</option>
                      <option value="AT" className="text-slate-800">AT</option>
                      <option value="100" className="text-slate-800">100%</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-[7px] opacity-70">Rang</p>
                    <input type="number" value={patientForm.birth_rank || ''} onChange={e => set('birth_rank', e.target.value ? parseInt(e.target.value) : null)} placeholder="1" min={1} max={9} style={{ fontSize: '9px' }} className={ci} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between mt-2">
                <div>
                  <p className="text-[8px] opacity-70">N. Securite Sociale</p>
                  <p className="text-xs font-mono tracking-wider font-bold">
                    {patientForm.ssn ? patientForm.ssn.replace(/(\d)(?=(\d{2})+(?!\d))/g, '$1 ') : '- - -'}
                  </p>
                </div>
                {patientForm.exoneration_type && (
                  <div className="mt-1">
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wide bg-white/25 border border-white/40 rounded px-1.5 py-0.5">
                      Exoneration : {patientForm.exoneration_type === '100' ? '100%' : patientForm.exoneration_type}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-medium uppercase truncate">{patientForm.lastName || ''} {patientForm.firstName || ''}</p>
                    {patientForm.birth_rank && <p className="text-[8px] opacity-70">Rang {patientForm.birth_rank}</p>}
                  </div>
                  <div className="text-right">
                    {patientForm.amo_center && <p className="text-[8px] opacity-70">{patientForm.amo_center}</p>}
                    {patientForm.amo_code && <p className="text-[9px] font-mono font-semibold">{patientForm.amo_code}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
        </div>

        {/* Carte Mutuelle */}
        <div className={`relative overflow-hidden rounded-xl text-white shadow-lg ${hasMutuelle || isEditing ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-slate-300 to-slate-400'}`} style={isEditing ? undefined : { aspectRatio: '1.586' }}>
          <div className={`${isEditing ? '' : 'absolute inset-0'} p-3 flex flex-col`}>
            <div className="flex justify-between items-start">
              <ShieldCheck size={20} className="opacity-80" />
              <span className="text-[8px] font-bold tracking-widest uppercase opacity-80">Mutuelle</span>
            </div>
            {isEditing ? (
              <div className="flex-1 flex flex-col justify-center gap-1.5 mt-1">
                <div>
                  <p className="text-[8px] opacity-70">Nom de la mutuelle</p>
                  <input type="text" value={patientForm.amc_name || ''} onChange={e => set('amc_name', e.target.value)} placeholder="MGEN, Harmonie..." style={{ fontSize: '10px' }} className={ci} />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <p className="text-[7px] opacity-70">Code AMC</p>
                    <input type="text" value={patientForm.amc_code || ''} onChange={e => set('amc_code', e.target.value)} placeholder="Code" maxLength={10} style={{ fontFamily: 'monospace', fontSize: '9px' }} className={ci} />
                  </div>
                  <div>
                    <p className="text-[7px] opacity-70">N. contrat</p>
                    <input type="text" value={patientForm.amc_contract || ''} onChange={e => set('amc_contract', e.target.value)} placeholder="Contrat" style={{ fontFamily: 'monospace', fontSize: '9px' }} className={ci} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-between mt-2">
                <div>
                  <p className="text-[8px] opacity-70">{hasMutuelle ? 'Organisme' : ''}</p>
                  <p className="text-sm font-bold">{hasMutuelle ? (patientForm.amc_name || 'Mutuelle') : 'Non renseignee'}</p>
                </div>
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-medium uppercase truncate">{patientForm.lastName || ''} {patientForm.firstName || ''}</p>
                  <div className="text-right">
                    {patientForm.amc_contract && <p className="text-[8px] opacity-70">Contrat</p>}
                    {patientForm.amc_contract && <p className="text-[9px] font-mono font-semibold">{patientForm.amc_contract}</p>}
                    {patientForm.amc_code && <p className="text-[8px] font-mono opacity-70 mt-0.5">{patientForm.amc_code}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-white/10 rounded-full blur-2xl" />
        </div>
      </div>

    </div>
  );
}
