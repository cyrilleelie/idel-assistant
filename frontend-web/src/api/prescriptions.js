import client from './client';

export async function listPrescriptions({ patient_id, care_protocol_id, status, offset = 0, limit = 50 } = {}) {
  const params = { offset, limit };
  if (patient_id) params.patient_id = patient_id;
  if (care_protocol_id) params.care_protocol_id = care_protocol_id;
  if (status) params.status = status;
  const { data } = await client.get('/prescriptions/', { params });
  return data; // { items: [...], total }
}

export async function getPrescription(id) {
  const { data } = await client.get(`/prescriptions/${id}`);
  return data;
}

export async function createPrescription(payload) {
  const { data } = await client.post('/prescriptions/', payload);
  return data;
}

export async function updatePrescription(id, payload) {
  const { data } = await client.put(`/prescriptions/${id}`, payload);
  return data;
}

export async function deletePrescription(id) {
  await client.put(`/prescriptions/${id}`, { status: 'canceled' });
}

/**
 * Upload un document (scan/photo) pour une ordonnance.
 * @param {string} id - UUID de l'ordonnance
 * @param {File} file - Fichier à uploader
 */
export async function uploadPrescriptionDocument(id, file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await client.post(`/prescriptions/${id}/document`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getPrescriptionInvoices(id) {
  const { data } = await client.get(`/prescriptions/${id}/invoices`);
  return data;
}

export async function renewPrescription(id, payload = {}) {
  const { data } = await client.post(`/prescriptions/${id}/renew`, payload);
  return data;
}

export async function getExpiringPrescriptions(days_ahead = 7) {
  const { data } = await client.get('/prescriptions/expiring', { params: { days_ahead } });
  return data;
}

export async function linkPrescriptionToInvoice(invoiceId, prescriptionId) {
  const { data } = await client.post(`/prescriptions/${invoiceId}/link-prescription`, {
    prescription_id: prescriptionId,
  });
  return data;
}
