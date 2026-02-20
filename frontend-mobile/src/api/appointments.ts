import apiClient from './client';
import type { Appointment, AppointmentCreate, PaginatedResponse } from '../types/models';

export async function listAppointments(params?: {
  patient_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  skip?: number;
  limit?: number;
}): Promise<PaginatedResponse<Appointment>> {
  const { data } = await apiClient.get<PaginatedResponse<Appointment>>('/appointments', { params });
  return data;
}

export async function getAppointment(id: string): Promise<Appointment> {
  const { data } = await apiClient.get<Appointment>(`/appointments/${id}`);
  return data;
}

export async function createAppointment(payload: AppointmentCreate): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>('/appointments', payload);
  return data;
}

export async function cancelAppointment(
  id: string,
  reason?: string
): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(`/appointments/${id}/cancel`, {
    cancellation_reason: reason || '',
  });
  return data;
}

export async function completeAppointment(id: string): Promise<Appointment> {
  const { data } = await apiClient.post<Appointment>(`/appointments/${id}/complete`);
  return data;
}
