import client from './client';

export async function listAppointments({ date, idel_id, patient_id, status, skip = 0, limit = 50 } = {}) {
  const params = { skip, limit };
  if (date) params.date = date;
  if (idel_id) params.idel_id = idel_id;
  if (patient_id) params.patient_id = patient_id;
  if (status) params.status = status;
  const { data } = await client.get('/appointments/', { params });
  return data; // { items: [...], total: number }
}

export async function createAppointment(payload) {
  const { data } = await client.post('/appointments/', payload);
  return data; // AppointmentResponse
}

export async function cancelAppointment(id, reason) {
  const { data } = await client.post(`/appointments/${id}/cancel`, { reason });
  return data; // AppointmentResponse
}

export async function updateAppointment(id, payload) {
  const { data } = await client.patch(`/appointments/${id}`, payload);
  return data; // AppointmentResponse
}

export async function completeAppointment(id) {
  const { data } = await client.post(`/appointments/${id}/complete`);
  return data; // AppointmentResponse
}
