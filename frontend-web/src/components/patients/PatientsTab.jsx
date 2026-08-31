import { useEffect, useCallback } from 'react';
import PatientList from './PatientList';
import PatientDetail from './PatientDetail';
import { X } from 'lucide-react';

export default function PatientsTab({
  patients, patientSearch, setPatientSearch,
  selectedPatientId, patientForm, setPatientForm,
  isEditingPatient, setIsEditingPatient,
  patientSubTab, setPatientSubTab,
  openNewPatient, openPatientDetail, closePatientDetail,
  handleSavePatient, deactivatePatient, reactivatePatient,
  appointments, nurses,
  schedule, configs, getActiveConfigForDate,
  onCreateAppointment, onCancelAppointment,
  onSavePrescription, onDeletePrescription, prescriptionsLoading,
  careLabels, careDurations, careLabelCodeMap,
  cabinetData,
  initialEditProtocolId
}) {
  const isDrawerOpen = !!selectedPatientId;

  // Close drawer on Escape
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape' && isDrawerOpen) {
      closePatientDetail();
    }
  }, [isDrawerOpen, closePatientDetail]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative">
      {/* Patient list (always visible, capped width so drawer doesn't overlap) */}
      <div className="max-w-5xl">
        <PatientList
          patients={patients}
          patientSearch={patientSearch}
          setPatientSearch={setPatientSearch}
          openNewPatient={openNewPatient}
          openPatientDetail={openPatientDetail}
          selectedPatientId={selectedPatientId}
          deactivatePatient={deactivatePatient}
          reactivatePatient={reactivatePatient}
          setPatientSubTab={setPatientSubTab}
        />
      </div>

      {/* Backdrop overlay on small screens */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 top-16 bg-black/20 z-30 lg:hidden"
          onClick={closePatientDetail}
        />
      )}

      {/* Right: Detail drawer (below header) */}
      <div
        className={`
          fixed top-16 right-0 h-[calc(100vh-4rem)] z-40
          w-full sm:w-[540px] lg:w-[540px]
          bg-white border-l border-slate-200 shadow-2xl
          flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {isDrawerOpen && (
          <>
            {/* Drawer header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                    {patientForm.firstName?.charAt(0) || '?'}{patientForm.lastName?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-slate-900 uppercase truncate">
                      {patientForm.lastName || 'Nouveau'}{' '}
                      <span className="capitalize font-medium">{patientForm.firstName || 'Patient'}</span>
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                      {patientForm._apiBirthDate && (
                        <span className="text-sm text-slate-500">
                          {formatBirthDate(patientForm._apiBirthDate)}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                        patientForm.active === false
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {patientForm.active === false ? 'Inactif' : 'Actif'}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closePatientDetail}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer content: PatientDetail handles sub-tabs and content */}
            <PatientDetail
              selectedPatientId={selectedPatientId}
              patientForm={patientForm}
              setPatientForm={setPatientForm}
              isEditingPatient={isEditingPatient}
              setIsEditingPatient={setIsEditingPatient}
              patientSubTab={patientSubTab}
              setPatientSubTab={setPatientSubTab}
              closePatientDetail={closePatientDetail}
              handleSavePatient={handleSavePatient}
              deactivatePatient={deactivatePatient}
              reactivatePatient={reactivatePatient}
              appointments={appointments}
              nurses={nurses}
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
              isDrawerMode={true}
            />
          </>
        )}
      </div>
    </div>
  );
}

function formatBirthDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const age = now.getFullYear() - d.getFullYear() - (
      now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate()) ? 1 : 0
    );
    return `${d.toLocaleDateString('fr-FR')} (${age} ans)`;
  } catch {
    return dateStr;
  }
}
