import { useState } from 'react';
import {
  ArrowLeft, UserMinus, UserPlus, Edit, UserCircle, Activity,
  MapPin, Phone, Mail, Stethoscope, FileText, ClipboardList, ScrollText, MessageSquare
} from 'lucide-react';
import PrescriptionsTab from './PrescriptionsTab';
import PrescriptionList from '../prescriptions/PrescriptionList';
import DoctorAutocomplete from '../common/DoctorAutocomplete';
import AddressAutocomplete from '../common/AddressAutocomplete';
import TransmissionsTab from '../transmissions/TransmissionsTab';

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
  initialEditProtocolId
}) {
  const isInactive = patientForm.active === false;
  const [transmissionPreFilter, setTransmissionPreFilter] = useState(null);

  const navigateToTransmissions = (prescriptionId) => {
    setTransmissionPreFilter(prescriptionId);
    setPatientSubTab('transmissions');
  };

  return (
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
              {!isEditingPatient && selectedPatientId !== 'new' && <span className="text-sm text-slate-500">Dossier patient</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-16 md:ml-0">
          {!isEditingPatient ? (
            <>
              {isInactive ? (
                <button onClick={() => reactivatePatient(selectedPatientId)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <UserPlus size={16}/> Réactiver
                </button>
              ) : (
                <button onClick={() => deactivatePatient(selectedPatientId)} className="text-amber-600 hover:bg-amber-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <UserMinus size={16}/> Désactiver
                </button>
              )}
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
        <button onClick={() => setPatientSubTab('prescriptions')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${patientSubTab === 'prescriptions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <ClipboardList size={16}/> Plans de soins
        </button>
        <button onClick={() => setPatientSubTab('ordonnances')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${patientSubTab === 'ordonnances' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <ScrollText size={16}/> Ordonnances
        </button>
        <button onClick={() => { setTransmissionPreFilter(null); setPatientSubTab('transmissions'); }} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${patientSubTab === 'transmissions' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <MessageSquare size={16}/> Transmissions
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
                {isEditingPatient ? <AddressAutocomplete value={patientForm.address} onChange={address => setPatientForm({...patientForm, address})} placeholder="12 rue de la Paix, 75000 Paris" /> : <div className="text-sm text-slate-700 flex items-start gap-2"><MapPin size={16} className="text-slate-400 shrink-0"/> {patientForm.address || '-'}</div>}
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
                <label className="block text-xs font-medium text-slate-500 mb-1">N° Sécurité Sociale (NIR)</label>
                {isEditingPatient ? <input type="text" value={patientForm.ssn} onChange={e => setPatientForm({...patientForm, ssn: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none tracking-widest" placeholder="1 80 12 75 000 000 00" maxLength={15} /> : <div className="text-sm font-mono tracking-widest text-slate-800">{patientForm.ssn || '-'}</div>}
              </div>

              {/* Section SESAM-Vitale / Assurance */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3">
                <h4 className="font-medium text-sm text-blue-800 flex items-center gap-2">
                  <span className="text-base">🏥</span> Assurance Maladie (SESAM-Vitale)
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Code organisme AMO</label>
                    {isEditingPatient ? (
                      <input type="text" value={patientForm.amo_code || ''} onChange={e => setPatientForm({...patientForm, amo_code: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="750100001" maxLength={9} />
                    ) : <div className="text-sm font-mono text-slate-700">{patientForm.amo_code || '-'}</div>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Centre gestionnaire</label>
                    {isEditingPatient ? (
                      <input type="text" value={patientForm.amo_center || ''} onChange={e => setPatientForm({...patientForm, amo_center: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="CPAM Paris" />
                    ) : <div className="text-sm text-slate-700">{patientForm.amo_center || '-'}</div>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Type d'exonération</label>
                    {isEditingPatient ? (
                      <select value={patientForm.exoneration_type || ''} onChange={e => setPatientForm({...patientForm, exoneration_type: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                        <option value="">Aucune</option>
                        <option value="ALD">ALD (Affection Longue Durée)</option>
                        <option value="MAT">MAT (Maternité)</option>
                        <option value="AT">AT (Accident du Travail)</option>
                        <option value="100">100% (autres cas)</option>
                      </select>
                    ) : <div className="text-sm text-slate-700">{patientForm.exoneration_type || 'Aucune'}</div>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Rang de naissance</label>
                    {isEditingPatient ? (
                      <input type="number" value={patientForm.birth_rank || ''} onChange={e => setPatientForm({...patientForm, birth_rank: e.target.value ? parseInt(e.target.value) : null})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="1" min={1} max={9} />
                    ) : <div className="text-sm text-slate-700">{patientForm.birth_rank || '-'}</div>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-blue-200">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Mutuelle (code AMC)</label>
                    {isEditingPatient ? (
                      <input type="text" value={patientForm.amc_code || ''} onChange={e => setPatientForm({...patientForm, amc_code: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Code AMC" maxLength={10} />
                    ) : <div className="text-sm font-mono text-slate-700">{patientForm.amc_code || '-'}</div>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Nom de la mutuelle</label>
                    {isEditingPatient ? (
                      <input type="text" value={patientForm.amc_name || ''} onChange={e => setPatientForm({...patientForm, amc_name: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="MGEN, Harmonie..." />
                    ) : <div className="text-sm text-slate-700">{patientForm.amc_name || '-'}</div>}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">N° contrat AMC</label>
                    {isEditingPatient ? (
                      <input type="text" value={patientForm.amc_contract || ''} onChange={e => setPatientForm({...patientForm, amc_contract: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Numéro de contrat" />
                    ) : <div className="text-sm font-mono text-slate-700">{patientForm.amc_contract || '-'}</div>}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-3">
                <h4 className="font-medium text-sm text-slate-700 flex items-center gap-2"><Stethoscope size={16} className="text-blue-600"/> Médecin Traitant</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nom du médecin</label>
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

        {/* PRESCRIPTIONS TAB */}
        {patientSubTab === 'prescriptions' && (
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
        )}

        {/* ORDONNANCES TAB */}
        {patientSubTab === 'ordonnances' && patientForm.id && (
          <PrescriptionList
            patientId={patientForm.id}
            patientDoctor={patientForm.doctorName ? { name: patientForm.doctorName, rpps_number: patientForm.doctorRpps || null } : null}
            onViewTransmissions={navigateToTransmissions}
          />
        )}

        {/* TRANSMISSIONS TAB */}
        {patientSubTab === 'transmissions' && patientForm.id && (
          <TransmissionsTab
            patientId={patientForm.id}
            nurses={nurses}
            initialPrescriptionFilter={transmissionPreFilter}
          />
        )}

      </div>
    </div>
  );
}
