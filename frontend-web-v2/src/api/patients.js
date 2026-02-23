import client from './client';

export async function listPatients({ search, status, skip = 0, limit = 50 } = {}) {
  const params = { skip, limit };
  if (search) params.search = search;
  if (status) params.status = status;
  const { data } = await client.get('/patients/', { params });
  return data; // { items: [...], total: number }
}

export async function getPatient(id) {
  const { data } = await client.get(`/patients/${id}`);
  return data; // PatientResponse
}

export async function createPatient(payload) {
  const { data } = await client.post('/patients/', payload);
  return data; // PatientResponse
}

export async function updatePatient(id, payload) {
  const { data } = await client.patch(`/patients/${id}`, payload);
  return data; // PatientResponse
}

export async function archivePatient(id, reason) {
  await client.delete(`/patients/${id}`, { params: { reason } });
}
