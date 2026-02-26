import client from './client';

export async function listCareLabels() {
  const { data } = await client.get('/care-labels/');
  return data;
}

export async function createCareLabel(body) {
  const { data } = await client.post('/care-labels/', body);
  return data;
}

export async function updateCareLabel(id, body) {
  const { data } = await client.put(`/care-labels/${id}`, body);
  return data;
}

export async function deleteCareLabel(id) {
  await client.delete(`/care-labels/${id}`);
}
