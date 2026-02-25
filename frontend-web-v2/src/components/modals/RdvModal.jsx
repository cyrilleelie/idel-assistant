import { X, AlertCircle, FileText, Loader2, User, Home, Building2, MapPin, CircleDot, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Planifié', icon: CircleDot, className: 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm' },
  { value: 'completed', label: 'Réalisé', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-sm' },
  { value: 'canceled', label: 'Annulé', icon: XCircle, className: 'bg-red-50 text-red-600 border-red-300 shadow-sm' },
];

export default function RdvModal({
  rdvModalParams, setRdvModalParams,
  rdvForm, setRdvForm,
  rdvError,
  patients,
  nurses,
  handleSaveRdv,
  handleUpdateRdv,
  rdvPrescriptions,
  rdvPrescriptionsLoading,
  onPatientChange,
  patientsWithActivePlans,
}) {
  if (!rdvModalParams) return null;

  const isEditMode = !!rdvModalParams.editAppt;
  const editAppt = rdvModalParams.editAppt;
  const onSubmit = isEditMode ? handleUpdateRdv : handleSaveRdv;

  // Resolve nurse name
  const nurse = nurses.find(n => n.userId === rdvModalParams.nurseId);
  const nurseName = nurse ? `${nurse.firstName} ${nurse.lastName}` : '';

  // Resolve selected patient (for address display)
  const selectedPatientId = isEditMode ? editAppt.patientId : rdvForm.patientId;
  const selectedPatient = selectedPatientId ? patients.find(p => p.id === selectedPatientId) : null;

  const handlePatientSelect = (e) => {
    const patientId = e.target.value;
    setRdvForm({ ...rdvForm, patientId, careProtocolId: '' });
    onPatientChange(patientId);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden transform transition-all">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-semibold text-lg text-slate-800">{isEditMode ? 'Modifier le Rendez-vous' : 'Nouveau Rendez-vous'}</h3>
          <button onClick={() => setRdvModalParams(null)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={20}/></button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5">
          {rdvError && <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-medium flex gap-2"><AlertCircle size={18} className="shrink-0" /><p>{rdvError}</p></div>}

          {/* Soignant (read-only) */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2">
            <User size={16} className="text-blue-500 shrink-0" />
            <span className="text-sm text-blue-700 font-medium">{nurseName}</span>
          </div>

          {/* Statut (edit mode only) */}
          {isEditMode && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Statut</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const isActive = rdvForm.status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRdvForm({ ...rdvForm, status: opt.value })}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                        isActive ? opt.className : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={16} /> {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Patient */}
          {isEditMode ? (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-sm text-slate-500">Patient :</span>{' '}
              <strong className="text-sm text-slate-800">{editAppt.patient}</strong>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Patient</label>
              {patientsWithActivePlans === null ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Chargement des patients...
                </div>
              ) : (
                <select value={rdvForm.patientId} onChange={handlePatientSelect} className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                  <option value="" disabled>-- Choisir un patient --</option>
                  {patients
                    .filter(p => patientsWithActivePlans.has(p.id))
                    .map(p => (
                      <option key={p.id} value={p.id}>{p.lastName} {p.firstName}</option>
                    ))}
                </select>
              )}
              {patientsWithActivePlans instanceof Set && patientsWithActivePlans.size === 0 && (
                <p className="text-xs text-amber-600 mt-1">Aucun patient n'a de plan de soins en cours. Créez d'abord un plan de soins depuis la fiche patient.</p>
              )}
            </div>
          )}

          {/* Lieu */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Lieu</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRdvForm({ ...rdvForm, locationType: 'home' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  rdvForm.locationType === 'home'
                    ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Home size={16} /> A domicile
              </button>
              <button
                type="button"
                onClick={() => setRdvForm({ ...rdvForm, locationType: 'office' })}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  rdvForm.locationType === 'office'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Building2 size={16} /> Au cabinet
              </button>
            </div>

            {/* Patient address when "A domicile" */}
            {rdvForm.locationType === 'home' && selectedPatient && (
              <div className="mt-2 p-2.5 bg-amber-50/50 rounded-lg border border-amber-100 flex items-start gap-2">
                <MapPin size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <span className="text-sm text-amber-800">
                  {selectedPatient.address || <span className="italic text-amber-400">Adresse non renseignée</span>}
                </span>
              </div>
            )}
          </div>

          {/* Plan de soins (requis) */}
          {(isEditMode || rdvForm.patientId) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText size={14} className="text-slate-400" /> Plan de soins <span className="text-red-400">*</span>
              </label>
              {rdvPrescriptionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Chargement...
                </div>
              ) : (() => {
                const rdvDate = rdvModalParams.dateStr;
                const activePlans = rdvPrescriptions.filter(rx => {
                  const startDates = rx.soins?.map(s => s.startDate).filter(Boolean).sort() || [];
                  const endDates = rx.soins?.map(s => s.endDate).filter(Boolean).sort() || [];
                  const minStart = startDates[0];
                  const maxEnd = endDates[endDates.length - 1];
                  if (minStart && minStart > rdvDate) return false;
                  if (maxEnd && maxEnd < rdvDate) return false;
                  return true;
                });
                if (activePlans.length === 0) {
                  return <p className="text-sm text-amber-600 italic py-1">Aucun plan de soins en cours pour ce patient.</p>;
                }
                return (
                  <select
                    value={rdvForm.careProtocolId}
                    onChange={e => setRdvForm({ ...rdvForm, careProtocolId: e.target.value })}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none bg-white ${
                      !rdvForm.careProtocolId ? 'border-red-300' : 'border-slate-300'
                    }`}
                  >
                    <option value="" disabled>-- Choisir un plan de soins --</option>
                    {activePlans.map(rx => {
                      const soinsLabel = rx.soins?.length > 0
                        ? rx.soins.map(s => s.label).filter(Boolean).join(', ')
                        : (rx.label || 'Plan de soins');
                      const minStart = rx.soins?.length > 0
                        ? rx.soins.map(s => s.startDate).filter(Boolean).sort()[0]
                        : rx.startDate;
                      const maxEnd = rx.soins?.length > 0
                        ? rx.soins.map(s => s.endDate).filter(Boolean).sort().pop()
                        : rx.endDate;
                      return (
                        <option key={rx._apiId} value={rx._apiId}>
                          {soinsLabel}{minStart ? ` (${minStart}` : ''}{maxEnd ? ` → ${maxEnd})` : minStart ? ')' : ''}
                        </option>
                      );
                    })}
                  </select>
                );
              })()}
            </div>
          )}

          {/* Horaires */}
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

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onClick={() => setRdvModalParams(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Annuler</button>
            <button
              type="submit"
              disabled={!isEditMode && !rdvForm.careProtocolId}
              className={`px-5 py-2 rounded-lg font-medium ${
                !isEditMode && !rdvForm.careProtocolId
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isEditMode ? 'Modifier' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
