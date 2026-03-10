import client from './client';

export async function simulateCotation(payload) {
  const { data } = await client.post('/cotation/simulate', payload);
  return data;
}

export async function createInvoiceFromAppointment(appointmentId, zoneIk = 'plaine') {
  const { data } = await client.post('/cotation/create-from-appointment', {
    appointment_id: appointmentId,
    zone_ik: zoneIk,
  });
  return data;
}

export async function getDailyBilling(date) {
  const { data } = await client.get('/cotation/daily-billing', { params: { date } });
  return data;
}

export async function createAllDailyInvoices(date, zoneIk = 'plaine') {
  const { data } = await client.post('/cotation/create-all-daily', { date, zone_ik: zoneIk });
  return data;
}

export async function suggestNgapCodes(careType) {
  const { data } = await client.get('/care-catalog/suggest-codes', { params: { care_type: careType } });
  return data;
}

const EXCLUDED_CATEGORIES = ['majoration', 'indemnite_km', 'indemnite_deplacement'];

export async function listCareActCodes() {
  const { data } = await client.get('/care-catalog/');
  const items = (data.items || []).filter(i => !EXCLUDED_CATEGORIES.includes(i.category));
  return items;
}
