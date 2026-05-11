import { apiClient } from "@/lib/api/api-client";
import type { PaginatedResponse } from "@/features/visits/api/visits.api";

// ---------- Types ----------

export type Ward = {
  id: number;
  name: string;
  code: string;
  ward_type?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  /** Optional aggregate fields the backend may include on the list endpoint */
  total_beds?: number;
  available_beds?: number;
  occupied_beds?: number;
  active_admissions?: number;
};

/** Detailed ward response from /wards/{id}/summary */
export type WardSummary = Ward & {
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  total_admissions: number;
  active_admissions: number;
};

export const WARD_TYPES = [
  "GENERAL",
  "PRIVATE",
  "ICU",
  "MATERNITY",
  "PEDIATRIC",
  "SURGICAL",
  "ISOLATION",
  "OTHER",
] as const;

// ---------- Payloads ----------

export type CreateWardPayload = {
  name: string;
  code: string;
  ward_type?: string;
  description?: string;
};

export type UpdateWardPayload = Partial<CreateWardPayload>;

// ---------- Endpoints (Wards) ----------

export async function listWards(
  params: { skip?: number; limit?: number } = {},
): Promise<PaginatedResponse<Ward>> {
  const { skip = 0, limit = 200 } = params;
  const response = await apiClient.get<PaginatedResponse<Ward>>("/wards/", {
    params: { skip, limit },
  });
  return response.data;
}

export async function getWard(wardId: number): Promise<Ward> {
  const response = await apiClient.get<Ward>(`/wards/${wardId}`);
  return response.data;
}

export async function getWardSummary(wardId: number): Promise<WardSummary> {
  const response = await apiClient.get<WardSummary>(`/wards/${wardId}/summary`);
  return response.data;
}

export async function createWard(payload: CreateWardPayload): Promise<Ward> {
  const response = await apiClient.post<Ward>("/wards/", payload);
  return response.data;
}

export async function updateWard(
  wardId: number,
  payload: UpdateWardPayload,
): Promise<Ward> {
  const response = await apiClient.put<Ward>(`/wards/${wardId}`, payload);
  return response.data;
}

export async function deleteWard(
  wardId: number,
): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.delete<{ success: boolean; message: string }>(
    `/wards/${wardId}`,
  );
  return response.data;
}

