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

// --- Stats ---

export async function getMonthlyStats(period) {
  const { data } = await client.get('/invoices/stats/monthly', { params: { period } });
  return data;
}

export async function comparePeriods(period1, period2) {
  const { data } = await client.get('/invoices/stats/compare', { params: { period1, period2 } });
  return data;
}

export async function getStatsPerIdel(period) {
  const { data } = await client.get('/invoices/stats/per-idel', { params: { period } });
  return data;
}

// --- Paiements ---

export async function markInvoicesPaid(payload) {
  // payload: { invoice_ids, payment_date, payment_reference?, payment_amount? }
  const { data } = await client.post('/invoices/mark-paid', payload);
  return data;
}

export async function listUnpaidInvoices(params = {}) {
  const { data } = await client.get('/invoices/unpaid', { params });
  return data;
}

// --- Rejets ---

export async function rejectInvoice(id, payload) {
  // payload: { rejection_reason, rejection_code? }
  const { data } = await client.post(`/invoices/${id}/reject`, payload);
  return data;
}

export async function correctAndResubmit(id, payload) {
  // payload: { lines: [...], prescription_id? }
  const { data } = await client.post(`/invoices/${id}/correct-and-resubmit`, payload);
  return data;
}

export async function listRejectedInvoices(params = {}) {
  const { data } = await client.get('/invoices/rejected', { params });
  return data;
}
