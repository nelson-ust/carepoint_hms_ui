import { apiClient } from "@/lib/api/api-client";

export type VitalSigns = {
  temperature?: number;
  pulse_rate?: number;
  respiratory_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  oxygen_saturation?: number;
  weight?: number;
  height?: number;
  bmi?: number;
};

export async function recordVitals(visitId: number, vitals: VitalSigns) {
  const response = await apiClient.post(`/vital-signs`, {
    visit_id: visitId,
    ...vitals,
  });
  return response.data;
}

export async function recordTriage(visitId: number, triageData: any) {
  const response = await apiClient.post(`/triage`, {
    visit_id: visitId,
    ...triageData,
  });
  return response.data;
}

export async function createConsultation(visitId: number, data: any) {
  const response = await apiClient.post(`/consultations`, {
    visit_id: visitId,
    ...data,
  });
  return response.data;
}


// ============================================================
// Chronic care: problem list, vitals trends, baseline, history
// ============================================================

export type ProblemStatus =
  | "ACTIVE"
  | "CONTROLLED"
  | "IMPROVING"
  | "WORSENING"
  | "RESOLVED";

export type PatientProblem = {
  id: number;
  patient_id: number;
  condition_name: string;
  condition_code?: string | null;
  category?: string | null;
  status: ProblemStatus;
  is_chronic: boolean;
  onset_date?: string | null;
  resolved_date?: string | null;
  severity?: string | null;
  notes?: string | null;
  last_reviewed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProblemUpsert = {
  condition_name: string;
  condition_code?: string | null;
  category?: string | null;
  status?: ProblemStatus;
  is_chronic?: boolean;
  onset_date?: string | null;
  severity?: string | null;
  notes?: string | null;
};

export type TrendPoint = { date: string; value: number };
export type MetricTrend = {
  key: string;
  label: string;
  unit?: string | null;
  points: TrendPoint[];
  first_value?: number | null;
  latest_value?: number | null;
  delta?: number | null;
  assessment: "improving" | "worsening" | "stable" | "insufficient_data" | "trend_only";
  direction?: "up" | "down" | "flat" | null;
};
export type ClinicalTrends = {
  patient_id: number;
  metrics: MetricTrend[];
  improving: number;
  worsening: number;
  stable: number;
};

export async function listPatientProblems(patientId: number, activeOnly = false) {
  const res = await apiClient.get<PatientProblem[]>(`/patients/${patientId}/problems`, {
    params: { active_only: activeOnly },
  });
  return res.data;
}

export async function createPatientProblem(patientId: number, payload: ProblemUpsert) {
  const res = await apiClient.post<PatientProblem>(`/patients/${patientId}/problems`, payload);
  return res.data;
}

export async function updatePatientProblem(
  patientId: number,
  problemId: number,
  payload: Partial<ProblemUpsert> & { resolved_date?: string | null },
) {
  const res = await apiClient.put<PatientProblem>(
    `/patients/${patientId}/problems/${problemId}`,
    payload,
  );
  return res.data;
}

export async function deletePatientProblem(patientId: number, problemId: number) {
  const res = await apiClient.delete(`/patients/${patientId}/problems/${problemId}`);
  return res.data;
}

export async function getClinicalTrends(patientId: number) {
  const res = await apiClient.get<ClinicalTrends>(`/patients/${patientId}/clinical-trends`);
  return res.data;
}

export async function getBaselineProfile(patientId: number) {
  const res = await apiClient.get<any>(`/patients/${patientId}/baseline-profile`);
  return res.data;
}

export async function getMedicalHistory(patientId: number) {
  const res = await apiClient.get<any>(`/patients/${patientId}/medical-history`);
  return res.data;
}

// Clinical template CRUD now lives in ./clinical-templates.api.ts
export { clinicalTemplatesApi } from "./clinical-templates.api";
