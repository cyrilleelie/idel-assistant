import client from './client';

export async function listCareProtocols({ patient_id, status, skip = 0, limit = 50 } = {}) {
  const params = { skip, limit };
  if (patient_id) params.patient_id = patient_id;
  if (status) params.status = status;
  const { data } = await client.get('/care-protocols/', { params });
  return data; // { items: [...], total: number }
}

export async function createCareProtocol(payload) {
  const { data } = await client.post('/care-protocols/', payload);
  return data; // CareProtocolResponse
}

export async function updateCareProtocol(id, payload) {
  const { data } = await client.patch(`/care-protocols/${id}`, payload);
  return data; // CareProtocolResponse
}

export async function deleteCareProtocol(id) {
  await client.delete(`/care-protocols/${id}`);
}
