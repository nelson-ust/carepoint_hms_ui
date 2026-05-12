import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type AdherenceProfile = {
  id: number;
  patient_id: number;
  prescription_id: number;
  medication_name: string;
  is_active: boolean;
  created_at: string;
};

export type AdherenceSchedule = {
  id: number;
  profile_id: number;
  time_of_day: string; // HH:mm
  dose_quantity: number;
  is_active: boolean;
};

export type AdherenceDose = {
  id: number;
  schedule_id: number;
  scheduled_at: string;
  taken_at?: string;
  status: "PENDING" | "TAKEN" | "MISSED" | "SKIPPED";
  medication_name: string;
};

export type AdherenceAlert = {
  id: number;
  patient_id: number;
  alert_type: "MISSED_DOSE" | "LOW_ADHERENCE";
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  is_resolved: boolean;
  created_at: string;
};

// ---------- Endpoints ----------

export const adherenceApi = {
  listProfiles: (params: { patient_id?: number } = {}) =>
    apiClient.get<PaginatedResponse<AdherenceProfile>>("/medication-adherence/profiles", { params }).then((res) => res.data),
  
  createProfileFromPrescription: (prescriptionId: number) =>
    apiClient.post<{ success: boolean; message: string; profile: AdherenceProfile }>(`/medication-adherence/profiles/from-prescription/${prescriptionId}`).then((res) => res.data),
  
  listSchedules: (params: { profile_id?: number } = {}) =>
    apiClient.get<PaginatedResponse<AdherenceSchedule>>("/medication-adherence/schedules", { params }).then((res) => res.data),
  
  listDoses: (params: { patient_id?: number; start_date?: string; end_date?: string } = {}) =>
    apiClient.get<PaginatedResponse<AdherenceDose>>("/medication-adherence/doses", { params }).then((res) => res.data),
  
  confirmDose: (doseId: number, payload: { status: string; taken_at?: string }) =>
    apiClient.post<{ success: boolean; message: string; dose: AdherenceDose }>(`/medication-adherence/doses/${doseId}/confirm`, payload).then((res) => res.data),
  
  listAlerts: (params: { severity?: string } = {}) =>
    apiClient.get<PaginatedResponse<AdherenceAlert>>("/medication-adherence/alerts", { params }).then((res) => res.data),
  
  getAdherenceStats: (patientId: number) =>
    apiClient.post<{ success: boolean; adherence_percentage: number }>(`/medication-adherence/adherence/compute`, { patient_id: patientId }).then((res) => res.data),
};
