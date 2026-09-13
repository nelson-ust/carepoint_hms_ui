import axios from "axios";
import { apiClient } from "@/lib/api/api-client";
import { env } from "@/config/env";

export type AccessRequest = {
  id: number;
  request_no: string;
  requester_type: "HOSPITAL" | "DEVELOPER";
  requester_name: string;
  requesting_tenant_id?: number | null;
  holding_tenant_id: number;
  patient_global_id: string;
  patient_display_name?: string | null;
  reason: string;
  scope: string;
  status: "PENDING" | "APPROVED" | "DECLINED" | "EXPIRED" | "CANCELLED" | "FULFILLED";
  requires_patient_approval: boolean;
  requires_hospital_approval: boolean;
  patient_decision: "PENDING" | "APPROVED" | "DECLINED";
  patient_decided_at?: string | null;
  hospital_decision: "PENDING" | "APPROVED" | "DECLINED";
  hospital_decided_at?: string | null;
  decline_reason?: string | null;
  link_expiry_hours: number;
  link_generated_at?: string | null;
  link_expires_at?: string | null;
  link_used_at?: string | null;
  requested_at?: string | null;
  patient_decision_url?: string | null;
};

export type AuditEvent = {
  id: number;
  event: string;
  actor_type: string;
  actor_display?: string | null;
  detail?: string | null;
  ip_address?: string | null;
  occurred_at?: string | null;
};

export type MedicalRecord = {
  meta?: Record<string, any>;
  record?: {
    kind?: string;
    generated_at?: string;
    global_patient_id?: string;
    patient?: Record<string, any>;
    sections?: Record<string, any[]>;
    counts?: Record<string, number>;
  } | null;
};

function errMsg(e: any, fallback: string): string {
  return e?.response?.data?.detail || e?.response?.data?.message || fallback;
}

// Bare client for the public token endpoints (no JWT, no tenant header).
const publicClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { "Content-Type": "application/json" },
});

export const medicalAccessApi = {
  errMsg,

  // ---- Staff (JWT) ----
  submit: (payload: {
    holding_tenant_code: string; patient_global_id: string; reason: string;
    scope?: string; link_expiry_hours?: number;
    requires_patient_approval?: boolean; requires_hospital_approval?: boolean;
  }) => apiClient.post("/medical-access/requests", payload).then((r) => r.data?.request as AccessRequest),

  list: (direction: "incoming" | "outgoing", status?: string) =>
    apiClient.get("/medical-access/requests", { params: { direction, ...(status ? { status } : {}) } })
      .then((r) => (r.data?.items ?? []) as AccessRequest[]),

  detail: (id: number) =>
    apiClient.get(`/medical-access/requests/${id}`).then((r) => r.data?.request as AccessRequest),

  audit: (id: number) =>
    apiClient.get(`/medical-access/requests/${id}/audit`).then((r) => (r.data?.items ?? []) as AuditEvent[]),

  hospitalDecision: (id: number, approve: boolean, reason?: string) =>
    apiClient.post(`/medical-access/requests/${id}/hospital-decision`, { approve, reason })
      .then((r) => r.data?.request as AccessRequest),

  cancel: (id: number) =>
    apiClient.post(`/medical-access/requests/${id}/cancel`, {}).then((r) => r.data?.request as AccessRequest),

  retrieve: (id: number) =>
    apiClient.post(`/medical-access/requests/${id}/retrieve`, {}).then((r) => r.data as MedicalRecord),

  // ---- Public (token) ----
  viewAsPatient: (token: string) =>
    publicClient.get(`/medical-access/public/patient/${token}`).then((r) => r.data?.request as AccessRequest),

  patientDecision: (token: string, approve: boolean, reason?: string) =>
    publicClient.post(`/medical-access/public/patient/${token}/decision`, { approve, reason })
      .then((r) => r.data?.request as AccessRequest),

  consumeLink: (token: string) =>
    publicClient.post(`/medical-access/public/link/${token}`, {}).then((r) => r.data as MedicalRecord),
};
