import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

export type Consultation = {
  id: number;
  visit_id: number;
  clinician_staff_id: number;
  status: string; // DRAFT, IN_PROGRESS, FINALIZED, CANCELLED
  subjective_note?: string;
  objective_note?: string;
  assessment_note?: string;
  plan_note?: string;
  consultation_started_at?: string;
  consultation_ended_at?: string;
  created_at: string;
  updated_at: string;
};

export type CreateConsultationPayload = {
  visit_id: number;
  clinician_staff_id: number;
  subjective_note?: string;
  objective_note?: string;
  assessment_note?: string;
  plan_note?: string;
};

export type UpdateConsultationPayload = {
  subjective_note?: string;
  objective_note?: string;
  assessment_note?: string;
  plan_note?: string;
};

export type FinalizeConsultationPayload = {
  next_service_delivery_point_id?: number;
  end_visit?: boolean;
  closing_note?: string;
};

export type ConsultationActionResponse = {
  success: boolean;
  message: string;
  consultation: Consultation;
};

// ---------- Endpoints ----------

export async function listConsultationsForVisit(
  visitId: number,
): Promise<PaginatedResponse<Consultation>> {
  const response = await apiClient.get<PaginatedResponse<Consultation>>(
    `/consultations/visits/${visitId}`,
  );
  return response.data;
}

export async function getConsultation(consultationId: number): Promise<Consultation> {
  const response = await apiClient.get<Consultation>(`/consultations/${consultationId}`);
  return response.data;
}

export async function createConsultation(
  payload: CreateConsultationPayload,
): Promise<ConsultationActionResponse> {
  const response = await apiClient.post<ConsultationActionResponse>(
    "/consultations/",
    payload,
  );
  return response.data;
}

export async function updateConsultation(
  consultationId: number,
  payload: UpdateConsultationPayload,
): Promise<ConsultationActionResponse> {
  const response = await apiClient.put<ConsultationActionResponse>(
    `/consultations/${consultationId}`,
    payload,
  );
  return response.data;
}

export async function finalizeConsultation(
  consultationId: number,
  payload: FinalizeConsultationPayload = {},
): Promise<ConsultationActionResponse> {
  const response = await apiClient.post<ConsultationActionResponse>(
    `/consultations/${consultationId}/finalize`,
    payload,
  );
  return response.data;
}

export async function cancelConsultation(
  consultationId: number,
): Promise<ConsultationActionResponse> {
  const response = await apiClient.post<ConsultationActionResponse>(
    `/consultations/${consultationId}/cancel`,
  );
  return response.data;
}

// ---------- Helpers ----------

/** Status badge styling helper. */
export function isFinalConsultationStatus(status?: string): boolean {
  const s = (status || "").toUpperCase();
  return s === "FINALIZED" || s === "CANCELLED" || s === "COMPLETED";
}
