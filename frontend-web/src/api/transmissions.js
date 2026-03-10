import client from './client';

/**
 * List transmissions with optional filters.
 */
export async function listTransmissions({
  patient_id,
  prescription_id,
  author_user_id,
  status,
  date_from,
  date_to,
  search,
  skip = 0,
  limit = 20,
} = {}) {
  const params = { skip, limit };
  if (patient_id) params.patient_id = patient_id;
  if (prescription_id) params.prescription_id = prescription_id;
  if (author_user_id) params.author_user_id = author_user_id;
  if (status) params.status = status;
  if (date_from) params.date_from = date_from;
  if (date_to) params.date_to = date_to;
  if (search) params.search = search;
  const { data } = await client.get('/transmissions/', { params });
  return data;
}

/**
 * Get a single transmission by ID.
 */
export async function getTransmission(id) {
  const { data } = await client.get(`/transmissions/${id}`);
  return data;
}

/**
 * Update a transmission (transcription text, structured_data, status).
 */
export async function updateTransmission(id, payload) {
  const { data } = await client.put(`/transmissions/${id}`, payload);
  return data;
}

/**
 * Validate a transmission (irreversible).
 */
export async function validateTransmission(id) {
  const { data } = await client.post(`/transmissions/${id}/validate`);
  return data;
}

/**
 * Regenerate IA synthesis for a transmission.
 */
export async function regenerateSynthesis(id) {
  const { data } = await client.post(`/transmissions/${id}/synthesize`);
  return data;
}

/**
 * Update manual prescription links for a transmission.
 */
export async function updateTransmissionPrescriptions(id, prescriptionIds) {
  const { data } = await client.put(`/transmissions/${id}/prescriptions`, {
    prescription_ids: prescriptionIds,
  });
  return data;
}

/**
 * Get transmissions linked to a specific prescription.
 */
export async function getTransmissionsForPrescription(prescriptionId, { limit = 5, skip = 0 } = {}) {
  const { data } = await client.get(`/prescriptions/${prescriptionId}/transmissions`, {
    params: { limit, skip },
  });
  return data;
}
