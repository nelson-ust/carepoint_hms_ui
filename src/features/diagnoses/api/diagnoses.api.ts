import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type Diagnosis = {
  id: number;
  visit_id: number;
  consultation_id: number;
  diagnosis_code?: string;
  diagnosis_name: string;
  diagnosis_type?: string; // PROVISIONAL, PRIMARY, SECONDARY, DIFFERENTIAL, FINAL, CONFIRMED, RULED_OUT, …
  diagnosis_note?: string;
  created_at: string;
  updated_at: string;
};

export type CreateDiagnosisPayload = {
  visit_id: number;
  consultation_id: number;
  diagnosis_name: string;
  diagnosis_code?: string;
  diagnosis_type?: string;
  diagnosis_note?: string;
};

export type UpdateDiagnosisPayload = {
  diagnosis_name?: string;
  diagnosis_code?: string;
  diagnosis_type?: string;
  diagnosis_note?: string;
};

export type DiagnosisActionResponse = {
  success: boolean;
  message: string;
  diagnosis: Diagnosis;
};

// ---------- Common diagnosis types (for the picker) ----------

export const DIAGNOSIS_TYPES = [
  "PRIMARY",
  "SECONDARY",
  "PROVISIONAL",
  "DIFFERENTIAL",
  "CONFIRMED",
  "FINAL",
  "RULED_OUT",
] as const;

export type DiagnosisType = (typeof DIAGNOSIS_TYPES)[number];

// ---------- Endpoints ----------

export async function listDiagnosesForVisit(
  visitId: number,
): Promise<PaginatedResponse<Diagnosis>> {
  const response = await apiClient.get<PaginatedResponse<Diagnosis>>(
    `/diagnoses/visits/${visitId}`,
  );
  return response.data;
}

export async function getDiagnosis(diagnosisId: number): Promise<Diagnosis> {
  const response = await apiClient.get<Diagnosis>(`/diagnoses/${diagnosisId}`);
  return response.data;
}

export async function createDiagnosis(
  payload: CreateDiagnosisPayload,
): Promise<DiagnosisActionResponse> {
  const response = await apiClient.post<DiagnosisActionResponse>(
    "/diagnoses/",
    payload,
  );
  return response.data;
}

export async function updateDiagnosis(
  diagnosisId: number,
  payload: UpdateDiagnosisPayload,
): Promise<DiagnosisActionResponse> {
  const response = await apiClient.put<DiagnosisActionResponse>(
    `/diagnoses/${diagnosisId}`,
    payload,
  );
  return response.data;
}
