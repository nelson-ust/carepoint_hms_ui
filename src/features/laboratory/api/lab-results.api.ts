import { apiClient } from "@/lib/api/api-client";

// ---------- Status Vocabulary ----------

export const LAB_RESULT_STATUSES = [
  "DRAFT",
  "ENTERED",
  "VERIFIED",
  "RELEASED",
  "CANCELLED",
] as const;

// ---------- Types ----------

export type LabResult = {
  id: number;
  lab_order_item_id: number;
  entered_by_staff_id?: number;
  verified_by_staff_id?: number;
  result_status: string;
  result_value?: string;
  result_text?: string;
  unit_of_measure?: string;
  reference_range?: string;
  interpretation?: string;
  entered_at?: string;
  verified_at?: string;
  released_at?: string;
  created_at: string;
  updated_at: string;
};

// ---------- Payloads ----------

export type EnterLabResultPayload = {
  lab_order_item_id: number;
  entered_by_staff_id: number;
  result_value?: string;
  result_text?: string;
  unit_of_measure?: string;
  reference_range?: string;
  interpretation?: string;
};

export type UpdateLabResultPayload = {
  result_value?: string;
  result_text?: string;
  unit_of_measure?: string;
  reference_range?: string;
  interpretation?: string;
};

export type VerifyLabResultPayload = {
  verified_by_staff_id: number;
  verification_note?: string;
};

export type ReleaseLabResultPayload = {
  release_note?: string;
  notify_clinician?: boolean;
  route_to_service_delivery_point_id?: number;
};

// ---------- Responses ----------

export type LabResultActionResponse = {
  success: boolean;
  message: string;
  result: LabResult;
};

// ---------- Endpoints ----------

export async function getLabResult(resultId: number): Promise<LabResult> {
  const response = await apiClient.get<LabResult>(`/lab/results/${resultId}`);
  return response.data;
}

export async function getLabResultByItem(itemId: number): Promise<LabResult> {
  const response = await apiClient.get<LabResult>(`/lab/results/by-item/${itemId}`);
  return response.data;
}

export async function enterLabResult(
  payload: EnterLabResultPayload,
): Promise<LabResultActionResponse> {
  const response = await apiClient.post<LabResultActionResponse>("/lab/results/", payload);
  return response.data;
}

export async function updateLabResult(
  resultId: number,
  payload: UpdateLabResultPayload,
): Promise<LabResultActionResponse> {
  const response = await apiClient.put<LabResultActionResponse>(
    `/lab/results/${resultId}`,
    payload,
  );
  return response.data;
}

export async function verifyLabResult(
  resultId: number,
  payload: VerifyLabResultPayload,
): Promise<LabResultActionResponse> {
  const response = await apiClient.post<LabResultActionResponse>(
    `/lab/results/${resultId}/verify`,
    payload,
  );
  return response.data;
}

export async function releaseLabResult(
  resultId: number,
  payload: ReleaseLabResultPayload = {},
): Promise<LabResultActionResponse> {
  const response = await apiClient.post<LabResultActionResponse>(
    `/lab/results/${resultId}/release`,
    payload,
  );
  return response.data;
}

export async function cancelLabResult(
  resultId: number,
): Promise<LabResultActionResponse> {
  const response = await apiClient.post<LabResultActionResponse>(
    `/lab/results/${resultId}/cancel`,
  );
  return response.data;
}
