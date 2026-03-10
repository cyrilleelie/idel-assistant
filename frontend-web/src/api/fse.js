import client from './client';
import { downloadFile, openPdfBlob } from '../utils/fileDownload';

// --- Generation FSE ---

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

// --- Export (telechargement) ---

/**
 * Telecharge un export FSE (CSV, XML ou JSON) et declenche le download navigateur.
 */
export async function downloadFseLot({ fmt = 'csv', lotNumber = null, status = 'generated' } = {}) {
  const params = { fmt, status };
  if (lotNumber) params.lot_number = lotNumber;
  await downloadFile('/fse/export', params, `fse_lot.${fmt}`);
}

// --- PDF ---

export async function downloadFsePdf(fseId) {
  const response = await client.get(`/fse/${fseId}/pdf`, { responseType: 'blob' });
  openPdfBlob(response.data);
}

export async function downloadLotPdf(lotNumber) {
  await downloadFile(
    '/fse/batch-pdf',
    { lot_number: lotNumber },
    `fse_lot_${lotNumber}.pdf`,
  );
}

// --- Marquer transmises ---

export async function markFseTransmitted(fseIds) {
  const { data } = await client.post('/fse/mark-transmitted', { fse_ids: fseIds });
  return data;
}
