/**
 * Patient mapper: backend (snake_case) <-> frontend (camelCase)
 *
 * Backend fields without a frontend equivalent (birth_date, sector_id, postal_code, city,
 * preferred_time_slot, care_duration_default, lat, lon) are preserved via _api* for round-trip.
 */

export function patientApiToFrontend(p) {
  return {
    id: p.id,
    firstName: p.first_name || '',
    lastName: p.last_name || '',
    phone: p.phone || '',
    email: p.email || '',
    address: p.address || '',
    ssn: p.ssn || '',
    doctorName: p.doctor_name || '',
    doctorRpps: p.doctor_rpps || '',
    doctorContact: p.doctor_contact || '',
    antecedents: (p.pathologies || []).join('\n'),
    notes: p.notes || '',
    active: p.status === 'active',
    prescriptions: [], // loaded separately via care-protocols API
    // SESAM-Vitale / Assurance
    amo_code: p.amo_code || '',
    amo_center: p.amo_center || '',
    amc_code: p.amc_code || '',
    amc_name: p.amc_name || '',
    amc_contract: p.amc_contract || '',
    exoneration_type: p.exoneration_type || '',
    birth_rank: p.birth_rank ?? null,
    // Preserve backend-only fields for round-trip
    _apiBirthDate: p.birth_date ?? null,
    _apiSectorId: p.sector_id ?? null,
    _apiPostalCode: p.postal_code || '',
    _apiCity: p.city || '',
    _apiPreferredTimeSlot: p.preferred_time_slot || '',
    _apiCareDurationDefault: p.care_duration_default ?? 30,
    _apiLat: p.lat ?? null,
    _apiLon: p.lon ?? null,
  };
}

export function patientFrontendToApiCreate(form) {
  return {
    first_name: form.firstName?.trim() || '',
    last_name: form.lastName?.trim() || '',
    phone: form.phone || '',
    email: form.email || '',
    address: form.address || '',
    ssn: form.ssn || '',
    doctor_name: form.doctorName || '',
    doctor_rpps: form.doctorRpps || '',
    doctor_contact: form.doctorContact || '',
    pathologies: form.antecedents ? form.antecedents.split('\n').filter(Boolean) : [],
    notes: form.notes || '',
    // SESAM-Vitale
    amo_code: form.amo_code || '',
    amo_center: form.amo_center || '',
    amc_code: form.amc_code || '',
    amc_name: form.amc_name || '',
    amc_contract: form.amc_contract || '',
    exoneration_type: form.exoneration_type || '',
    birth_rank: form.birth_rank ?? null,
  };
}

export function patientFrontendToApiUpdate(form) {
  const payload = {
    first_name: form.firstName?.trim() || '',
    last_name: form.lastName?.trim() || '',
    phone: form.phone || '',
    email: form.email || '',
    address: form.address || '',
    ssn: form.ssn || '',
    doctor_name: form.doctorName || '',
    doctor_rpps: form.doctorRpps || '',
    doctor_contact: form.doctorContact || '',
    pathologies: form.antecedents ? form.antecedents.split('\n').filter(Boolean) : [],
    notes: form.notes || '',
    // SESAM-Vitale
    amo_code: form.amo_code || '',
    amo_center: form.amo_center || '',
    amc_code: form.amc_code || '',
    amc_name: form.amc_name || '',
    amc_contract: form.amc_contract || '',
    exoneration_type: form.exoneration_type || '',
    birth_rank: form.birth_rank ?? null,
  };
  // Preserve backend-only fields if present
  if (form._apiBirthDate !== undefined) payload.birth_date = form._apiBirthDate;
  if (form._apiSectorId !== undefined) payload.sector_id = form._apiSectorId;
  if (form._apiPostalCode !== undefined) payload.postal_code = form._apiPostalCode;
  if (form._apiCity !== undefined) payload.city = form._apiCity;
  if (form._apiPreferredTimeSlot !== undefined) payload.preferred_time_slot = form._apiPreferredTimeSlot;
  if (form._apiCareDurationDefault !== undefined) payload.care_duration_default = form._apiCareDurationDefault;
  return payload;
}
