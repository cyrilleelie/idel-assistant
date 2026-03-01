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

// --- Export comptable ---

/**
 * Télécharge un fichier depuis l'API et déclenche le téléchargement navigateur.
 * Récupère le nom de fichier depuis Content-Disposition si disponible.
 */
export async function downloadFile(url, params, defaultFilename) {
  const response = await client.get(url, { params, responseType: 'blob' });
  const contentDisposition = response.headers['content-disposition'];
  let filename = defaultFilename;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\s]+)"?/);
    if (match) filename = match[1];
  }
  const blob = new Blob([response.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export async function downloadExportCSV(params = {}) {
  const { date_from, date_to } = params;
  const filename = `factures_${date_from}_${date_to}.csv`;
  await downloadFile('/invoices/export/csv', params, filename);
}

export async function downloadExportFEC(year) {
  await downloadFile('/invoices/export/fec', { year }, `CabinetFEC${year}1231.txt`);
}

export async function downloadExportRecettes(params = {}) {
  const { date_from, date_to } = params;
  const filename = `livre_recettes_${date_from}_${date_to}.csv`;
  await downloadFile('/invoices/export/recettes', params, filename);
}

export async function getQuarterlySummary(year, quarter) {
  const { data } = await client.get('/invoices/quarterly-summary', { params: { year, quarter } });
  return data;
}

export async function downloadQuarterlyPDF(year, quarter) {
  await downloadFile(
    '/invoices/export/quarterly-pdf',
    { year, quarter },
    `recap_trimestriel_${year}-T${quarter}.pdf`,
  );
}
