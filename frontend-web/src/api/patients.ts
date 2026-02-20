import apiClient from "./client";
import type { Patient, PatientCreate, PatientUpdate, PaginatedResponse } from "@/types/models";

export async function listPatients(params?: {
  search?: string;
  sector_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<Patient>> {
  const { data } = await apiClient.get<PaginatedResponse<Patient>>(
    "/patients/",
    { params }
  );
  return data;
}

export async function getPatient(id: string): Promise<Patient> {
  const { data } = await apiClient.get<Patient>(`/patients/${id}`);
  return data;
}

export async function createPatient(payload: PatientCreate): Promise<Patient> {
  const { data } = await apiClient.post<Patient>("/patients/", payload);
  return data;
}

export async function updatePatient(
  id: string,
  payload: PatientUpdate
): Promise<Patient> {
  const { data } = await apiClient.patch<Patient>(`/patients/${id}`, payload);
  return data;
}

export async function deletePatient(id: string): Promise<void> {
  await apiClient.delete(`/patients/${id}`);
}
