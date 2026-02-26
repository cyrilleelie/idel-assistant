import client from './client';

export async function listInvoices(params = {}) {
  const { data } = await client.get('/invoices/', { params });
  return data;
}

export async function getInvoice(id) {
  const { data } = await client.get(`/invoices/${id}`);
  return data;
}

export async function validateInvoice(id) {
  const { data } = await client.post(`/invoices/${id}/validate`);
  return data;
}

export async function cancelInvoice(id) {
  const { data } = await client.post(`/invoices/${id}/cancel`);
  return data;
}
