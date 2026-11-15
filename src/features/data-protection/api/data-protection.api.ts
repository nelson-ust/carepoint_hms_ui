import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type DPDashboard = {
  consents_active: number; consents_withdrawn: number;
  dsr_open: number; dsr_overdue: number; dsr_total: number;
  breaches_open: number; breaches_awaiting_ndpc: number; breaches_overdue_ndpc: number;
  ropa_count: number; dpo_set: boolean; privacy_policy_set: boolean; ndpc_registered: boolean;
};

export type DPSettings = {
  id?: number; dpo_name?: string | null; dpo_email?: string | null; dpo_phone?: string | null;
  privacy_policy_version?: string | null; privacy_policy_url?: string | null; privacy_policy_text?: string | null;
  retention_months?: number | null; breach_notify_hours?: number | null; dsr_response_days?: number | null;
  ndpc_registered?: boolean | null;
};

export type Consent = {
  id: number; patient_id?: number | null; subject_name: string; consent_type: string; status: "GRANTED" | "WITHDRAWN";
  lawful_basis: string; purpose?: string | null; policy_version?: string | null; method?: string | null;
  granted_at?: string | null; withdrawn_at?: string | null; notes?: string | null;
};

export type DSR = {
  id: number; patient_id?: number | null; subject_name: string; subject_contact?: string | null;
  request_type: string; status: "RECEIVED" | "IN_PROGRESS" | "COMPLETED" | "REJECTED";
  received_at?: string | null; due_at?: string | null; details?: string | null;
  resolution_notes?: string | null; completed_at?: string | null; overdue: boolean;
};

export type Breach = {
  id: number; title: string; description?: string | null; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "CONTAINED" | "RESOLVED"; discovered_at?: string | null; notify_due_at?: string | null;
  data_categories?: string | null; subjects_affected?: number | null; ndpc_notified: boolean;
  ndpc_notified_at?: string | null; subjects_notified: boolean; remediation?: string | null; notify_overdue: boolean;
};

export type Ropa = {
  id: number; name: string; purpose?: string | null; lawful_basis: string; data_categories?: string | null;
  data_subjects?: string | null; recipients?: string | null; retention_period?: string | null;
  cross_border: boolean; cross_border_detail?: string | null; owner?: string | null;
};

const data = <T,>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data);

export const dpApi = {
  getDashboard: () => data<DPDashboard>(apiClient.get("/data-protection/dashboard")),
  getSettings: () => data<DPSettings>(apiClient.get("/data-protection/settings")),
  updateSettings: (payload: DPSettings) => data<DPSettings>(apiClient.put("/data-protection/settings", payload)),

  listConsents: (params: { status?: string; consent_type?: string; search?: string } = {}) =>
    apiClient.get<PaginatedResponse<Consent>>("/data-protection/consents", { params }).then((r) => r.data),
  recordConsent: (payload: Record<string, unknown>) => data<Consent>(apiClient.post("/data-protection/consents", payload)),
  withdrawConsent: (id: number) => data<Consent>(apiClient.post(`/data-protection/consents/${id}/withdraw`, {})),

  listDSR: (params: { status?: string; request_type?: string } = {}) =>
    apiClient.get<PaginatedResponse<DSR>>("/data-protection/subject-requests", { params }).then((r) => r.data),
  createDSR: (payload: Record<string, unknown>) => data<DSR>(apiClient.post("/data-protection/subject-requests", payload)),
  updateDSR: (id: number, payload: Record<string, unknown>) => data<DSR>(apiClient.put(`/data-protection/subject-requests/${id}`, payload)),
  exportDSR: (id: number) => data<Record<string, unknown>>(apiClient.get(`/data-protection/subject-requests/${id}/export`)),

  listBreaches: (params: { status?: string } = {}) =>
    apiClient.get<PaginatedResponse<Breach>>("/data-protection/breaches", { params }).then((r) => r.data),
  createBreach: (payload: Record<string, unknown>) => data<Breach>(apiClient.post("/data-protection/breaches", payload)),
  updateBreach: (id: number, payload: Record<string, unknown>) => data<Breach>(apiClient.put(`/data-protection/breaches/${id}`, payload)),
  notifyNdpc: (id: number) => data<Breach>(apiClient.post(`/data-protection/breaches/${id}/notify-ndpc`, {})),

  listRopa: () => apiClient.get<PaginatedResponse<Ropa>>("/data-protection/processing-activities").then((r) => r.data),
  createRopa: (payload: Record<string, unknown>) => data<Ropa>(apiClient.post("/data-protection/processing-activities", payload)),
  updateRopa: (id: number, payload: Record<string, unknown>) => data<Ropa>(apiClient.put(`/data-protection/processing-activities/${id}`, payload)),
  deleteRopa: (id: number) => apiClient.delete(`/data-protection/processing-activities/${id}`).then((r) => r.data),
};
