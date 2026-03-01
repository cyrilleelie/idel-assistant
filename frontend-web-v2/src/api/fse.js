import client from './client';

// --- Génération FSE ---

export async function generateFse(invoiceIds, lotNumber = null) {
  const { data } = await client.post('/fse/generate', {
    invoice_ids: invoiceIds,
    lot_number: lotNumber,
  });
  return data;
}

// --- Liste ---

export async function listFse(params = {}) {
  const { data } = await client.get('/fse', { params });
  return data;
}

// --- Export (téléchargement) ---

/**
 * Télécharge un export FSE (CSV, XML ou JSON) et déclenche le download navigateur.
 */
export async function downloadFseLot({ fmt = 'csv', lotNumber = null, status = 'generated' } = {}) {
  const params = { fmt, status };
  if (lotNumber) params.lot_number = lotNumber;

  const response = await client.get('/fse/export', { params, responseType: 'blob' });
  const contentDisposition = response.headers['content-disposition'];
  let filename = `fse_lot.${fmt}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\\s]+)"?/);
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

// --- PDF ---

export async function downloadFsePdf(fseId) {
  const response = await client.get(`/fse/${fseId}/pdf`, { responseType: 'blob' });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function downloadLotPdf(lotNumber) {
  const response = await client.get('/fse/batch-pdf', {
    params: { lot_number: lotNumber },
    responseType: 'blob',
  });
  const blob = new Blob([response.data], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `fse_lot_${lotNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// --- Marquer transmises ---

export async function markFseTransmitted(fseIds) {
  const { data } = await client.post('/fse/mark-transmitted', { fse_ids: fseIds });
  return data;
}
