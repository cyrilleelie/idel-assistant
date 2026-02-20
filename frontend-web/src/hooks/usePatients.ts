import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
} from "@/api/patients";
import { listAppointments } from "@/api/appointments";
import { listCareProtocols } from "@/api/care-protocols";
import type { PatientCreate, PatientUpdate } from "@/types/models";

export function usePatients(params?: {
  search?: string;
  sector_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["patients", params],
    queryFn: () => listPatients(params),
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: () => getPatient(id),
    enabled: !!id,
  });
}

export function usePatientAppointments(patientId: string) {
  return useQuery({
    queryKey: ["appointments", { patient_id: patientId }],
    queryFn: () => listAppointments({ patient_id: patientId, limit: 20 }),
    enabled: !!patientId,
  });
}

export function usePatientProtocols(patientId: string) {
  return useQuery({
    queryKey: ["care-protocols", { patient_id: patientId }],
    queryFn: () => listCareProtocols({ patient_id: patientId }),
    enabled: !!patientId,
  });
}

export function useCreatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatientCreate) => createPatient(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useUpdatePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: PatientUpdate;
    }) => updatePatient(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}

export function useDeletePatient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
  });
}
