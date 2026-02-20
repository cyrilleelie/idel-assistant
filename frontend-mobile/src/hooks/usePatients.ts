import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listPatients, getPatient, createPatient, updatePatient, deletePatient } from '../api/patients';
import { listAppointments } from '../api/appointments';
import type { PatientCreate } from '../types/models';

export function usePatients(search?: string) {
  return useQuery({
    queryKey: ['patients', search],
    queryFn: () => listPatients({ search, limit: 100 }),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patients', id],
    queryFn: () => getPatient(id),
    enabled: !!id,
  });
}

export function usePatientAppointments(patientId: string) {
  return useQuery({
    queryKey: ['appointments', { patient_id: patientId }],
    queryFn: () => listAppointments({ patient_id: patientId, limit: 5 }),
    enabled: !!patientId,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatientCreate) => createPatient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PatientCreate> }) =>
      updatePatient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
