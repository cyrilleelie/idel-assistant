import client from './client';

export async function fetchCabinet() {
  const { data } = await client.get('/cabinet/');
  return data;
}

export async function updateCabinet(payload) {
  const { data } = await client.patch('/cabinet/', payload);
  return data;
}
