import PatientList from './PatientList';
import PatientDetail from './PatientDetail';

export default function PatientsTab({
  patients, patientSearch, setPatientSearch,
  selectedPatientId, patientForm, setPatientForm,
  isEditingPatient, setIsEditingPatient,
  patientSubTab, setPatientSubTab,
  openNewPatient, openPatientDetail, closePatientDetail,
  handleSavePatient, deactivatePatient, reactivatePatient,
  appointments, nurses
}) {
  return (
    <div className="max-w-screen-xl mx-auto">
      {!selectedPatientId && (
        <PatientList
          patients={patients}
          patientSearch={patientSearch}
          setPatientSearch={setPatientSearch}
          openNewPatient={openNewPatient}
          openPatientDetail={openPatientDetail}
        />
      )}

      {selectedPatientId && (
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
        />
      )}
    </div>
  );
}
