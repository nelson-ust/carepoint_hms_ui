import { apiClient } from "@/lib/api/api-client";

// ---------- Types (mirroring medication_adherence_routes.py schemas) ----------

export type AdherenceProfile = {
  id: number;
  patient_id: number;
  drug_id?: number | null;
  drug_name_snapshot: string;
  prescription_id?: number | null;
  dosage?: string | null;
  frequency_code?: string | null;
  route?: string | null;
  duration?: string | null;
  instructions?: string | null;
  started_on?: string | null;
  ended_on?: string | null;
  is_active: boolean;
  is_high_risk: boolean;
};

export type AdherenceSchedule = {
  id: number;
  medication_profile_id: number;
  patient_id: number;
  frequency: string;
  custom_times?: string[] | null;
  interval_hours?: number | null;
  start_date: string;
  end_date?: string | null;
  status: string;
};

export type AdherenceDoseStatus = "SCHEDULED" | "TAKEN" | "MISSED" | "SKIPPED" | "DELAYED" | "STOPPED";

export type AdherenceDose = {
  id: number;
  schedule_id: number;
  patient_id: number;
  scheduled_for: string;
  window_minutes: number;
  status: AdherenceDoseStatus;
  taken_at?: string | null;
  confirmation_source?: string | null;
  miss_reason?: string | null;
};

export type AdherenceAlert = {
  id: number;
  patient_id: number;
  schedule_id?: number | null;
  severity: string;
  title: string;
  message?: string | null;
  triggered_at: string;
  is_acknowledged: boolean;
};

export type AdherenceSnapshot = {
  id: number;
  patient_id: number;
  schedule_id?: number | null;
  period_start: string;
  period_end: string;
  doses_scheduled: number;
  doses_taken: number;
  doses_missed: number;
  doses_skipped: number;
  doses_delayed: number;
  /** Serialized Decimal — may arrive as a string. Use Number() before math. */
  adherence_pct: number | string;
  level: string;
};

/** The backend returns bare arrays for these endpoints; normalize to {items}. */
const toList = <T>(data: T[] | { items?: T[] }): { items: T[] } =>
  Array.isArray(data) ? { items: data } : { items: data?.items ?? [] };

// ---------- Endpoints ----------

export const adherenceApi = {
  listProfiles: (params: { patient_id?: number; only_active?: boolean } = {}) =>
    apiClient
      .get<AdherenceProfile[]>("/medication-adherence/profiles", { params })
      .then((res) => toList(res.data)),

  createProfileFromPrescription: (prescriptionId: number) =>
    apiClient
      .post(`/medication-adherence/profiles/from-prescription/${prescriptionId}`)
      .then((res) => res.data),

  listSchedules: (params: { patient_id?: number; profile_id?: number } = {}) =>
    apiClient
      .get<AdherenceSchedule[]>("/medication-adherence/schedules", { params })
      .then((res) => toList(res.data)),

  listDoses: (
    params: { patient_id?: number; schedule_id?: number; from_date?: string; to_date?: string; dose_status?: string } = {},
  ) =>
    apiClient
      .get<AdherenceDose[]>("/medication-adherence/doses", { params })
      .then((res) => toList(res.data)),

  confirmDose: (doseId: number, payload: { status: AdherenceDoseStatus; taken_at?: string; source?: string }) =>
    apiClient
      .post<AdherenceDose>(`/medication-adherence/doses/${doseId}/confirm`, payload)
      .then((res) => res.data),

  listAlerts: (params: { patient_id?: number; only_unacknowledged?: boolean } = {}) =>
    apiClient
      .get<AdherenceAlert[]>("/medication-adherence/alerts", { params })
      .then((res) => toList(res.data)),

  listSnapshots: (params: { patient_id?: number; level?: string } = {}) =>
    apiClient
      .get<AdherenceSnapshot[]>("/medication-adherence/adherence/snapshots", { params })
      .then((res) => toList(res.data)),
};
