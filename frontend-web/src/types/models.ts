// Types aligned with backend API schemas

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  rpps: string;
  phone: string;
  cabinet_id: string;
  role: string;
  created_at: string;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  address: string;
  lat: number | null;
  lon: number | null;
  sector_id: string | null;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  pathologies: string[];
  preferred_time_slot: string;
  care_duration_default: number;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PatientCreate {
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  address?: string;
  lat?: number | null;
  lon?: number | null;
  sector_id?: string | null;
  postal_code?: string;
  city?: string;
  phone?: string;
  email?: string;
  pathologies?: string[];
  preferred_time_slot?: string;
  care_duration_default?: number;
  notes?: string;
}

export interface Appointment {
  id: string;
  cabinet_id: string;
  idel_id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  care_type: string;
  location_type: string;
  time_window_start: string | null;
  time_window_end: string | null;
  care_protocol_id: string | null;
  status: string;
  cancellation_reason: string;
  canceled_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentCreate {
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  care_type: string;
  location_type?: string;
  time_window_start?: string | null;
  time_window_end?: string | null;
  care_protocol_id?: string | null;
}

export interface SlotSuggestion {
  rank: number;
  start_time: string;
  end_time: string;
  previous_appointment_id: string | null;
  next_appointment_id: string | null;
  detour_km: number;
  detour_minutes: number;
  same_sector: boolean;
  sector_name: string;
  score: number;
  explanation: string;
}

export interface DaySummary {
  date: string;
  num_appointments: number;
  first_appointment: string | null;
  last_appointment: string | null;
}

export interface SlotSuggestResponse {
  suggestions: SlotSuggestion[];
  day_summary: DaySummary;
}

export interface SlotSuggestRequest {
  patient_id: string;
  care_type: string;
  duration_minutes: number;
  location_type?: string;
  date?: string;
  preferred_slot?: string;
}

export interface SlotBookRequest {
  patient_id: string;
  care_type: string;
  duration_minutes: number;
  location_type?: string;
  start_time: string;
  date: string;
}

export interface TourneeStop {
  stop_order: number;
  appointment_id: string;
  estimated_arrival: string | null;
  distance_from_previous_km: number;
  travel_time_from_previous_min: number;
}

export interface TourneeMetrics {
  total_distance_km: number;
  total_travel_minutes: number;
  total_care_minutes: number;
  longest_leg_km: number;
  num_stops: number;
}

export interface TourneeDetail {
  tournee_id: string | null;
  date: string;
  status: string;
  stops: TourneeStop[];
  metrics: TourneeMetrics;
  inefficiencies: string[];
  map_data: MapData | null;
}

export interface MapStop {
  lat: number;
  lon: number;
  patient_name: string;
  care_type: string;
  time: string;
  sector_name: string;
  sector_color: string;
}

export interface MapData {
  stops: MapStop[];
  center_lat: number;
  center_lon: number;
}

export interface Sector {
  id: string;
  cabinet_id: string;
  name: string;
  postal_codes: string[];
  communes: string[];
  color: string;
  display_order: number;
  created_at: string;
}

export interface SectorCreate {
  name: string;
  postal_codes?: string[];
  communes?: string[];
  color?: string;
  display_order?: number;
}

export interface SectorUpdate {
  name?: string;
  postal_codes?: string[];
  communes?: string[];
  color?: string;
  display_order?: number;
}

export interface CareProtocol {
  id: string;
  patient_id: string;
  cabinet_id: string;
  care_type: string;
  duration_minutes: number;
  recurrence_rule: string;
  start_date: string;
  end_date: string | null;
  preferred_time: string | null;
  preferred_slot: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PatientUpdate extends Partial<PatientCreate> {
  status?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}
